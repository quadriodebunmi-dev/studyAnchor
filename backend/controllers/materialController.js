import archiver from "archiver";
import Material from "../models/Material.js";
import Course from "../models/Course.js";
import ActivityLog from "../models/ActivityLog.js";
import Report from "../models/Report.js";
import { extractText, inferFileType } from "../utils/fileParser.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { canViewMaterial, viewableFilter, PUBLIC_MATERIAL_FILTER } from "../utils/materialAccess.js";
import { paginate, paginateArray } from "../utils/pagination.js";
import { extractTopics } from "../utils/feedRanking.js";
import { trackInteraction } from "../utils/interactions.js";
import { findContextCourses } from "../utils/academicContext.js";

const COURSE_FIELDS = "code title department level semester session";
// Extracted file text can be huge and no list or card needs it.
const NO_TEXT = "-extractedText";

const sameSchool = (a, b) => !a || !b || String(a) === String(b);

// POST /api/materials  (student or Course Rep, multipart/form-data with "files")
// Stage 2.1 — multiple files per request, one Material per file.
// Students choose `visibility`:
//   "private" -> just for themselves: no review, only they (and admins) can
//                see it, and it appears on their own dashboard.
//   "class"   -> shared with the class: lands "pending" until a Course Rep
//                approves it (Stage 2.2).
// Course Reps always upload straight to the class (auto-approved).
export async function uploadMaterial(req, res, next) {
  try {
    const { courseId, title, description, visibility: requested } = req.body;
    if (!courseId || !title || !req.files?.length) {
      return res.status(400).json({ message: "courseId, title and at least one file are required." });
    }
    if (requested !== undefined && !["class", "private"].includes(requested)) {
      return res.status(400).json({ message: "visibility must be \"class\" or \"private\"." });
    }
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found." });
    if (!sameSchool(course.schoolId, req.user.schoolId)) {
      return res.status(403).json({ message: "You can only upload to courses at your own school." });
    }

    const isStudent = req.user.role === "student";
    const isPrivate = isStudent && requested === "private";
    const visibility = isPrivate ? "private" : "class";
    const status = isStudent && !isPrivate ? "pending" : "approved";

    const results = await Promise.allSettled(
      req.files.map(async (file) => {
        const fileType = inferFileType(file.originalname, file.mimetype);
        const [extractedText, cloudinaryResult] = await Promise.all([
          extractText(file.buffer, fileType),
          uploadBufferToCloudinary(file.buffer, file.originalname, fileType),
        ]);
        return Material.create({
          courseId,
          uploadedBy: req.user._id,
          schoolId: req.user.schoolId || course.schoolId,
          title: req.files.length > 1 ? `${title} — ${file.originalname}` : title,
          description,
          fileUrl: cloudinaryResult.secure_url,
          fileName: file.originalname,
          fileType,
          size: file.size ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : undefined,
          extractedText,
          // Keywords for the feed's interest matching.
          topics: extractTopics({
            title,
            description,
            courseText: `${course.code} ${course.title}`,
            body: extractedText,
          }),
          status,
          visibility,
        });
      })
    );

    const materials = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failed = results.length - materials.length;
    if (materials.length === 0) {
      return res.status(502).json({ message: "None of the files could be uploaded. Please try again." });
    }

    // Private titles stay out of the admin-visible activity feed.
    const action = isPrivate
      ? `${req.user.name} saved ${materials.length} file(s) privately`
      : `${req.user.name} ${status === "pending" ? "submitted (pending approval)" : "uploaded"} ${materials.length} file(s) to "${title}"`;
    await ActivityLog.create({ action, actor: req.user._id });
    res.status(201).json({ materials, failed, status, visibility });
  } catch (err) { next(err); }
}

// GET /api/materials/:id
export async function getMaterial(req, res, next) {
  try {
    const material = await Material.findById(req.params.id)
      .populate("uploadedBy", "name")
      .populate("courseId", "code title department level");
    if (!material || !canViewMaterial(req.user, material)) return res.status(404).json({ message: "Material not found." });
    trackInteraction(req.user, material, "view");
    res.json({ material });
  } catch (err) { next(err); }
}

// PUT /api/materials/:id  (rep who owns it)
export async function updateMaterial(req, res, next) {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found." });
    if (String(material.uploadedBy) !== String(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own materials." });
    }
    const { title, description } = req.body;
    if (title) material.title = title;
    if (description !== undefined) material.description = description;
    if (title || description !== undefined) {
      const course = await Course.findById(material.courseId).select("code title");
      material.topics = extractTopics({
        title: material.title,
        description: material.description,
        courseText: course ? `${course.code} ${course.title}` : "",
        body: material.extractedText,
      });
    }
    await material.save();
    res.json({ material });
  } catch (err) { next(err); }
}

// DELETE /api/materials/:id (rep who owns it, or admin)
export async function deleteMaterial(req, res, next) {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found." });
    if (String(material.uploadedBy) !== String(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own materials." });
    }
    await material.deleteOne();
    await ActivityLog.create({ action: `${req.user.name} deleted "${material.title}"`, actor: req.user._id });
    res.json({ message: "Material deleted." });
  } catch (err) { next(err); }
}

