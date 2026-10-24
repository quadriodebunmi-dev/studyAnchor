import test from "node:test";
import assert from "node:assert/strict";
import {
  computeQuizState, isResultsReleased, attemptDeadline, isAttemptExpired, isEligibleMember,
  scoreObjective, summarizeAttempt, rankEntries, validateQuestionInput, dedupeByPrompt,
  attemptQuestionView, reviewQuestionView, canStartAttempt,
} from "../utils/quizEngine.js";

const T = (iso) => new Date(iso);
const base = { status: "published", releaseMode: "on_close" };

test("quiz state: draft, scheduled, available, closed, released", () => {
  const now = T("2026-06-10T12:00:00Z");
  assert.equal(computeQuizState({ status: "draft" }, now), "draft");
  assert.equal(computeQuizState({ ...base, opensAt: T("2026-06-11T00:00:00Z") }, now), "scheduled");
  assert.equal(computeQuizState({ ...base, opensAt: T("2026-06-01T00:00:00Z"), closesAt: T("2026-06-20T00:00:00Z") }, now), "available");
  assert.equal(computeQuizState({ ...base, releaseMode: "manual", closesAt: T("2026-06-09T00:00:00Z") }, now), "closed");
  assert.equal(computeQuizState({ ...base, releaseMode: "manual", closedAt: T("2026-06-09T00:00:00Z"), resultsReleasedAt: T("2026-06-10T00:00:00Z") }, now), "results_released");
  // on_close releases automatically at the deadline
  assert.equal(computeQuizState({ ...base, closesAt: T("2026-06-09T00:00:00Z") }, now), "results_released");
});

test("a manually closed quiz stops accepting attempts", () => {
  const now = T("2026-06-10T12:00:00Z");
  const q = { ...base, releaseMode: "manual", closedAt: T("2026-06-10T11:00:00Z") };
  assert.equal(canStartAttempt(q, now), false);
});

test("results release rules", () => {
  const now = T("2026-06-10T12:00:00Z");
  assert.equal(isResultsReleased({ releaseMode: "immediate" }, { status: "in_progress" }, now), false);
  assert.equal(isResultsReleased({ releaseMode: "immediate" }, { status: "submitted" }, now), true);
  assert.equal(isResultsReleased({ releaseMode: "manual" }, { status: "submitted" }, now), false);
  assert.equal(isResultsReleased({ releaseMode: "manual", resultsReleasedAt: T("2026-06-10T11:00:00Z") }, { status: "submitted" }, now), true);
  assert.equal(isResultsReleased({ releaseMode: "scheduled", releaseAt: T("2026-06-10T13:00:00Z") }, { status: "submitted" }, now), false);
});

test("attempt deadline is the earliest of time limit, deadline and manual close", () => {
  const startedAt = T("2026-06-10T12:00:00Z");
  assert.equal(attemptDeadline({ startedAt, timeLimitMinutes: 30 }).toISOString(), "2026-06-10T12:30:00.000Z");
  assert.equal(attemptDeadline({ startedAt, timeLimitMinutes: 30, closesAt: T("2026-06-10T12:10:00Z") }).toISOString(), "2026-06-10T12:10:00.000Z");
  assert.equal(attemptDeadline({ startedAt, timeLimitMinutes: 0 }), null);
});

test("expiry honours the grace window", () => {
  const attempt = { expiresAt: T("2026-06-10T12:30:00Z") };
  assert.equal(isAttemptExpired(attempt, T("2026-06-10T12:30:10Z"), 15), false);
  assert.equal(isAttemptExpired(attempt, T("2026-06-10T12:30:16Z"), 15), true);
  assert.equal(isAttemptExpired({}, T("2030-01-01"), 0), false);
});

test("late joiners follow the quiz policy", () => {
  const quiz = { allowLateJoiners: false, publishedAt: T("2026-06-01T00:00:00Z") };
  assert.equal(isEligibleMember(quiz, { status: "active", joinedAt: T("2026-05-30T00:00:00Z") }), true);
  assert.equal(isEligibleMember(quiz, { status: "active", joinedAt: T("2026-06-02T00:00:00Z") }), false);
  assert.equal(isEligibleMember({ allowLateJoiners: true, publishedAt: quiz.publishedAt }, { status: "active", joinedAt: T("2026-06-02T00:00:00Z") }), true);
  assert.equal(isEligibleMember(quiz, { status: "pending", joinedAt: T("2026-05-01T00:00:00Z") }), false);
});

