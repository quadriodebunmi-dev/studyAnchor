import { PLATFORM } from "../config/platform.js";
import { localDay, localMinutes, parseClock, weekdayOf } from "./streaks.js";

/**
 * Pure: should this goal's reminder fire for this learner right now?
 * Rules: reminder on, goal active, today is a study day inside the goal's dates,
 * the reminder time has passed but not by more than the window (no stale "study
 * now" at midnight), and today's target isn't already met.
 */
export function shouldRemind({ goal, tz, now, minutesToday, windowMinutes = PLATFORM.goals.reminderWindowMinutes }) {
  if (!goal.reminderEnabled || goal.status !== "active") return false;
  const today = localDay(now, tz);
  if (today < goal.startDay || (goal.endDay && today > goal.endDay)) return false;
  if (!(goal.studyDays?.length ? goal.studyDays : [0, 1, 2, 3, 4, 5, 6]).includes(weekdayOf(today))) return false;
  const at = parseClock(goal.reminderTime);
  if (at === null) return false;
  const nowMin = localMinutes(now, tz);
  if (nowMin < at || nowMin - at > windowMinutes) return false;
  return (minutesToday || 0) < goal.targetMinutes;
}

