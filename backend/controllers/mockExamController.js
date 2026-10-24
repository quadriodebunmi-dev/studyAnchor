import mongoose from "mongoose";
import MockExam from "../models/MockExam.js";
import MockExamAttempt from "../models/MockExamAttempt.js";
import Material from "../models/Material.js";
import Course from "../models/Course.js";
import { PLATFORM } from "../config/platform.js";
import { canViewMaterial, publicFilterFor, canAccessSchool } from "../utils/materialAccess.js";
import { generateQuestions, gradeTheoryAnswer, prepareSource } from "../utils/aiStudy.js";
import { isAIConfigured } from "../utils/aiClient.js";
import { recordAIUsage, respondToAIError, aiBudgetLeft } from "../utils/aiGuard.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { onMockExamSubmitted } from "../utils/rewardHooks.js";
import {
  scoreObjective, summarizeAttempt, attemptQuestionView, reviewQuestionView, sanitizeAnswers,
  isAttemptExpired, topicBreakdown,
} from "../utils/quizEngine.js";

const idStr = (v) => String(v?._id ?? v ?? "");
const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const FORMATS = ["objective", "theory", "mixed"];

const examView = (q) => ({ ...attemptQuestionView(q), topic: q.topic });

function examSummary(e, extra = {}) {
  return {
    _id: e._id, title: e.title, subject: e.subject, format: e.format, difficulty: e.difficulty,
    timeLimitMinutes: e.timeLimitMinutes, explanationMode: e.explanationMode, totalMarks: e.totalMarks,
    questionCount: e.questions.length, materialTitles: e.materialTitles, attemptCount: e.attemptCount,
    topics: [...new Set(e.questions.map((q) => q.topic))], createdAt: e.createdAt, ...extra,
  };
}

async function ownExam(req, res, id = req.params.examId) {
  if (!mongoose.isValidObjectId(id)) { res.status(404).json({ message: "Exam not found." }); return null; }
  const exam = await MockExam.findOne({ _id: id, user: req.user._id });
  if (!exam) { res.status(404).json({ message: "Exam not found." }); return null; }
  return exam;
}

async function ownAttempt(req, res) {
  if (!mongoose.isValidObjectId(req.params.attemptId)) { res.status(404).json({ message: "Attempt not found." }); return {}; }
  const attempt = await MockExamAttempt.findOne({ _id: req.params.attemptId, user: req.user._id });
  if (!attempt) { res.status(404).json({ message: "Attempt not found." }); return {}; }
  const exam = await MockExam.findById(attempt.exam);
  if (!exam) { res.status(404).json({ message: "This exam was deleted." }); return {}; }
  return { attempt, exam };
}

// ---------------------------------------------------------------------------
// Generate / list / delete
// ---------------------------------------------------------------------------