const questions = [
  { _id: "q1", type: "objective", options: ["a", "b", "c"], correctIndex: 1, marks: 2 },
  { _id: "q2", type: "objective", options: ["a", "b"], correctIndex: 0, marks: 1 },
  { _id: "q3", type: "theory", marks: 10 },
];

test("objective scoring uses the server key and ignores malformed answers", () => {
  const r = scoreObjective(questions, { q1: { selectedIndex: 1 }, q2: { selectedIndex: 99 } });
  assert.equal(r.score, 2);
  assert.equal(r.maxScore, 3);
  assert.equal(r.answered, 1);
  const none = scoreObjective(questions, undefined);
  assert.equal(none.score, 0);
  const str = scoreObjective(questions, { q1: { selectedIndex: "1" } });
  assert.equal(str.score, 0, "string indexes are not accepted");
});

test("mixed quiz: pending theory is not presented as a final score", () => {
  const objective = scoreObjective(questions, { q1: { selectedIndex: 1 }, q2: { selectedIndex: 0 } });
  const pending = summarizeAttempt({ questions, objective, theoryGrades: [] });
  assert.equal(pending.gradingStatus, "pending_review");
  assert.equal(pending.score, 3);
  assert.equal(pending.maxScore, 13);

  const provisional = summarizeAttempt({ questions, objective, theoryGrades: [{ question: "q3", marks: 6, status: "provisional" }] });
  assert.equal(provisional.gradingStatus, "provisional");
  assert.equal(provisional.score, 9);

  const final = summarizeAttempt({ questions, objective, theoryGrades: [{ question: "q3", marks: 6, status: "final" }] });
  assert.equal(final.gradingStatus, "complete");
  assert.equal(final.percentage, Math.round((9 / 13) * 10000) / 100);
});

test("theory marks are capped at the question's maximum", () => {
  const objective = scoreObjective(questions, {});
  const r = summarizeAttempt({ questions, objective, theoryGrades: [{ question: "q3", marks: 500, status: "final" }] });
  assert.equal(r.theoryScore, 10);
});

test("an objective-only quiz is complete immediately", () => {
  const qs = questions.slice(0, 2);
  const r = summarizeAttempt({ questions: qs, objective: scoreObjective(qs, { q1: { selectedIndex: 1 } }), theoryGrades: [] });
  assert.equal(r.gradingStatus, "complete");
});

test("leaderboard: ties share a rank and the next rank skips", () => {
  const ranked = rankEntries([
    { userId: "a", score: 8, gradingStatus: "complete", durationSeconds: 100 },
    { userId: "b", score: 9, gradingStatus: "complete", durationSeconds: 300 },
    { userId: "c", score: 8, gradingStatus: "complete", durationSeconds: 50 },
    { userId: "d", score: 5, gradingStatus: "complete", durationSeconds: 10 },
  ]);
  assert.deepEqual(ranked.map((e) => [e.userId, e.rank]), [["b", 1], ["a", 2], ["c", 2], ["d", 4]]);
});

test("leaderboard: time tie-break only when the creator enables it", () => {
  const entries = [
    { userId: "a", score: 8, gradingStatus: "complete", durationSeconds: 100 },
    { userId: "c", score: 8, gradingStatus: "complete", durationSeconds: 50 },
  ];
  const timed = rankEntries(entries, { tieBreak: "time" });
  assert.deepEqual(timed.map((e) => [e.userId, e.rank]), [["c", 1], ["a", 2]]);
});

test("leaderboard flags provisional entries", () => {
  const [e] = rankEntries([{ userId: "a", score: 1, gradingStatus: "provisional" }]);
  assert.equal(e.provisional, true);
});

test("question validation: objective", () => {
  assert.equal(validateQuestionInput({ type: "objective", prompt: "2+2?", options: ["3", "4"], correctIndex: 1 }).ok, true);
  assert.equal(validateQuestionInput({ type: "objective", prompt: "x", options: ["a"], correctIndex: 0 }).ok, false);
  assert.equal(validateQuestionInput({ type: "objective", prompt: "x", options: ["a", "A"], correctIndex: 0 }).ok, false, "duplicate options");
  assert.equal(validateQuestionInput({ type: "objective", prompt: "x", options: ["a", "b"], correctIndex: 5 }).ok, false);
  assert.equal(validateQuestionInput({ type: "objective", prompt: "", options: ["a", "b"], correctIndex: 0 }).ok, false);
  assert.equal(validateQuestionInput({ type: "objective", prompt: "x", options: ["a", "b"], correctIndex: 0, marks: -1 }).ok, false);
});

