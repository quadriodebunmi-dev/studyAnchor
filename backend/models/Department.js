import mongoose from "mongoose";

// Departments are scoped to a school (a "Computer Science" at Unilag is a
// different row from "Computer Science" at Unilorin), but schoolId is left
// optional so admin-side tools that manage courses across every school can
// still request/browse departments without picking one school first — same
// escape hatch School.js takes for early rows before multi-tenancy landed.
const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", index: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

departmentSchema.index({ name: "text" });
// Same department name is fine across different schools, just not twice at
// the same one. Rows with no schoolId (global/admin-requested) are exempt —
// the partial filter keeps the unique index from colliding on `undefined`.
departmentSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, partialFilterExpression: { schoolId: { $type: "objectId" } } }
);

export default mongoose.model("Department", departmentSchema);
