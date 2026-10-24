import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const answerSchema = new mongoose.Schema(
  { question: { type: ObjectId, required: true }, selectedIndex: { type: Number }, text: { type: String, maxlength: 6000 } },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    question: { type: ObjectId, required: true },
    topic: { type: String, default: "General" },
    marks: { type: Number, default: null },
    maxMarks: { type: Number, required: true },
    status: { type: String, enum: ["final", "provisional", "pending"], default: "final" },
    graderType: { type: String, enum: ["auto", "ai", "self"], default: "auto" },
    feedback: { type: String, maxlength: 1500, default: "" },
    confidence: { type: String, enum: ["high", "medium", "low", ""], default: "" },
  },
  { _id: false }
);

const mockExamAttemptSchema = new mongoose.Schema(
  {
    exam: { type: ObjectId, ref: "MockExam", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    submittedAt: { type: Date },
    answers: { type: [answerSchema], default: [] },
    // Questions the learner checked in "immediate" mode; their answers are locked.
    checked: [{ type: ObjectId }],
    results: { type: [resultSchema], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    gradingStatus: { type: String, enum: ["complete", "provisional", "pending_review"], default: "pending_review" },
  },
  { timestamps: true }
);

mockExamAttemptSchema.index({ user: 1, createdAt: -1 });
mockExamAttemptSchema.index({ exam: 1, user: 1, createdAt: -1 });

export default mongoose.model("MockExamAttempt", mockExamAttemptSchema);
