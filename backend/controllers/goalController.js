import mongoose from "mongoose";
import StudyGoal from "../models/StudyGoal.js";
import StudySession from "../models/StudySession.js";
import Course from "../models/Course.js";
import Material from "../models/Material.js";
import { PLATFORM } from "../config/platform.js";
import { canAccessSchool, canViewMaterial } from "../utils/materialAccess.js";
import { localDay, addDays, isDayString, parseClock, goalProgress, goalCompletionEligible } from "../utils/streaks.js";
import { recordActivity } from "../utils/activity.js";
import { awardPoints } from "../utils/rewards.js";
import { toObjectId } from "../utils/objectId.js";

const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const idStr = (v) => String(v?._id ?? v ?? "");

async function minutesByGoal(userId, goalIds) {
  if (!goalIds.length) return new Map();
  const rows = await StudySession.aggregate([
    { $match: { user: toObjectId(userId), goal: { $in: goalIds.map(toObjectId) } } },
    { $group: { _id: { goal: "$goal", day: "$day" }, minutes: { $sum: "$minutes" } } },
  ]);
  const out = new Map();
  for (const r of rows) {
    const k = idStr(r._id.goal);
    if (!out.has(k)) out.set(k, {});
    out.get(k)[r._id.day] = r.minutes;
  }
  return out;
}

function view(goal, today, minutes) {
  const progress = goalProgress({
    startDay: goal.startDay, endDay: goal.endDay, studyDays: goal.studyDays, targetMinutes: goal.targetMinutes,
    minutesByDay: minutes || {}, today,
  });
  return {
    _id: goal._id, title: goal.title, description: goal.description, courseId: goal.courseId, materialId: goal.materialId,
    targetMinutes: goal.targetMinutes, studyDays: goal.studyDays, startDay: goal.startDay, endDay: goal.endDay || null,
    reminderEnabled: goal.reminderEnabled, reminderTime: goal.reminderTime, status: goal.status, completedAt: goal.completedAt,
    completionRewarded: goal.completionRewarded, progress,
    canEarnReward: !goal.completionRewarded && goalCompletionEligible(progress, { minMetDays: PLATFORM.goals.completionMinMetDays, minPercent: PLATFORM.goals.completionMinPercent }),
  };
}

// Validates and normalises a goal body. `partial` = PUT (only provided fields).
async function readGoal(body, user, { partial }) {
  const out = {};
  const errors = [];
  const has = (k) => body[k] !== undefined;
  const today = localDay(new Date(), user.timezone);

  if (has("title") || !partial) { const t = clean(body.title, 100); if (t.length < 2) errors.push("Give the goal a title."); out.title = t; }
  if (has("description")) out.description = clean(body.description, 400);
  if (has("targetMinutes") || !partial) {
    const n = Number(body.targetMinutes);
    if (!Number.isInteger(n) || n < 5 || n > 480) errors.push("Daily target must be 5–480 minutes."); else out.targetMinutes = n;
  }
  if (has("studyDays")) {
    const d = Array.isArray(body.studyDays) ? [...new Set(body.studyDays.map(Number))] : [];
    if (!d.length || d.some((x) => !Number.isInteger(x) || x < 0 || x > 6)) errors.push("Choose at least one study day."); else out.studyDays = d.sort();
  }
  if (has("startDay") || !partial) {
    const s = body.startDay || today;
    if (!isDayString(s)) errors.push("Start date isn't valid."); else out.startDay = s;
  }
  if (has("endDay")) {
    if (body.endDay === "" || body.endDay === null) out.endDay = undefined;
    else if (!isDayString(body.endDay)) errors.push("End date isn't valid."); else out.endDay = body.endDay;
  }
  const start = out.startDay;
  if (start && out.endDay && out.endDay < start) errors.push("The end date must be after the start date.");
  if (start && out.endDay && out.endDay > addDays(start, 366)) errors.push("A goal can span up to a year.");
  if (has("reminderEnabled")) out.reminderEnabled = Boolean(body.reminderEnabled);
  if (has("reminderTime")) { if (parseClock(body.reminderTime) === null) errors.push("Reminder time must look like 18:30."); else out.reminderTime = body.reminderTime; }
  if (has("courseId") && body.courseId) {
    const c = mongoose.isValidObjectId(body.courseId) ? await Course.findById(body.courseId).select("schoolId") : null;
    if (!c || !canAccessSchool(user, c.schoolId)) errors.push("Choose a course from your own school."); else out.courseId = c._id;
  }
  if (has("materialId") && body.materialId) {
    const m = mongoose.isValidObjectId(body.materialId) ? await Material.findById(body.materialId).select("uploadedBy visibility status schoolId") : null;
    if (!m || !canViewMaterial(user, m)) errors.push("Choose a material you have access to."); else out.materialId = m._id;
  }
  return { out, errors };
}

