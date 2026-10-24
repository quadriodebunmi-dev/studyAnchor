import mongoose from "mongoose";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import School from "../models/School.js";
import User from "../models/User.js";
import { escapeRegex } from "../utils/regex.js";
import { paginate } from "../utils/pagination.js";
import { parseDepartmentInput, findDuplicateDepartment, departmentLabel } from "../utils/dedupe.js";

// Departments are compared within one school (or among the school-less ones).
// `{ schoolId: null }` matches rows where the field is null or missing.
const sameScopeFilter = (schoolId) => ({ schoolId: schoolId || null });
const departmentsInScope = (schoolId) => Department.find(sameScopeFilter(schoolId), "name shortName schoolId").limit(5000).lean();

const duplicateDepartmentMessage = (dupe, schoolId) =>
  `${departmentLabel(dupe)} already exists${schoolId ? " at this school" : ""} — pick it from the list instead of adding it again.`;

// Returns an error message, or null when `schoolId` is empty or points at a real school.
async function checkSchoolId(schoolId) {
  if (!schoolId) return null;
  if (!mongoose.isValidObjectId(schoolId)) return "Select a valid school.";
  if (!(await School.exists({ _id: schoolId }))) return "Select a valid school.";
  return null;
}

// GET /api/departments?q=&schoolId=  — typeahead used at signup, profile
// editing, and course forms. Scoped to a school when one is known (signup,
// profile, rep course forms); left unscoped for admin course management,
// which spans every school.
export async function searchDepartments(req, res, next) {
  try {
    const { q, schoolId } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i");
      filter.$or = [{ name: rx }, { shortName: rx }];
    }
    if (schoolId) {
      if (!mongoose.isValidObjectId(schoolId)) return res.json({ departments: [] });
      filter.schoolId = schoolId;
    }
    const departments = await Department.find(filter).limit(15).sort({ verified: -1, name: 1 });
    res.json({ departments });
  } catch (err) { next(err); }
}

// POST /api/departments  { name, shortName?, schoolId? }
// Anyone can request a new department; it's usable immediately, same as
// requestSchool. The same department can't be added twice at one school —
// "Medical Laboratory Science", "Medical Laboratory Science (MLS)" and "MLS"
// all count as one.
export async function requestDepartment(req, res, next) {
  try {
    const { name, shortName } = parseDepartmentInput(req.body.name, req.body.shortName);
    const schoolId = req.body.schoolId || undefined;
    if (!name) return res.status(400).json({ message: "Department name is required." });

    const schoolError = await checkSchoolId(schoolId);
    if (schoolError) return res.status(400).json({ message: schoolError });

    const dupe = findDuplicateDepartment(await departmentsInScope(schoolId), { name, shortName });
    if (dupe) return res.status(409).json({ message: duplicateDepartmentMessage(dupe, schoolId), department: dupe });

    const department = await Department.create({ name, shortName: shortName || undefined, schoolId, verified: true });
    res.status(201).json({ department });
  } catch (err) { next(err); }
}

// GET /api/departments/admin?q=&schoolId=&page=&limit=  (admin) — every
// department, verified or not, with its school's name. Unverified first (they
// need attention), then newest.
export async function listDepartmentsAdmin(req, res, next) {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    const filter = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { shortName: rx }];
    }
    if (req.query.schoolId && mongoose.isValidObjectId(req.query.schoolId)) filter.schoolId = req.query.schoolId;
    const { items, pagination } = await paginate(Department, filter, req.query, {
      sort: { verified: 1, createdAt: -1 }, defaultLimit: 12, lean: true,
      populate: [["schoolId", "name city"]],
    });
    res.json({ departments: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/departments/:id/verify  (admin) — approve a department someone requested
export async function verifyDepartment(req, res, next) {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, { verified: true }, { new: true }).populate("schoolId", "name city");
    if (!department) return res.status(404).json({ message: "Department not found." });
    res.json({ department });
  } catch (err) { next(err); }
}

// PUT /api/departments/:id  (admin) — rename, change the short name, or move to another school.
// Renaming also renames it on that school's courses and users, which store the name as text.
export async function updateDepartment(req, res, next) {
  try {
    const current = await Department.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Department not found." });

    const body = req.body || {};
    const parsed = parseDepartmentInput(
      body.name !== undefined ? body.name : current.name,
      body.shortName !== undefined ? body.shortName : current.shortName
    );
    // "" clears the school; undefined leaves it alone.
    const schoolId = body.schoolId === undefined ? current.schoolId : (body.schoolId || undefined);

    if (!parsed.name) return res.status(400).json({ message: "Department name is required." });
    const schoolError = await checkSchoolId(schoolId);
    if (schoolError) return res.status(400).json({ message: schoolError });

    const dupe = findDuplicateDepartment(await departmentsInScope(schoolId), parsed, current._id);
    if (dupe) return res.status(409).json({ message: duplicateDepartmentMessage(dupe, schoolId), department: dupe });

    const oldName = current.name;
    const oldSchoolId = current.schoolId;
    current.name = parsed.name;
    current.shortName = parsed.shortName || undefined;
    current.schoolId = schoolId;
    if (typeof body.verified === "boolean") current.verified = body.verified;
    await current.save();

    // Courses and users reference the department by its name, so keep them attached.
    if (oldName !== current.name && String(oldSchoolId || "") === String(current.schoolId || "")) {
      const scope = oldSchoolId ? { schoolId: oldSchoolId } : {};
      await Promise.all([
        Course.updateMany({ department: oldName, ...scope }, { $set: { department: current.name } }),
        User.updateMany({ department: oldName, ...scope }, { $set: { department: current.name } }),
      ]);
    }

    await current.populate("schoolId", "name city");
    res.json({ department: current });
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