// POST /api/study/exams/generate
export async function generateExam(req, res, next) {
  try {
    const b = req.body || {};
    const format = FORMATS.includes(b.format) ? b.format : "objective";
    const difficulty = ["Easy", "Medium", "Hard"].includes(b.difficulty) ? b.difficulty : "Medium";
    const n = Math.min(PLATFORM.exams.maxQuestions, Math.max(PLATFORM.exams.minQuestions, parseInt(b.numQuestions, 10) || 10));
    const timeLimit = Math.min(PLATFORM.exams.maxTimeLimitMinutes, Math.max(0, parseInt(b.timeLimitMinutes, 10) || 0));
    const explanationMode = b.explanationMode === "immediate" ? "immediate" : "after";

    // Sources: chosen materials, or (when a course is chosen) that course's shared materials.
    let materials = [];
    let course = null;
    const ids = (Array.isArray(b.materialIds) ? b.materialIds : []).filter((i) => mongoose.isValidObjectId(i)).slice(0, PLATFORM.exams.maxMaterials);
    if (ids.length) {
      materials = await Material.find({ _id: { $in: ids } }).select("title extractedText uploadedBy visibility status schoolId");
      if (materials.length !== ids.length || materials.some((m) => !canViewMaterial(req.user, m))) {
        return res.status(403).json({ message: "You can only use materials you have access to." });
      }
    } else if (mongoose.isValidObjectId(b.courseId)) {
      course = await Course.findById(b.courseId).select("code title schoolId");
      if (!course || !canAccessSchool(req.user, course.schoolId)) return res.status(404).json({ message: "Course not found." });
      materials = await Material.find({ courseId: course._id, ...publicFilterFor(req.user), extractedText: { $exists: true, $ne: "" } })
        .select("title extractedText").sort({ createdAt: -1 }).limit(PLATFORM.exams.maxMaterials);
    }
    if (!materials.length) return res.status(400).json({ message: "Pick at least one material (or a course with materials) to build the exam from." });

    let generated;
    try {
      generated = await generateQuestions({
        text: materials.map((m) => m.extractedText), title: materials.map((m) => m.title).join(", "),
        count: n, format, difficulty,
      });
      recordAIUsage(req.user._id, "exams");
    } catch (err) {
      if (err?.name !== "UnreadableDocumentError") recordAIUsage(req.user._id, "exams", err);
      if (err?.name === "UnreadableDocumentError") return res.status(422).json({ code: err.code, message: err.message });
      if (respondToAIError(err, res)) return;
      throw err;
    }

    const questions = generated.map((g) => ({
      type: g.type, prompt: g.prompt, topic: g.topic, marks: g.marks, options: g.options, correctIndex: g.correctIndex,
      explanation: g.explanation, expectedAnswer: g.expectedAnswer, rubric: g.rubric,
    }));
    const exam = await MockExam.create({
      user: req.user._id,
      title: clean(b.title, 140) || `${course ? course.code : materials[0].title} mock exam`,
      courseId: course?._id, subject: course ? `${course.code} ${course.title}` : "",
      materialIds: materials.map((m) => m._id), materialTitles: materials.map((m) => m.title),
      format, difficulty, timeLimitMinutes: timeLimit, explanationMode, questions,
      totalMarks: Math.round(questions.reduce((s, q) => s + q.marks, 0) * 100) / 100,
    });
    res.status(201).json({ exam: examSummary(exam), requested: n, generated: questions.length });
  } catch (err) { next(err); }
}

