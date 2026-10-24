import { useCallback, useEffect, useState } from "react";
import { getPushConfig, removePushSubscription, savePushSubscription } from "../services/progressService.js";

const b64ToBytes = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// `serviceWorker.ready` never settles when no worker is registered (e.g. plain `npm run dev`).
const swReady = (ms = 5000) => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, rej) => setTimeout(() => rej(new Error("The service worker isn't active. Use a production build or reload the page.")), ms)),
]);

// Push on/off for this device. Returns { supported, configured, enabled, busy, toggle }.
// toggle() resolves to { ok, message } so the caller decides how to show it.
export default function usePushNotifications() {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [state, setState] = useState({ configured: false, publicKey: null, enabled: false, busy: false });

  useEffect(() => {
    if (!supported) return undefined;
    let live = true;
    getPushConfig()
      .then((c) => live && setState((s) => ({ ...s, configured: Boolean(c?.configured), publicKey: c?.publicKey })))
      .catch(() => {});
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => live && setState((s) => ({ ...s, enabled: Boolean(sub) && Notification.permission === "granted" })))
      .catch(() => {});
    return () => { live = false; };
  }, [supported]);

  const toggle = useCallback(async () => {
    if (state.busy) return { ok: false, message: "" };
    setState((s) => ({ ...s, busy: true }));
    try {
      const reg = await swReady();
      if (state.enabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
        setState((s) => ({ ...s, enabled: false, busy: false }));
        return { ok: true, message: "Push notifications off" };
      }
      if (Notification.permission === "denied") throw new Error("Notifications are blocked. Allow them in your browser's site settings, then try again.");
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications weren't allowed.");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(state.publicKey) });
      const j = sub.toJSON();
      await savePushSubscription({ endpoint: j.endpoint, keys: j.keys });
      setState((s) => ({ ...s, enabled: true, busy: false }));
      return { ok: true, message: "Push notifications on" };
    } catch (e) {
      setState((s) => ({ ...s, busy: false }));
      return { ok: false, message: e?.message || "Couldn't change push notifications." };
    }
  }, [state.busy, state.enabled, state.publicKey]);

  return { supported, configured: state.configured, enabled: state.enabled, busy: state.busy, toggle };
}