// POST /api/materials/:id/download  (increments counter, returns file URL)
export async function downloadMaterial(req, res, next) {
  try {
    const existing = await Material.findById(req.params.id);
    if (!existing || !canViewMaterial(req.user, existing)) return res.status(404).json({ message: "Material not found." });
    const material = await Material.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } }, { new: true });
    trackInteraction(req.user, existing, "download");
    res.json({ fileUrl: material.fileUrl, fileName: material.fileName });
  } catch (err) { next(err); }
}

// POST /api/materials/:id/bookmark  (toggle for the logged-in student)
export async function toggleBookmark(req, res, next) {
  try {
    const user = req.user;
    const materialId = req.params.id;
    const already = user.bookmarks.some((id) => String(id) === materialId);
    let material = null;
    if (!already) {
      material = await Material.findById(materialId);
      if (!material || !canViewMaterial(user, material)) return res.status(404).json({ message: "Material not found." });
    }
    if (already) {
      user.bookmarks = user.bookmarks.filter((id) => String(id) !== materialId);
    } else {
      user.bookmarks.push(materialId);
    }
    await user.save();

    // Bookmarks are a feed-ranking signal ("students save this one").
    if (already) {
      await Material.updateOne({ _id: materialId, bookmarkCount: { $gt: 0 } }, { $inc: { bookmarkCount: -1 } });
      trackInteraction(user, { _id: materialId }, "unbookmark");
    } else {
      await Material.updateOne({ _id: materialId }, { $inc: { bookmarkCount: 1 } });
      trackInteraction(user, material, "bookmark");
    }
    res.json({ bookmarked: !already });
  } catch (err) { next(err); }
}

// GET /api/materials/bookmarks/mine?page=&limit=  — newest bookmark first.
export async function myBookmarks(req, res, next) {
  try {
    const ids = (req.user.bookmarks || []).map(String);
    // Only ones this person may still see (a bookmarked upload can later be
    // deleted, rejected or made private).
    const viewable = ids.length
      ? await Material.find({ _id: { $in: ids }, ...viewableFilter(req.user) }).select("_id").lean()
      : [];
    const ok = new Set(viewable.map((m) => String(m._id)));
    const ordered = [...ids].reverse().filter((id) => ok.has(id));

    const { items: pageIds, pagination } = paginateArray(ordered, req.query, { defaultLimit: 12 });
    const docs = pageIds.length
      ? await Material.find({ _id: { $in: pageIds } })
          .select(NO_TEXT).populate("uploadedBy", "name").populate("courseId", COURSE_FIELDS).lean()
      : [];
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    res.json({ materials: pageIds.map((id) => byId.get(id)).filter(Boolean), pagination });
  } catch (err) { next(err); }
}

// GET /api/materials/search?q=&page=&limit=  — approved shared materials + your own private ones.
export async function searchMaterials(req, res, next) {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (!q) return res.json({ materials: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false, hasMore: false } });
    const { items, pagination } = await paginate(Material, {
      $text: { $search: q },
      // Shared, approved materials — plus the caller's own private ones.
      $or: [PUBLIC_MATERIAL_FILTER, { uploadedBy: req.user._id, visibility: "private" }],
    }, req.query, {
      sort: { score: { $meta: "textScore" } },
      select: { extractedText: 0, score: { $meta: "textScore" } },
      populate: [["courseId", COURSE_FIELDS]],
      defaultLimit: 12,
      lean: true,
    });
    res.json({ materials: items, pagination });
  } catch (err) { next(err); }
}

// GET /api/materials/mine?page=&limit=  — the logged-in rep's own uploads.
// `stats` covers ALL of their uploads (not just this page) for the dashboard tiles.
export async function myMaterials(req, res, next) {
  try {
    const filter = { uploadedBy: req.user._id };
    const [{ items, pagination }, statRows] = await Promise.all([
      paginate(Material, filter, req.query, { select: NO_TEXT, populate: [["courseId", `${COURSE_FIELDS}`]], defaultLimit: 12 }),
      Material.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: 1 }, downloads: { $sum: "$downloads" }, quizzes: { $sum: "$quizzesGenerated" } } },
      ]),
    ]);
    const { total = 0, downloads = 0, quizzes = 0 } = statRows[0] || {};
    res.json({ materials: items, pagination, stats: { total, downloads, quizzes } });
  } catch (err) { next(err); }
}

// GET /api/materials/mine/student?page=&limit=  — Stage 2.2: a student's own
// uploads, across every status, for the "My uploads" page.
export async function myUploads(req, res, next) {
  try {
    const { items, pagination } = await paginate(Material, { uploadedBy: req.user._id }, req.query, {
      select: NO_TEXT, populate: [["courseId", COURSE_FIELDS]], defaultLimit: 10,
    });
    res.json({ materials: items, pagination });
  } catch (err) { next(err); }
}