// GET /api/study/exams
export async function listExams(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 10, maxLimit: 30 });
    const filter = { user: req.user._id };
    const [exams, total] = await Promise.all([
      MockExam.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      MockExam.countDocuments(filter),
    ]);
    const best = await MockExamAttempt.aggregate([
      { $match: { user: req.user._id, status: "submitted", exam: { $in: exams.map((e) => e._id) } } },
      { $group: { _id: "$exam", best: { $max: "$percentage" } } },
    ]);
    const bestBy = new Map(best.map((x) => [idStr(x._id), x.best]));
    res.json({ exams: exams.map((e) => examSummary(e, { bestPercentage: bestBy.get(idStr(e._id)) ?? null })), pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// GET /api/study/exams/:examId — preview: settings and topics, never the questions
export async function getExam(req, res, next) {
  try {
    const exam = await ownExam(req, res); if (!exam) return;
    const attempts = await MockExamAttempt.find({ exam: exam._id, user: req.user._id }).sort({ createdAt: -1 }).limit(20).select("status percentage gradingStatus startedAt submittedAt");
    res.json({ exam: examSummary(exam), attempts });
  } catch (err) { next(err); }
}

// DELETE /api/study/exams/:examId
export async function deleteExam(req, res, next) {
  try {
    const exam = await ownExam(req, res); if (!exam) return;
    await Promise.all([MockExamAttempt.deleteMany({ exam: exam._id }), MockExam.deleteOne({ _id: exam._id })]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

function inProgressPayload(attempt, exam) {
  return {
    attempt: { _id: attempt._id, status: attempt.status, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, serverTime: new Date(), checked: attempt.checked.map(idStr) },
    exam: { _id: exam._id, title: exam.title, timeLimitMinutes: exam.timeLimitMinutes, explanationMode: exam.explanationMode, totalMarks: exam.totalMarks },
    questions: exam.questions.map(examView),
    answers: Object.fromEntries(attempt.answers.map((a) => [idStr(a.question), { selectedIndex: a.selectedIndex, text: a.text }])),
  };
}

// POST /api/study/exams/:examId/attempts — start, or resume
export async function startExamAttempt(req, res, next) {
  try {
    const exam = await ownExam(req, res); if (!exam) return;
    let attempt = await MockExamAttempt.findOne({ exam: exam._id, user: req.user._id, status: "in_progress" });
    if (attempt && isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds)) {
      await finalizeExamAttempt(attempt, exam);
      attempt = null;
    }
    if (!attempt) {
      const now = new Date();
      attempt = await MockExamAttempt.create({
        exam: exam._id, user: req.user._id, startedAt: now,
        expiresAt: exam.timeLimitMinutes > 0 ? new Date(now.getTime() + exam.timeLimitMinutes * 60000) : undefined,
      });
      await MockExam.updateOne({ _id: exam._id }, { $inc: { attemptCount: 1 } });
    }
    res.status(201).json(inProgressPayload(attempt, exam));
  } catch (err) { next(err); }
}

// PUT /api/study/exams/attempts/:attemptId/answers
export async function saveExamAnswers(req, res, next) {
  try {
    const { attempt, exam } = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status !== "in_progress") return res.status(409).json({ code: "ALREADY_SUBMITTED", message: "This exam was already submitted." });
    if (isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds)) {
      await finalizeExamAttempt(attempt, exam);
      return res.status(409).json({ code: "TIME_EXPIRED", message: "Time's up — your exam was submitted with the answers saved so far." });
    }
    // Questions already checked in "immediate" mode are locked.
    const locked = new Set(attempt.checked.map(idStr));
    const incoming = sanitizeAnswers(req.body?.answers, exam.questions).filter((a) => !locked.has(idStr(a.question)));
    const kept = attempt.answers.filter((a) => locked.has(idStr(a.question)));
    const r = await MockExamAttempt.updateOne({ _id: attempt._id, status: "in_progress" }, { $set: { answers: [...kept, ...incoming] } });
    if (!r.matchedCount) return res.status(409).json({ code: "ALREADY_SUBMITTED", message: "This exam was already submitted." });
    res.json({ saved: true, serverTime: new Date() });
  } catch (err) { next(err); }
}

// POST /api/study/exams/attempts/:attemptId/check  body: { questionId }  (immediate-feedback exams)
export async function checkAnswer(req, res, next) {
  try {
    const { attempt, exam } = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status !== "in_progress") return res.status(409).json({ message: "This exam was already submitted." });
    if (exam.explanationMode !== "immediate") return res.status(403).json({ message: "This exam shows explanations after you submit." });
    const q = exam.questions.id(req.body?.questionId);
    if (!q || q.type !== "objective") return res.status(400).json({ message: "You can only check multiple-choice questions." });
    const a = attempt.answers.find((x) => idStr(x.question) === idStr(q._id));
    if (!a || !Number.isInteger(a.selectedIndex)) return res.status(400).json({ message: "Choose an answer first." });
    if (!attempt.checked.map(idStr).includes(idStr(q._id))) {
      attempt.checked.push(q._id);
      await attempt.save();
    }
    res.json({ questionId: q._id, correct: a.selectedIndex === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation });
  } catch (err) { next(err); }
}

// Builds per-question results and the summary from the stored answers, once.
async function finalizeExamAttempt(attempt, exam) {
  const claimed = await MockExamAttempt.findOneAndUpdate({ _id: attempt._id, status: "in_progress" }, { $set: { status: "submitted", submittedAt: new Date() } }, { new: true });
  if (!claimed) return MockExamAttempt.findById(attempt._id);
  if (claimed.expiresAt && claimed.submittedAt > claimed.expiresAt) claimed.submittedAt = claimed.expiresAt;

  const objective = scoreObjective(exam.questions, claimed.answers.map((a) => a.toObject?.() ?? a));
  const results = objective.perQuestion.map((r) => {
    const q = exam.questions.id(r.question);
    return { question: r.question, topic: q.topic, marks: r.marks, maxMarks: r.maxMarks, status: "final", graderType: "auto" };
  });

  // Written answers: AI-assisted when available, always labelled provisional.
  const theory = exam.questions.filter((q) => q.type === "theory");
  let budget = theory.length && isAIConfigured() ? await aiBudgetLeft(claimed.user, "theoryGrading") : 0;
  await Promise.all(theory.map(async (q) => {
    const row = { question: q._id, topic: q.topic, marks: null, maxMarks: q.marks, status: "pending", graderType: "ai" };
    const answer = claimed.answers.find((a) => idStr(a.question) === idStr(q._id))?.text;
    if (!String(answer || "").trim()) { Object.assign(row, { marks: 0, status: "final", graderType: "auto", feedback: "No answer was given." }); }
    else if (budget > 0) {
      budget -= 1;
      try {
        const r = await gradeTheoryAnswer({ question: q.prompt, expectedAnswer: q.expectedAnswer, rubric: q.rubric, maxMarks: q.marks, studentAnswer: answer });
        Object.assign(row, { marks: r.marks, status: "provisional", feedback: r.feedback, confidence: r.confidence });
        recordAIUsage(claimed.user, "theoryGrading");
      } catch (err) { recordAIUsage(claimed.user, "theoryGrading", err); }
    }
    results.push(row);
  }));

  claimed.results = results;
  applyExamSummary(claimed, exam);
  await claimed.save();
  const answered = claimed.answers.filter((a) => Number.isInteger(a.selectedIndex) || String(a.text || "").trim()).length;
  onMockExamSubmitted({ userId: claimed.user, attemptId: claimed._id, answered, total: exam.questions.length });
  return claimed;
}

function applyExamSummary(attempt, exam) {
  const objIds = new Set(exam.questions.filter((q) => q.type === "objective").map((q) => idStr(q._id)));
  const objectiveScore = attempt.results.filter((r) => objIds.has(idStr(r.question))).reduce((s, r) => s + (r.marks || 0), 0);
  const theoryGrades = attempt.results.filter((r) => !objIds.has(idStr(r.question)) && r.marks !== null && r.marks !== undefined);
  const s = summarizeAttempt({ questions: exam.questions, objective: { score: objectiveScore }, theoryGrades });
  Object.assign(attempt, { score: s.score, maxScore: s.maxScore, percentage: s.percentage, gradingStatus: s.gradingStatus });
}

function resultPayload(attempt, exam) {
  const ans = new Map(attempt.answers.map((a) => [idStr(a.question), a]));
  const res = new Map(attempt.results.map((r) => [idStr(r.question), r]));
  return {
    attempt: {
      _id: attempt._id, status: attempt.status, submittedAt: attempt.submittedAt, startedAt: attempt.startedAt,
      score: attempt.score, maxScore: attempt.maxScore, percentage: attempt.percentage, gradingStatus: attempt.gradingStatus,
      gradingNote: attempt.gradingStatus === "complete" ? "" : attempt.gradingStatus === "provisional"
        ? "Written answers were marked by AI and may not be perfect. Review the feedback and adjust the marks if you disagree."
        : "Some written answers haven't been marked. Compare with the model answer and mark them yourself.",
    },
    exam: { _id: exam._id, title: exam.title },
    review: exam.questions.map((q) => {
      const r = res.get(idStr(q._id));
      const view = reviewQuestionView(q, { showReview: true, selectedIndex: ans.get(idStr(q._id))?.selectedIndex, text: ans.get(idStr(q._id))?.text, grade: r ? { marks: r.marks, maxMarks: r.maxMarks, status: r.status, graderType: r.graderType, feedback: r.feedback } : null });
      return { ...view, topic: q.topic, rubric: q.type === "theory" ? q.rubric : undefined, confidence: r?.confidence || "" };
    }),
    topics: topicBreakdown(attempt.results.map((r) => ({ topic: r.topic, marks: r.marks, maxMarks: r.maxMarks })), { minQuestions: 1 }),
  };
}

// POST /api/study/exams/attempts/:attemptId/submit  body: { answers? }
export async function submitExamAttempt(req, res, next) {
  try {
    const { attempt, exam } = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status === "submitted") return res.json(resultPayload(attempt, exam)); // idempotent
    const expired = isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds);
    if (!expired && req.body?.answers) {
      const locked = new Set(attempt.checked.map(idStr));
      const incoming = sanitizeAnswers(req.body.answers, exam.questions).filter((a) => !locked.has(idStr(a.question)));
      const kept = attempt.answers.filter((a) => locked.has(idStr(a.question)));
      await MockExamAttempt.updateOne({ _id: attempt._id, status: "in_progress" }, { $set: { answers: [...kept, ...incoming] } });
      attempt.answers = [...kept, ...incoming];
    }
    const done = await finalizeExamAttempt(attempt, exam);
    res.json({ ...resultPayload(done, exam), lateNote: expired ? "Time had run out, so your saved answers were submitted." : undefined });
  } catch (err) { next(err); }
}

