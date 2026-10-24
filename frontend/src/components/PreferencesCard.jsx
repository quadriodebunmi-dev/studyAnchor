import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Button from "./Button.jsx";
import { Field, Select } from "./FormFields.jsx";
import { useToast } from "./Toast.jsx";
import { getPreferences, getPushConfig, removePushSubscription, savePushSubscription, updatePreferences } from "../services/progressService.js";

// Leaderboard privacy, time zone (for streaks & reminders) and push notifications.
const zones = () => { try { return Intl.supportedValuesOf("timeZone"); } catch { return ["UTC", "Africa/Lagos", "Europe/London", "America/New_York", "Asia/Kolkata"]; } };
const b64ToBytes = (b64) => { const pad = "=".repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

// `navigator.serviceWorker.ready` never settles when no worker is registered (e.g. `npm run dev`,
// where registerSW.js deliberately skips registration), so race it against a timeout.
const swReady = (ms = 5000) => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, rej) => setTimeout(() => rej(new Error("The service worker isn't active. Use a production build (npm run build && npm run preview) or reload the page.")), ms)),
]);

export default function PreferencesCard() {
  const toast = useToast();
  const [p, setP] = useState(null);
  const [push, setPush] = useState({ configured: false, enabled: false, supported: "serviceWorker" in navigator && "PushManager" in window });

  useEffect(() => {
    getPreferences().then(setP).catch(() => {});

    // 1) Server config: shown immediately, independent of the service worker.
    getPushConfig()
      .then((c) => setPush((s) => ({ ...s, configured: Boolean(c?.configured), publicKey: c?.publicKey })))
      .catch((e) => console.error("push config failed:", e));

    // 2) Per-device subscription state: fills in whenever a service worker is ready.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPush((s) => ({ ...s, enabled: Boolean(sub) })))
        .catch(() => {});
    }
  }, []);
  if (!p) return null;

  async function save(patch) {
    const next = { ...p, ...patch };
    setP(next);
    try { await updatePreferences(patch); toast("Saved", "success"); } catch (e) { toast(e.message || "Couldn't save.", "error"); getPreferences().then(setP); }
  }

  async function togglePush() {
    try {
      const reg = await swReady();
      if (push.enabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
        setPush((s) => ({ ...s, enabled: false })); toast("Push notifications off", "success"); return;
      }
      if ((await Notification.requestPermission()) !== "granted") return toast("Notifications are blocked in your browser settings.", "error");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(push.publicKey) });
      const j = sub.toJSON();
      await savePushSubscription({ endpoint: j.endpoint, keys: j.keys });
      setPush((s) => ({ ...s, enabled: true })); toast("Push notifications on", "success");
    } catch (e) { toast(e.message || "Couldn't change push notifications.", "error"); }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold">Leaderboard, time zone &amp; notifications</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Leaderboard visibility" hint="Public shows 'Ada O.' — never your email.">
          <Select value={p.leaderboardVisibility} onChange={(e) => save({ leaderboardVisibility: e.target.value })}>
            <option value="public">Show my name</option><option value="anonymous">Anonymous learner</option><option value="hidden">Hide me completely</option>
          </Select>
        </Field>
        <Field label="Time zone" hint="Your streak days and reminders follow this.">
          <Select value={p.timezone} onChange={(e) => save({ timezone: e.target.value })}>{[...new Set([p.timezone, ...zones()])].map((z) => <option key={z}>{z}</option>)}</Select>
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={p.showSchoolOnLeaderboard} disabled={p.leaderboardVisibility !== "public"} onChange={(e) => save({ showSchoolOnLeaderboard: e.target.checked })} />Show my school next to my name</label>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4" />Push notifications</p>
        {!push.supported ? <p className="mt-1 text-xs lv-meta">This browser doesn't support push notifications. You'll still get in-app notifications.</p>
          : !push.configured ? <p className="mt-1 text-xs lv-meta">Push isn't set up on this server yet. In-app notifications work as normal.</p>
          : <Button size="sm" variant="outline" className="mt-2" onClick={togglePush}>{push.enabled ? "Turn off push on this device" : "Turn on push on this device"}</Button>}
      </div>
    </div>
  );
}