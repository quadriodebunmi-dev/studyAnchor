import QuizAttempt from "../models/QuizAttempt.js";
import MockExamAttempt from "../models/MockExamAttempt.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import FlashcardDeck from "../models/FlashcardDeck.js";
import SnapQuestion from "../models/SnapQuestion.js";
import StudyGoal from "../models/StudyGoal.js";
import StudySession from "../models/StudySession.js";
import StudyActivity from "../models/StudyActivity.js";
import PointTransaction from "../models/PointTransaction.js";
import { getStreak } from "../utils/activity.js";
import { addDays, localDay, weekdayOf } from "../utils/streaks.js";
import { toObjectId } from "../utils/objectId.js";

const RANGES = [7, 30, 90];
const round = (n, d = 0) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : 0);
const dayStart = (day) => new Date(`${day}T00:00:00Z`);

/** Buckets a {day: n} map into daily points (<= 30 days) or weekly points (90 days). */
export function buildSeries(byDay, today, days) {
  const out = [];
  if (days <= 30) {
    for (let i = days - 1; i >= 0; i--) { const day = addDays(today, -i); out.push({ day, value: byDay[day] || 0 }); }
    return out;
  }
  const weeks = Math.ceil(days / 7);
  for (let w = weeks - 1; w >= 0; w--) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += byDay[addDays(today, -(w * 7 + i))] || 0;
    out.push({ day: addDays(today, -(w * 7 + 6)), value: sum });
  }
  return out;
}

/** Splits topic scores into strongest / weakest, ignoring topics with too little evidence. */
export function rankTopics(rows, { minMarks = 3, take = 4 } = {}) {
  const scored = rows
    .filter((r) => r.maxMarks >= minMarks)
    .map((r) => ({ topic: r._id || "General", percent: round((r.marks / r.maxMarks) * 100), questions: r.n }));
  const sorted = [...scored].sort((a, b) => a.percent - b.percent);
  return { weakest: sorted.slice(0, take).filter((t) => t.percent < 80), strongest: [...sorted].reverse().slice(0, take).filter((t) => t.percent >= 60), all: sorted.length };
}

