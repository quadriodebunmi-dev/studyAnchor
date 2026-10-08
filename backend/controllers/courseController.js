import Course from "../models/Course.js";
import Material from "../models/Material.js";
import ActivityLog from "../models/ActivityLog.js";
import { isValidSession } from "../utils/sessions.js";
import { PUBLIC_MATERIAL_FILTER } from "../utils/materialAccess.js";
import { paginate } from "../utils/pagination.js";
import { escapeRegex } from "../utils/regex.js";

// GET /api/courses?department=&level=&semester=&session=&q=&page=&limit=
export async function listCourses(req, res, next) {
  try {
    const { department, level, semester, session } = req.query;
    const q = String(req.query.q || "").trim().slice(0, 80);
    const filter = {};
    if (req.user?.schoolId) filter.schoolId = req.user.schoolId;
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
export async function createCourse(req, res, next) {
  try {
    const { code, title, department, level, semester, session, description } = req.body;
    if (!code || !title || !department || !level || !semester || !session) {
      return res.status(400).json({ message: "code, title, department, level, semester and session are required." });
    }
    if (!isValidSession(session)) return res.status(400).json({ message: "Enter a valid academic session, e.g. 2025/2026." });

    const schoolId = req.user.schoolId;
    const exists = await Course.findOne({ code: code.toUpperCase().trim(), session, schoolId });
    if (exists) return res.status(409).json({ message: `${code.toUpperCase()} already exists for the ${session} session.` });

    const course = await Course.create({ code, title, department, level, semester, session, description, schoolId });
    await ActivityLog.create({ action: `${req.user.name} added course ${code} (${session})`, actor: req.user._id });
    res.status(201).json({ course });
  } catch (err) { next(err); }
}

// PUT /api/courses/:id (admin)
export async function updateCourse(req, res, next) {
  try {
    if (req.body.session && !isValidSession(req.body.session)) {
      return res.status(400).json({ message: "Enter a valid academic session, e.g. 2025/2026." });
    }
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ message: "Course not found." });
    await ActivityLog.create({ action: `${req.user.name} updated course ${course.code}`, actor: req.user._id });
    res.json({ course });
  } catch (err) { next(err); }
}

// DELETE /api/courses/:id (admin)
export async function deleteCourse(req, res, next) {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found." });
    await ActivityLog.create({ action: `${req.user.name} removed course ${course.code}`, actor: req.user._id });
    res.json({ message: "Course removed." });
  } catch (err) { next(err); }
}
