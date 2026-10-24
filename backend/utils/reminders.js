import StudyGoal from "../models/StudyGoal.js";
import StudySession from "../models/StudySession.js";
import User from "../models/User.js";
import { localDay } from "./streaks.js";
import { shouldRemind } from "./reminderRules.js";
import { notifyUser } from "./notify.js";

/**
 * Sends due goal reminders (in-app, plus push when configured). One reminder per
 * goal per local day (dedupeKey), so running this every minute — or from two
 * servers at once — never repeats it.
 */
export async function processGoalReminders(now = new Date()) {
  const goals = await StudyGoal.find({ status: "active", reminderEnabled: true }).limit(5000);
  if (!goals.length) return 0;
  const users = await User.find({ _id: { $in: [...new Set(goals.map((g) => String(g.user)))] }, suspended: { $ne: true } }).select("timezone");
  const tzOf = new Map(users.map((u) => [String(u._id), u.timezone || "UTC"]));

  let sent = 0;
  for (const goal of goals) {
    const tz = tzOf.get(String(goal.user));
    if (!tz) continue;
    const today = localDay(now, tz);
    const [agg] = await StudySession.aggregate([{ $match: { goal: goal._id, day: today } }, { $group: { _id: null, m: { $sum: "$minutes" } } }]);
    if (!shouldRemind({ goal, tz, now, minutesToday: agg?.m || 0 })) continue;
    const n = await notifyUser(goal.user, {
      category: "reminders", type: "goal_reminder",
      title: `Time to study: ${goal.title}`, body: `Your goal today is ${goal.targetMinutes} minutes.`,
      link: "/goals", dedupeKey: `goal:${goal._id}:${today}`,
    });
    sent += n;
  }
  return sent;
}