// GET /api/study/exams/attempts/:attemptId
export async function getExamAttempt(req, res, next) {
  try {
    const { attempt, exam } = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status === "in_progress") {
      if (isAttemptExpired(attempt, new Date(), PLATFORM.quizzes.submitGraceSeconds)) {
        const done = await finalizeExamAttempt(attempt, exam);
        return res.json(resultPayload(done, exam));
      }
      return res.json(inProgressPayload(attempt, exam));
    }
    res.json(resultPayload(attempt, exam));
  } catch (err) { next(err); }
}

// PUT /api/study/exams/attempts/:attemptId/theory-marks  body: { marks?: { [qid]: number }, acceptAi?: true }
// The learner confirms or overrides AI / pending marks on their own practice exam.
export async function adjustTheoryMarks(req, res, next) {
  try {
    const { attempt, exam } = await ownAttempt(req, res); if (!attempt) return;
    if (attempt.status !== "submitted") return res.status(409).json({ message: "Submit the exam first." });
    const marks = req.body?.marks && typeof req.body.marks === "object" ? req.body.marks : {};
    for (const [qid, value] of Object.entries(marks)) {
      const q = exam.questions.id(qid);
      const m = Number(value);
      if (!q || q.type !== "theory" || !Number.isFinite(m) || m < 0 || m > q.marks) return res.status(400).json({ message: "Marks must be between 0 and the question's maximum." });
      const row = attempt.results.find((r) => idStr(r.question) === idStr(q._id));
      if (row) Object.assign(row, { marks: Math.round(m * 2) / 2, status: "final", graderType: "self" });
    }
    if (req.body?.acceptAi) for (const r of attempt.results) if (r.status === "provisional" && r.marks !== null) r.status = "final";
    applyExamSummary(attempt, exam);
    await attempt.save();
    res.json(resultPayload(attempt, exam));
  } catch (err) { next(err); }
}

