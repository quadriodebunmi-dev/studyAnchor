import RoomQuiz from "../models/RoomQuiz.js";
import RoomQuizQuestion from "../models/RoomQuizQuestion.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import RoomMember from "../models/RoomMember.js";
import { PLATFORM } from "../config/platform.js";
import { isAIConfigured } from "./aiClient.js";
import { gradeTheoryAnswer } from "./aiStudy.js";
import { recordAIUsage } from "./aiGuard.js";
import { scoreObjective, summarizeAttempt, computeQuizState, isResultsReleased } from "./quizEngine.js";
import { awardQuizAttempt } from "./rewards.js";
import { notifyUsers } from "./notify.js";
import { emitToRoom } from "./realtime.js";
import { logRoomEvent } from "./roomEvents.js";
import { onRoomQuizSubmitted } from "./rewardHooks.js";

const idStr = (v) => String(v?._id ?? v ?? "");

/** Rebuilds an attempt's score fields from its stored per-question grades. */
export function applySummary(attempt, questions) {
  const objectiveIds = new Set(questions.filter((q) => q.type === "objective").map((q) => idStr(q._id)));
  const objectiveScore = attempt.grades.filter((g) => objectiveIds.has(idStr(g.question))).reduce((s, g) => s + (g.marks || 0), 0);
  const theoryGrades = attempt.grades.filter((g) => !objectiveIds.has(idStr(g.question)) && g.marks !== null && g.marks !== undefined);
  const s = summarizeAttempt({ questions, objective: { score: objectiveScore }, theoryGrades });
  attempt.score = s.score;
  attempt.maxScore = s.maxScore;
  attempt.percentage = s.percentage;
  attempt.objectiveScore = s.objectiveScore;
  attempt.theoryScore = s.theoryScore;
  attempt.gradingStatus = s.gradingStatus;
  return s;
}

/** AI-marks every ungraded/provisional theory answer on the attempt. Best effort; never throws. */
export async function aiGradeTheory(attempt, quiz, questions, { final = false } = {}) {
  if (!isAIConfigured()) return 0;
  const answerBy = Object.fromEntries(attempt.answers.map((a) => [idStr(a.question), a]));
  const targets = questions
    .filter((q) => q.type === "theory")
    .filter((q) => {
      const g = attempt.grades.find((x) => idStr(x.question) === idStr(q._id));
      return !g || (g.status !== "final");
    })
    .slice(0, 10);

  let graded = 0;
  await Promise.all(targets.map(async (q) => {
    try {
      const r = await gradeTheoryAnswer({
        question: q.prompt, expectedAnswer: q.expectedAnswer, rubric: q.rubric, maxMarks: q.marks,
        studentAnswer: answerBy[idStr(q._id)]?.text,
      });
      const status = final ? "final" : "provisional";
      const existing = attempt.grades.find((x) => idStr(x.question) === idStr(q._id));
      const row = { question: q._id, marks: r.marks, maxMarks: q.marks, status, graderType: "ai", feedback: r.feedback, confidence: r.confidence };
      if (existing) Object.assign(existing, row); else attempt.grades.push(row);
      graded += 1;
      recordAIUsage(attempt.user, "theoryGrading");
    } catch (err) {
      recordAIUsage(attempt.user, "theoryGrading", err);
    }
  }));
  return graded;
}

/**
 * Submits an attempt exactly once. The status flip is an atomic
 * findOneAndUpdate, so a double-click, a retry, the timer firing and the
 * scheduler sweep can all race and only one of them scores the attempt.
 * Resolves { attempt, already } — `already` means someone else got there first.
 */
