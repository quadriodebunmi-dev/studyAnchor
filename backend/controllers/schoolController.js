import School from "../models/School.js";
import Course from "../models/Course.js";
import { escapeRegex } from "../utils/regex.js";
import { paginate } from "../utils/pagination.js";


// GET /api/schools?q=  — typeahead for signup
export async function searchSchools(req, res, next) {
  try {
    const { q } = req.query;
    // Substring match so typing "Len" finds "Lens University" (a $text search
    // only matches whole words, which is useless for a typeahead).
    const filter = q ? { name: new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i") } : {};
    const schools = await School.find(filter).limit(15);
    res.json({ schools });
  } catch (err) { next(err); }
}

// POST /api/schools  — anyone can request a new school; goes in unverified
export async function requestSchool(req, res, next) {
  try {
    const { name, domain, city } = req.body;
    if (!name) return res.status(400).json({ message: "School name is required." });

    // Cheap duplicate guard: exact case-insensitive name or domain match.
    const dupe = await School.findOne({
      $or: [{ name: new RegExp(`^${escapeRegex(name.trim())}$`, "i") }, ...(domain ? [{ domain: domain.toLowerCase() }] : [])],
    });
    if (dupe) return res.status(409).json({ message: "A school with that name or domain already exists.", school: dupe });

    const school = await School.create({ name, domain, city, verified: false });
    res.status(201).json({ school });
  } catch (err) { next(err); }
}

// GET /api/schools/admin?q=&page=&limit=  (admin) — every school, verified or not.
// Unverified first (they need attention), then newest.
export async function listSchoolsAdmin(req, res, next) {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    const filter = q ? { name: new RegExp(escapeRegex(q), "i") } : {};
    const { items, pagination } = await paginate(School, filter, req.query, {
      sort: { verified: 1, createdAt: -1 }, defaultLimit: 12, lean: true,
    });
    res.json({ schools: items, pagination });
  } catch (err) { next(err); }
}

// POST /api/schools/:id/verify  (admin) — approve a school a visitor requested
export async function verifySchool(req, res, next) {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, { verified: true }, { new: true });
    if (!school) return res.status(404).json({ message: "School not found." });
    res.json({ school });
  } catch (err) { next(err); }
}

// PUT /api/schools/:id  (admin) — edit a school's structure (org-unit label,
// term structure, level scheme)
export async function updateSchool(req, res, next) {
  try {
    const { name, domain, city, orgUnitLabel, termStructure, levels } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (domain !== undefined) update.domain = domain;
    if (city !== undefined) update.city = city;
    if (orgUnitLabel !== undefined) update.orgUnitLabel = orgUnitLabel;
    if (termStructure !== undefined) update.termStructure = termStructure;
    if (levels !== undefined) update.levels = levels;

    const school = await School.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ message: "School not found." });
    res.json({ school });
  } catch (err) { next(err); }
}

// DELETE /api/schools/:id  (admin) — only allowed while nothing references it
export async function deleteSchool(req, res, next) {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ message: "School not found." });
    const inUse = await Course.exists({ schoolId: school._id });
    if (inUse) return res.status(409).json({ message: "This school already has courses attached — it can't be deleted." });
    await school.deleteOne();
    res.json({ message: "School removed." });
  } catch (err) { next(err); }
}

// GET /api/schools/:id/structure
// Returns the level scheme + org-unit label for the school, plus the
// distinct department strings already in use there (self-forming from
// whatever reps at that school have actually created — no separate
// Department CRUD needed).
export async function getSchoolStructure(req, res, next) {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ message: "School not found." });
    const departments = await Course.distinct("department", { schoolId: school._id });
    res.json({
      orgUnitLabel: school.orgUnitLabel,
      termStructure: school.termStructure,
      levels: school.levels,
      departments,
    });
  } catch (err) { next(err); }
}
