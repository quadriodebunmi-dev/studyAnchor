import User from "../models/User.js";
import Material from "../models/Material.js";
import Course from "../models/Course.js";
import Report from "../models/Report.js";
import ActivityLog from "../models/ActivityLog.js";
import { sendRepDecisionEmail } from "../utils/mailer.js";
import { paginate } from "../utils/pagination.js";
import { escapeRegex } from "../utils/regex.js";

const NO_TEXT = "-extractedText"; // extracted file text is large and never shown in a list

// GET /api/admin/reps/pending?page=&limit=  — oldest application first
export async function listPendingReps(req, res, next) {
  try {
    const { items, pagination } = await paginate(User, { role: "rep", repStatus: "pending" }, req.query, {
      sort: { createdAt: 1 }, select: "-password -passwordResetToken -passwordResetExpires", defaultLimit: 10, lean: true,
    });
    res.json({ reps: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/admin/reps/:id/approve
export async function approveRep(req, res, next) {
  try {
    const rep = await User.findByIdAndUpdate(req.params.id, { repStatus: "active" }, { new: true });
    if (!rep) return res.status(404).json({ message: "Applicant not found." });
    await ActivityLog.create({ action: `Admin approved Course Rep application from ${rep.name}`, actor: req.user._id });
    try {
      await sendRepDecisionEmail(rep.email, rep.name, true);
    } catch (mailErr) {
      console.error("Failed to send rep approval email:", mailErr.message);
    }
    res.json({ message: `${rep.name} approved as Course Rep.`, rep });
  } catch (err) { next(err); }
}

// POST /api/admin/reps/:id/reject  { reason }
export async function rejectRep(req, res, next) {
  try {
    const { reason } = req.body;
    const rep = await User.findByIdAndUpdate(req.params.id, { repStatus: "rejected", rejectionReason: reason || "Not specified" }, { new: true });
    if (!rep) return res.status(404).json({ message: "Applicant not found." });
    await ActivityLog.create({ action: `Admin rejected Course Rep application from ${rep.name}`, actor: req.user._id });
    try {
      await sendRepDecisionEmail(rep.email, rep.name, false, rep.rejectionReason);
    } catch (mailErr) {
      console.error("Failed to send rep rejection email:", mailErr.message);
    }
    res.json({ message: `${rep.name}'s application rejected.`, rep });
  } catch (err) { next(err); }
}

// GET /api/admin/users?search=&page=&limit=
export async function listUsers(req, res, next) {
  try {
    const search = String(req.query.search || "").trim().slice(0, 80);
    const rx = search ? new RegExp(escapeRegex(search), "i") : null;
    const filter = rx ? { $or: [{ name: rx }, { email: rx }, { matricNumber: rx }] } : {};
    const { items, pagination } = await paginate(User, filter, req.query, {
      sort: { createdAt: -1 }, select: "-password -passwordResetToken -passwordResetExpires", defaultLimit: 15, lean: true,
    });
    res.json({ users: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/admin/users/:id/suspend  (toggles suspension)
export async function toggleSuspendUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "admin") return res.status(400).json({ message: "Admins can't be suspended." });
    user.suspended = !user.suspended;
    await user.save();
    await ActivityLog.create({ action: `Admin ${user.suspended ? "suspended" : "reactivated"} ${user.name}`, actor: req.user._id });
    res.json({ user });
  } catch (err) { next(err); }
}

// GET /api/admin/materials/pending?page=&limit=  — every pending student upload, any school
export async function listPendingMaterials(req, res, next) {
  try {
    const { items, pagination } = await paginate(Material, { status: "pending" }, req.query, {
      select: NO_TEXT, populate: [["uploadedBy", "name email"], ["courseId", "code title schoolId"]], defaultLimit: 10, lean: true,
    });
    res.json({ materials: items, pagination });
  } catch (err) { next(err); }
}

// GET /api/admin/materials?page=&limit=
export async function listAllMaterials(req, res, next) {
  try {
    const { items, pagination } = await paginate(Material, {}, req.query, {
      select: NO_TEXT, populate: [["uploadedBy", "name"], ["courseId", "code title"]], defaultLimit: 15, lean: true,
    });
    res.json({ materials: items, pagination });
  } catch (err) { next(err); }
}

// DELETE /api/admin/materials/:id
export async function removeMaterial(req, res, next) {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found." });
    await ActivityLog.create({ action: `Admin removed material "${material.title}"`, actor: req.user._id });
    res.json({ message: "Material removed." });
  } catch (err) { next(err); }
}

// GET /api/admin/reports?status=open|resolved&page=&limit=
export async function listReports(req, res, next) {
  try {
    const filter = ["open", "resolved"].includes(req.query.status) ? { status: req.query.status } : {};
    const { items, pagination } = await paginate(Report, filter, req.query, {
      populate: [["materialId", "title"], ["reportedBy", "name"]], defaultLimit: 15, lean: true,
    });
    res.json({ reports: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/admin/reports/:id/resolve
export async function resolveReport(req, res, next) {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, { status: "resolved" }, { new: true });
    if (!report) return res.status(404).json({ message: "Report not found." });
    await ActivityLog.create({ action: "Admin resolved a content report", actor: req.user._id });
    res.json({ report });
  } catch (err) { next(err); }
}

// GET /api/admin/activity-log?page=&limit=
export async function getActivityLog(req, res, next) {
  try {
    const { items, pagination } = await paginate(ActivityLog, {}, req.query, {
      populate: [["actor", "name"]], defaultLimit: 25, lean: true,
    });
    res.json({ log: items, pagination });
  } catch (err) { next(err); }
}

// GET /api/admin/analytics
// Counts and the downloads-per-course grouping happen in the database — this
// used to load every course and every material into memory just to add them
// up. The department breakdown is only a few dozen rows (one per course), so
// that join happens in JS rather than with $lookup — keeps this portable to
// any Mongo-compatible database, not just ones with the full aggregation
// pipeline, and for a handful of rows it's no slower.
export async function getPlatformAnalytics(req, res, next) {
  try {
    const [totalStudents, activeReps, pendingReps, totalMaterials, totalCourses, downloadsByCourse, courses, top] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "rep", repStatus: "active" }),
      User.countDocuments({ role: "rep", repStatus: "pending" }),
      Material.countDocuments(),
      Course.countDocuments(),
      Material.aggregate([{ $group: { _id: "$courseId", downloads: { $sum: "$downloads" } } }]),
      Course.find().select("department").lean(),
      Material.find().sort({ downloads: -1 }).limit(5).select("title downloads").lean(),
    ]);

    const departmentByCourse = new Map(courses.map((c) => [String(c._id), c.department]));
    const downloadsByDept = {};
    for (const row of downloadsByCourse) {
      const dept = departmentByCourse.get(String(row._id)) || "Unknown";
      downloadsByDept[dept] = (downloadsByDept[dept] || 0) + row.downloads;
    }
    const mostDownloaded = top.map((m) => ({ title: m.title, downloads: m.downloads }));

    res.json({ totalStudents, activeReps, pendingReps, totalMaterials, totalCourses, downloadsByDept, mostDownloaded });
  } catch (err) { next(err); }
}
