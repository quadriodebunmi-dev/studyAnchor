import Course from "../models/Course.js";
import Material from "../models/Material.js";
import ActivityLog from "../models/ActivityLog.js";
import { isValidSession } from "../utils/sessions.js";
import { PUBLIC_MATERIAL_FILTER, canAccessSchool } from "../utils/materialAccess.js";
import { paginate, pageMeta, parsePageParams } from "../utils/pagination.js";
import { isIndependent } from "../utils/learner.js";
import { escapeRegex } from "../utils/regex.js";
import School from "../models/School.js";

const COURSE_EDIT_FIELDS = ["code", "title", "department", "level", "semester", "session", "description"];
const VALID_LEVELS = [100, 200, 300, 400, 500, 600];
const VALID_SEMESTERS = ["First Semester", "Second Semester"];
const sameId = (a, b) => String(a?._id || a || "") === String(b?._id || b || "");

// Reps manage only their own school's courses; admins manage any.
function canManageCourse(user, course) {
  if (user.role === "admin") return true;
  return Boolean(user.schoolId) && sameId(user.schoolId, course.schoolId);
}

// Validates the editable course fields. Returns an error message or null.
function courseFieldError(b, { partial = false } = {}) {
  const has = (k) => b[k] !== undefined;
  if ((!partial || has("code")) && !String(b.code || "").trim()) return "Course code is required.";
  if ((!partial || has("title")) && !String(b.title || "").trim()) return "Course title is required.";
  if ((!partial || has("department")) && !String(b.department || "").trim()) return "Department is required.";
  if ((!partial || has("level")) && !VALID_LEVELS.includes(Number(b.level))) return "Choose a valid level.";
  if ((!partial || has("semester")) && !VALID_SEMESTERS.includes(b.semester)) return "Choose a valid semester.";
  if ((!partial || has("session")) && !isValidSession(b.session)) return "Enter a valid academic session, e.g. 2025/2026.";
  return null;
}

// GET /api/courses?department=&level=&semester=&session=&q=&page=&limit=
export async function listCourses(req, res, next) {
  try {
    const { department, level, semester, session } = req.query;
    const q = String(req.query.q || "").trim().slice(0, 80);
    // Independent learners belong to no school, so they have no course list
    // (an unfiltered query would otherwise return every school's courses).
    if (isIndependent(req.user)) {
      const { page, limit } = parsePageParams(req.query);
      return res.json({ courses: [], pagination: pageMeta({ page, limit, total: 0 }) });
    }
    const filter = {};
    const isAdmin = req.user?.role === "admin";
    if (req.user?.schoolId) filter.schoolId = req.user.schoolId;
    // Admins aren't in a school: they see every school, or one when filtered.
    if (isAdmin && req.query.schoolId && req.query.schoolId !== "All") filter.schoolId = req.query.schoolId;
    if (department && department !== "All") filter.department = department;
    if (level && level !== "All") filter.level = Number(level);
    if (semester && semester !== "All") filter.semester = semester;
    if (session && session !== "All") filter.session = session;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ code: rx }, { title: rx }];
    }
    const { items, pagination } = await paginate(Course, filter, req.query, {
      sort: { session: -1, code: 1 },
      populate: isAdmin ? [["schoolId", "name"]] : [],
      lean: true,
    });
    res.json({ courses: items, pagination });
  } catch (err) { next(err); }
}

