import PointTransaction from "../models/PointTransaction.js";
import User from "../models/User.js";
import StudyGoal from "../models/StudyGoal.js";
import StudySession from "../models/StudySession.js";
import PushSubscription from "../models/PushSubscription.js";
import { PLATFORM } from "../config/platform.js";
import { getStreak } from "../utils/activity.js";
import { goalProgress, isValidTimeZone, localDay } from "../utils/streaks.js";
import { rankByPoints, leaderboardIdentity, VISIBILITY } from "../utils/leaderboard.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { toObjectId } from "../utils/objectId.js";
import { isPushConfigured, pushPublicKey } from "../utils/push.js";

const ELIGIBLE = { suspended: { $ne: true }, role: { $in: ["student", "rep"] }, leaderboardVisibility: { $ne: "hidden" } };

// GET /api/progress/summary — everything the dashboard widgets need in one call
export async function summary(req, res, next) {
  try {
    const user = req.user;
    const today = localDay(new Date(), user.timezone);
    const [streak, goals] = await Promise.all([getStreak(user), StudyGoal.find({ user: user._id, status: "active" }).limit(20)]);
    const sessions = goals.length
      ? await StudySession.aggregate([{ $match: { user: toObjectId(user._id), goal: { $in: goals.map((g) => g._id) } } }, { $group: { _id: { goal: "$goal", day: "$day" }, minutes: { $sum: "$minutes" } } }])
      : [];
    const byGoal = new Map();
    for (const r of sessions) { const k = String(r._id.goal); byGoal.set(k, { ...(byGoal.get(k) || {}), [r._id.day]: r.minutes }); }
    const todayGoals = goals.map((g) => ({ g, p: goalProgress({ startDay: g.startDay, endDay: g.endDay, studyDays: g.studyDays, targetMinutes: g.targetMinutes, minutesByDay: byGoal.get(String(g._id)) || {}, today }) }))
      .filter(({ p }) => p.todayScheduled)
      .map(({ g, p }) => ({ _id: g._id, title: g.title, targetMinutes: g.targetMinutes, todayMinutes: p.todayMinutes, todayMet: p.todayMet }));
    res.json({ streak, points: user.points || 0, today, todayGoals, timezone: user.timezone });
  } catch (err) { next(err); }
}

