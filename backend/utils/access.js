// Feature access resolution — pure, so the backend gate and the "what do I
// have?" API share exactly one definition. Subscriptions are OFF by default:
// when off, every feature is available (nothing is accidentally paywalled).
//
// Policy for changes (documented for admins):
//  - An entitlement snapshots the features/limits that were part of the plan
//    WHEN IT WAS BOUGHT and stays valid until it expires, even if the plan is
//    edited or a feature later becomes free. Edits affect new purchases only.
//  - Turning subscriptions off makes everything free immediately.
//  - Marking a feature "paid" takes effect immediately for people without an
//    active entitlement that includes it.

const ms = (d) => new Date(d).getTime();

export function activeEntitlements(entitlements = [], now = new Date()) {
  const t = ms(now);
  return entitlements.filter((e) => e.status === "active" && ms(e.startsAt) <= t && ms(e.expiresAt) > t);
}

export function resolveAccess({ subscriptions, featureKey, entitlements = [], now = new Date() }) {
  if (!subscriptions?.enabled) return { allowed: true, reason: "subscriptions_disabled", limits: {} };
  const rule = subscriptions.features?.[featureKey];
  if (!rule || rule.access !== "paid") return { allowed: true, reason: "free", limits: {} };

  const covering = activeEntitlements(entitlements, now).filter((e) => (e.features || []).includes(featureKey));
  if (!covering.length) {
    return { allowed: false, reason: "upgrade_required", code: "UPGRADE_REQUIRED", message: "This feature is part of a paid plan." };
  }
  const limits = {};
  for (const e of covering) {
    for (const [k, v] of Object.entries(e.limits || {})) {
      limits[k] = v === -1 || limits[k] === -1 ? -1 : Math.max(limits[k] ?? 0, v);
    }
  }
  return {
    allowed: true, reason: "plan", limits,
    planKeys: [...new Set(covering.map((e) => e.planKey))],
    expiresAt: new Date(Math.max(...covering.map((e) => ms(e.expiresAt)))),
  };
}

/** Daily AI ceiling: the free limit, raised (never lowered) by an active plan. -1 = unlimited. */
export function effectiveDailyLimit(baseLimit, access, usageKey) {
  const planLimit = access?.limits?.[usageKey];
  if (planLimit === -1) return Infinity;
  if (typeof planLimit === "number") return Math.max(baseLimit ?? 0, planLimit);
  return baseLimit ?? Infinity;
}
