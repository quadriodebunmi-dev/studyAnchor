import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    answers: [{ type: Number }], // selected option index per question, in order
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("QuizAttempt", quizAttemptSchema);
