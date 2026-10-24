import RoomQuizQuestion from "../models/RoomQuizQuestion.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import RoomQuiz from "../models/RoomQuiz.js";
import { PLATFORM } from "../config/platform.js";
import { can } from "../utils/roomPermissions.js";
import {
  computeQuizState, attemptDeadline, isAttemptExpired, isEligibleMember, isResultsReleased,
  attemptQuestionView, reviewQuestionView, sanitizeAnswers,
} from "../utils/quizEngine.js";
import { finalizeAttempt } from "../utils/roomQuizService.js";
import { loadQuiz, quizView } from "./roomQuizController.js";

const idStr = (v) => String(v?._id ?? v ?? "");

function attemptPayload(attempt, questions) {
  return {
    attempt: { _id: attempt._id, status: attempt.status, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, serverTime: new Date() },
    // The key never leaves the server during an attempt.
    questions: questions.map(attemptQuestionView),
    answers: Object.fromEntries(attempt.answers.map((a) => [idStr(a.question), { selectedIndex: a.selectedIndex, text: a.text }])),
  };
}

const orderQuestions = (quizId) => RoomQuizQuestion.find({ quiz: quizId }).sort({ order: 1, _id: 1 });

// POST /api/rooms/:roomId/quizzes/:quizId/attempts  — start, or resume the one in progress
export async function startAttempt(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (can.manageQuizzes(req.membership)) {
      return res.status(403).json({ message: "Quiz creators and moderators can see the answer key, so they can't take the quiz. Use Preview instead." });
    }
    if (!isEligibleMember(quiz, req.membership)) {
      return res.status(403).json({ message: "This quiz was published before you joined the room, so it isn't open to you." });
    }

    // Resume.
    let attempt = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id, status: "in_progress" });
    if (attempt) {
      if (isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds)) {
        await finalizeAttempt(attempt._id, "time_expired");
        return res.status(409).json({ code: "TIME_EXPIRED", message: "Your time for this quiz ran out and it was submitted automatically." });
      }
      return res.json(attemptPayload(attempt, await orderQuestions(quiz._id)));
    }

    const state = computeQuizState(quiz);
    if (state === "scheduled") return res.status(409).json({ code: "NOT_OPEN", message: `This quiz opens ${new Date(quiz.opensAt).toUTCString()}.` });
    if (state !== "available") return res.status(409).json({ code: "CLOSED", message: "This quiz is closed." });

    const done = await RoomQuizAttempt.countDocuments({ quiz: quiz._id, user: req.user._id, status: "submitted" });
    if (done >= quiz.maxAttempts) return res.status(409).json({ code: "NO_ATTEMPTS_LEFT", message: "You've already submitted this quiz." });

    const now = new Date();
    try {
      attempt = await RoomQuizAttempt.create({
        quiz: quiz._id, room: req.room._id, user: req.user._id, attemptNo: done + 1, quizVersion: quiz.version,
        startedAt: now, expiresAt: attemptDeadline({ startedAt: now, timeLimitMinutes: quiz.timeLimitMinutes, closesAt: quiz.closesAt, closedAt: quiz.closedAt }),
      });
      await RoomQuiz.updateOne({ _id: quiz._id }, { $inc: { attemptCount: 1 } });
    } catch (err) {
      // Double-click / two tabs: the unique index let only one attempt exist — use it.
      if (err?.code !== 11000) throw err;
      attempt = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id, status: "in_progress" });
      if (!attempt) return res.status(409).json({ code: "NO_ATTEMPTS_LEFT", message: "You've already submitted this quiz." });
    }
    res.status(201).json(attemptPayload(attempt, await orderQuestions(quiz._id)));
  } catch (err) { next(err); }
}

