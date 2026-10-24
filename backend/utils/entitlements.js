import Entitlement from "../models/Entitlement.js";
import { getSubscriptions } from "./settings.js";
import { resolveAccess } from "./access.js";

// The single place that answers "may this user use this feature?". Every
// feature-gated endpoint asks here (never the UI alone) and so does the
// /billing/me endpoint the UI reads — one definition, no drift.
//
// Returns { allowed, access, code?, message? } where `access` is the full
// resolution (reason, plan limits, expiry).
export async function checkEntitlement(user, featureKey) {
  if (user?.role === "admin") return { allowed: true, access: { allowed: true, reason: "admin", limits: {} } };
  const subs = await getSubscriptions();
  let entitlements = [];
  // No database round-trip while subscriptions are off or this feature is free.
  if (subs.enabled && subs.features?.[featureKey]?.access === "paid") {
    entitlements = await Entitlement.find({ user: user._id, status: "active", expiresAt: { $gt: new Date() } }).lean();
  }
  const access = resolveAccess({ subscriptions: subs, featureKey, entitlements });
  return access.allowed
    ? { allowed: true, access }
    : { allowed: false, access, code: access.code, message: "This feature is part of a paid plan. See the plans to unlock it." };
}

/** Resolves every feature at once (for the UI). */
export async function resolveAllAccess(user, featureKeys) {
  const subs = await getSubscriptions();
  const entitlements = subs.enabled && user.role !== "admin"
    ? await Entitlement.find({ user: user._id, status: "active", expiresAt: { $gt: new Date() } }).lean()
    : [];
  const out = {};
  for (const k of featureKeys) out[k] = user.role === "admin" ? { allowed: true, reason: "admin", limits: {} } : resolveAccess({ subscriptions: subs, featureKey: k, entitlements });
  return { subscriptions: subs, entitlements, access: out };
}
