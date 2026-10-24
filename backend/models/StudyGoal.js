import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// A personal study goal: "30 minutes on Mon/Wed/Fri between these dates".
// Days are the learner's LOCAL calendar days (YYYY-MM-DD) so a goal means the same thing wherever the server is.
const studyGoalSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 400, default: "" },
    courseId: { type: ObjectId, ref: "Course" },
    materialId: { type: ObjectId, ref: "Material" },
    targetMinutes: { type: Number, required: true, min: 5, max: 480 },
    studyDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0 = Sunday
    startDay: { type: String, required: true },
    endDay: { type: String },
    reminderEnabled: { type: Boolean, default: false },
    reminderTime: { type: String, default: "18:00" }, // HH:MM local
    status: { type: String, enum: ["active", "paused", "completed"], default: "active" },
    completedAt: { type: Date },
    completionRewarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);
studyGoalSchema.index({ user: 1, status: 1, createdAt: -1 });
studyGoalSchema.index({ status: 1, reminderEnabled: 1 });
export default mongoose.model("StudyGoal", studyGoalSchema);
