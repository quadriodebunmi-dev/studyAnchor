import mongoose from "mongoose";
import RoomQuiz from "../models/RoomQuiz.js";
import RoomQuizQuestion from "../models/RoomQuizQuestion.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import RoomMember from "../models/RoomMember.js";
import Material from "../models/Material.js";
import Course from "../models/Course.js";
import { PLATFORM } from "../config/platform.js";
import { can } from "../utils/roomPermissions.js";
import { canViewMaterial, canAccessSchool } from "../utils/materialAccess.js";
import {
  computeQuizState, validateQuestionInput, dedupeByPrompt, effectiveReleaseAt, isResultsReleased, rankEntries,
} from "../utils/quizEngine.js";
import { generateQuestions } from "../utils/aiStudy.js";
import { recordAIUsage, respondToAIError } from "../utils/aiGuard.js";
import { notifyUsers } from "../utils/notify.js";
import { logRoomEvent } from "../utils/roomEvents.js";
import { emitToRoom } from "../utils/realtime.js";
import { announceRelease, eligibleMemberIds, applySummary, aiGradeTheory, maybeProcessSchedule } from "../utils/roomQuizService.js";
import { awardQuizAttempt } from "../utils/rewards.js";

const idStr = (v) => String(v?._id ?? v ?? "");
const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const toDate = (v) => (v === null || v === "" ? null : v ? new Date(v) : undefined);
const validDate = (d) => d === null || d === undefined || (d instanceof Date && !Number.isNaN(d.getTime()));

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function quizView(quiz, { manager = false, myAttempt } = {}) {
  const state = computeQuizState(quiz);
  const v = {
    _id: quiz._id, room: quiz.room, title: quiz.title, instructions: quiz.instructions, topic: quiz.topic,
    format: quiz.format, timeLimitMinutes: quiz.timeLimitMinutes, status: quiz.status, state,
    opensAt: quiz.opensAt || null, closesAt: quiz.closesAt || null, closedAt: quiz.closedAt || null,
    releaseMode: quiz.releaseMode, releaseAt: quiz.releaseAt || null, resultsReleasedAt: quiz.resultsReleasedAt || null,
    showReview: quiz.showReview, allowLateJoiners: quiz.allowLateJoiners, maxAttempts: quiz.maxAttempts,
    tieBreak: quiz.tieBreak, theoryGrading: quiz.theoryGrading,
    questionCount: quiz.questionCount, totalMarks: quiz.totalMarks, publishedAt: quiz.publishedAt || null, createdAt: quiz.createdAt,
    creator: quiz.creator?.name ? { _id: quiz.creator._id, name: quiz.creator.name } : { _id: idStr(quiz.creator) },
  };
  if (manager) { v.attemptCount = quiz.attemptCount; v.locked = quiz.attemptCount > 0; v.courseId = quiz.courseId; }
  if (myAttempt !== undefined) {
    v.myAttempt = myAttempt ? { _id: myAttempt._id, status: myAttempt.status, startedAt: myAttempt.startedAt, expiresAt: myAttempt.expiresAt, submittedAt: myAttempt.submittedAt } : null;
  }
  return v;
}

const managerQuestionView = (q) => ({
  _id: q._id, order: q.order, type: q.type, prompt: q.prompt, marks: q.marks, options: q.options,
  correctIndex: q.correctIndex, explanation: q.explanation, expectedAnswer: q.expectedAnswer, rubric: q.rubric,
  source: q.source, reviewStatus: q.reviewStatus,
});

async function loadQuiz(req, res) {
  if (!mongoose.isValidObjectId(req.params.quizId)) { res.status(404).json({ message: "Quiz not found." }); return null; }
  const quiz = await RoomQuiz.findOne({ _id: req.params.quizId, room: req.room._id });
  if (!quiz) { res.status(404).json({ message: "Quiz not found." }); return null; }
  // Members never see drafts.
  if (quiz.status === "draft" && !can.manageQuizzes(req.membership)) { res.status(404).json({ message: "Quiz not found." }); return null; }
  return quiz;
}
export { loadQuiz };

