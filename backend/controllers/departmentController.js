import Department from "../models/Department.js";
import Course from "../models/Course.js";
import { escapeRegex } from "../utils/regex.js";
import { paginate } from "../utils/pagination.js";

// GET /api/departments?q=&schoolId=  — typeahead used at signup, profile
// editing, and course forms. Scoped to a school when one is known (signup,
// profile, rep course forms); left unscoped for admin course management,
// which spans every school.
export async function searchDepartments(req, res, next) {
  try {
    const { q, schoolId } = req.query;
    const filter = {};
    if (q) filter.name = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i");
    if (schoolId) filter.schoolId = schoolId;
    const departments = await Department.find(filter).limit(15).sort({ verified: -1, name: 1 });
    res.json({ departments });
  } catch (err) { next(err); }
}

// POST /api/departments  — anyone can request a new department; goes in
// unverified and usable immediately, same as requestSchool.
export async function requestDepartment(req, res, next) {
  try {
    const { name, schoolId } = req.body;
    if (!name) return res.status(400).json({ message: "Department name is required." });

    // Cheap duplicate guard: exact case-insensitive name match, scoped to
    // the same school when one was given.
    const dupeFilter = { name: new RegExp(`^${escapeRegex(name.trim())}$`, "i") };
    if (schoolId) dupeFilter.schoolId = schoolId;
    const dupe = await Department.findOne(dupeFilter);
    if (dupe) return res.status(409).json({ message: "That department already exists.", department: dupe });

    const department = await Department.create({ name, schoolId: schoolId || undefined, verified: true });
    res.status(201).json({ department });
  } catch (err) { next(err); }
}

// GET /api/departments/admin?q=&page=&limit=  (admin) — every department,
// verified or not. Unverified first (they need attention), then newest.
export async function listDepartmentsAdmin(req, res, next) {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    const filter = q ? { name: new RegExp(escapeRegex(q), "i") } : {};
    const { items, pagination } = await paginate(Department, filter, req.query, {
      sort: { verified: 1, createdAt: -1 }, defaultLimit: 12, lean: true,
    });
    res.json({ departments: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/departments/:id/verify  (admin) — approve a department someone requested
export async function verifyDepartment(req, res, next) {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, { verified: true }, { new: true });
    if (!department) return res.status(404).json({ message: "Department not found." });
    res.json({ department });
  } catch (err) { next(err); }
}

// PUT /api/departments/:id  (admin) — rename or re-scope a department
export async function updateDepartment(req, res, next) {
  try {
    const { name, schoolId } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (schoolId !== undefined) update.schoolId = schoolId;

    const department = await Department.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!department) return res.status(404).json({ message: "Department not found." });
    res.json({ department });
  } catch (err) { next(err); }
}

// DELETE /api/departments/:id  (admin) — only allowed while nothing references it
export async function deleteDepartment(req, res, next) {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found." });
    const inUse = await Course.exists({
      department: department.name,
      ...(department.schoolId ? { schoolId: department.schoolId } : {}),
    });
    if (inUse) return res.status(409).json({ message: "This department already has courses attached — it can't be deleted." });
    await department.deleteOne();
    res.json({ message: "Department removed." });
  } catch (err) { next(err); }
}
