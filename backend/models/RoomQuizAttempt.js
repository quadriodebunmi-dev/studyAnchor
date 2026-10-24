import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const answerSchema = new mongoose.Schema(
  {
    question: { type: ObjectId, ref: "RoomQuizQuestion", required: true },
    selectedIndex: { type: Number },
    text: { type: String, maxlength: 6000 },
  },
  { _id: false }
);

// Per-question marks. Objective rows are written by the server at submit time;
// theory rows by AI or by the creator.
const gradeSchema = new mongoose.Schema(
  {
    question: { type: ObjectId, ref: "RoomQuizQuestion", required: true },
    marks: { type: Number, default: null }, // null = not graded yet
    maxMarks: { type: Number, required: true },
    status: { type: String, enum: ["final", "provisional", "pending"], default: "pending" },
    graderType: { type: String, enum: ["auto", "ai", "manual"], default: "auto" },
    feedback: { type: String, maxlength: 1500, default: "" },
    confidence: { type: String, enum: ["high", "medium", "low", ""], default: "" },
    gradedBy: { type: ObjectId, ref: "User" },
  },
  { _id: false }
);

const roomQuizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: ObjectId, ref: "RoomQuiz", required: true },
    room: { type: ObjectId, ref: "Room", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    attemptNo: { type: Number, default: 1 },
    quizVersion: { type: Number, default: 1 },

    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    // How it was submitted: by the member, or automatically when time ran out.
    submitReason: { type: String, enum: ["member", "time_expired", "quiz_closed"], default: undefined },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },        // server-computed hard stop
    submittedAt: { type: Date },
    lastSavedAt: { type: Date },
    durationSeconds: { type: Number },

    answers: { type: [answerSchema], default: [] },
    grades: { type: [gradeSchema], default: [] },

    // Set at submit, recomputed whenever a theory grade changes.
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    objectiveScore: { type: Number, default: 0 },
    theoryScore: { type: Number, default: 0 },
    gradingStatus: { type: String, enum: ["complete", "provisional", "pending_review"], default: "pending_review" },
    answeredCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// The guarantee behind "one attempt per member": the database refuses a second row.
roomQuizAttemptSchema.index({ quiz: 1, user: 1, attemptNo: 1 }, { unique: true });
roomQuizAttemptSchema.index({ quiz: 1, status: 1, score: -1 });
roomQuizAttemptSchema.index({ user: 1, room: 1, submittedAt: -1 });
roomQuizAttemptSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model("RoomQuizAttempt", roomQuizAttemptSchema);
