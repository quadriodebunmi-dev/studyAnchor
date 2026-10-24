// Pure quiz/exam rules — no database, no Express. Everything that decides
// "what state is this quiz in", "what did this attempt score" and "who ranks
// where" lives here so it can be unit-tested and shared by room quizzes and
// personal mock exams. The server clock is the only clock that counts.

const toMs = (d) => (d ? new Date(d).getTime() : null);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Quiz lifecycle
// ---------------------------------------------------------------------------

/**
 * draft            not published yet
 * scheduled        published, opens later
 * available        open for attempts
 * closed           deadline passed or closed by the creator
 * results_released results are visible (manual/scheduled/on-close releases)
 *
 * "In progress" is a property of a member's attempt, not of the quiz.
 */
export function computeQuizState(quiz, now = new Date()) {
  const t = toMs(now);
  if (!quiz || quiz.status !== "published") return "draft";
  const released = effectiveReleaseAt(quiz);
  if (quiz.releaseMode !== "immediate" && released !== null && released <= t) return "results_released";
  const closedAt = toMs(quiz.closedAt);
  if (closedAt !== null && closedAt <= t) return "closed";
  const opensAt = toMs(quiz.opensAt);
  if (opensAt !== null && opensAt > t) return "scheduled";
  const closesAt = toMs(quiz.closesAt);
  if (closesAt !== null && closesAt <= t) return "closed";
  return "available";
}

/** ms timestamp at which results become visible for non-"immediate" modes, or null. */
export function effectiveReleaseAt(quiz) {
  switch (quiz?.releaseMode) {
    case "manual": return toMs(quiz.resultsReleasedAt);
    case "scheduled": return toMs(quiz.releaseAt);
    case "on_close": return toMs(quiz.closedAt) ?? toMs(quiz.closesAt);
    default: return null; // "immediate" is decided per attempt
  }
}

/** May this attempt's result (and the leaderboard entry) be shown? */
export function isResultsReleased(quiz, attempt, now = new Date()) {
  if (!quiz) return false;
  if (quiz.releaseMode === "immediate") return attempt?.status === "submitted";
  const at = effectiveReleaseAt(quiz);
  return at !== null && at <= toMs(now);
}

export function canStartAttempt(quiz, now = new Date()) {
  return computeQuizState(quiz, now) === "available";
}

/** The moment an attempt stops accepting answers (earliest of: time limit, deadline, manual close). */
export function attemptDeadline({ startedAt, timeLimitMinutes, closesAt, closedAt }) {
  const candidates = [];
  if (timeLimitMinutes > 0 && startedAt) candidates.push(toMs(startedAt) + timeLimitMinutes * 60 * 1000);
  if (closesAt) candidates.push(toMs(closesAt));
  if (closedAt) candidates.push(toMs(closedAt));
  return candidates.length ? new Date(Math.min(...candidates)) : null;
}

export function isAttemptExpired(attempt, now = new Date(), graceSeconds = 0) {
  if (!attempt?.expiresAt) return false;
  return toMs(now) > toMs(attempt.expiresAt) + graceSeconds * 1000;
}

/**
 * Members who joined after publication may attempt only if the quiz allows it.
 * `joinedAt` is when their membership became active.
 */
export function isEligibleMember(quiz, membership) {
  if (!membership || membership.status !== "active") return false;
  if (quiz.allowLateJoiners !== false) return true;
  if (!quiz.publishedAt) return true;
  return toMs(membership.joinedAt) <= toMs(quiz.publishedAt);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const idStr = (v) => String(v?._id ?? v ?? "");

/**
 * Scores objective questions against the server-side key.
 * `answers` is { [questionId]: { selectedIndex } } (or an array of
 * { question, selectedIndex }). Anything malformed counts as unanswered.
 */
export function scoreObjective(questions, answers) {
  const byId = normaliseAnswers(answers);
  let score = 0;
  let maxScore = 0;
  let answered = 0;
  const perQuestion = [];
  for (const q of questions) {
    if (q.type !== "objective") continue;
    const marks = Number(q.marks) || 0;
    maxScore += marks;
    const a = byId[idStr(q._id)];
    const sel = a?.selectedIndex;
    const valid = Number.isInteger(sel) && sel >= 0 && sel < (q.options?.length || 0);
    if (valid) answered += 1;
    const correct = valid && sel === q.correctIndex;
    if (correct) score += marks;
    perQuestion.push({ question: q._id, correct, marks: correct ? marks : 0, maxMarks: marks, selectedIndex: valid ? sel : null });
  }
  return { score: round2(score), maxScore: round2(maxScore), answered, perQuestion };
}

/**
 * Turns whatever the client sent into stored answers, keeping ONLY questions
 * that belong to this quiz and values that are valid for the question type.
 * Anything else is silently dropped (never trusted, never stored).
 */
export function sanitizeAnswers(input, questions) {
  const byId = new Map(questions.map((q) => [idStr(q._id), q]));
  const out = [];
  const entries = Array.isArray(input) ? input.map((a) => [a?.question, a]) : Object.entries(input && typeof input === "object" ? input : {});
  for (const [qid, a] of entries) {
    const q = byId.get(String(qid));
    if (!q || !a || typeof a !== "object") continue;
    if (q.type === "objective") {
      const sel = a.selectedIndex;
      if (Number.isInteger(sel) && sel >= 0 && sel < q.options.length) out.push({ question: q._id, selectedIndex: sel });
    } else if (typeof a.text === "string") {
      out.push({ question: q._id, text: a.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 6000) });
    }
  }
  return out;
}