// GET /api/goals
export async function listGoals(req, res, next) {
  try {
    const goals = await StudyGoal.find({ user: req.user._id }).sort({ status: 1, createdAt: -1 }).limit(100);
    const today = localDay(new Date(), req.user.timezone);
    const mins = await minutesByGoal(req.user._id, goals.map((g) => g._id));
    res.json({ goals: goals.map((g) => view(g, today, mins.get(idStr(g._id)))), today });
  } catch (err) { next(err); }
}

// POST /api/goals
export async function createGoal(req, res, next) {
  try {
    const { out, errors } = await readGoal(req.body || {}, req.user, { partial: false });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const active = await StudyGoal.countDocuments({ user: req.user._id, status: { $ne: "completed" } });
    if (active >= PLATFORM.goals.maxActive) return res.status(400).json({ message: `You can have up to ${PLATFORM.goals.maxActive} open goals. Complete or delete one first.` });
    const goal = await StudyGoal.create({ studyDays: [1, 2, 3, 4, 5], ...out, user: req.user._id });
    res.status(201).json({ goal: view(goal, localDay(new Date(), req.user.timezone), {}) });
  } catch (err) { next(err); }
}

async function ownGoal(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ message: "Goal not found." }); return null; }
  const g = await StudyGoal.findOne({ _id: req.params.id, user: req.user._id });
  if (!g) { res.status(404).json({ message: "Goal not found." }); return null; }
  return g;
}

// PUT /api/goals/:id   (also pauses/resumes: { status: "paused" | "active" })
export async function updateGoal(req, res, next) {
  try {
    const goal = await ownGoal(req, res); if (!goal) return;
    if (goal.status === "completed") return res.status(409).json({ message: "Completed goals can't be edited." });
    const { out, errors } = await readGoal(req.body || {}, req.user, { partial: true });
    if (["active", "paused"].includes(req.body?.status)) out.status = req.body.status;
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    Object.assign(goal, out);
    if ("endDay" in out && out.endDay === undefined) goal.endDay = undefined;
    if (goal.endDay && goal.endDay < goal.startDay) return res.status(400).json({ message: "The end date must be after the start date." });
    await goal.save();
    const mins = await minutesByGoal(req.user._id, [goal._id]);
    res.json({ goal: view(goal, localDay(new Date(), req.user.timezone), mins.get(idStr(goal._id))) });
  } catch (err) { next(err); }
}