// GET /api/study/exams/attempts — history
export async function examHistory(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 10, maxLimit: 30 });
    const filter = { user: req.user._id, status: "submitted" };
    const [rows, total] = await Promise.all([
      MockExamAttempt.find(filter).sort({ submittedAt: -1, _id: -1 }).skip(skip).limit(limit).select("exam score maxScore percentage gradingStatus submittedAt"),
      MockExamAttempt.countDocuments(filter),
    ]);
    const exams = await MockExam.find({ _id: { $in: rows.map((r) => r.exam) } }).select("title");
    const title = new Map(exams.map((e) => [idStr(e._id), e.title]));
    res.json({ history: rows.map((r) => ({ _id: r._id, examId: r.exam, title: title.get(idStr(r.exam)) || "Deleted exam", score: r.score, maxScore: r.maxScore, percentage: r.percentage, gradingStatus: r.gradingStatus, submittedAt: r.submittedAt })), pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// GET /api/study/exams/analytics — strengths and weaknesses across recent exams
export async function examAnalytics(req, res, next) {
  try {
    const attempts = await MockExamAttempt.find({ user: req.user._id, status: "submitted" }).sort({ submittedAt: -1 }).limit(20).select("results percentage submittedAt");
    const topics = topicBreakdown(attempts.flatMap((a) => a.results.map((r) => ({ topic: r.topic, marks: r.marks, maxMarks: r.maxMarks }))));
    res.json({
      attemptsAnalysed: attempts.length,
      averagePercentage: attempts.length ? Math.round((attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length) * 10) / 10 : null,
      trend: attempts.slice().reverse().map((a) => ({ percentage: a.percentage, at: a.submittedAt })),
      topics,
      weak: topics.filter((t) => t.level === "weak").map((t) => t.topic),
      strong: topics.filter((t) => t.level === "strong").map((t) => t.topic),
      note: attempts.length < 2 ? "Take a few more exams for stronger insights." : "",
    });
  } catch (err) { next(err); }
}
