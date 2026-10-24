import { ENV } from "../config/env.js";

// One place that decides who may see a material, so "private" and "pending"
// uploads — and other schools' uploads — can't leak through any individual
// endpoint.
//
//  - private  : only the uploader (and admins, for moderation)
//  - school isolation: a shared material belongs to the school it was uploaded
//    for. Only members of THAT school see it (unless ALLOW_CROSS_SCHOOL_MATERIALS
//    is switched on). Materials with no schoolId predate multi-tenancy and
//    stay visible, exactly as before.
//  - pending / rejected (shared with class): uploader, active Reps of the
//    SAME school (the approval queue), and admins
//  - approved (shared with class): everyone in the same school

const idOf = (v) => String(v?._id || v || "");

// Mongo filter for "materials any student may see". `$ne` (not `=== "class"`)
// so older documents that predate the `visibility` field still match.
// NOTE: this is only the status/visibility half. Combine with
// schoolScopeFilter(user) / publicFilterFor(user) for the school half.
export const PUBLIC_MATERIAL_FILTER = { status: "approved", visibility: { $ne: "private" } };

/** May `user` see content that belongs to `schoolId`? (pure) */
export function canAccessSchool(user, schoolId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!schoolId) return true; // legacy / untagged row
  if (ENV.crossSchoolMaterials) return true;
  return Boolean(user.schoolId) && idOf(user.schoolId) === idOf(schoolId);
}

/** Mongo fragment restricting a query to the user's own school (plus untagged legacy rows). */
export function schoolScopeFilter(user) {
  if (user?.role === "admin" || ENV.crossSchoolMaterials) return {};
  return user?.schoolId ? { $or: [{ schoolId: user.schoolId }, { schoolId: null }] } : { schoolId: null };
}

/** Shared + approved materials this user may see (status/visibility AND school). */
export function publicFilterFor(user) {
  const scope = schoolScopeFilter(user);
  return Object.keys(scope).length ? { $and: [PUBLIC_MATERIAL_FILTER, scope] } : { ...PUBLIC_MATERIAL_FILTER };
}

export function canViewMaterial(user, material) {
  if (!user || !material) return false;
  if (user.role === "admin") return true;
  if (idOf(material.uploadedBy) === idOf(user._id)) return true;
  if (material.visibility === "private") return false;
  if (!canAccessSchool(user, material.schoolId)) return false;
  if (material.status === "approved") return true;
  if (user.role === "rep" && user.repStatus === "active") {
    return !material.schoolId || !user.schoolId || idOf(material.schoolId) === idOf(user.schoolId);
  }
  return false;
}

// The Mongo equivalent of canViewMaterial(), for queries that need to filter in
// the database (pagination) instead of loading everything and filtering in JS.
// Keep the two in sync.
export function viewableFilter(user) {
  if (user.role === "admin") return {};
  const branches = [{ uploadedBy: user._id }, publicFilterFor(user)];
  if (user.role === "rep" && user.repStatus === "active") {
    branches.push(
      user.schoolId
        ? { visibility: { $ne: "private" }, $or: [{ schoolId: user.schoolId }, { schoolId: null }] }
        : { visibility: { $ne: "private" } }
    );
  }
  return { $or: branches };
}
