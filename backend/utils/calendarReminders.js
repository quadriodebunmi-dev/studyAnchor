import CalendarEvent from "../models/CalendarEvent.js";
import User from "../models/User.js";
import { notifyMany } from "./notify.js";

const AUDIENCE_CAP = 2000;
const REMIND_AHEAD_MS = 24 * 60 * 60 * 1000;

const when = (e) => {
  const d = new Date(e.startsAt);
  return e.allDay
    ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    : d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Students and reps an event is meant for (never the creator). Platform-wide dates have no audience here. */
export async function audienceFor(event, { cap = AUDIENCE_CAP } = {}) {
  if (event.scope === "personal") return [];
  if (!event.schoolId) return [];
  const filter = { role: { $in: ["student", "rep"] }, schoolId: event.schoolId, suspended: { $ne: true }, _id: { $ne: event.createdBy } };
  if (event.department) filter.department = event.department;
  if (event.level) filter.level = event.level;
  const users = await User.find(filter).select("_id").limit(cap).lean();
  return users.map((u) => u._id);
}

/** Tells the audience a new shared event was added. Fire and forget; never throws. */
export async function notifyNewEvent(event) {
  try {
    if (new Date(event.startsAt) < new Date()) return 0;
    const ids = await audienceFor(event);
    return await notifyMany(ids, {
      category: "calendar", type: "calendar_new",
      title: `New on the calendar: ${event.title}`, body: when(event),
      link: "/calendar", dedupeKey: `calendar:${event._id}:new`,
    });
  } catch (err) {
    console.error("notifyNewEvent failed:", err.message);
    return 0;
  }
}

/**
 * "Starting within 24 hours" reminders. Each event is claimed atomically (remindedAt), so
 * a timer and the cron endpoint can both run this and every person still hears about it once.
 */
export async function processCalendarReminders(now = new Date()) {
  const soon = await CalendarEvent.find({
    remindedAt: { $exists: false }, startsAt: { $gt: now, $lte: new Date(now.getTime() + REMIND_AHEAD_MS) },
  }).limit(200);

  let sent = 0;
  for (const e of soon) {
    const claimed = await CalendarEvent.findOneAndUpdate({ _id: e._id, remindedAt: { $exists: false } }, { $set: { remindedAt: now } });
    if (!claimed) continue;
    const ids = [e.createdBy, ...(await audienceFor(e))];
    sent += await notifyMany(ids, {
      category: "calendar", type: "calendar_reminder",
      title: `Coming up: ${e.title}`, body: when(e),
      link: "/calendar", dedupeKey: `calendar:${e._id}:${new Date(e.startsAt).getTime()}:soon`,
    });
  }
  return sent;
}
