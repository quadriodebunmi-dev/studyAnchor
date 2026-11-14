import crypto from "crypto";
import Payment from "../models/Payment.js";
import PaymentEvent from "../models/PaymentEvent.js";
import Entitlement from "../models/Entitlement.js";
import AutoRenewal from "../models/AutoRenewal.js";
import User from "../models/User.js";
import { ENV } from "../config/env.js";
import { PLATFORM } from "../config/platform.js";
import { getSubscriptions } from "../utils/settings.js";
import { resolveAllAccess } from "../utils/entitlements.js";
import { FEATURE_KEYS, FEATURE_LABELS } from "../utils/subscriptionConfig.js";
import { createPaystackClient, validateTransaction, verifySignature, PaystackError } from "../utils/paystack.js";
import { notifyUser } from "../utils/notify.js";
import { extractAuthorization, isRenewalDue, RETRY_GAP_MS, MAX_RENEW_FAILURES, NEEDS_CUSTOMER } from "../utils/autoRenew.js";

const secret = () => process.env.PAYSTACK_SECRET_KEY;
const client = () => createPaystackClient({ secret: secret() });
const DAY = 24 * 3600 * 1000;
const money = (minor, cur) => `${cur} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const publicPlan = (p) => ({ key: p.key, name: p.name, description: p.description, priceMinor: p.priceMinor, currency: p.currency, durationDays: p.durationDays, features: p.features, featureLabels: p.features.map((f) => FEATURE_LABELS[f]), limits: p.limits });

// GET /api/billing/plans
export async function listPlans(req, res, next) {
  try {
    const subs = await getSubscriptions();
    res.json({
      enabled: Boolean(subs.enabled), currency: subs.currency,
      plans: subs.enabled ? subs.plans.filter((p) => p.active).map(publicPlan) : [],
      paidFeatures: FEATURE_KEYS.filter((k) => subs.features?.[k]?.access === "paid").map((k) => ({ key: k, label: FEATURE_LABELS[k] })),
      paymentsConfigured: Boolean(secret()),
    });
  } catch (err) { next(err); }
}

// GET /api/billing/me — what the caller can use, what they've bought, recent payments
export async function myBilling(req, res, next) {
  try {
    const { subscriptions, entitlements, access } = await resolveAllAccess(req.user, FEATURE_KEYS);
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10).select("reference planSnapshot.name amountMinor currency status paidAt createdAt").lean();
    res.json({
      subscriptionsEnabled: Boolean(subscriptions.enabled),
      access,
      entitlements: entitlements.map((e) => ({ _id: e._id, planKey: e.planKey, planName: e.planName, startsAt: e.startsAt, expiresAt: e.expiresAt, features: e.features })),
      autoRenew: await autoRenewView(req.user._id),
      payments: payments.map((p) => ({ reference: p.reference, plan: p.planSnapshot?.name, amountMinor: p.amountMinor, currency: p.currency, status: p.status, at: p.paidAt || p.createdAt })),
    });
  } catch (err) { next(err); }
}

// POST /api/billing/checkout  body: { planKey } — price comes from OUR config, never the request
export async function checkout(req, res, next) {
  try {
    const subs = await getSubscriptions();
    if (!subs.enabled) return res.status(400).json({ message: "Subscriptions aren't available right now." });
    const plan = subs.plans.find((p) => p.key === String(req.body?.planKey || "") && p.active);
    if (!plan) return res.status(404).json({ message: "That plan isn't available." });
    if (!secret()) return res.status(503).json({ message: "Payments aren't available right now." });

    // Cheap abuse brake: no endless pending checkouts.
    const recent = await Payment.countDocuments({ user: req.user._id, status: "pending", renewal: { $ne: true }, createdAt: { $gte: new Date(Date.now() - 3600 * 1000) } });
    if (recent >= 5) return res.status(429).json({ message: "You have several unfinished checkouts. Finish one or wait a little." });

    // Opt-in only: the card is charged again later ONLY if the customer asked for it here.
    const autoRenew = req.body?.autoRenew === true;
    const reference = `SA-${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}`.toUpperCase();
    const payment = await Payment.create({
      user: req.user._id, reference, planKey: plan.key, amountMinor: plan.priceMinor, currency: plan.currency, autoRenew,
      planSnapshot: { key: plan.key, name: plan.name, priceMinor: plan.priceMinor, currency: plan.currency, durationDays: plan.durationDays, features: plan.features, limits: plan.limits },
    });
    try {
      const init = await client().initialize({
        email: req.user.email, amountMinor: plan.priceMinor, currency: plan.currency, reference,
        callbackUrl: `${ENV.clientUrl.replace(/\/$/, "")}/billing/result`,
        metadata: { paymentId: String(payment._id), userId: String(req.user._id), planKey: plan.key },
        channels: autoRenew ? ["card"] : undefined, // only a card can be charged again later
      });
      res.status(201).json({ authorizationUrl: init.authorization_url, reference });
    } catch (err) {
      await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed", failureReason: "provider_error" } });
      if (err instanceof PaystackError) return res.status(err.statusCode === 503 ? 503 : 502).json({ message: "We couldn't start the payment. Please try again." });
      throw err;
    }
  } catch (err) { next(err); }
}

/**
 * Turns a provider transaction into the right payment state. Shared by the
 * verify endpoint, the webhook and the reconciliation job, so there is exactly
 * one code path that can grant access. Safe to call repeatedly and concurrently:
 * every state change is an atomic "only from pending" update.
 */
export async function settlePayment(payment, tx) {
  if (payment.status !== "pending") return payment; // already settled (or refunded)

  if (tx?.status === "success") {
    const v = validateTransaction(payment, tx);
    if (!v.ok) {
      // Paid, but not what we asked for. Never grant; flag for an admin.
      await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed", failureReason: v.reason, verifiedAt: new Date() } });
      console.error(`payment ${payment.reference} failed validation: ${v.reason}`);
      return Payment.findById(payment._id);
    }
    const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: "pending" }, { $set: { status: "success", paidAt: new Date(), verifiedAt: new Date() } }, { new: true });
    if (!claimed) return Payment.findById(payment._id); // another request won the race
    await grantEntitlement(claimed);
    // Saving the card must never block (or undo) the access the customer just paid for.
    await captureAuthorization(claimed, tx).catch((err) => console.error(`saving card for ${claimed.reference} failed:`, err.message));
    return Payment.findById(payment._id);
  }

  if (["failed", "abandoned", "reversed"].includes(tx?.status)) {
    const status = tx.status === "abandoned" ? "abandoned" : "failed";
    const done = await Payment.findOneAndUpdate({ _id: payment._id, status: "pending" }, { $set: { status, failureReason: tx.gateway_response ? String(tx.gateway_response).slice(0, 120) : tx.status, verifiedAt: new Date() } }, { new: true });
    if (done) {
      notifyUser(payment.user, { category: "payments", type: "payment_failed", title: "Your payment didn't go through", body: `${payment.planSnapshot?.name || "Plan"}: no charge was completed. You can try again.`, link: "/billing", dedupeKey: `payment:${payment.reference}:failed` });
    }
    return Payment.findById(payment._id);
  }
  return payment; // still pending at the provider
}

/** Creates the entitlement for a successful payment (once — `payment` is unique on Entitlement). */
export async function grantEntitlement(payment) {
  const snap = payment.planSnapshot;
  const now = new Date();
  // Renewals stack: a new period starts when the current one for this plan ends.
  const latest = await Entitlement.findOne({ user: payment.user, planKey: snap.key, status: "active", expiresAt: { $gt: now } }).sort({ expiresAt: -1 });
  const startsAt = latest ? latest.expiresAt : now;
  const expiresAt = new Date(startsAt.getTime() + snap.durationDays * DAY);
  let ent;
  try {
    ent = await Entitlement.create({ user: payment.user, planKey: snap.key, planName: snap.name, features: snap.features, limits: snap.limits || {}, startsAt, expiresAt, payment: payment._id });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    ent = await Entitlement.findOne({ payment: payment._id }); // already granted
  }
  await Payment.updateOne({ _id: payment._id }, { $set: { entitlement: ent._id } });
  notifyUser(payment.user, {
    category: "payments", type: "payment_success", title: `Payment received — ${snap.name} is active`,
    body: `${money(payment.amountMinor, payment.currency)} · valid until ${expiresAt.toLocaleDateString("en-GB")}.`, link: "/billing", dedupeKey: `payment:${payment.reference}:success`,
  });
  return ent;
}

/**
 * Remembers the card Paystack lets us reuse. Switching auto-renew ON happens only when the
 * customer ticked it at checkout (payment.autoRenew); otherwise we only store the card so
 * they can turn it on later from the Billing page. Renewal charges never change the switch.
 */
async function captureAuthorization(payment, tx) {
  const auth = extractAuthorization(tx);
  if (!auth) return;
  const update = {
    $set: { authorizationCode: auth.authorizationCode, signature: auth.signature, card: auth.card, failureCount: 0 },
    $unset: { lastFailureReason: "" },
  };
  if (payment.autoRenew && !payment.renewal) {
    update.$set.enabled = true;
    update.$set.planKey = payment.planKey;
    update.$unset.disabledReason = "";
  }
  await AutoRenewal.updateOne({ user: payment.user }, update, { upsert: true });
}

/** What the Billing page shows about auto-renew. Never includes the authorization code. */
async function autoRenewView(userId) {
  const ar = await AutoRenewal.findOne({ user: userId }).lean();
  const hasCard = Boolean(ar?.card?.last4);
  const enabled = Boolean(ar?.enabled && hasCard);
  let renewsAt = null;
  if (enabled && ar.planKey) {
    const latest = await Entitlement.findOne({ user: userId, planKey: ar.planKey, status: "active" }).sort({ expiresAt: -1 }).select("expiresAt").lean();
    renewsAt = latest?.expiresAt || null;
  }
  return {
    enabled, hasCard, planKey: ar?.planKey || null, renewsAt,
    card: hasCard ? { brand: ar.card.brand, last4: ar.card.last4, expMonth: ar.card.expMonth, expYear: ar.card.expYear, bank: ar.card.bank } : null,
    disabledReason: ar?.disabledReason || null,
  };
}

// PUT /api/billing/auto-renew  body: { enabled: boolean, planKey? } — the on/off switch.
export async function setAutoRenew(req, res, next) {
  try {
    if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ message: "Say whether auto-renew should be on or off." });

    if (!req.body.enabled) {
      await AutoRenewal.updateOne({ user: req.user._id }, { $set: { enabled: false, disabledReason: "user" } });
      return res.json({ autoRenew: await autoRenewView(req.user._id) });
    }

    const ar = await AutoRenewal.findOne({ user: req.user._id }).select("+authorizationCode");
    if (!ar?.authorizationCode) {
      return res.status(409).json({ code: "no_saved_card", message: "Pay for a plan with your card first and we'll keep it for renewals." });
    }
    const subs = await getSubscriptions();
    const latest = await Entitlement.findOne({ user: req.user._id, status: "active" }).sort({ expiresAt: -1 }).select("planKey").lean();
    const wanted = String(req.body.planKey || ar.planKey || latest?.planKey || "");
    const plan = subs.plans.find((p) => p.key === wanted && p.active);
    if (!subs.enabled || !plan) return res.status(400).json({ message: "Choose a plan first, then turn auto-renew on." });

    await AutoRenewal.updateOne({ _id: ar._id }, { $set: { enabled: true, planKey: plan.key, failureCount: 0 }, $unset: { disabledReason: "", lastFailureReason: "" } });
    res.json({ autoRenew: await autoRenewView(req.user._id) });
  } catch (err) { next(err); }
}

// GET /api/billing/verify/:reference — the page the learner lands on after paying calls this.
// We ask Paystack; we never trust the redirect itself.
export async function verifyPayment(req, res, next) {
  try {
    const payment = await Payment.findOne({ reference: String(req.params.reference), user: req.user._id });
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    let current = payment;
    if (payment.status === "pending") {
      try {
        current = await settlePayment(payment, await client().verify(payment.reference));
      } catch (err) {
        if (!(err instanceof PaystackError)) throw err;
        return res.json({ status: "pending", message: "We're still confirming your payment. This can take a minute." });
      }
    }
    res.json({ status: current.status, plan: current.planSnapshot?.name, message: current.status === "success" ? "Payment confirmed — your plan is active." : current.status === "pending" ? "We're still confirming your payment." : "The payment didn't complete." });
  } catch (err) { next(err); }
}

// POST /api/billing/webhook — called by Paystack. Authenticated by signature, not by login.
export async function webhook(req, res) {
  const raw = req.rawBody;
  if (!verifySignature(raw, req.headers["x-paystack-signature"], secret())) return res.status(401).json({ message: "Bad signature." });

  const { event, data } = req.body || {};
  const reference = data?.reference || data?.transaction_reference || data?.transaction?.reference;
  const eventKey = `${event}:${data?.id ?? reference}`;
  try {
    // Insert-first idempotency: a replayed event hits the unique index and is ignored.
    try { await PaymentEvent.create({ eventKey, event, reference }); }
    catch (err) { if (err?.code === 11000) return res.json({ ok: true, duplicate: true }); throw err; }

    try {
      const payment = reference ? await Payment.findOne({ reference }) : null;
      if (payment && event === "charge.success") {
        // Defence in depth: confirm with Paystack rather than trusting the payload alone.
        let tx = data;
        try { tx = await client().verify(reference); } catch { /* fall back to the signed payload */ }
        await settlePayment(payment, tx);
      } else if (payment && (event === "refund.processed" || event === "charge.dispute.create")) {
        await markRefunded(payment, event);
      }
    } catch (err) {
      // Let Paystack retry: forget the event so the retry isn't treated as a duplicate.
      await PaymentEvent.deleteOne({ eventKey }).catch(() => {});
      throw err;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("webhook failed:", err.message);
    res.status(500).json({ message: "Processing failed." });
  }
}

/** A refund/chargeback revokes the access that payment bought. */
export async function markRefunded(payment, reason = "refund") {
  const done = await Payment.findOneAndUpdate({ _id: payment._id, status: "success" }, { $set: { status: "refunded", failureReason: reason } }, { new: true });
  if (!done) return;
  await Entitlement.updateOne({ payment: payment._id, status: "active" }, { $set: { status: "revoked", revokedReason: reason } });
  notifyUser(payment.user, { category: "payments", type: "payment_refunded", title: "Your payment was refunded", body: `${payment.planSnapshot?.name || "Plan"} access has ended.`, link: "/billing", dedupeKey: `payment:${payment.reference}:refunded` });
}

/**
 * Scheduler job: (1) settle pending payments older than ~10 minutes by asking
 * Paystack, abandoning those older than the TTL; (2) repair any payment marked
 * successful whose entitlement is missing (e.g. a crash between the two writes).
 */
export async function expirePendingPayments() {
  let touched = 0;
  if (secret()) {
    const stale = await Payment.find({ status: "pending", createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }).sort({ createdAt: 1 }).limit(50);
    for (const p of stale) {
      try {
        const tx = await client().verify(p.reference);
        await settlePayment(p, tx);
      } catch { /* provider hiccup: try again next run */ }
      const expired = Date.now() - new Date(p.createdAt).getTime() > PLATFORM.billing.pendingTtlHours * 3600 * 1000;
      if (expired) await Payment.updateOne({ _id: p._id, status: "pending" }, { $set: { status: "abandoned", failureReason: "expired" } });
      touched += 1;
    }
  }
  const orphans = await Payment.find({ status: "success", entitlement: { $exists: false } }).limit(50);
  for (const p of orphans) { await grantEntitlement(p); touched += 1; }
  return touched;
}

async function noteRenewalFailure(ar, reason, reference) {
  const updated = await AutoRenewal.findOneAndUpdate({ _id: ar._id }, { $inc: { failureCount: 1 }, $set: { lastFailureReason: String(reason || "failed").slice(0, 120) } }, { new: true });
  if (updated && updated.failureCount >= MAX_RENEW_FAILURES) {
    await AutoRenewal.updateOne({ _id: ar._id }, { $set: { enabled: false, disabledReason: "too_many_failures" } });
    notifyUser(ar.user, { category: "payments", type: "autorenew_off", title: "Auto-renew was turned off", body: "We couldn't charge your card after a few tries. Pay for your plan again to keep it going.", link: "/billing", dedupeKey: `payment:${reference}:autorenew_off` });
  }
}

/** Charges one person's saved card for the next period. Returns true if a charge was attempted. */
async function renewOne(ar, subs, now) {
  const plan = subs.plans.find((p) => p.key === ar.planKey && p.active);
  if (!plan || !ar.authorizationCode) return false;
  const latest = await Entitlement.findOne({ user: ar.user, planKey: plan.key, status: "active" }).sort({ expiresAt: -1 }).select("expiresAt").lean();
  if (!isRenewalDue({ latestExpiresAt: latest?.expiresAt, now })) return false;
  const inFlight = await Payment.exists({ user: ar.user, renewal: true, status: "pending", createdAt: { $gte: new Date(now.getTime() - 2 * 3600 * 1000) } });
  if (inFlight) return false;
  const user = await User.findById(ar.user).select("email suspended").lean();
  if (!user?.email || user.suspended) return false;

  // Price comes from OUR current plan config, exactly like a normal checkout.
  const reference = `SA-R-${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}`.toUpperCase();
  const payment = await Payment.create({
    user: ar.user, reference, planKey: plan.key, amountMinor: plan.priceMinor, currency: plan.currency, renewal: true,
    planSnapshot: { key: plan.key, name: plan.name, priceMinor: plan.priceMinor, currency: plan.currency, durationDays: plan.durationDays, features: plan.features, limits: plan.limits },
  });
  await AutoRenewal.updateOne({ _id: ar._id }, { $set: { lastAttemptAt: now } });

  let tx;
  try {
    tx = await client().chargeAuthorization({ email: user.email, amountMinor: plan.priceMinor, currency: plan.currency, reference, authorizationCode: ar.authorizationCode, metadata: { paymentId: String(payment._id), userId: String(ar.user), planKey: plan.key, renewal: true } });
  } catch (err) {
    // Unknown outcome (timeout) or a rejected request. Leave the payment pending: the
    // reconciliation job asks Paystack and grants access only if money really moved.
    await noteRenewalFailure(ar, err.message, reference);
    return true;
  }

  if (NEEDS_CUSTOMER.has(tx?.status)) {
    await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "abandoned", failureReason: `needs_${tx.status}`.slice(0, 120) } });
    notifyUser(ar.user, { category: "payments", type: "payment_failed", title: "We couldn't renew your plan", body: `${plan.name}: your card needs extra approval. Please renew manually.`, link: "/billing", dedupeKey: `payment:${reference}:failed` });
    await noteRenewalFailure(ar, `needs_${tx.status}`, reference);
    return true;
  }

  const settled = await settlePayment(payment, tx);
  if (settled.status === "failed" || settled.status === "abandoned") await noteRenewalFailure(ar, settled.failureReason, reference);
  return true;
}

/**
 * Scheduler job: renews plans for people who switched auto-renew on, a day before
 * their current period ends. Safe to run every minute: each person is retried at most
 * every few hours, never while a renewal is still in flight, and the charge itself goes
 * through settlePayment like every other payment.
 */
export async function processAutoRenewals() {
  if (!secret()) return 0;
  const subs = await getSubscriptions();
  if (!subs.enabled) return 0;
  const now = new Date();
  const due = await AutoRenewal.find({
    enabled: true, failureCount: { $lt: MAX_RENEW_FAILURES },
    $or: [{ lastAttemptAt: { $exists: false } }, { lastAttemptAt: { $lt: new Date(now.getTime() - RETRY_GAP_MS) } }],
  }).select("+authorizationCode").limit(50);
  let touched = 0;
  for (const ar of due) {
    try { if (await renewOne(ar, subs, now)) touched += 1; }
    catch (err) { console.error(`auto-renew for ${ar.user} failed:`, err.message); }
  }
  return touched;
}