// GET /api/progress/points — the caller's own ledger
export async function pointsHistory(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 20, maxLimit: 50 });
    const filter = { user: req.user._id };
    const [rows, total] = await Promise.all([
      PointTransaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).select("points reason sourceType createdAt").lean(),
      PointTransaction.countDocuments(filter),
    ]);
    res.json({ total: req.user.points || 0, transactions: rows, pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

// GET /api/progress/rules — the point rules, straight from configuration (so the page is never out of date)
export async function pointRules(req, res) {
  const r = PLATFORM.rewards;
  const rules = [
    { key: "flashcards", label: `Review flashcards: ${r.flashcardsPer10Cards} points for every 10 cards (up to ${r.flashcardsDailyCap}/day)`, points: r.flashcardsPer10Cards },
    { key: "mockExam", label: `Finish a mock exam: ${r.mockExamCompleted} points (up to ${r.mockExamDailyCap} a day)`, points: r.mockExamCompleted },
    { key: "personalQuiz", label: `Finish a personal quiz of ${r.personalQuizMinQuestions}+ questions: ${r.personalQuizCompleted} points (up to ${r.personalQuizDailyCap} a day)`, points: r.personalQuizCompleted },
    { key: "roomQuiz", label: `Complete a room quiz: ${r.roomQuizParticipation} points, +${r.roomQuizAccuracyBonus.points} for ${r.roomQuizAccuracyBonus.minPercentage}%+ once marks are final`, points: r.roomQuizParticipation },
    { key: "room", label: `Create a discussion room: ${r.roomCreated} points (up to ${r.roomCreatedDailyCap} a day)`, points: r.roomCreated },
    { key: "goal", label: `Complete a goal you've really worked at: ${r.goalCompleted} points`, points: r.goalCompleted },
    ...Object.entries(r.streakMilestones || {}).map(([d, p]) => ({ key: `streak${d}`, label: `${d}-day study streak: ${p} bonus points`, points: p })),
  ].filter((x) => x.points > 0);
  res.json({
    rules,
    streak: `A streak day is a day you did real studying — a logged session of ${PLATFORM.goals.minSessionMinutesForStreak}+ minutes, a mock exam, a quiz, a solved question, or at least 5 flashcards. Just opening the app doesn't count.`,
    fairPlay: "Every award is recorded once per activity. Suspicious points can be reversed by an admin.",
  });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

const cache = new Map(); // period -> { at, data }
const CACHE_MS = 60 * 1000;

async function topAllTime(size) {
  const users = await User.find({ ...ELIGIBLE, points: { $gt: 0 } }).sort({ points: -1, _id: 1 }).limit(size)
    .select("name points leaderboardVisibility showSchoolOnLeaderboard schoolId").populate("schoolId", "name");
  return users.map((u) => ({ id: String(u._id), points: u.points, user: u }));
}

const weekStart = () => new Date(Date.now() - 7 * 24 * 3600 * 1000);

async function topWeekly(size) {
  const rows = await PointTransaction.aggregate([
    { $match: { createdAt: { $gte: weekStart() } } },
    { $group: { _id: "$user", points: { $sum: "$points" } } },
    { $match: { points: { $gt: 0 } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    { $match: { "u.suspended": { $ne: true }, "u.role": { $in: ["student", "rep"] }, "u.leaderboardVisibility": { $ne: "hidden" } } },
    { $sort: { points: -1, _id: 1 } },
    { $limit: size },
    { $project: { points: 1, "u.name": 1, "u.leaderboardVisibility": 1, "u.showSchoolOnLeaderboard": 1, "u.schoolId": 1 } },
  ]);
  return rows.map((r) => ({ id: String(r._id), points: r.points, user: { ...r.u, _id: r._id } }));
}

async function myRank(user, period) {
  if (user.leaderboardVisibility === "hidden") return { hidden: true };
  if (period === "week") {
    const [mine] = await PointTransaction.aggregate([{ $match: { user: toObjectId(user._id), createdAt: { $gte: weekStart() } } }, { $group: { _id: null, points: { $sum: "$points" } } }]);
    const points = mine?.points || 0;
    if (points <= 0) return { points: Math.max(points, 0), rank: null };
    const [above] = await PointTransaction.aggregate([
      { $match: { createdAt: { $gte: weekStart() } } }, { $group: { _id: "$user", points: { $sum: "$points" } } }, { $match: { points: { $gt: points } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } }, { $unwind: "$u" },
      { $match: { "u.suspended": { $ne: true }, "u.role": { $in: ["student", "rep"] }, "u.leaderboardVisibility": { $ne: "hidden" } } }, { $count: "n" },
    ]);
    return { points, rank: (above?.n || 0) + 1 };
  }
  const points = user.points || 0;
  if (points <= 0) return { points: 0, rank: null };
  const above = await User.countDocuments({ ...ELIGIBLE, points: { $gt: points } });
  return { points, rank: above + 1 };
}

// GET /api/leaderboard?period=all|week
export async function leaderboard(req, res, next) {
  try {
    const period = req.query.period === "week" ? "week" : "all";
    const size = PLATFORM.leaderboard.size;
    let hit = cache.get(period);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      const raw = period === "week" ? await topWeekly(size) : await topAllTime(size);
      const ranked = rankByPoints(raw.map((r) => ({ id: r.id, points: r.points, ref: r.user })));
      hit = {
        at: Date.now(),
        data: ranked.map((e) => {
          const ident = leaderboardIdentity({ ...e.ref, schoolName: e.ref.schoolId?.name });
          return ident ? { id: e.id, rank: e.rank, points: e.points, name: ident.name, school: ident.school } : null;
        }).filter(Boolean),
      };
      cache.set(period, hit);
    }
    const me = await myRank(req.user, period);
    const myId = String(req.user._id);
    res.json({
      period, entries: hit.data.map(({ id, ...e }) => ({ ...e, me: id === myId })), me,
      note: period === "week" ? "Points earned in the last 7 days." : "All-time points.",
    });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Preferences (time zone, leaderboard privacy) and push subscriptions
// ---------------------------------------------------------------------------

// PUT /api/progress/preferences
export async function updatePreferences(req, res, next) {
  try {
    const set = {};
    const { timezone, leaderboardVisibility, showSchoolOnLeaderboard } = req.body || {};
    if (timezone !== undefined) {
      if (!isValidTimeZone(timezone)) return res.status(400).json({ message: "That time zone isn't recognised." });
      set.timezone = timezone;
    }
    if (leaderboardVisibility !== undefined) {
      if (!VISIBILITY.includes(leaderboardVisibility)) return res.status(400).json({ message: "Choose public, anonymous or hidden." });
      set.leaderboardVisibility = leaderboardVisibility;
    }
    if (showSchoolOnLeaderboard !== undefined) set.showSchoolOnLeaderboard = Boolean(showSchoolOnLeaderboard);
    if (Object.keys(set).length) { await User.updateOne({ _id: req.user._id }, { $set: set }); cache.clear(); }
    res.json({ preferences: { timezone: set.timezone ?? req.user.timezone, leaderboardVisibility: set.leaderboardVisibility ?? req.user.leaderboardVisibility, showSchoolOnLeaderboard: set.showSchoolOnLeaderboard ?? req.user.showSchoolOnLeaderboard } });
  } catch (err) { next(err); }
}

export async function getPreferences(req, res) {
  const u = req.user;
  res.json({ preferences: { timezone: u.timezone || "UTC", leaderboardVisibility: u.leaderboardVisibility || "public", showSchoolOnLeaderboard: Boolean(u.showSchoolOnLeaderboard) } });
}

// GET /api/progress/push-config
export async function pushConfig(req, res) {
  res.json({ configured: isPushConfigured(), publicKey: pushPublicKey() });
}

// POST /api/progress/push  body: { endpoint, keys: { p256dh, auth } }
export async function savePushSubscription(req, res, next) {
  try {
    const { endpoint, keys } = req.body || {};
    if (!isPushConfigured()) return res.status(503).json({ message: "Push notifications aren't set up on this server." });
    if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 600 || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid push subscription." });
    }
    await PushSubscription.findOneAndUpdate({ endpoint }, { $set: { user: req.user._id, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, userAgent: String(req.headers["user-agent"] || "").slice(0, 200) } }, { upsert: true });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
}

// DELETE /api/progress/push  body: { endpoint }
export async function removePushSubscription(req, res, next) {
  try {
    await PushSubscription.deleteOne({ endpoint: String(req.body?.endpoint || ""), user: req.user._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
