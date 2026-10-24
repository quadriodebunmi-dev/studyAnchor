import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// One question + its answer key. NEVER send this document to a member as-is —
// go through attemptQuestionView / reviewQuestionView in utils/quizEngine.js.
const roomQuizQuestionSchema = new mongoose.Schema(
  {
    quiz: { type: ObjectId, ref: "RoomQuiz", required: true },
    room: { type: ObjectId, ref: "Room", required: true },
    order: { type: Number, default: 0 },
    type: { type: String, enum: ["objective", "theory"], required: true },
    prompt: { type: String, required: true, maxlength: 1500 },
    marks: { type: Number, required: true, min: 0 },

    // objective
    options: { type: [String], default: undefined },
    correctIndex: { type: Number },
    explanation: { type: String, default: "" },

    // theory
    expectedAnswer: { type: String, default: "" },
    rubric: { type: String, default: "" },

    // AI-generated questions start as "needs_review" and block publishing until
    // the creator has looked at (and possibly corrected) every one.
    source: { type: String, enum: ["manual", "ai"], default: "manual" },
    reviewStatus: { type: String, enum: ["approved", "needs_review"], default: "approved" },
  },
  { timestamps: true }
);

roomQuizQuestionSchema.index({ quiz: 1, order: 1 });

export default mongoose.model("RoomQuizQuestion", roomQuizQuestionSchema);
