import StudyActivity from "../models/StudyActivity.js";
import User from "../models/User.js";
import { PLATFORM } from "../config/platform.js";
import { localDay, addDays, computeStreak, currentStreakStart, qualifyingDays } from "./streaks.js";
import { awardPoints } from "./rewards.js";
import { notifyUser } from "./notify.js";
import { toObjectId } from "./objectId.js";

// The single entry point for "this learner just studied". It:
//  1. records a de-duplicated activity row (unique per user + sourceKey),
//  2. recomputes the streak from the learner's own calendar days,
//  3. pays one-off streak milestone bonuses and tells them about it.
// Best-effort by design: a failure here must never fail the action that triggered it.

const LOOKBACK_DAYS = 400;

export async function loadStreakDays(userId, today) {
  const since = addDays(today, -LOOKBACK_DAYS);
  const rows = await StudyActivity.aggregate([
    { $match: { user: toObjectId(userId), day: { $gte: since } } },
    { $group: { _id: { day: "$day", type: "$type" }, n: { $sum: 1 } } },
  ]);
  return qualifyingDays(rows.map((r) => ({ day: r._id.day, type: r._id.type, n: r.n })));
}

export async function getStreak(user, now = new Date()) {
  const today = localDay(now, user.timezone);
  const days = await loadStreakDays(user._id, today);
  return { ...computeStreak(days, today), today };
}

/** Recomputes the streak for `day` and pays any milestone bonus. Idempotent via the award key. */
export async function evaluateStreak(userId, day) {
  const days = await loadStreakDays(userId, day);
  const streak = computeStreak(days, day);
  const bonus = PLATFORM.rewards.streakMilestones?.[streak.current];
  if (bonus && streak.activeToday) {
    const start = currentStreakStart(days, day);
    const key = `streak:${userId}:${streak.current}:${start}`;
    const r = await awardPoints({ userId, points: bonus, reason: `${streak.current}-day study streak`, sourceType: "streak", key });
    if (r.awarded) {
      notifyUser(userId, {
        category: "achievements", type: "streak_milestone",
        title: `🔥 ${streak.current}-day streak!`, body: `Nice consistency — you earned ${bonus} bonus points.`,
        link: "/goals", dedupeKey: key,
      });
    }
  }
  return streak;
}

/**
 * recordActivity({ userId, type, sourceKey, at?, skipStreak? }) -> { created, day, streak? }
 * `sourceKey` must be deterministic for the action (e.g. "exam:<attemptId>").
 */
export async function recordActivity({ userId, type, sourceKey, at = new Date(), skipStreak = false }) {
  try {
    const user = await User.findById(userId).select("timezone suspended");
    if (!user || user.suspended) return { created: false };
    const day = localDay(at, user.timezone);
    try {
      await StudyActivity.create({ user: userId, day, type, sourceKey });
    } catch (err) {
      if (err?.code === 11000) return { created: false, day };
      throw err;
    }
    return { created: true, day, streak: skipStreak ? undefined : await evaluateStreak(userId, day) };
  } catch (err) {
    console.error("recordActivity failed:", err.message);
    return { created: false, error: true };
  }
}
