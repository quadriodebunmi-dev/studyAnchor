import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Multi-tenancy (Stage 1.3). Left optional here on purpose — the
    // three-deploy migration is: (1) add nullable, (2) run
    // utils/migrateSchool.js to backfill existing rows, (3) flip to
    // `required: true` once every row has a value.
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", index: true },
    password: { type: String }, // optional — Google users have no password
    googleId: { type: String, default: null },

    matricNumber: { type: String, unique: true, sparse: true }, // required for students & reps
    department: { type: String },
    level: { type: Number, enum: [100, 200, 300, 400] },
    semester: { type: String, enum: ["First Semester", "Second Semester"] },
    session: { type: String, trim: true }, // academic session/year registered under, e.g. "2025/2026"

    role: { type: String, enum: ["student", "rep", "admin"], default: "student" },

    // Course Rep specific
    repCourses: { type: String, default: "" }, // free text: courses/levels they represent
    repStatus: { type: String, enum: ["pending", "active", "rejected"], default: undefined },
    // "course" reps manage materials (upload/edit/download); "class" reps
    // manage the course list itself (add/edit courses). Defaults to "course"
    // so existing/seeded reps keep their current material-management access.
    repType: { type: String, enum: ["course", "class"], default: "course" },
    repNote: { type: String },
    rejectionReason: { type: String },

    // Student specific
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Material" }],

    isEmailVerified: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },

    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
