import { processQuizSchedule } from "./roomQuizService.js";
import { processGoalReminders } from "./reminders.js";
import { processCalendarReminders } from "./calendarReminders.js";
import { expirePendingPayments } from "../controllers/billingController.js";

// Everything that has to happen "because time passed". Each job is independent
// and idempotent, so this is safe to run every minute from a timer on a
// long-running server AND from an external cron hitting /api/internal/cron.
export async function runScheduledJobs() {
  const jobs = { quizzes: processQuizSchedule, reminders: processGoalReminders, calendar: processCalendarReminders, payments: expirePendingPayments };
  const result = {};
  for (const [name, job] of Object.entries(jobs)) {
    try { result[name] = await job(); } catch (err) { result[name] = `failed: ${err.message}`; console.error(`scheduled job "${name}" failed:`, err.message); }
  }
  return result;
}