// DELETE /api/goals/:id
export async function deleteGoal(req, res, next) {
  try {
    const goal = await ownGoal(req, res); if (!goal) return;
    await Promise.all([StudyGoal.deleteOne({ _id: goal._id }), StudySession.updateMany({ goal: goal._id }, { $unset: { goal: 1 } })]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/goals/:id/complete — marks done; pays the reward only if the effort was real.
export async function completeGoal(req, res, next) {
  try {
    const goal = await ownGoal(req, res); if (!goal) return;
    if (goal.status === "completed") return res.json({ goal: view(goal, localDay(new Date(), req.user.timezone), (await minutesByGoal(req.user._id, [goal._id])).get(idStr(goal._id))), rewarded: false });
    const today = localDay(new Date(), req.user.timezone);
    const mins = (await minutesByGoal(req.user._id, [goal._id])).get(idStr(goal._id)) || {};
    const progress = goalProgress({ startDay: goal.startDay, endDay: goal.endDay, studyDays: goal.studyDays, targetMinutes: goal.targetMinutes, minutesByDay: mins, today });
    const eligible = goalCompletionEligible(progress, { minMetDays: PLATFORM.goals.completionMinMetDays, minPercent: PLATFORM.goals.completionMinPercent });

    // Atomic flip so a double-click can't complete (and pay) twice.
    const claimed = await StudyGoal.findOneAndUpdate({ _id: goal._id, status: { $ne: "completed" } }, { $set: { status: "completed", completedAt: new Date() } }, { new: true });
    if (!claimed) return res.json({ goal: view(goal, today, mins), rewarded: false });

    let rewarded = false;
    if (eligible && PLATFORM.rewards.goalCompleted > 0) {
      const r = await awardPoints({ userId: req.user._id, points: PLATFORM.rewards.goalCompleted, reason: `Completed goal: ${goal.title}`, sourceType: "goal", sourceId: goal._id, key: `goal_completed:${goal._id}` });
      rewarded = r.awarded;
      if (rewarded) await StudyGoal.updateOne({ _id: goal._id }, { $set: { completionRewarded: true } });
    }
    const fresh = await StudyGoal.findById(goal._id);
    res.json({
      goal: view(fresh, today, mins), rewarded, points: rewarded ? PLATFORM.rewards.goalCompleted : 0,
      message: rewarded ? "Goal completed — points earned!" : eligible ? "Goal completed." : `Goal completed. Points are earned after at least ${PLATFORM.goals.completionMinMetDays} study days at ${PLATFORM.goals.completionMinPercent}% consistency.`,
    });
  } catch (err) { next(err); }
}

// POST /api/goals/sessions  body: { minutes, goalId?, note?, day? }   day: today or yesterday only
export async function logSession(req, res, next) {
  try {
    const minutes = Number(req.body?.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > PLATFORM.goals.maxSessionMinutes) {
      return res.status(400).json({ message: `A session can be 1–${PLATFORM.goals.maxSessionMinutes} minutes.` });
    }
    const today = localDay(new Date(), req.user.timezone);
    const day = req.body?.day || today;
    // No back-filling weeks of history to fake a streak.
    if (day !== today && day !== addDays(today, -1)) return res.status(400).json({ message: "You can log sessions for today or yesterday." });

    let goal = null;
    if (req.body?.goalId) {
      if (!mongoose.isValidObjectId(req.body.goalId)) return res.status(400).json({ message: "Choose a valid goal." });
      goal = await StudyGoal.findOne({ _id: req.body.goalId, user: req.user._id });
      if (!goal) return res.status(404).json({ message: "Goal not found." });
    }
    const [dayTotal] = await StudySession.aggregate([{ $match: { user: toObjectId(req.user._id), day } }, { $group: { _id: null, total: { $sum: "$minutes" } } }]);
    if ((dayTotal?.total || 0) + minutes > PLATFORM.goals.maxDailyMinutes) {
      return res.status(400).json({ message: `That would put you over ${PLATFORM.goals.maxDailyMinutes / 60} hours of study logged for one day.` });
    }
    const session = await StudySession.create({ user: req.user._id, goal: goal?._id, day, minutes, note: clean(req.body?.note, 200) });

    let streak = null;
    if (minutes >= PLATFORM.goals.minSessionMinutesForStreak) {
      const r = await recordActivity({ userId: req.user._id, type: "session", sourceKey: `session:${session._id}`, at: day === today ? new Date() : new Date(Date.now() - 24 * 3600 * 1000) });
      streak = r.streak || null;
    }
    res.status(201).json({ session: { _id: session._id, day, minutes }, streak, countsTowardStreak: minutes >= PLATFORM.goals.minSessionMinutesForStreak });
  } catch (err) { next(err); }
}

// GET /api/goals/sessions?limit=  — recent sessions
export async function recentSessions(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const rows = await StudySession.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit).populate("goal", "title").lean();
    res.json({ sessions: rows.map((s) => ({ _id: s._id, day: s.day, minutes: s.minutes, note: s.note, goal: s.goal ? { _id: s.goal._id, title: s.goal.title } : null })) });
  } catch (err) { next(err); }
}
