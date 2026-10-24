import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A quiz run inside a discussion room. Questions (with their answer keys) live
// in RoomQuizQuestion so a quiz document can be sent to members without ever
// carrying the key.
const roomQuizSchema = new mongoose.Schema(
  {
    room: { type: ObjectId, ref: "Room", required: true },
    creator: { type: ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, trim: true, maxlength: 2000, default: "" },
    topic: { type: String, trim: true, maxlength: 120, default: "" },
    courseId: { type: ObjectId, ref: "Course" },
    // Materials the creator picked as AI sources. Kept for provenance only —
    // never exposed to members.
    materialIds: [{ type: ObjectId, ref: "Material" }],

    // What kinds of questions the quiz holds. Informational + validated at publish.
    format: { type: String, enum: ["objective", "theory", "mixed"], default: "objective" },
    // 0 = no time limit.
    timeLimitMinutes: { type: Number, default: 0, min: 0 },

    // Lifecycle. `status` is only draft/published; the live state (scheduled /
    // available / closed / results_released) is computed from the timestamps by
    // utils/quizEngine.js so there is nothing to keep in sync.
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date },
    opensAt: { type: Date },        // null = open as soon as published
    closesAt: { type: Date },       // submission deadline; null = until the creator closes it
    closedAt: { type: Date },       // set when the creator closes it early

    // Results release.
    //   immediate  a member sees their own result as soon as they submit
    //   on_close   everyone's results appear when the quiz closes
    //   scheduled  at `releaseAt` (must be on/after the deadline)
    //   manual     when the creator presses "Release results"
    releaseMode: { type: String, enum: ["immediate", "on_close", "scheduled", "manual"], default: "on_close" },
    releaseAt: { type: Date },
    resultsReleasedAt: { type: Date },
    // May members see correct answers and explanations once results are out?
    showReview: { type: Boolean, default: true },

    // Policies
    allowLateJoiners: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: 1, min: 1, max: 5 },
    // "none": equal scores tie. "time": faster completion breaks ties (fair only
    // when everyone had the same time limit — the creator opts in).
    tieBreak: { type: String, enum: ["none", "time"], default: "none" },
    // manual: creator marks theory. ai_assisted: AI proposes marks the creator confirms.
    // ai_final: AI marks count as final (still labelled AI-assisted).
    theoryGrading: { type: String, enum: ["manual", "ai_assisted", "ai_final"], default: "ai_assisted" },

    questionCount: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    attemptCount: { type: Number, default: 0 }, // bumps on first start; locks the questions
    // Version of the question set. Bumped on every edit while the quiz is still
    // editable, and recorded on each attempt.
    version: { type: Number, default: 1 },

    // Idempotency flags for the scheduler so each notification goes out once.
    notified: {
      published: { type: Boolean, default: false },
      opened: { type: Boolean, default: false },
      deadline: { type: Boolean, default: false },
      closed: { type: Boolean, default: false },
      released: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

roomQuizSchema.index({ room: 1, status: 1, createdAt: -1 });
roomQuizSchema.index({ status: 1, opensAt: 1 });
roomQuizSchema.index({ status: 1, closesAt: 1 });

export default mongoose.model("RoomQuiz", roomQuizSchema);
