import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitToUser } from "./realtime.js";
import { sendPush } from "./push.js";
import { createNotifier, NOTIFICATION_CATEGORIES, ALWAYS_ON } from "./notifier.js";

// The one doorway for in-app notifications (see utils/notifier.js for the rules).
// Channels: in-app (always), live Socket.IO nudge, and Web Push when configured.
export { NOTIFICATION_CATEGORIES, ALWAYS_ON };

export const notifyUsers = createNotifier({ Notification, User, emit: emitToUser, push: sendPush });
export const notifyUser = (userId, payload) => notifyUsers([userId], payload);

/** Notifies a large audience in chunks so one announcement can't build a giant query/insert. */
export async function notifyMany(userIds, payload, chunk = 500) {
  let total = 0;
  for (let i = 0; i < userIds.length; i += chunk) total += await notifyUsers(userIds.slice(i, i + chunk), payload);
  return total;
}