export async function finalizeAttempt(attemptId, reason, { answers } = {}) {
  const now = new Date();
  const claimed = await RoomQuizAttempt.findOneAndUpdate(
    { _id: attemptId, status: "in_progress" },
    { $set: { status: "submitted", submitReason: reason } },
    { new: true }
  );
  if (!claimed) return { attempt: await RoomQuizAttempt.findById(attemptId), already: true };

  const quiz = await RoomQuiz.findById(claimed.quiz);
  const questions = await RoomQuizQuestion.find({ quiz: claimed.quiz }).sort({ order: 1, _id: 1 });

  if (answers) claimed.answers = answers; // already validated by the caller
  // A timed-out attempt is stamped at its deadline, not whenever the sweep ran.
  const stamp = reason === "member" || !claimed.expiresAt ? now : new Date(Math.min(now.getTime(), new Date(claimed.expiresAt).getTime()));
  claimed.submittedAt = stamp;
  claimed.durationSeconds = Math.max(0, Math.round((stamp.getTime() - new Date(claimed.startedAt).getTime()) / 1000));

  const objective = scoreObjective(questions, claimed.answers.map((a) => a.toObject?.() ?? a));
  claimed.answeredCount = objective.answered + claimed.answers.filter((a) => {
    const q = questions.find((x) => idStr(x._id) === idStr(a.question));
    return q?.type === "theory" && String(a.text || "").trim();
  }).length;

  claimed.grades = [
    ...objective.perQuestion.map((r) => ({ question: r.question, marks: r.marks, maxMarks: r.maxMarks, status: "final", graderType: "auto" })),
    ...questions.filter((q) => q.type === "theory").map((q) => ({ question: q._id, marks: null, maxMarks: q.marks, status: "pending", graderType: "manual" })),
  ];

  if (quiz.theoryGrading !== "manual" && questions.some((q) => q.type === "theory")) {
    await aiGradeTheory(claimed, quiz, questions, { final: quiz.theoryGrading === "ai_final" });
  }
  applySummary(claimed, questions);
  await claimed.save();

  awardQuizAttempt(claimed, quiz).catch(() => {});
  onRoomQuizSubmitted({ userId: claimed.user, attemptId: claimed._id, answered: claimed.answeredCount, total: quiz.questionCount });
  emitToRoom(idStr(claimed.room), "quiz:submission", { quizId: quiz._id });
  return { attempt: claimed, already: false };
}

/** Submits every in-progress attempt whose time has run out (so scores exist even if the member never returns). */
export async function sweepExpiredAttempts(limit = 100) {
  const cutoff = new Date(Date.now() - PLATFORM.quizzes.submitGraceSeconds * 1000);
  const due = await RoomQuizAttempt.find({ status: "in_progress", expiresAt: { $lte: cutoff } }).select("_id").limit(limit);
  for (const a of due) {
    try { await finalizeAttempt(a._id, "time_expired"); } catch (err) { console.error("sweep finalize failed:", err.message); }
  }
  return due.length;
}

/** Everyone who may take this quiz: active members who aren't its managers and meet the late-joiner rule. */
export async function eligibleMemberIds(quiz) {
  const rows = await RoomMember.find({ room: quiz.room, status: "active", role: "member" }).select("user joinedAt");
  return rows
    .filter((m) => quiz.allowLateJoiners !== false || !quiz.publishedAt || new Date(m.joinedAt) <= new Date(quiz.publishedAt))
    .map((m) => m.user);
}

const link = (quiz) => `/rooms/${quiz.room}/quizzes/${quiz._id}`;

/** One-time "results are out" announcement. Atomic flag => sent once no matter who triggers it. */
export async function announceRelease(quizId) {
  const claimed = await RoomQuiz.findOneAndUpdate({ _id: quizId, "notified.released": { $ne: true } }, { $set: { "notified.released": true } }, { new: true });
  if (!claimed) return;
  const submitted = await RoomQuizAttempt.find({ quiz: quizId, status: "submitted" }).select("user");
  await notifyUsers(submitted.map((a) => a.user), {
    category: "quizzes", type: "quiz_results_released", title: `Results are out: ${claimed.title}`,
    body: "See your score and how you ranked.", link: link(claimed), dedupeKey: `quiz:${quizId}:released`,
  });
  logRoomEvent(claimed.room, "results_released", { quiz: claimed._id, text: `Results for "${claimed.title}" were released.` });
  emitToRoom(idStr(claimed.room), "quiz:results_released", { quizId: claimed._id });
}

