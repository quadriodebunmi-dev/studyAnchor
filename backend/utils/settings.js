import PlatformSetting from "../models/PlatformSetting.js";
import { PLATFORM, PLATFORM_DEFAULTS } from "../config/platform.js";
import { DEFAULT_SUBSCRIPTIONS } from "./subscriptionConfig.js";

// Runtime, admin-editable settings stored in MongoDB:
//  - "overrides": whitelisted numeric tweaks to config/platform.js (rewards, limits…),
//    applied in place onto the live PLATFORM object;
//  - "subscriptions": plans, feature access and the on/off switch.
// Instances re-read them every 60 s, so a change reaches every server within a minute.

const TTL = 60 * 1000;
let loadedAt = 0;
let subscriptions = DEFAULT_SUBSCRIPTIONS;
let pending = null;

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
  cur[parts[parts.length - 1]] = value;
}
const getPath = (obj, dotted) => dotted.split(".").reduce((o, k) => o?.[k], obj);

/** Applies a flat {"rewards.goalCompleted": 20} map onto the live config. */
export function applyOverrides(flat = {}) {
  for (const [k, v] of Object.entries(flat)) setPath(PLATFORM, k, v);
}
/** Puts a key back to its shipped default. */
export function resetOverride(key) {
  const d = getPath(PLATFORM_DEFAULTS, key);
  if (d !== undefined) setPath(PLATFORM, key, d);
}

export async function refreshSettings(force = false) {
  if (!force && Date.now() - loadedAt < TTL) return;
  if (pending) return pending;
  pending = (async () => {
    try {
      const docs = await PlatformSetting.find({ key: { $in: ["overrides", "subscriptions"] } }).lean();
      for (const d of docs) {
        if (d.key === "overrides") applyOverrides(d.value || {});
        if (d.key === "subscriptions") subscriptions = { ...DEFAULT_SUBSCRIPTIONS, ...(d.value || {}) };
      }
      loadedAt = Date.now();
    } catch (err) {
      console.error("settings refresh failed (keeping last known values):", err.message);
    } finally { pending = null; }
  })();
  return pending;
}

export async function getSubscriptions() {
  await refreshSettings();
  return subscriptions;
}

export function setSubscriptionsCache(value) { subscriptions = value; loadedAt = Date.now(); }

/** Express middleware: keeps the cache warm without blocking requests on a stale-but-valid cache. */
export function settingsMiddleware(req, res, next) {
  if (Date.now() - loadedAt >= TTL) refreshSettings().catch(() => {});
  next();
}