// GET /api/courses/:id?sort=date|downloads&page=&limit=
// The course, plus one page of its materials.
export async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ message: "Course not found." });
    // The course listing is browsable across schools (Explore), but its study
    // materials belong to that school: everyone else gets the course card only.
    if (!canAccessSchool(req.user, course.schoolId)) {
      const { page, limit } = parsePageParams(req.query, { defaultLimit: 12 });
      return res.json({ course, materials: [], pagination: pageMeta({ page, limit, total: 0 }), restricted: true });
    }
    // Everyone sees approved, shared materials. Reps of THIS course's school
    // (and admins) also see pending/rejected student uploads awaiting review.
    // Nobody but the uploader sees a private upload here.
    const staffHere =
      req.user.role === "admin" ||
      (req.user.role === "rep" && (!course.schoolId || !req.user.schoolId || String(course.schoolId) === String(req.user.schoolId)));
    const filter = staffHere
      ? { courseId: course._id, $or: [{ visibility: { $ne: "private" } }, { uploadedBy: req.user._id }] }
      : { courseId: course._id, ...PUBLIC_MATERIAL_FILTER };
    const sort = req.query.sort === "downloads" ? { downloads: -1, createdAt: -1 } : { createdAt: -1 };
    const { items, pagination } = await paginate(Material, filter, req.query, {
      sort,
      select: "-extractedText",
      populate: [["uploadedBy", "name"]],
      defaultLimit: 12,
      lean: true,
    });
    res.json({ course, materials: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/courses (admin or rep)
// Reps add to their own school. Admins aren't in a school, so they pick one
// with `schoolId` — a course with no school would be invisible to every student.
export async function createCourse(req, res, next) {
  try {
    const err = courseFieldError(req.body);
    if (err) return res.status(400).json({ message: err });
    const { description } = req.body;
    const code = String(req.body.code).trim().toUpperCase();
    const title = String(req.body.title).trim();
    const department = String(req.body.department).trim();
    const level = Number(req.body.level);
    const { semester, session } = req.body;

    let schoolId = req.user.schoolId;
    if (req.user.role === "admin") {
      if (!req.body.schoolId) return res.status(400).json({ message: "Choose the school this course belongs to." });
      const school = await School.findById(req.body.schoolId).select("_id").lean();
      if (!school) return res.status(400).json({ message: "That school doesn't exist." });
      schoolId = school._id;
    } else if (!schoolId) {
      return res.status(400).json({ message: "Join a school before adding courses." });
    }

    const exists = await Course.findOne({ code, session, schoolId });
    if (exists) return res.status(409).json({ message: `${code} already exists for the ${session} session.` });

    const course = await Course.create({ code, title, department, level, semester, session, description: String(description || "").trim(), schoolId });
    await ActivityLog.create({ action: `${req.user.name} added course ${code} (${session})`, actor: req.user._id });
    res.status(201).json({ course });
  } catch (err) { next(err); }
}

// PUT /api/courses/:id (admin, or a rep of the same school)
// Only the editable fields are applied — never the school or other internals.
export async function updateCourse(req, res, next) {
  try {
    const existing = await Course.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Course not found." });
    if (!canManageCourse(req.user, existing)) return res.status(403).json({ message: "You can only edit courses at your own school." });

    const update = {};
    for (const k of COURSE_EDIT_FIELDS) if (req.body[k] !== undefined) update[k] = req.body[k];
    const err = courseFieldError(update, { partial: true });
    if (err) return res.status(400).json({ message: err });
    if (update.code !== undefined) update.code = String(update.code).trim().toUpperCase();
    if (update.title !== undefined) update.title = String(update.title).trim();
    if (update.department !== undefined) update.department = String(update.department).trim();
    if (update.level !== undefined) update.level = Number(update.level);
    if (update.description !== undefined) update.description = String(update.description || "").trim();

    const code = update.code ?? existing.code;
    const session = update.session ?? existing.session;
    const clash = await Course.findOne({ code, session, schoolId: existing.schoolId, _id: { $ne: existing._id } });
    if (clash) return res.status(409).json({ message: `${code} already exists for the ${session} session.` });

    const course = await Course.findByIdAndUpdate(existing._id, update, { new: true, runValidators: true });
    await ActivityLog.create({ action: `${req.user.name} updated course ${course.code}`, actor: req.user._id });
    res.json({ course });
  } catch (err) { next(err); }
}

// DELETE /api/courses/:id (admin, or a rep of the same school)
// A course that still has materials can't be removed — that would orphan them.
export async function deleteCourse(req, res, next) {
  try {
    const existing = await Course.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Course not found." });
    if (!canManageCourse(req.user, existing)) return res.status(403).json({ message: "You can only delete courses at your own school." });

    const materials = await Material.countDocuments({ courseId: existing._id });
    if (materials > 0) {
      return res.status(409).json({ message: `${existing.code} still has ${materials} material${materials === 1 ? "" : "s"}. Delete or move them first.` });
    }
    await existing.deleteOne();
    await ActivityLog.create({ action: `${req.user.name} removed course ${existing.code}`, actor: req.user._id });
    res.json({ message: "Course removed." });
  } catch (err) { next(err); }
}
