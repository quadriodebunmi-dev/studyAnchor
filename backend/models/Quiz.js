import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    // Multiple-choice fields — required for "mcq" questions, unused for "theory".
    options: { type: [String], default: undefined },
    correctAnswer: { type: Number }, // index into options
    explanation: { type: String },
    // Theory fields — the free-form written answer, used only for "theory" questions.
    answer: { type: String },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
    generatedFor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["mcq", "theory"], default: "mcq" },
    numQuestions: { type: Number, default: 5 },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    questions: { type: [questionSchema], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Quiz", quizSchema);
