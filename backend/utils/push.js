import PushSubscription from "../models/PushSubscription.js";

// Web Push (optional). Needs: `npm i web-push`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and
// VAPID_SUBJECT (mailto:...) in the environment — generate keys with `npx web-push generate-vapid-keys`.
// Without them this is a no-op and people simply get in-app notifications.
let webpush = null;
let tried = false;

async function lib() {
  if (tried) return webpush;
  tried = true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return null;
  try {
    ({ default: webpush } = await import("web-push"));
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@example.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  } catch {
    webpush = null;
    console.warn("⚠️  VAPID keys are set but the web-push package isn't installed — push disabled.");
  }
  return webpush;
}

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;
export const isPushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export async function sendPush(userId, { title, body, link, type }) {
  const wp = await lib();
  if (!wp) return;
  const subs = await PushSubscription.find({ user: userId });
  await Promise.all(subs.map(async (s) => {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body, link, type }));
    } catch (err) {
      // 404/410 = the browser dropped the subscription; clean it up.
      if (err?.statusCode === 404 || err?.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
    }
  }));
}