// GET /api/materials/pending?page=&limit=  — Stage 2.2: rep-only, their school's
// pending student uploads awaiting review.
export async function pendingMaterials(req, res, next) {
  try {
    const courseFilter = req.user.schoolId ? { schoolId: req.user.schoolId } : {};
    const courses = await Course.find(courseFilter).select("_id").lean();
    const { items, pagination } = await paginate(
      Material,
      { courseId: { $in: courses.map((c) => c._id) }, status: "pending", visibility: { $ne: "private" } },
      req.query,
      { select: NO_TEXT, populate: [["uploadedBy", "name"], ["courseId", "code title"]], defaultLimit: 10 }
    );
    res.json({ materials: items, pagination });
  } catch (err) { next(err); }
}

// Loads a material for review, refusing private ones and other schools' uploads.
async function loadReviewable(req, res) {
  const material = await Material.findById(req.params.id);
  if (!material || material.visibility === "private") {
    res.status(404).json({ message: "Material not found." });
    return null;
  }
  if (req.user.role === "rep" && !sameSchool(material.schoolId, req.user.schoolId)) {
    res.status(403).json({ message: "That upload belongs to a different school." });
    return null;
  }
  return material;
}

// POST /api/materials/:id/approve  — Stage 2.2
export async function approveMaterial(req, res, next) {
  try {
    const material = await loadReviewable(req, res);
    if (!material) return;
    material.status = "approved";
    material.reviewedBy = req.user._id;
    material.reviewedAt = new Date();
    material.reviewNote = undefined;
    await material.save();
    await ActivityLog.create({ action: `${req.user.name} approved a student upload: "${material.title}"`, actor: req.user._id });
    res.json({ material });
  } catch (err) { next(err); }
}

// POST /api/materials/:id/reject  { reason }  — Stage 2.2
export async function rejectMaterial(req, res, next) {
  try {
    const material = await loadReviewable(req, res);
    if (!material) return;
    material.status = "rejected";
    material.reviewedBy = req.user._id;
    material.reviewedAt = new Date();
    material.reviewNote = req.body.reason;
    await material.save();
    await ActivityLog.create({ action: `${req.user.name} rejected a student upload: "${material.title}"`, actor: req.user._id });
    res.json({ material });
  } catch (err) { next(err); }
}

// POST /api/materials/:id/report  (student flags content)
export async function reportMaterial(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "A reason is required." });
    const target = await Material.findById(req.params.id);
    if (!target || !canViewMaterial(req.user, target)) return res.status(404).json({ message: "Material not found." });
    const report = await Report.create({ materialId: req.params.id, reportedBy: req.user._id, reason });
    res.status(201).json({ report });
  } catch (err) { next(err); }
}

// POST /api/materials/download-all  { ids?: string[], courseId?: string }
// Streams a zip of every requested material's file.
// - `ids` given -> zips exactly those.
// - `courseId` given (no ids) -> Stage 2.4: zips that course's *approved*
//   materials only.
// - neither given -> defaults to the caller's whole dashboard feed
//   (approved materials only), which powers the feed-level "Download all".
export async function downloadAllMaterials(req, res, next) {
  try {
    let { ids, courseId } = req.body;

    if ((!Array.isArray(ids) || ids.length === 0) && courseId) {
      const found = await Material.find({ courseId, ...PUBLIC_MATERIAL_FILTER }).select("_id");
      ids = found.map((m) => String(m._id));
    } else if (!Array.isArray(ids) || ids.length === 0) {
      const courses = await findContextCourses(req.user, "_id", 500);
      const found = await Material.find({ courseId: { $in: courses.map((c) => c._id) }, ...PUBLIC_MATERIAL_FILTER }).select("_id");
      ids = found.map((m) => String(m._id));
    }

    if (ids.length === 0) {
      return res.status(404).json({ message: "No materials found to download." });
    }

    // Whatever ids were sent, only zip what this user is actually allowed to see.
    const requested = await Material.find({ _id: { $in: ids.slice(0, 200) } });
    const materials = requested.filter((m) => canViewMaterial(req.user, m));
    if (materials.length === 0) {
      return res.status(404).json({ message: "No materials found to download." });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="study-anchor-materials.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    const usedNames = new Set();
    const nameFor = (material) => {
      let name = material.fileName || `${material.title}`;
      let candidate = name;
      let i = 1;
      while (usedNames.has(candidate)) {
        const dot = name.lastIndexOf(".");
        candidate = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
        i++;
      }
      usedNames.add(candidate);
      return candidate;
    };

    for (const material of materials) {
      try {
        const fileRes = await fetch(material.fileUrl);
        if (!fileRes.ok) continue; // skip files that fail to fetch rather than aborting the whole zip
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        archive.append(buffer, { name: nameFor(material) });
      } catch {
        // Skip this file and continue zipping the rest.
      }
    }

    await archive.finalize();

    await Material.updateMany({ _id: { $in: materials.map((m) => m._id) } }, { $inc: { downloads: 1 } });
  } catch (err) { next(err); }
}
