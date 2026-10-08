// One place that decides who may see a material, so "private" and "pending"
// uploads can't leak through any individual endpoint.
//
//  - private  : only the uploader (and admins, for moderation)
//  - pending / rejected (shared with class): uploader, active Reps of the
//    SAME school (the approval queue), and admins
//  - approved (shared with class): everyone signed in

const idOf = (v) => String(v?._id || v || "");

// Mongo filter for "materials any student may see". `$ne` (not `=== "class"`)
// so older documents that predate the `visibility` field still match.
export const PUBLIC_MATERIAL_FILTER = { status: "approved", visibility: { $ne: "private" } };

export function canViewMaterial(user, material) {
  if (!user || !material) return false;
  if (user.role === "admin") return true;
  if (idOf(material.uploadedBy) === idOf(user._id)) return true;
  if (material.visibility === "private") return false;
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
  const branches = [{ uploadedBy: user._id }, PUBLIC_MATERIAL_FILTER];
  if (user.role === "rep" && user.repStatus === "active") {
    branches.push(
      user.schoolId
        ? { visibility: { $ne: "private" }, $or: [{ schoolId: user.schoolId }, { schoolId: null }] }
        : { visibility: { $ne: "private" } }
    );
  }
  return { $or: branches };
}
