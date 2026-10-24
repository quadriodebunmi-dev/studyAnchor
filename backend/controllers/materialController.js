import archiver from "archiver";
import Material from "../models/Material.js";
import Course from "../models/Course.js";
import ActivityLog from "../models/ActivityLog.js";
import Report from "../models/Report.js";
import { extractText, inferFileType } from "../utils/fileParser.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { canViewMaterial, viewableFilter, PUBLIC_MATERIAL_FILTER, publicFilterFor, canAccessSchool } from "../utils/materialAccess.js";
import { isIndependent } from "../utils/learner.js";
import { notifyNewMaterial } from "../utils/materialNotify.js";
import { notifyUser } from "../utils/notify.js";
import { validateUploadedFile, SCHOOL_EXTENSIONS, PERSONAL_EXTENSIONS } from "../utils/uploadValidation.js";
import { escapeRegex } from "../utils/regex.js";
import { paginate, paginateArray } from "../utils/pagination.js";
import { extractTopics } from "../utils/feedRanking.js";
import { trackInteraction } from "../utils/interactions.js";
import { findContextCourses, contextCourseFilter } from "../utils/academicContext.js";

const COURSE_FIELDS = "code title department level semester session";
// Extracted file text can be huge and no list or card needs it.
const NO_TEXT = "-extractedText";

const sameSchool = (a, b) => !a || !b || String(a) === String(b);

// Folder + tags for personal organisation. Always trimmed and bounded.
const cleanFolder = (v) => String(v ?? "").trim().slice(0, 60);
const cleanTags = (v) => {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return [...new Set(arr.map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);
};

// An upload's title is always its file name (without the extension), so
// "Chapter 3 - Cell Biology.pdf" is listed as "Chapter 3 - Cell Biology".
// It can still be renamed afterwards through PUT /api/materials/:id.
const titleFromFileName = (fileName) => {
  const name = String(fileName || "").trim();
  const withoutExt = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim();
  return (withoutExt || name || "Untitled").slice(0, 200);
};

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
    const { courseId, description, visibility: requested } = req.body;
    if (!req.files?.length) {
      return res.status(400).json({ message: "Choose at least one file to upload." });
    }
    if (requested !== undefined && !["class", "private"].includes(requested)) {
      return res.status(400).json({ message: "visibility must be \"class\" or \"private\"." });
    }

    // Personal material: no course. Independent learners can ONLY upload this way;
    // school students may also keep course-less private notes. Always private.
    const independent = isIndependent(req.user);
    const personal = independent || !courseId;
    if (independent && courseId) {
      return res.status(403).json({ message: "Independent learners keep a private library — join a school to upload to its courses." });
    }
    if (personal && req.user.role !== "student") {
      return res.status(400).json({ message: "courseId is required." });
    }
    if (personal && requested === "class") {
      return res.status(400).json({ message: "Personal materials stay private. Choose a course to share with a class." });
    }

    // Check every file's extension AND real bytes before anything is stored.
    const allowed = independent ? PERSONAL_EXTENSIONS : SCHOOL_EXTENSIONS;
    for (const file of req.files) {
      const check = validateUploadedFile(file, allowed);
      if (!check.ok) return res.status(400).json({ message: check.message });
    }

    let course = null;
    if (!personal) {
      course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ message: "Course not found." });
      if (!sameSchool(course.schoolId, req.user.schoolId)) {
        return res.status(403).json({ message: "You can only upload to courses at your own school." });
      }
    }

    const isStudent = req.user.role === "student";
    const isPrivate = personal || (isStudent && requested === "private");
    const visibility = isPrivate ? "private" : "class";
    const status = isStudent && !isPrivate ? "pending" : "approved";
    const folder = cleanFolder(req.body.folder);
    const tags = cleanTags(req.body.tags);

    const results = await Promise.allSettled(
      req.files.map(async (file) => {
        const fileType = inferFileType(file.originalname, file.mimetype);
        const [extractedText, cloudinaryResult] = await Promise.all([
          extractText(file.buffer, fileType),
          uploadBufferToCloudinary(file.buffer, file.originalname, fileType),
        ]);
        const title = titleFromFileName(file.originalname);
        return Material.create({
          courseId: course?._id,
          uploadedBy: req.user._id,
          schoolId: req.user.schoolId || course?.schoolId,
          folder,
          tags,
          title,
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
            courseText: course ? `${course.code} ${course.title}` : "",
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
      : `${req.user.name} ${status === "pending" ? "submitted (pending approval)" : "uploaded"} ${materials.length} file(s)${course ? ` to ${course.code}` : ""}`;
    await ActivityLog.create({ action, actor: req.user._id });
    // Rep/admin uploads are approved on the spot — tell the students of that course.
    if (status === "approved" && visibility === "class") materials.forEach((m) => notifyNewMaterial(m));
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
    if (req.body.folder !== undefined) material.folder = cleanFolder(req.body.folder);
    if (req.body.tags !== undefined) material.tags = cleanTags(req.body.tags);
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
      $or: [publicFilterFor(req.user), { uploadedBy: req.user._id, visibility: "private" }],
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
    const filter = { uploadedBy: req.user._id };
    if (req.query.folder !== undefined && req.query.folder !== "") {
      filter.folder = req.query.folder === "__none__" ? "" : cleanFolder(req.query.folder);
    }
    const q = String(req.query.q || "").trim().slice(0, 80);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ title: rx }, { description: rx }, { fileName: rx }, { tags: rx }];
    }
    const { items, pagination } = await paginate(Material, filter, req.query, {
      select: NO_TEXT, populate: [["courseId", COURSE_FIELDS]], defaultLimit: 10,
    });
    res.json({ materials: items, pagination });
  } catch (err) { next(err); }
}