/**
 * Time-driven notifications: quiz opened, deadline approaching, quiz closed,
 * results released by schedule / deadline. Each step is guarded by an atomic
 * flag, so it is safe to call from a timer, from a cron endpoint, or both.
 */
export async function processQuizSchedule() {
  const now = new Date();
  const lead = PLATFORM.quizzes.deadlineReminderLeadMinutes * 60 * 1000;

  // 1. Scheduled quizzes that have opened.
  const opening = await RoomQuiz.find({ status: "published", "notified.opened": { $ne: true }, opensAt: { $lte: now } });
  for (const q of opening) {
    const c = await RoomQuiz.findOneAndUpdate({ _id: q._id, "notified.opened": { $ne: true } }, { $set: { "notified.opened": true } });
    if (!c) continue;
    await notifyUsers(await eligibleMemberIds(q), { category: "quizzes", type: "quiz_opened", title: `Now open: ${q.title}`, link: link(q), dedupeKey: `quiz:${q._id}:opened` });
    emitToRoom(idStr(q.room), "quiz:opened", { quizId: q._id });
  }

  // 2. Deadlines approaching — only people who haven't submitted.
  const soon = await RoomQuiz.find({ status: "published", "notified.deadline": { $ne: true }, closedAt: { $exists: false }, closesAt: { $gt: now, $lte: new Date(now.getTime() + lead) }, opensAt: { $not: { $gt: now } } });
  for (const q of soon) {
    const c = await RoomQuiz.findOneAndUpdate({ _id: q._id, "notified.deadline": { $ne: true } }, { $set: { "notified.deadline": true } });
    if (!c) continue;
    const done = new Set((await RoomQuizAttempt.find({ quiz: q._id, status: "submitted" }).select("user")).map((a) => idStr(a.user)));
    const todo = (await eligibleMemberIds(q)).filter((u) => !done.has(idStr(u)));
    await notifyUsers(todo, { category: "quizzes", type: "quiz_deadline", title: `Closing soon: ${q.title}`, body: "Submit before the deadline.", link: link(q), dedupeKey: `quiz:${q._id}:deadline` });
  }

  // 3. Closed -> tell the creator how it went; hand out the on_close / scheduled releases.
  const ended = await RoomQuiz.find({ status: "published", "notified.closed": { $ne: true }, $or: [{ closesAt: { $lte: now } }, { closedAt: { $lte: now } }] });
  for (const q of ended) {
    const c = await RoomQuiz.findOneAndUpdate({ _id: q._id, "notified.closed": { $ne: true } }, { $set: { "notified.closed": true } });
    if (!c) continue;
    const [submitted, eligible] = await Promise.all([RoomQuizAttempt.countDocuments({ quiz: q._id, status: "submitted" }), eligibleMemberIds(q)]);
    await notifyUsers([q.creator], { category: "quizzes", type: "quiz_closed", title: `"${q.title}" has closed`, body: `${submitted} of ${eligible.length} members submitted.`, link: link(q), dedupeKey: `quiz:${q._id}:closed` });
    logRoomEvent(q.room, "quiz_closed", { quiz: q._id, text: `"${q.title}" closed.` });
  }
  const releasable = await RoomQuiz.find({ status: "published", "notified.released": { $ne: true }, releaseMode: { $in: ["on_close", "scheduled"] } });
  for (const q of releasable) {
    if (computeQuizState(q, now) === "results_released") await announceRelease(q._id);
  }

  await sweepExpiredAttempts();
}

let lastRun = 0;
/** Cheap opportunistic trigger for request paths: runs the schedule at most once a minute per instance. */
export function maybeProcessSchedule() {
  if (Date.now() - lastRun < 60 * 1000) return;
  lastRun = Date.now();
  processQuizSchedule().catch((err) => console.error("quiz schedule failed:", err.message));
}

export { isResultsReleased };
