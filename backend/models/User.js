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
    // "school" (default — every existing account) or "independent": no school,
    // no department/level, a private library plus the AI tools.
    learnerType: { type: String, enum: ["school", "independent"], default: "school" },
    // Profile picture: a small square JPEG made by the in-app editor (the original photo is never stored).
    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },
    password: { type: String }, // optional — Google users have no password
    googleId: { type: String, default: null },

    matricNumber: { type: String, unique: true, sparse: true }, // required for students & reps
    department: { type: String },
    level: { type: Number, enum: [100, 200, 300, 400, 500, 600] },
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

    // Global Study Anchor points. Only ever changed through utils/rewards.js,
    // which writes a PointTransaction for every movement.
    points: { type: Number, default: 0, index: true },

    // IANA zone (e.g. "Africa/Lagos"). Streaks, goals and reminders use the learner's own calendar day.
    timezone: { type: String, default: "UTC" },
    // "public" shows "Ada O."; "anonymous" shows "Anonymous learner"; "hidden" leaves the leaderboard entirely.
    leaderboardVisibility: { type: String, enum: ["public", "anonymous", "hidden"], default: "public" },
    showSchoolOnLeaderboard: { type: Boolean, default: false },
    // Updated at most hourly by authMiddleware; powers the admin "active users" numbers.
    lastActiveAt: { type: Date },
    suspendedReason: { type: String, maxlength: 200 },

    // Which in-app notification categories this person wants (see utils/notify.js).
    // Missing key = on.
    notificationPrefs: { type: Map, of: Boolean, default: {} },

    isEmailVerified: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },

    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