// PUT .../attempts/mine/answers  body: { answers }  — autosave
export async function saveAnswers(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const attempt = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id, status: "in_progress" });
    if (!attempt) return res.status(404).json({ message: "No attempt in progress." });

    if (isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds)) {
      await finalizeAttempt(attempt._id, "time_expired");
      return res.status(409).json({ code: "TIME_EXPIRED", message: "Time's up — your quiz was submitted with the answers saved so far." });
    }
    const questions = await orderQuestions(quiz._id);
    const answers = sanitizeAnswers(req.body?.answers, questions);
    // Conditional on still being in progress, so a save can never overwrite a submission.
    const r = await RoomQuizAttempt.updateOne({ _id: attempt._id, status: "in_progress" }, { $set: { answers, lastSavedAt: new Date() } });
    if (!r.matchedCount) return res.status(409).json({ code: "ALREADY_SUBMITTED", message: "This quiz was already submitted." });
    res.json({ saved: true, savedAt: new Date(), expiresAt: attempt.expiresAt, serverTime: new Date() });
  } catch (err) { next(err); }
}

// POST .../attempts/mine/submit  body: { answers? }
export async function submitAttempt(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const attempt = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id }).sort({ attemptNo: -1 });
    if (!attempt) return res.status(404).json({ message: "No attempt found." });

    // Already submitted (retry / double-click): same answer, no second scoring.
    if (attempt.status === "submitted") return res.json(await resultResponse(quiz, attempt, req, { already: true }));

    const expired = isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds);
    if (!expired && req.body?.answers) {
      const questions = await orderQuestions(quiz._id);
      const answers = sanitizeAnswers(req.body.answers, questions);
      await RoomQuizAttempt.updateOne({ _id: attempt._id, status: "in_progress" }, { $set: { answers, lastSavedAt: new Date() } });
    }
    // If time already ran out, only what was saved before the deadline counts.
    const { attempt: done, already } = await finalizeAttempt(attempt._id, expired ? "time_expired" : "member");
    res.json(await resultResponse(quiz, done, req, { already, lateNote: expired ? "Time had run out, so your saved answers were submitted." : undefined }));
  } catch (err) { next(err); }
}

async function resultResponse(quiz, attempt, req, extra = {}) {
  const released = isResultsReleased(quiz, attempt);
  const base = { submitted: true, released, submittedAt: attempt.submittedAt, submitReason: attempt.submitReason, ...extra };
  if (!released) {
    return { ...base, message: quiz.releaseMode === "manual" ? "Submitted. Your results will appear when the quiz creator releases them." : "Submitted. Your results will appear when the quiz closes." };
  }
  return { ...base, ...(await buildResult(quiz, attempt)) };
}

async function buildResult(quiz, attempt) {
  const questions = await orderQuestions(quiz._id);
  const ans = new Map(attempt.answers.map((a) => [idStr(a.question), a]));
  const grade = new Map(attempt.grades.map((g) => [idStr(g.question), g]));
  return {
    result: {
      score: attempt.score, maxScore: attempt.maxScore, percentage: attempt.percentage,
      objectiveScore: attempt.objectiveScore, theoryScore: attempt.theoryScore,
      gradingStatus: attempt.gradingStatus,
      // Plain-language label so a provisional score is never read as final.
      gradingNote: attempt.gradingStatus === "complete" ? "" : attempt.gradingStatus === "provisional"
        ? "Some written answers were marked with AI assistance and are awaiting confirmation, so your score may change."
        : "Some written answers haven't been marked yet, so your score is incomplete.",
      durationSeconds: attempt.durationSeconds,
    },
    review: questions.map((q) => reviewQuestionView(q, {
      showReview: quiz.showReview,
      selectedIndex: ans.get(idStr(q._id))?.selectedIndex,
      text: ans.get(idStr(q._id))?.text,
      grade: grade.get(idStr(q._id)),
    })),
  };
}

// GET .../results/mine
export async function myResult(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const attempt = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id, status: "submitted" }).sort({ attemptNo: -1 });
    if (!attempt) return res.status(404).json({ message: "You haven't submitted this quiz." });
    res.json(await resultResponse(quiz, attempt, req));
  } catch (err) { next(err); }
}

// GET .../preview  (manager) — the quiz exactly as a member sees it, without creating an attempt
export async function previewQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const questions = await orderQuestions(quiz._id);
    res.json({ quiz: quizView(quiz, { manager: true }), questions: questions.map(attemptQuestionView) });
  } catch (err) { next(err); }
}
