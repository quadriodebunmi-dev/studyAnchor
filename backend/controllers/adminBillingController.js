import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Entitlement from "../models/Entitlement.js";
import PlatformSetting from "../models/PlatformSetting.js";
import User from "../models/User.js";
import { paginate } from "../utils/pagination.js";
import { audit } from "../utils/audit.js";
import { getSubscriptions, setSubscriptionsCache, refreshSettings } from "../utils/settings.js";
import { validateSubscriptionsConfig, FEATURE_KEYS, FEATURE_LABELS, LIMIT_KEYS } from "../utils/subscriptionConfig.js";
import { notifyUser } from "../utils/notify.js";

// GET /api/admin/subscriptions
export async function getSubscriptionConfig(req, res, next) {
  try {
    await refreshSettings(true);
    res.json({
      config: await getSubscriptions(), featureKeys: FEATURE_KEYS, featureLabels: FEATURE_LABELS, limitKeys: LIMIT_KEYS,
      paymentsConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      policy: [
        "Subscriptions are off until you turn them on; while off, every feature is free.",
        "People who already bought a plan keep what they bought until it expires, even if you later edit the plan or make a feature free.",
        "Marking a feature paid applies immediately to anyone without an active plan that includes it.",
        "Refunds revoke the access that payment bought.",
      ],
    });
  } catch (err) { next(err); }
}

// PUT /api/admin/subscriptions
export async function updateSubscriptionConfig(req, res, next) {
  try {
    const v = validateSubscriptionsConfig(req.body);
    if (!v.ok) return res.status(400).json({ message: v.errors[0], errors: v.errors });
    if (v.value.enabled && !process.env.PAYSTACK_SECRET_KEY) {
      return res.status(400).json({ message: "Set PAYSTACK_SECRET_KEY on the server before enabling subscriptions.", errors: ["PAYSTACK_SECRET_KEY is not configured."] });
    }
    const before = await getSubscriptions();
    await PlatformSetting.findOneAndUpdate({ key: "subscriptions" }, { $set: { value: v.value, updatedBy: req.user._id } }, { upsert: true });
    setSubscriptionsCache(v.value);
    audit(req, "subscriptions.update", { targetType: "settings", summary: `Subscriptions ${v.value.enabled ? "enabled" : "disabled"}; ${v.value.plans.length} plan(s)`, meta: { wasEnabled: Boolean(before.enabled), enabled: v.value.enabled, plans: v.value.plans.map((p) => p.key).join(",") } });
    res.json({ config: v.value });
  } catch (err) { next(err); }
}

// GET /api/admin/payments?status=&search=
export async function listPayments(req, res, next) {
  try {
    const filter = {};
    if (["pending", "success", "failed", "abandoned", "refunded"].includes(req.query.status)) filter.status = req.query.status;
    const search = String(req.query.search || "").trim().slice(0, 80);
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const users = await User.find({ $or: [{ email: rx }, { name: rx }] }).select("_id").limit(50).lean();
      filter.$or = [{ reference: rx }, { user: { $in: users.map((u) => u._id) } }];
    }
    const { items, pagination } = await paginate(Payment, filter, req.query, { populate: [["user", "name email"]], defaultLimit: 20, lean: true, select: "reference planSnapshot.name amountMinor currency status failureReason paidAt createdAt user" });
    res.json({ payments: items.map((p) => ({ _id: p._id, reference: p.reference, plan: p.planSnapshot?.name, amountMinor: p.amountMinor, currency: p.currency, status: p.status, failureReason: p.failureReason, paidAt: p.paidAt, createdAt: p.createdAt, user: p.user ? { _id: p.user._id, name: p.user.name, email: p.user.email } : null })), pagination });
  } catch (err) { next(err); }
}

// GET /api/admin/payments/summary
export async function paymentSummary(req, res, next) {
  try {
    const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [byStatus, revenueAll, revenue30, active] = await Promise.all([
      Payment.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: { status: "success" } }, { $group: { _id: "$currency", amountMinor: { $sum: "$amountMinor" } } }]),
      Payment.aggregate([{ $match: { status: "success", paidAt: { $gte: d30 } } }, { $group: { _id: "$currency", amountMinor: { $sum: "$amountMinor" } } }]),
      Entitlement.countDocuments({ status: "active", expiresAt: { $gt: new Date() } }),
    ]);
    res.json({ byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.n])), revenueAllTime: revenueAll, revenueLast30Days: revenue30, activeSubscribers: active });
  } catch (err) { next(err); }
}

// POST /api/admin/entitlements/:id/revoke  { reason }
export async function revokeEntitlement(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Entitlement not found." });
    const reason = String(req.body?.reason || "").trim().slice(0, 160);
    if (reason.length < 3) return res.status(400).json({ message: "Give a reason." });
    const ent = await Entitlement.findOneAndUpdate({ _id: req.params.id, status: "active" }, { $set: { status: "revoked", revokedReason: reason } }, { new: true });
    if (!ent) return res.status(404).json({ message: "No active entitlement found." });
    audit(req, "entitlement.revoke", { targetType: "user", targetId: ent.user, summary: `Revoked ${ent.planName || ent.planKey}`, meta: { reason } });
    notifyUser(ent.user, { category: "payments", type: "entitlement_revoked", title: "Your plan access was changed", body: reason, link: "/billing", dedupeKey: `entitlement:${ent._id}:revoked` });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
