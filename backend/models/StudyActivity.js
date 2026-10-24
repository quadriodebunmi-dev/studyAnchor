import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// One row per qualifying study action. `sourceKey` is unique per user, so a
// retried request or replayed event can never count a day twice. Streaks are
// computed from the distinct `day`s here.
const studyActivitySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    type: { type: String, required: true, enum: ["session", "flashcards", "mock_exam", "room_quiz", "personal_quiz", "snap"] },
    sourceKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
studyActivitySchema.index({ user: 1, sourceKey: 1 }, { unique: true });
studyActivitySchema.index({ user: 1, day: -1 });
export default mongoose.model("StudyActivity", studyActivitySchema);
