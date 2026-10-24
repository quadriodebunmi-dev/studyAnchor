import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// A logged block of study time. Only these carry minutes toward a goal —
// automatic activities (flashcards, quizzes) don't invent durations.
const studySessionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    goal: { type: ObjectId, ref: "StudyGoal" },
    day: { type: String, required: true }, // learner-local YYYY-MM-DD
    minutes: { type: Number, required: true, min: 1 },
    note: { type: String, maxlength: 200, default: "" },
  },
  { timestamps: true }
);
studySessionSchema.index({ user: 1, day: 1 });
studySessionSchema.index({ goal: 1, day: 1 });
export default mongoose.model("StudySession", studySessionSchema);
