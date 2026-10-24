import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// History for "Snap a Question". The photo itself is NEVER stored — only the
// text read from it and the explanation that followed.
const snapQuestionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    extractedText: { type: String, default: "", maxlength: 6000 },
    // What the learner actually asked after correcting the OCR (if they did).
    questionText: { type: String, default: "", maxlength: 6000 },
    readConfidence: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    status: { type: String, enum: ["extracted", "answered"], default: "extracted" },
    answer: {
      finalAnswer: String,
      steps: [String],
      hints: [String],
      conceptsToReview: [String],
      confidence: { type: String, enum: ["high", "medium", "low"] },
      caveats: String,
    },
  },
  { timestamps: true }
);

snapQuestionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("SnapQuestion", snapQuestionSchema);