async function recount(quiz) {
  const qs = await RoomQuizQuestion.find({ quiz: quiz._id }).select("marks");
  quiz.questionCount = qs.length;
  quiz.totalMarks = Math.round(qs.reduce((s, q) => s + q.marks, 0) * 100) / 100;
  quiz.version += 1;
  await quiz.save();
}

// ---------------------------------------------------------------------------
// Settings validation (shared by create + update)
// ---------------------------------------------------------------------------

const FORMATS = ["objective", "theory", "mixed"];
const RELEASE = ["immediate", "on_close", "scheduled", "manual"];
const GRADING = ["manual", "ai_assisted", "ai_final"];

function readSettings(b, { partial }) {
  const out = {};
  const errors = [];
  const has = (k) => b[k] !== undefined;
  if (has("title") || !partial) { const t = clean(b.title, 120); if (t.length < 3) errors.push("Give the quiz a title (at least 3 characters)."); out.title = t; }
  if (has("instructions")) out.instructions = clean(b.instructions, 2000);
  if (has("topic")) out.topic = clean(b.topic, 120);
  if (has("format")) { if (!FORMATS.includes(b.format)) errors.push("Choose a quiz format."); else out.format = b.format; }
  if (has("timeLimitMinutes")) {
    const n = Number(b.timeLimitMinutes);
    if (!Number.isInteger(n) || n < 0 || n > PLATFORM.quizzes.maxTimeLimitMinutes) errors.push(`Time limit must be 0–${PLATFORM.quizzes.maxTimeLimitMinutes} minutes (0 = no limit).`);
    else out.timeLimitMinutes = n;
  }
  for (const k of ["opensAt", "closesAt", "releaseAt"]) {
    if (has(k)) { const d = toDate(b[k]); if (!validDate(d)) errors.push(`${k} isn't a valid date.`); else out[k] = d; }
  }
  if (has("releaseMode")) { if (!RELEASE.includes(b.releaseMode)) errors.push("Choose when results are released."); else out.releaseMode = b.releaseMode; }
  if (has("theoryGrading")) { if (!GRADING.includes(b.theoryGrading)) errors.push("Choose how written answers are marked."); else out.theoryGrading = b.theoryGrading; }
  if (has("tieBreak")) out.tieBreak = b.tieBreak === "time" ? "time" : "none";
  if (has("showReview")) out.showReview = Boolean(b.showReview);
  if (has("allowLateJoiners")) out.allowLateJoiners = Boolean(b.allowLateJoiners);
  if (has("maxAttempts")) { const n = Number(b.maxAttempts); if (!Number.isInteger(n) || n < 1 || n > 5) errors.push("Attempts must be 1–5."); else out.maxAttempts = n; }
  return { out, errors };
}