test("question validation: theory defaults", () => {
  const r = validateQuestionInput({ type: "theory", prompt: "Explain X", expectedAnswer: " model " });
  assert.equal(r.ok, true);
  assert.equal(r.value.marks, 5);
  assert.equal(r.value.expectedAnswer, "model");
});

test("dedupe ignores case and punctuation", () => {
  const out = dedupeByPrompt([{ prompt: "What is DNA?" }, { prompt: "what is dna" }, { prompt: "What is RNA?" }], ["WHAT IS RNA??"]);
  assert.equal(out.length, 1);
});

test("answer keys never reach a member during an attempt", () => {
  const q = { _id: "q1", order: 0, type: "objective", prompt: "p", options: ["a", "b"], correctIndex: 1, explanation: "because", marks: 1 };
  const view = attemptQuestionView(q);
  assert.equal("correctIndex" in view, false);
  assert.equal("explanation" in view, false);
  const t = attemptQuestionView({ _id: "q2", type: "theory", prompt: "p", expectedAnswer: "secret", rubric: "secret", marks: 5 });
  assert.equal("expectedAnswer" in t, false);
  assert.equal("rubric" in t, false);
});

test("review only exposes the key when the creator enabled it", () => {
  const q = { _id: "q1", type: "objective", prompt: "p", options: ["a", "b"], correctIndex: 1, explanation: "because", marks: 1 };
  const grade = { marks: 0, maxMarks: 1, status: "final", graderType: "auto" };
  const hidden = reviewQuestionView(q, { showReview: false, selectedIndex: 0, grade });
  assert.equal(hidden.correct, false);
  assert.equal("correctIndex" in hidden, false);
  assert.equal("explanation" in hidden, false);
  const shown = reviewQuestionView(q, { showReview: true, selectedIndex: 0, grade });
  assert.equal(shown.correctIndex, 1);
  assert.equal(shown.explanation, "because");
});

import { sanitizeAnswers } from "../utils/quizEngine.js";
test("sanitizeAnswers keeps only valid answers for this quiz's questions", () => {
  const qs = [
    { _id: "a", type: "objective", options: ["x", "y"] },
    { _id: "b", type: "theory" },
  ];
  const out = sanitizeAnswers({ a: { selectedIndex: 1 }, b: { text: "hello\u0000" }, zzz: { selectedIndex: 0 }, }, qs);
  assert.deepEqual(out.map((o) => [o.question, o.selectedIndex, o.text]), [["a", 1, undefined], ["b", undefined, "hello"]]);
  assert.equal(sanitizeAnswers({ a: { selectedIndex: 9 } }, qs).length, 0);
  assert.equal(sanitizeAnswers({ a: { selectedIndex: "1" } }, qs).length, 0);
  assert.equal(sanitizeAnswers(null, qs).length, 0);
  assert.equal(sanitizeAnswers({ b: { text: "x".repeat(9000) } }, qs)[0].text.length, 6000);
});

import { topicBreakdown } from "../utils/quizEngine.js";
test("topic breakdown: needs enough questions and ignores ungraded ones", () => {
  const rows = [
    { topic: "Cells", marks: 1, maxMarks: 1 }, { topic: "Cells", marks: 1, maxMarks: 1 }, { topic: "Cells", marks: 1, maxMarks: 1 },
    { topic: "Genetics", marks: 0, maxMarks: 1 }, { topic: "Genetics", marks: 0, maxMarks: 1 }, { topic: "Genetics", marks: 1, maxMarks: 1 },
    { topic: "Ecology", marks: 0, maxMarks: 1 },
    { topic: "Cells", marks: null, maxMarks: 5 },
  ];
  const out = Object.fromEntries(topicBreakdown(rows).map((t) => [t.topic, t]));
  assert.equal(out.Cells.level, "strong");
  assert.equal(out.Cells.questions, 3, "pending theory isn't counted");
  assert.equal(out.Genetics.level, "weak");
  assert.equal(out.Ecology.level, "insufficient_data");
  assert.equal(topicBreakdown(rows)[0].topic !== "Cells", true, "weakest first");
});