export function normaliseAnswers(answers) {
  if (!answers) return {};
  if (Array.isArray(answers)) {
    return Object.fromEntries(answers.filter((a) => a && a.question).map((a) => [idStr(a.question), a]));
  }
  return typeof answers === "object" ? answers : {};
}

/**
 * Combines the objective result with theory grades.
 *   theoryGrades: [{ question, marks, maxMarks, status: "final" | "provisional" }]
 * A theory question with no grade yet is "pending".
 *
 * gradingStatus
 *   complete       nothing is waiting on a person or an AI check
 *   provisional    every theory question has marks but at least one is an
 *                  unconfirmed AI mark — the score may still change
 *   pending_review at least one theory question has no marks yet
 */
export function summarizeAttempt({ questions, objective, theoryGrades = [] }) {
  const theoryQs = questions.filter((q) => q.type === "theory");
  const maxScore = round2(questions.reduce((s, q) => s + (Number(q.marks) || 0), 0));
  const gradeById = Object.fromEntries(theoryGrades.map((g) => [idStr(g.question), g]));

  let theoryScore = 0;
  let pending = 0;
  let provisional = 0;
  for (const q of theoryQs) {
    const g = gradeById[idStr(q._id)];
    if (!g || g.marks === null || g.marks === undefined) { pending += 1; continue; }
    theoryScore += Math.min(Math.max(Number(g.marks) || 0, 0), Number(q.marks) || 0);
    if (g.status !== "final") provisional += 1;
  }

  const score = round2((objective?.score || 0) + theoryScore);
  const gradingStatus = pending > 0 ? "pending_review" : provisional > 0 ? "provisional" : "complete";
  return {
    score,
    maxScore,
    objectiveScore: round2(objective?.score || 0),
    theoryScore: round2(theoryScore),
    percentage: maxScore > 0 ? round2((score / maxScore) * 100) : 0,
    gradingStatus,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * Ranks submitted attempts. Competition ranking: equal results share a rank and
 * the next rank skips ("1, 2, 2, 4").
 *   tieBreak "none" (default): equal scores tie.
 *   tieBreak "time": equal scores are separated by completion time, which is
 *   only fair when everyone had the same time limit — the creator opts in.
 * Entries that are not fully graded are flagged `provisional`.
 */
export function rankEntries(entries, { tieBreak = "none" } = {}) {
  const useTime = tieBreak === "time";
  const sorted = [...entries].sort((a, b) => {
    const d = round2(b.score) - round2(a.score);
    if (d !== 0) return d;
    if (useTime) {
      const t = (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity);
      if (t !== 0) return t;
    }
    return String(a.userId).localeCompare(String(b.userId));
  });

  let lastKey = null;
  let lastRank = 0;
  return sorted.map((e, i) => {
    const key = `${round2(e.score)}|${useTime ? e.durationSeconds ?? "" : ""}`;
    const rank = key === lastKey ? lastRank : i + 1;
    lastKey = key;
    lastRank = rank;
    return { ...e, rank, provisional: e.gradingStatus !== "complete" };
  });
}

// ---------------------------------------------------------------------------
// Question authoring validation
// ---------------------------------------------------------------------------

const clean = (v) => String(v ?? "").trim();

/**
 * Validates one question from the creator (or from the AI). Returns
 * { ok: true, value } with a normalised object, or { ok: false, errors }.
 */
export function validateQuestionInput(input = {}, { maxMarks = 50 } = {}) {
  const errors = [];
  const type = input.type === "theory" ? "theory" : "objective";
  const prompt = clean(input.prompt);
  if (!prompt) errors.push("The question text is required.");
  if (prompt.length > 1500) errors.push("The question is too long (max 1500 characters).");

  const marksRaw = input.marks === undefined || input.marks === "" ? (type === "theory" ? 5 : 1) : Number(input.marks);
  if (!Number.isFinite(marksRaw) || marksRaw <= 0 || marksRaw > maxMarks) errors.push(`Marks must be between 0 and ${maxMarks}.`);

  const value = { type, prompt, marks: round2(marksRaw), explanation: clean(input.explanation).slice(0, 2000) };

  if (type === "objective") {
    const options = Array.isArray(input.options) ? input.options.map(clean) : [];
    if (options.length < 2 || options.length > 6) errors.push("Give between 2 and 6 answer options.");
    if (options.some((o) => !o)) errors.push("Answer options can't be blank.");
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) errors.push("Answer options must be different from each other.");
    if (options.some((o) => o.length > 500)) errors.push("An answer option is too long (max 500 characters).");
    const idx = Number(input.correctIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) errors.push("Mark which option is correct.");
    Object.assign(value, { options, correctIndex: idx });
  } else {
    value.expectedAnswer = clean(input.expectedAnswer).slice(0, 4000);
    value.rubric = clean(input.rubric).slice(0, 3000);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Normalised prompt used to spot duplicate questions. */
export const promptKey = (p) => clean(p).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function dedupeByPrompt(questions, existingPrompts = []) {
  const seen = new Set(existingPrompts.map(promptKey));
  const out = [];
  for (const q of questions) {
    const k = promptKey(q.prompt ?? q.question);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Answer-key protection
// ---------------------------------------------------------------------------

/** What a member sees WHILE attempting: never the key, never the explanation. */
export function attemptQuestionView(q) {
  const view = { _id: q._id, order: q.order, type: q.type, prompt: q.prompt, marks: q.marks };
  if (q.type === "objective") view.options = q.options;
  return view;
}

/**
 * What a member sees once results are released. Correct/incorrect and marks are
 * always shown; the answer key and explanations only when the creator enabled review.
 */
export function reviewQuestionView(q, { showReview, selectedIndex, text, grade }) {
  const view = {
    ...attemptQuestionView(q),
    yourAnswer: q.type === "objective" ? selectedIndex ?? null : text ?? "",
    marksAwarded: grade?.marks ?? null,
    gradingStatus: grade?.status ?? null,
    graderType: grade?.graderType ?? null,
    feedback: grade?.feedback ?? "",
  };
  if (q.type === "objective") view.correct = grade ? grade.marks > 0 && grade.marks >= grade.maxMarks : null;
  if (showReview) {
    if (q.type === "objective") view.correctIndex = q.correctIndex;
    else view.expectedAnswer = q.expectedAnswer || "";
    view.explanation = q.explanation || "";
  }
  return view;
}

// ---------------------------------------------------------------------------
// Topic strengths / weaknesses (mock-exam analytics)
// ---------------------------------------------------------------------------

/**
 * Groups graded result rows ({ topic, marks, maxMarks }) by topic. A topic
 * with fewer than `minQuestions` graded questions is reported as
 * "insufficient_data" — a single lucky or unlucky question is not a trend.
 */
export function topicBreakdown(rows, { minQuestions = 3, strongAt = 75, weakBelow = 50 } = {}) {
  const map = new Map();
  for (const r of rows) {
    if (r.marks === null || r.marks === undefined || !(r.maxMarks > 0)) continue; // not graded yet
    const topic = clean(r.topic) || "General";
    const t = map.get(topic) || { topic, questions: 0, marks: 0, maxMarks: 0 };
    t.questions += 1;
    t.marks += r.marks;
    t.maxMarks += r.maxMarks;
    map.set(topic, t);
  }
  return [...map.values()]
    .map((t) => {
      const percentage = t.maxMarks > 0 ? round2((t.marks / t.maxMarks) * 100) : 0;
      const level = t.questions < minQuestions ? "insufficient_data" : percentage >= strongAt ? "strong" : percentage < weakBelow ? "weak" : "developing";
      return { ...t, marks: round2(t.marks), maxMarks: round2(t.maxMarks), percentage, level };
    })
    .sort((a, b) => a.percentage - b.percentage);
}