// GET /api/materials/folders — the caller's folders with counts (for the library sidebar).
export async function myFolders(req, res, next) {
  try {
    const rows = await Material.aggregate([
      { $match: { uploadedBy: req.user._id } },
      { $group: { _id: "$folder", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ folders: rows.map((r) => ({ name: r._id || "", count: r.count })) });
  } catch (err) { next(err); }
}

// GET /api/materials/pickable?q=&scope=all|mine&page=&limit=
// What the study tools (flashcards, mock exams, room-quiz generator) let you
// choose from. `scope` decides how wide the search is:
//   all  (default) — your own library AND every approved material you may see in
//                    study-anchor (your school's shared materials).
//   mine           — your own library AND approved materials from the courses of
//                    your current department, level, semester and session.
// Independent learners only ever have their library, whatever the scope.
// Every row is something canViewMaterial() would allow, so the tools' own access
// checks still pass. Each row says where it came from (`source`: library | school).
export async function pickableMaterials(req, res, next) {
  try {
    const user = req.user;
    const scope = req.query.scope === "mine" ? "mine" : "all";
    const branches = [{ uploadedBy: user._id }];
    const schoolMember = !isIndependent(user) && user.role !== "admin";
    if (schoolMember) {
      if (scope === "mine") {
        const ctxCourses = await Course.find(contextCourseFilter(user)).select("_id").limit(500).lean();
        if (ctxCourses.length) {
          branches.push({ $and: [publicFilterFor(user), { courseId: { $in: ctxCourses.map((c) => c._id) } }] });
        }
      } else {
        branches.push(publicFilterFor(user));
      }
    }

    const filter = { $or: branches };
    const q = String(req.query.q || "").trim().slice(0, 80);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const textMatch = [{ title: rx }, { fileName: rx }, { tags: rx }];
      if (schoolMember) {
        const codes = await Course.find({ code: rx, ...(user.schoolId ? { schoolId: user.schoolId } : {}) }).select("_id").limit(50).lean();
        if (codes.length) textMatch.push({ courseId: { $in: codes.map((c) => c._id) } });
      }
      filter.$and = [{ $or: textMatch }];
    }

    const { items, pagination } = await paginate(Material, filter, req.query, {
      select: NO_TEXT, populate: [["courseId", COURSE_FIELDS]], defaultLimit: 8, maxLimit: 30, lean: true,
    });
    const mine = String(user._id);
    const materials = items.map((m) => ({ ...m, source: String(m.uploadedBy) === mine ? "library" : "school" }));
    res.json({ materials, pagination, scope });
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
    notifyUser(material.uploadedBy, { category: "materials", type: "upload_approved", title: "Your upload was approved", body: material.title, link: `/material/${material._id}`, dedupeKey: `material:${material._id}:approved` });
    notifyNewMaterial(material);
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
