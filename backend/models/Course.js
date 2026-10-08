import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true }, // e.g. CSC101
    // Multi-tenancy (Stage 1.3) — see the migration note in models/User.js.
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", index: true },
    title: { type: String, required: true },
    department: { type: String, required: true },
    level: { type: Number, required: true, enum: [100, 200, 300, 400] },
    semester: { type: String, required: true, enum: ["First Semester", "Second Semester"] },
    session: { type: String, required: true, trim: true }, // academic session/year, e.g. "2025/2026"
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

// A course code is unique per academic session PER SCHOOL (the same code
// can be re-offered every session, and two different schools can each have
// their own CSC 101 without colliding).
courseSchema.index({ code: 1, session: 1, schoolId: 1 }, { unique: true });

export default mongoose.model("Course", courseSchema);