/** Cross-field checks on the resulting settings. */
function checkSchedule(s) {
  const errors = [];
  if (s.opensAt && s.closesAt && s.closesAt <= s.opensAt) errors.push("The deadline must be after the opening time.");
  if (s.releaseMode === "scheduled") {
    if (!s.releaseAt) errors.push("Pick a release time.");
    if (!s.closesAt) errors.push("A scheduled release needs a deadline too.");
    if (s.releaseAt && s.closesAt && s.releaseAt < s.closesAt) errors.push("Results can't be released before the deadline.");
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

// POST /api/rooms/:roomId/quizzes
export async function createQuiz(req, res, next) {
  try {
    const { out, errors } = readSettings(req.body, { partial: false });
    const merged = { releaseMode: "on_close", ...out };
    errors.push(...checkSchedule(merged));
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    if (req.body.courseId) {
      const course = mongoose.isValidObjectId(req.body.courseId) ? await Course.findById(req.body.courseId).select("schoolId") : null;
      if (!course || !canAccessSchool(req.user, course.schoolId)) return res.status(400).json({ message: "Choose a course from your own school." });
      out.courseId = course._id;
    }
    const quiz = await RoomQuiz.create({ ...out, room: req.room._id, creator: req.user._id, format: out.format || "objective" });
    res.status(201).json({ quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// PUT /api/rooms/:roomId/quizzes/:quizId
export async function updateQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const { out, errors } = readSettings(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const state = computeQuizState(quiz);
    if (quiz.status === "published") {
      // After publishing, only low-risk fields change; anything that would alter
      // what members already agreed to take is locked.
      const allowed = new Set(["title", "instructions", "closesAt", "releaseAt", "showReview", "tieBreak"]);
      const blocked = Object.keys(out).filter((k) => !allowed.has(k) && out[k] !== undefined && String(out[k]) !== String(quiz[k]));
      if (blocked.length) return res.status(409).json({ message: "Unpublish the quiz (only possible before anyone starts) to change that setting." });
      if (out.closesAt !== undefined && quiz.attemptCount > 0 && out.closesAt && quiz.closesAt && out.closesAt < quiz.closesAt) {
        return res.status(409).json({ message: "You can extend the deadline after members have started, not shorten it." });
      }
      if (state === "results_released" && (out.showReview !== undefined || out.tieBreak !== undefined)) {
        return res.status(409).json({ message: "Results have been released, so these can't change." });
      }
    }
    const next_ = { ...quiz.toObject(), ...out };
    const sErrors = checkSchedule(next_);
    if (sErrors.length) return res.status(400).json({ message: sErrors[0], errors: sErrors });

    Object.assign(quiz, out);
    if (out.closesAt !== undefined) quiz.notified.deadline = false; // a moved deadline may remind again
    await quiz.save();
    emitToRoom(idStr(req.room._id), "quiz:updated", { quizId: quiz._id });
    res.json({ quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// DELETE /api/rooms/:roomId/quizzes/:quizId  (owner)
export async function deleteQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    await Promise.all([RoomQuizQuestion.deleteMany({ quiz: quiz._id }), RoomQuizAttempt.deleteMany({ quiz: quiz._id })]);
    await RoomQuiz.deleteOne({ _id: quiz._id });
    emitToRoom(idStr(req.room._id), "quiz:updated", { quizId: quiz._id, deleted: true });
    res.json({ message: "Quiz deleted." });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Questions (manager)
// ---------------------------------------------------------------------------

function assertEditable(quiz, res) {
  if (quiz.attemptCount > 0) {
    res.status(409).json({ message: "Members have already started this quiz, so its questions are locked to keep scoring fair." });
    return false;
  }
  if (quiz.status === "published") {
    res.status(409).json({ message: "Unpublish the quiz before editing its questions." });
    return false;
  }
  return true;
}

// GET /api/rooms/:roomId/quizzes/:quizId/manage
export async function getQuizForManager(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const questions = await RoomQuizQuestion.find({ quiz: quiz._id }).sort({ order: 1, _id: 1 });
    res.json({ quiz: quizView(quiz, { manager: true }), questions: questions.map(managerQuestionView) });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/quizzes/:quizId/questions
export async function addQuestion(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (!assertEditable(quiz, res)) return;
    if (quiz.questionCount >= PLATFORM.quizzes.maxQuestions) return res.status(400).json({ message: `A quiz can have up to ${PLATFORM.quizzes.maxQuestions} questions.` });
    const v = validateQuestionInput(req.body);
    if (!v.ok) return res.status(400).json({ message: v.errors[0], errors: v.errors });
    const q = await RoomQuizQuestion.create({ ...v.value, quiz: quiz._id, room: req.room._id, order: quiz.questionCount, source: "manual", reviewStatus: "approved" });
    await recount(quiz);
    res.status(201).json({ question: managerQuestionView(q), quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// PUT /api/rooms/:roomId/quizzes/:quizId/questions/:qid  (editing an AI question also approves it)
export async function updateQuestion(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (!assertEditable(quiz, res)) return;
    const q = await RoomQuizQuestion.findOne({ _id: req.params.qid, quiz: quiz._id });
    if (!q) return res.status(404).json({ message: "Question not found." });
    const v = validateQuestionInput({ ...q.toObject(), ...req.body, type: q.type });
    if (!v.ok) return res.status(400).json({ message: v.errors[0], errors: v.errors });
    Object.assign(q, v.value, { reviewStatus: "approved" });
    await q.save();
    await recount(quiz);
    res.json({ question: managerQuestionView(q), quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/quizzes/:quizId/questions/:qid/approve   (qid = "all" approves every pending AI question)
export async function approveQuestions(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (!assertEditable(quiz, res)) return;
    const filter = { quiz: quiz._id, reviewStatus: "needs_review" };
    if (req.params.qid !== "all") {
      if (!mongoose.isValidObjectId(req.params.qid)) return res.status(404).json({ message: "Question not found." });
      filter._id = req.params.qid;
    }
    const r = await RoomQuizQuestion.updateMany(filter, { $set: { reviewStatus: "approved" } });
    res.json({ approved: r.modifiedCount });
  } catch (err) { next(err); }
}

// DELETE /api/rooms/:roomId/quizzes/:quizId/questions/:qid
export async function deleteQuestion(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (!assertEditable(quiz, res)) return;
    if (!mongoose.isValidObjectId(req.params.qid)) return res.status(404).json({ message: "Question not found." });
    const r = await RoomQuizQuestion.deleteOne({ _id: req.params.qid, quiz: quiz._id });
    if (!r.deletedCount) return res.status(404).json({ message: "Question not found." });
    // Keep `order` contiguous.
    const rest = await RoomQuizQuestion.find({ quiz: quiz._id }).sort({ order: 1, _id: 1 }).select("_id");
    await Promise.all(rest.map((x, i) => RoomQuizQuestion.updateOne({ _id: x._id }, { $set: { order: i } })));
    await recount(quiz);
    res.json({ quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// POST /api/rooms/:roomId/quizzes/:quizId/questions/generate
//   body: { count, format, difficulty, topic, materialIds? }
// Generated questions are saved as "needs_review": the quiz can't be published until
// the creator has looked at each one.
export async function generateQuizQuestions(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (!assertEditable(quiz, res)) return;

    const count = Math.min(PLATFORM.quizzes.maxAiQuestionsPerRequest, Math.max(1, parseInt(req.body.count, 10) || 5));
    if (quiz.questionCount + count > PLATFORM.quizzes.maxQuestions) return res.status(400).json({ message: `That would exceed ${PLATFORM.quizzes.maxQuestions} questions.` });
    const format = FORMATS.includes(req.body.format) ? req.body.format : quiz.format;
    const difficulty = ["Easy", "Medium", "Hard"].includes(req.body.difficulty) ? req.body.difficulty : "Medium";
    const topic = clean(req.body.topic, 120) || quiz.topic;

    const ids = (Array.isArray(req.body.materialIds) ? req.body.materialIds : []).filter((i) => mongoose.isValidObjectId(i)).slice(0, PLATFORM.exams.maxMaterials);
    const materials = ids.length ? await Material.find({ _id: { $in: ids } }).select("title extractedText uploadedBy visibility status schoolId") : [];
    if (ids.length && materials.some((m) => !canViewMaterial(req.user, m))) return res.status(403).json({ message: "You can only use materials you have access to." });
    if (!materials.length && !topic) return res.status(400).json({ message: "Pick at least one material or enter a topic." });

    // With no material the model works from the topic alone — say so in the source it's given.
    const texts = materials.length ? materials.map((m) => m.extractedText) : [`Topic: ${topic}. (No study material was provided; write general, well-established questions on this topic.)`];

    let generated;
    try {
      generated = await generateQuestions({
        text: texts, title: materials.map((m) => m.title).join(", ") || quiz.title, topic, count, format, difficulty,
        // Topic-only mode has very little text by design; real materials still need to be readable.
        minChars: materials.length ? undefined : 0,
      });
      recordAIUsage(req.user._id, "roomQuizGeneration");
    } catch (err) {
      recordAIUsage(req.user._id, "roomQuizGeneration", err);
      if (err?.name === "UnreadableDocumentError") return res.status(422).json({ code: err.code, message: err.message });
      if (respondToAIError(err, res)) return;
      throw err;
    }

    const existing = (await RoomQuizQuestion.find({ quiz: quiz._id }).select("prompt")).map((q) => q.prompt);
    const fresh = dedupeByPrompt(generated, existing);
    const docs = fresh.map((g, i) => ({
      quiz: quiz._id, room: req.room._id, order: quiz.questionCount + i, source: "ai", reviewStatus: "needs_review",
      type: g.type, prompt: g.prompt, marks: g.marks, options: g.options, correctIndex: g.correctIndex,
      explanation: g.explanation, expectedAnswer: g.expectedAnswer, rubric: g.rubric,
    }));
    const created = docs.length ? await RoomQuizQuestion.insertMany(docs) : [];
    if (materials.length) quiz.materialIds = materials.map((m) => m._id);
    await recount(quiz);
    res.status(201).json({ questions: created.map(managerQuestionView), quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Lifecycle: publish / unpublish / close / release
// ---------------------------------------------------------------------------

export function publishErrors(quiz, questions, now = new Date()) {
  const errors = [];
  if (!questions.length) errors.push("Add at least one question.");
  if (questions.some((q) => q.reviewStatus !== "approved")) errors.push("Review and approve every AI-generated question first.");
  if (quiz.format === "objective" && questions.some((q) => q.type !== "objective")) errors.push("This is an objective quiz but it contains written questions.");
  if (quiz.format === "theory" && questions.some((q) => q.type !== "theory")) errors.push("This is a written quiz but it contains objective questions.");
  if (quiz.theoryGrading !== "manual" && questions.some((q) => q.type === "theory" && !q.expectedAnswer && !q.rubric)) {
    errors.push("Add a model answer or marking points to each written question so it can be marked.");
  }
  if (quiz.closesAt && new Date(quiz.closesAt) <= now) errors.push("The deadline is in the past.");
  errors.push(...checkSchedule(quiz));
  return errors;
}

// POST .../publish
export async function publishQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (quiz.status === "published") return res.json({ quiz: quizView(quiz, { manager: true }) });
    const questions = await RoomQuizQuestion.find({ quiz: quiz._id });
    const errors = publishErrors(quiz, questions);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const claimed = await RoomQuiz.findOneAndUpdate(
      { _id: quiz._id, status: "draft" },
      { $set: { status: "published", publishedAt: new Date(), questionCount: questions.length } },
      { new: true }
    );
    if (!claimed) return res.json({ quiz: quizView(await RoomQuiz.findById(quiz._id), { manager: true }) });

    const opensNow = !claimed.opensAt || claimed.opensAt <= new Date();
    if (opensNow) await RoomQuiz.updateOne({ _id: claimed._id }, { $set: { "notified.opened": true } });
    await RoomQuiz.updateOne({ _id: claimed._id }, { $set: { "notified.published": true } });

    notifyUsers(await eligibleMemberIds(claimed), {
      category: "quizzes", type: "quiz_published",
      title: opensNow ? `New quiz: ${claimed.title}` : `Quiz scheduled: ${claimed.title}`,
      body: opensNow ? (claimed.closesAt ? `Due ${new Date(claimed.closesAt).toUTCString()}` : "Open now.") : `Opens ${new Date(claimed.opensAt).toUTCString()}`,
      link: `/rooms/${req.room._id}/quizzes/${claimed._id}`, dedupeKey: `quiz:${claimed._id}:published`,
    });
    logRoomEvent(req.room._id, "quiz_published", { actor: req.user._id, quiz: claimed._id, text: `Quiz "${claimed.title}" was published.` });
    emitToRoom(idStr(req.room._id), "quiz:published", { quizId: claimed._id });
    res.json({ quiz: quizView(claimed, { manager: true }) });
  } catch (err) { next(err); }
}

// POST .../unpublish  — only while nobody has started
export async function unpublishQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (quiz.attemptCount > 0) return res.status(409).json({ message: "Members have already started this quiz, so it can't be unpublished. You can close it instead." });
    quiz.status = "draft";
    quiz.publishedAt = undefined;
    await quiz.save();
    emitToRoom(idStr(req.room._id), "quiz:updated", { quizId: quiz._id });
    res.json({ quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// POST .../close — stop accepting attempts now
export async function closeQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (quiz.status !== "published") return res.status(400).json({ message: "Publish the quiz first." });
    if (!quiz.closedAt) { quiz.closedAt = new Date(); await quiz.save(); }
    emitToRoom(idStr(req.room._id), "quiz:updated", { quizId: quiz._id });
    maybeProcessSchedule();
    res.json({ quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// POST .../release — close (if still open) and release results now
export async function releaseResults(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (quiz.status !== "published") return res.status(400).json({ message: "Publish the quiz first." });
    if (quiz.releaseMode === "immediate") return res.status(400).json({ message: "Members already see their results as they submit." });
    const now = new Date();
    if (!quiz.closedAt && !(quiz.closesAt && quiz.closesAt <= now)) quiz.closedAt = now;
    if (quiz.releaseMode === "scheduled") quiz.releaseMode = "manual"; // released early by hand
    quiz.resultsReleasedAt = quiz.resultsReleasedAt || now;
    await quiz.save();
    await announceRelease(quiz._id);
    res.json({ quiz: quizView(quiz, { manager: true }) });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Member-facing list/detail
// ---------------------------------------------------------------------------

// GET /api/rooms/:roomId/quizzes
export async function listQuizzes(req, res, next) {
  try {
    maybeProcessSchedule();
    const manager = can.manageQuizzes(req.membership);
    const filter = { room: req.room._id };
    if (!manager) filter.status = "published";
    const quizzes = await RoomQuiz.find(filter).sort({ createdAt: -1 }).limit(100).populate("creator", "name");
    const mine = await RoomQuizAttempt.find({ user: req.user._id, quiz: { $in: quizzes.map((q) => q._id) } }).sort({ attemptNo: -1 });
    const byQuiz = new Map();
    for (const a of mine) if (!byQuiz.has(idStr(a.quiz))) byQuiz.set(idStr(a.quiz), a);
    res.json({ quizzes: quizzes.map((q) => quizView(q, { manager, myAttempt: byQuiz.get(idStr(q._id)) || null })) });
  } catch (err) { next(err); }
}

// GET /api/rooms/:roomId/quizzes/:quizId
export async function getQuiz(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    await quiz.populate("creator", "name");
    const manager = can.manageQuizzes(req.membership);
    const mine = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id }).sort({ attemptNo: -1 });
    res.json({ quiz: quizView(quiz, { manager, myAttempt: mine || null }), canAttempt: !manager });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Participation, leaderboard, grading
// ---------------------------------------------------------------------------

function entryName(u) { return u?.name || "Member"; }

// GET .../participation  (manager)
export async function participation(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const [members, attempts] = await Promise.all([
      RoomMember.find({ room: req.room._id, status: "active", role: "member" }).populate("user", "name"),
      RoomQuizAttempt.find({ quiz: quiz._id }).sort({ attemptNo: -1 }),
    ]);
    const latest = new Map();
    for (const a of attempts) if (!latest.has(idStr(a.user))) latest.set(idStr(a.user), a);
    const rows = members.filter((m) => m.user).map((m) => {
      const a = latest.get(idStr(m.user._id));
      const eligible = quiz.allowLateJoiners !== false || !quiz.publishedAt || new Date(m.joinedAt) <= new Date(quiz.publishedAt);
      return {
        user: { _id: m.user._id, name: m.user.name }, eligible,
        status: !a ? "not_started" : a.status === "in_progress" ? "in_progress" : "submitted",
        attemptId: a?._id, submittedAt: a?.submittedAt, score: a?.status === "submitted" ? a.score : null,
        maxScore: a?.maxScore, percentage: a?.status === "submitted" ? a.percentage : null,
        gradingStatus: a?.status === "submitted" ? a.gradingStatus : null, submitReason: a?.submitReason,
      };
    });
    const submitted = rows.filter((r) => r.status === "submitted");
    const pcts = submitted.map((r) => r.percentage || 0);
    res.json({
      participation: rows,
      summary: {
        eligible: rows.filter((r) => r.eligible).length,
        notStarted: rows.filter((r) => r.eligible && r.status === "not_started").length,
        inProgress: rows.filter((r) => r.status === "in_progress").length,
        submitted: submitted.length,
        needsGrading: submitted.filter((r) => r.gradingStatus !== "complete").length,
        averagePercentage: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null,
        highestPercentage: pcts.length ? Math.max(...pcts) : null,
      },
    });
  } catch (err) { next(err); }
}

// GET .../leaderboard
export async function leaderboard(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const manager = can.manageQuizzes(req.membership);
    const mine = await RoomQuizAttempt.findOne({ quiz: quiz._id, user: req.user._id, status: "submitted" });
    // Managers can always look; members only once their own results are visible.
    if (!manager && !isResultsReleased(quiz, mine)) {
      return res.json({ available: false, entries: [], message: "The leaderboard appears when results are released." });
    }
    const attempts = await RoomQuizAttempt.find({ quiz: quiz._id, status: "submitted" }).populate("user", "name").limit(500);
    const ranked = rankEntries(attempts.filter((a) => a.user).map((a) => ({
      userId: idStr(a.user._id), name: entryName(a.user), score: a.score, maxScore: a.maxScore, percentage: a.percentage,
      durationSeconds: a.durationSeconds, gradingStatus: a.gradingStatus, submittedAt: a.submittedAt,
    })), { tieBreak: quiz.tieBreak });
    res.json({
      available: true, tieBreak: quiz.tieBreak,
      entries: ranked.map((e) => ({ rank: e.rank, name: e.name, score: e.score, maxScore: e.maxScore, percentage: e.percentage, durationSeconds: quiz.tieBreak === "time" ? e.durationSeconds : undefined, provisional: e.provisional, me: e.userId === idStr(req.user._id) })),
    });
  } catch (err) { next(err); }
}

// GET .../attempts/:attemptId  (manager) — one member's answers for grading
export async function getAttemptForGrading(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(404).json({ message: "Attempt not found." });
    const attempt = await RoomQuizAttempt.findOne({ _id: req.params.attemptId, quiz: quiz._id }).populate("user", "name");
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    const questions = await RoomQuizQuestion.find({ quiz: quiz._id }).sort({ order: 1, _id: 1 });
    const ans = new Map(attempt.answers.map((a) => [idStr(a.question), a]));
    const grade = new Map(attempt.grades.map((g) => [idStr(g.question), g]));
    res.json({
      attempt: { _id: attempt._id, user: { _id: attempt.user?._id, name: attempt.user?.name }, status: attempt.status, score: attempt.score, maxScore: attempt.maxScore, percentage: attempt.percentage, gradingStatus: attempt.gradingStatus, submittedAt: attempt.submittedAt, submitReason: attempt.submitReason },
      questions: questions.map((q) => ({ ...managerQuestionView(q), answer: { selectedIndex: ans.get(idStr(q._id))?.selectedIndex ?? null, text: ans.get(idStr(q._id))?.text || "" }, grade: grade.get(idStr(q._id)) || null })),
    });
  } catch (err) { next(err); }
}

async function afterGradeChange(attempt, quiz, questions) {
  applySummary(attempt, questions);
  await attempt.save();
  if (attempt.gradingStatus === "complete") {
    awardQuizAttempt(attempt, quiz).catch(() => {}); // unlocks the accuracy bonus once marks are final
    if (isResultsReleased(quiz, attempt)) {
      notifyUsers([attempt.user], { category: "quizzes", type: "quiz_graded", title: `Your written answers were marked: ${quiz.title}`, link: `/rooms/${quiz.room}/quizzes/${quiz._id}`, dedupeKey: `quiz:${quiz._id}:graded:${attempt.user}` });
    }
  }
}

// PUT .../attempts/:attemptId/grade  body: { grades: [{ question, marks, feedback? }] }
export async function gradeAttempt(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const attempt = await RoomQuizAttempt.findOne({ _id: req.params.attemptId, quiz: quiz._id, status: "submitted" });
    if (!attempt) return res.status(404).json({ message: "Submitted attempt not found." });
    const questions = await RoomQuizQuestion.find({ quiz: quiz._id });
    const byId = new Map(questions.map((q) => [idStr(q._id), q]));

    const input = Array.isArray(req.body?.grades) ? req.body.grades : [];
    if (!input.length) return res.status(400).json({ message: "Nothing to grade." });
    for (const g of input) {
      const q = byId.get(String(g?.question));
      if (!q || q.type !== "theory") return res.status(400).json({ message: "You can only mark written questions." });
      const marks = Number(g.marks);
      if (!Number.isFinite(marks) || marks < 0 || marks > q.marks) return res.status(400).json({ message: `Marks for a question must be between 0 and ${q.marks}.` });
      const row = { question: q._id, marks: Math.round(marks * 2) / 2, maxMarks: q.marks, status: "final", graderType: "manual", feedback: clean(g.feedback, 1500), confidence: "", gradedBy: req.user._id };
      const existing = attempt.grades.find((x) => idStr(x.question) === idStr(q._id));
      if (existing) Object.assign(existing, row); else attempt.grades.push(row);
    }
    await afterGradeChange(attempt, quiz, questions);
    res.json({ attempt: { score: attempt.score, maxScore: attempt.maxScore, percentage: attempt.percentage, gradingStatus: attempt.gradingStatus } });
  } catch (err) { next(err); }
}

// POST .../attempts/:attemptId/ai-grade — (re)run AI-assisted marking; results are provisional
export async function aiGradeAttempt(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const attempt = await RoomQuizAttempt.findOne({ _id: req.params.attemptId, quiz: quiz._id, status: "submitted" });
    if (!attempt) return res.status(404).json({ message: "Submitted attempt not found." });
    const questions = await RoomQuizQuestion.find({ quiz: quiz._id }).sort({ order: 1, _id: 1 });
    const n = await aiGradeTheory(attempt, quiz, questions, { final: false });
    if (!n) return res.status(502).json({ code: "AI_FAILED", message: "The AI couldn't mark these answers right now. You can mark them yourself." });
    await afterGradeChange(attempt, quiz, questions);
    res.json({ marked: n, attempt: { score: attempt.score, maxScore: attempt.maxScore, percentage: attempt.percentage, gradingStatus: attempt.gradingStatus } });
  } catch (err) { next(err); }
}

// POST .../attempts/:attemptId/confirm-ai — accept the AI's provisional marks as final
export async function confirmAiGrades(req, res, next) {
  try {
    const quiz = await loadQuiz(req, res); if (!quiz) return;
    const attempt = await RoomQuizAttempt.findOne({ _id: req.params.attemptId, quiz: quiz._id, status: "submitted" });
    if (!attempt) return res.status(404).json({ message: "Submitted attempt not found." });
    const questions = await RoomQuizQuestion.find({ quiz: quiz._id });
    let changed = 0;
    for (const g of attempt.grades) if (g.status === "provisional" && g.marks !== null) { g.status = "final"; g.gradedBy = req.user._id; changed += 1; }
    if (changed) await afterGradeChange(attempt, quiz, questions);
    res.json({ confirmed: changed, attempt: { score: attempt.score, maxScore: attempt.maxScore, percentage: attempt.percentage, gradingStatus: attempt.gradingStatus } });
  } catch (err) { next(err); }
}