// GET /api/progress/analytics?days=7|30|90
export async function studyAnalytics(req, res, next) {
  try {
    const user = req.user;
    const uid = toObjectId(user._id);
    const days = RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const today = localDay(new Date(), user.timezone);
    const since = addDays(today, -(days - 1));
    const heatSince = addDays(today, -83); // 12 weeks
    const sinceDate = dayStart(since);

    const [
      streak, sessions, activityByDay, activityByType, quizAgg, quizRecent, examAttempts, examTopics, roomAgg,
      deckAgg, snapTotal, snapRange, goalCounts, activeGoals, pointsRange, pointsBySource,
    ] = await Promise.all([
      getStreak(user),
      StudySession.find({ user: uid, day: { $gte: heatSince } }).select("day minutes").lean(),
      StudyActivity.aggregate([{ $match: { user: uid, day: { $gte: heatSince } } }, { $group: { _id: "$day", n: { $sum: 1 } } }]),
      StudyActivity.aggregate([{ $match: { user: uid, day: { $gte: since } } }, { $group: { _id: "$type", n: { $sum: 1 } } }]),
      QuizAttempt.aggregate([{ $match: { studentId: uid } }, { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$score", "$total"] }, 100] }, 0] } } } }]),
      QuizAttempt.find({ studentId: uid }).sort({ createdAt: -1 }).limit(15).select("score total completedAt").lean(),
      MockExamAttempt.find({ user: uid, status: "submitted" }).sort({ submittedAt: -1 }).limit(15).select("percentage submittedAt gradingStatus").lean(),
      MockExamAttempt.aggregate([
        { $match: { user: uid, status: "submitted" } }, { $sort: { submittedAt: -1 } }, { $limit: 30 },
        { $unwind: "$results" }, { $match: { "results.marks": { $ne: null }, "results.status": { $ne: "pending" } } },
        { $group: { _id: "$results.topic", marks: { $sum: "$results.marks" }, maxMarks: { $sum: "$results.maxMarks" }, n: { $sum: 1 } } },
      ]),
      RoomQuizAttempt.aggregate([{ $match: { user: uid, status: "submitted" } }, { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: "$percentage" } } }]),
      FlashcardDeck.aggregate([
        { $match: { user: uid } },
        { $project: { cards: { $size: "$cards" }, understood: { $size: { $filter: { input: "$cards", cond: { $eq: ["$$this.status", "understood"] } } } }, needs: { $size: { $filter: { input: "$cards", cond: { $eq: ["$$this.status", "needs_review"] } } } }, lastStudiedAt: 1 } },
        { $group: { _id: null, decks: { $sum: 1 }, cards: { $sum: "$cards" }, understood: { $sum: "$understood" }, needsReview: { $sum: "$needs" }, lastStudiedAt: { $max: "$lastStudiedAt" } } },
      ]),
      SnapQuestion.countDocuments({ user: uid, status: "answered" }),
      SnapQuestion.countDocuments({ user: uid, status: "answered", createdAt: { $gte: sinceDate } }),
      StudyGoal.aggregate([{ $match: { user: uid } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      StudyGoal.find({ user: uid, status: "active" }).select("title targetMinutes").limit(10).lean(),
      PointTransaction.aggregate([{ $match: { user: uid, createdAt: { $gte: sinceDate } } }, { $group: { _id: null, net: { $sum: "$points" } } }]),
      PointTransaction.aggregate([{ $match: { user: uid, points: { $gt: 0 }, createdAt: { $gte: sinceDate } } }, { $group: { _id: "$sourceType", points: { $sum: "$points" } } }, { $sort: { points: -1 } }, { $limit: 6 }]),
    ]);

    // ---- study time
    const minutesByDay = {};
    for (const s of sessions) minutesByDay[s.day] = (minutesByDay[s.day] || 0) + s.minutes;
    const inRange = sessions.filter((s) => s.day >= since);
    const totalMinutes = inRange.reduce((a, s) => a + s.minutes, 0);
    const activeDays = new Set([...Object.keys(minutesByDay).filter((d) => d >= since), ...activityByDay.filter((r) => r._id >= since).map((r) => r._id)]).size;
    const weekdayMinutes = [0, 0, 0, 0, 0, 0, 0];
    for (const s of inRange) weekdayMinutes[weekdayOf(s.day)] += s.minutes;
    const bestWeekday = totalMinutes ? weekdayMinutes.indexOf(Math.max(...weekdayMinutes)) : null;

    const actMap = Object.fromEntries(activityByDay.map((r) => [r._id, r.n]));
    const heatmap = [];
    for (let i = 83; i >= 0; i--) { const d = addDays(today, -i); heatmap.push({ day: d, count: (actMap[d] || 0) + (minutesByDay[d] ? 1 : 0), minutes: minutesByDay[d] || 0 }); }

    // ---- scores
    const pct = (a) => (a.total ? Math.round((a.score / a.total) * 100) : 0);
    const examAvg = examAttempts.length ? examAttempts.reduce((a, e) => a + (e.percentage || 0), 0) / examAttempts.length : 0;
    const scoreTrend = [
      ...quizRecent.map((q) => ({ kind: "quiz", score: pct(q), at: q.completedAt })),
      ...examAttempts.map((e) => ({ kind: "exam", score: round(e.percentage || 0), at: e.submittedAt })),
    ].filter((p) => p.at).sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-20);
    const taken = (quizAgg[0]?.n || 0) + examAttempts.length + (roomAgg[0]?.n || 0);

    // ---- flashcards
    const d = deckAgg[0] || { decks: 0, cards: 0, understood: 0, needsReview: 0 };
    const goals = Object.fromEntries(goalCounts.map((g) => [g._id, g.n]));

    res.json({
      range: days, today, timezone: user.timezone,
      overview: {
        streak, points: user.points || 0, pointsEarned: pointsRange[0]?.net || 0,
        totalMinutes, activeDays, activeRatio: round((activeDays / days) * 100),
        avgMinutesPerActiveDay: activeDays ? round(totalMinutes / activeDays) : 0,
        sessions: inRange.length, assessmentsTaken: taken,
      },
      studyTime: { series: buildSeries(minutesByDay, today, days), weekdayMinutes, bestWeekday, bucket: days <= 30 ? "day" : "week" },
      heatmap,
      activityByType: Object.fromEntries(activityByType.map((r) => [r._id, r.n])),
      quizzes: { taken: quizAgg[0]?.n || 0, avg: round(quizAgg[0]?.avg || 0) },
      mockExams: { taken: examAttempts.length, avg: round(examAvg), best: examAttempts.length ? round(Math.max(...examAttempts.map((e) => e.percentage || 0))) : 0, pendingReview: examAttempts.filter((e) => e.gradingStatus !== "complete").length },
      roomQuizzes: { taken: roomAgg[0]?.n || 0, avg: round(roomAgg[0]?.avg || 0) },
      scoreTrend,
      topics: rankTopics(examTopics),
      flashcards: { decks: d.decks, cards: d.cards, understood: d.understood, needsReview: d.needsReview, fresh: Math.max(0, d.cards - d.understood - d.needsReview), mastery: d.cards ? round((d.understood / d.cards) * 100) : 0, lastStudiedAt: d.lastStudiedAt || null },
      snap: { total: snapTotal, inRange: snapRange },
      goals: { active: goals.active || 0, completed: goals.completed || 0, paused: goals.paused || 0, list: activeGoals.map((g) => ({ _id: g._id, title: g.title, targetMinutes: g.targetMinutes })) },
      points: { earned: pointsRange[0]?.net || 0, bySource: pointsBySource.map((p) => ({ source: p._id, points: p.points })) },
    });
  } catch (err) { next(err); }
}
