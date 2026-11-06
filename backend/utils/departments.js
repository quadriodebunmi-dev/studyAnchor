import Department from "../models/Department.js";
import { escapeRegex } from "./regex.js";

export const DEPARTMENT_NOT_FOUND_MESSAGE =
  "Pick your department from the list, or add it first.";

// Looks a department up inside one school, matching its name (or its short
// name, e.g. "MLS") case-insensitively. Returns the stored department, or
// null when there isn't one. Callers save `dept.name` so the stored text is
// always the canonical spelling rather than whatever was typed.
export async function resolveDepartment(schoolId, name) {
  const term = String(name || "").trim().slice(0, 120);
  if (!schoolId || !term) return null;
  const rx = new RegExp(`^${escapeRegex(term)}$`, "i");
  return Department.findOne({ schoolId, $or: [{ name: rx }, { shortName: rx }] }).lean();
}
