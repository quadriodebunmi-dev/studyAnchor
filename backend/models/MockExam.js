import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const examQuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["objective", "theory"], required: true },
  prompt: { type: String, required: true },
  topic: { type: String, default: "General" },
  marks: { type: Number, required: true },
  options: { type: [String], default: undefined },
  correctIndex: { type: Number },
  explanation: { type: String, default: "" },
  expectedAnswer: { type: String, default: "" },
  rubric: { type: String, default: "" },
});

// An AI-generated practice exam, private to its owner. Answer keys sit on the
// questions; controllers only expose them through utils/quizEngine.js views.
const mockExamSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    courseId: { type: ObjectId, ref: "Course" },
    subject: { type: String, maxlength: 120, default: "" },
    materialIds: [{ type: ObjectId, ref: "Material" }],
    materialTitles: [{ type: String }],
    format: { type: String, enum: ["objective", "theory", "mixed"], default: "objective" },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    timeLimitMinutes: { type: Number, default: 0 },
    // immediate: the learner may check an answer as they go (that answer then locks).
    // after: explanations only once the exam is submitted.
    explanationMode: { type: String, enum: ["immediate", "after"], default: "after" },
    questions: { type: [examQuestionSchema], default: [] },
    totalMarks: { type: Number, default: 0 },
    attemptCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

mockExamSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("MockExam", mockExamSchema);
