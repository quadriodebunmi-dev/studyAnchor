// The notification engine, with its collaborators passed in. That keeps the
// rules (preferences, dedupe, failure isolation) unit-testable without a
// database; utils/notify.js wires it to the real models.

export const NOTIFICATION_CATEGORIES = {
  rooms: "Room invitations, requests and activity",
  quizzes: "Room quizzes, deadlines and results",
  materials: "New study materials for your courses",
  reminders: "Study goal reminders",
  calendar: "New events and reminders on the education calendar",
  achievements: "Points, streaks and goals",
  announcements: "Announcements from Study Anchor",
  payments: "Payments and subscription updates",
  system: "Account and security",
};
// People can't switch these off: they are about money, their account, or platform-wide notices.
export const ALWAYS_ON = new Set(["announcements", "payments", "system"]);

export const prefEnabled = (user, category) => {
  if (ALWAYS_ON.has(category)) return true;
  const prefs = user.notificationPrefs;
  const v = prefs?.get ? prefs.get(category) : prefs?.[category];
  return v !== false;
};

/**
 * deps: { Notification, User, emit(userId, event, payload), push?(userId, payload), log? }
 * Returns notifyUsers(ids, payload) -> number created. Never throws.
 */
export function createNotifier({ Notification, User, emit = () => {}, push, log = console.error }) {
  return async function notifyUsers(userIds, { category = "system", type, title, body = "", link = "", data, dedupeKey } = {}) {
    try {
      const ids = [...new Set((userIds || []).map(String))];
      if (!ids.length || !type || !title) return 0;

      const users = await User.find({ _id: { $in: ids }, suspended: { $ne: true } }).select("notificationPrefs");
      let recipients = users.filter((u) => prefEnabled(u, category)).map((u) => String(u._id));
      if (!recipients.length) return 0;

      if (dedupeKey) {
        const already = await Notification.find({ user: { $in: recipients }, dedupeKey }).select("user").lean();
        const skip = new Set(already.map((n) => String(n.user)));
        recipients = recipients.filter((id) => !skip.has(id));
        if (!recipients.length) return 0;
      }

      const docs = recipients.map((user) => ({ user, category, type, title, body, link, data, dedupeKey }));
      let created = [];
      try {
        created = await Notification.insertMany(docs, { ordered: false });
      } catch (err) {
        // A concurrent duplicate trips the unique index; the rest still land.
        if (err?.code !== 11000 && !err?.writeErrors) throw err;
        created = err.insertedDocs || [];
      }
      for (const n of created) {
        // Delivery channels are best-effort: one failing must not affect the others or the caller.
        try { emit(String(n.user), "notification:new", { _id: n._id, type, title, body, link, createdAt: n.createdAt }); } catch (e) { log("emit failed:", e.message); }
        if (push) Promise.resolve(push(String(n.user), { title, body, link, type })).catch((e) => log("push failed:", e.message));
      }
      return created.length || recipients.length;
    } catch (err) {
      log("notifyUsers failed:", err.message);
      return 0;
    }
  };
}
