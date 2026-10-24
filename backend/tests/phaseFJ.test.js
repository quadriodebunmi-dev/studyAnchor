import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { rankByPoints, publicName, leaderboardIdentity, isLeaderboardEligible } from "../utils/leaderboard.js";
import { resolveAccess, effectiveDailyLimit, activeEntitlements } from "../utils/access.js";
import { verifySignature, validateTransaction, createPaystackClient, PaystackError } from "../utils/paystack.js";
import { createNotifier, prefEnabled } from "../utils/notifier.js";
import { canChangeRole, canSuspend, validateSettingsPatch } from "../utils/adminGuards.js";

// ---------------- leaderboard
test("leaderboard ties share a rank and the next rank skips", () => {
  const r = rankByPoints([{ id: "a", points: 50 }, { id: "b", points: 80 }, { id: "c", points: 50 }, { id: "d", points: 10 }]);
  assert.deepEqual(r.map((e) => [e.id, e.rank]), [["b", 1], ["a", 2], ["c", 2], ["d", 4]]);
});

test("leaderboard privacy: names are shortened, anonymous hides, hidden excludes", () => {
  assert.equal(publicName("Ada Chukwu Obi"), "Ada O.");
  assert.equal(publicName("Ada"), "Ada");
  assert.equal(publicName(""), "Learner");
  assert.equal(leaderboardIdentity({ name: "Ada Obi" }).name, "Ada O.");
  assert.equal(leaderboardIdentity({ name: "Ada Obi", leaderboardVisibility: "anonymous" }).name, "Anonymous learner");
  assert.equal(leaderboardIdentity({ name: "Ada Obi", leaderboardVisibility: "hidden" }), null);
  assert.equal(leaderboardIdentity({ name: "Ada Obi", schoolName: "UNILAG" }).school, undefined, "school hidden unless opted in");
  assert.equal(leaderboardIdentity({ name: "Ada Obi", schoolName: "UNILAG", showSchoolOnLeaderboard: true }).school, "UNILAG");
  assert.equal(isLeaderboardEligible({ role: "student" }), true);
  assert.equal(isLeaderboardEligible({ role: "admin" }), false);
  assert.equal(isLeaderboardEligible({ role: "student", suspended: true }), false);
  assert.equal(isLeaderboardEligible({ role: "student", leaderboardVisibility: "hidden" }), false);
});

// ---------------- access / entitlements
const now = new Date("2026-06-01T00:00:00Z");
const ent = (over = {}) => ({ status: "active", startsAt: "2026-05-01T00:00:00Z", expiresAt: "2026-07-01T00:00:00Z", features: ["snap"], planKey: "pro", limits: { snap: 100 }, ...over });
const subs = (over = {}) => ({ enabled: true, features: { snap: { access: "paid" }, flashcards: { access: "free" } }, ...over });

test("subscriptions off => everything is available", () => {
  assert.equal(resolveAccess({ subscriptions: { enabled: false, features: { snap: { access: "paid" } } }, featureKey: "snap", now }).allowed, true);
  assert.equal(resolveAccess({ subscriptions: undefined, featureKey: "snap", now }).allowed, true);
});

test("free features stay free; paid features need an active entitlement that covers them", () => {
  assert.equal(resolveAccess({ subscriptions: subs(), featureKey: "flashcards", now }).allowed, true);
  const none = resolveAccess({ subscriptions: subs(), featureKey: "snap", entitlements: [], now });
  assert.equal(none.allowed, false);
  assert.equal(none.code, "UPGRADE_REQUIRED");
  assert.equal(resolveAccess({ subscriptions: subs(), featureKey: "snap", entitlements: [ent()], now }).allowed, true);
  assert.equal(resolveAccess({ subscriptions: subs(), featureKey: "snap", entitlements: [ent({ features: ["mockExams"] })], now }).allowed, false, "plan lacks this feature");
});

test("expired, not-yet-started and revoked entitlements grant nothing", () => {
  for (const bad of [{ expiresAt: "2026-05-15T00:00:00Z" }, { startsAt: "2026-06-10T00:00:00Z" }, { status: "revoked" }]) {
    assert.equal(resolveAccess({ subscriptions: subs(), featureKey: "snap", entitlements: [ent(bad)], now }).allowed, false);
  }
  assert.equal(activeEntitlements([ent(), ent({ status: "revoked" })], now).length, 1);
});

test("a purchased entitlement survives the admin later making the feature free or editing the plan", () => {
  // The snapshot on the entitlement is what counts, not the current plan definition.
  const a = resolveAccess({ subscriptions: subs({ features: { snap: { access: "paid" } } }), featureKey: "snap", entitlements: [ent()], now });
  assert.equal(a.allowed, true);
  assert.equal(a.limits.snap, 100);
});

test("plan limits raise the daily ceiling, never lower it; -1 is unlimited", () => {
  assert.equal(effectiveDailyLimit(20, { limits: { snap: 100 } }, "snap"), 100);
  assert.equal(effectiveDailyLimit(20, { limits: { snap: 5 } }, "snap"), 20);
  assert.equal(effectiveDailyLimit(20, { limits: { snap: -1 } }, "snap"), Infinity);
  assert.equal(effectiveDailyLimit(20, { limits: {} }, "snap"), 20);
  const merged = resolveAccess({ subscriptions: subs(), featureKey: "snap", entitlements: [ent({ limits: { snap: 50 } }), ent({ planKey: "b", limits: { snap: 80 } })], now });
  assert.equal(merged.limits.snap, 80);
});

// ---------------- paystack
test("webhook signature is verified over the raw body", () => {
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"r1"}}');
  const sig = crypto.createHmac("sha512", "sk_test").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "sk_test"), true);
  assert.equal(verifySignature(body, sig, "other_secret"), false);
  assert.equal(verifySignature(Buffer.from(body.toString() + " "), sig, "sk_test"), false, "any change to the body breaks it");
  assert.equal(verifySignature(body, "", "sk_test"), false);
  assert.equal(verifySignature(body, "abc", "sk_test"), false);
});

test("a transaction must match the payment WE recorded", () => {
  const payment = { reference: "SA-1", amountMinor: 250000, currency: "NGN" };
  const tx = { status: "success", reference: "SA-1", amount: 250000, currency: "NGN" };
  assert.equal(validateTransaction(payment, tx).ok, true);
  assert.equal(validateTransaction(payment, { ...tx, amount: 100 }).reason, "amount_mismatch");
  assert.equal(validateTransaction(payment, { ...tx, currency: "USD" }).reason, "currency_mismatch");
  assert.equal(validateTransaction(payment, { ...tx, reference: "SA-2" }).reason, "reference_mismatch");
  assert.equal(validateTransaction(payment, { ...tx, status: "abandoned" }).reason, "status_abandoned");
  assert.equal(validateTransaction(payment, null).ok, false);
});

test("paystack client: initialises, verifies, and surfaces provider errors", async () => {
  const calls = [];
  const okFetch = async (url, init) => { calls.push([url, init.method, init.headers.Authorization]); return { ok: true, json: async () => ({ status: true, data: { authorization_url: "https://pay/x", reference: "r" } }) }; };
  const client = createPaystackClient({ secret: "sk", fetchImpl: okFetch });
  const init = await client.initialize({ email: "a@b.c", amountMinor: 100, currency: "NGN", reference: "r", callbackUrl: "https://app/cb" });
  assert.equal(init.authorization_url, "https://pay/x");
  await client.verify("r/../x");
  assert.ok(calls[1][0].endsWith("/transaction/verify/r%2F..%2Fx"), "reference is URL-encoded");
  assert.equal(calls[0][2], "Bearer sk");

  const bad = createPaystackClient({ secret: "sk", fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ status: false, message: "Invalid key" }) }) });
  await assert.rejects(() => bad.verify("r"), PaystackError);
  await assert.rejects(() => createPaystackClient({ secret: "", fetchImpl: okFetch }).verify("r"), /aren't configured/);
  const down = createPaystackClient({ secret: "sk", fetchImpl: async () => { throw new Error("ECONNRESET"); } });
  await assert.rejects(() => down.verify("r"), /Couldn't reach/);
});

// ---------------- notifier (fakes instead of a database)
function fakes({ users, existing = [] }) {
  const store = [...existing];
  const emitted = [];
  const Notification = {
    find: ({ user, dedupeKey }) => ({ select: () => ({ lean: async () => store.filter((n) => user.$in.includes(String(n.user)) && n.dedupeKey === dedupeKey) }) }),
    insertMany: async (docs) => { const out = docs.map((d, i) => ({ ...d, _id: `n${store.length + i}`, createdAt: new Date() })); store.push(...out); return out; },
  };
  const User = { find: ({ _id }) => ({ select: async () => users.filter((u) => _id.$in.includes(String(u._id)) && !u.suspended) }) };
  return { store, emitted, Notification, User, emit: (id, ev, p) => emitted.push([id, ev, p.title]) };
}

test("notifier: preferences are respected, always-on categories can't be disabled", async () => {
  const users = [{ _id: "1", notificationPrefs: { rooms: false } }, { _id: "2", notificationPrefs: new Map([["rooms", false]]) }, { _id: "3" }];
  const f = fakes({ users });
  const notify = createNotifier(f);
  assert.equal(await notify(["1", "2", "3"], { category: "rooms", type: "t", title: "Hi" }), 1);
  assert.deepEqual(f.store.map((n) => n.user), ["3"]);
  const f2 = fakes({ users });
  await createNotifier(f2)(["1", "2"], { category: "payments", type: "t", title: "Receipt" });
  assert.equal(f2.store.length, 2, "payment notices can't be switched off");
  assert.equal(prefEnabled({ notificationPrefs: { announcements: false } }, "announcements"), true);
});

test("notifier: the same dedupeKey never notifies the same person twice", async () => {
  const users = [{ _id: "1" }, { _id: "2" }];
  const f = fakes({ users });
  const notify = createNotifier(f);
  const payload = { category: "quizzes", type: "t", title: "Deadline", dedupeKey: "quiz:9:deadline" };
  assert.equal(await notify(["1", "2"], payload), 2);
  assert.equal(await notify(["1", "2"], payload), 0, "replay does nothing");
  assert.equal(await notify(["1", "2", "2", "1"], { ...payload, dedupeKey: "quiz:10:deadline" }), 2, "different event, and duplicate ids collapse");
  assert.equal(f.store.length, 4);
});

test("notifier: suspended users are skipped; bad input and failures never throw", async () => {
  const f = fakes({ users: [{ _id: "1", suspended: true }, { _id: "2" }] });
  const notify = createNotifier(f);
  assert.equal(await notify(["1", "2"], { category: "rooms", type: "t", title: "x" }), 1);
  assert.equal(await notify([], { type: "t", title: "x" }), 0);
  assert.equal(await notify(["2"], { category: "rooms" }), 0, "missing type/title");
  const logged = [];
  const broken = createNotifier({ ...f, Notification: { find: () => { throw new Error("db down"); }, insertMany: async () => { throw new Error("db down"); } }, log: (...a) => logged.push(a.join(" ")) });
  assert.equal(await broken(["2"], { category: "rooms", type: "t", title: "x", dedupeKey: "k" }), 0);
  assert.ok(logged[0].includes("db down"));
});

test("notifier: a failing push or live channel doesn't affect delivery", async () => {
  const f = fakes({ users: [{ _id: "1" }] });
  const logged = [];
  const notify = createNotifier({ ...f, emit: () => { throw new Error("socket gone"); }, push: async () => { throw new Error("push 500"); }, log: (...a) => logged.push(a.join(" ")) });
  assert.equal(await notify(["1"], { category: "rooms", type: "t", title: "x" }), 1);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.store.length, 1, "in-app notification still created");
  assert.ok(logged.some((l) => l.includes("socket gone")) && logged.some((l) => l.includes("push 500")));
});

test("notifier: a duplicate-key race still delivers the non-duplicates", async () => {
  const f = fakes({ users: [{ _id: "1" }, { _id: "2" }] });
  f.Notification.insertMany = async () => { const e = new Error("dup"); e.code = 11000; e.insertedDocs = [{ user: "2", _id: "x", createdAt: new Date() }]; throw e; };
  assert.equal(await createNotifier(f)(["1", "2"], { category: "rooms", type: "t", title: "x" }), 1);
  assert.equal(f.emitted.length, 1);
});

// ---------------- admin guards
test("role changes: no self-change, no removing the last admin, valid roles only", () => {
  const admin = { _id: "a", role: "admin" };
  assert.equal(canChangeRole({ actor: admin, target: admin, newRole: "student", adminCount: 2 }).ok, false);
  assert.equal(canChangeRole({ actor: admin, target: { _id: "b", role: "admin" }, newRole: "student", adminCount: 1 }).ok, false);
  assert.equal(canChangeRole({ actor: admin, target: { _id: "b", role: "admin" }, newRole: "student", adminCount: 2 }).ok, true);
  assert.equal(canChangeRole({ actor: admin, target: { _id: "c", role: "student" }, newRole: "superuser", adminCount: 2 }).ok, false);
  assert.equal(canChangeRole({ actor: admin, target: { _id: "c", role: "student" }, newRole: "student", adminCount: 2 }).ok, false);
  assert.equal(canSuspend({ actor: admin, target: { _id: "c", role: "admin" } }).ok, false);
  assert.equal(canSuspend({ actor: admin, target: { _id: "c", role: "student" } }).ok, true);
});

test("settings patches are bounded and whitelisted", () => {
  assert.equal(validateSettingsPatch({ rewards: { goalCompleted: 20 }, ai: { dailyLimits: { snap: 30 } } }).ok, true);
  assert.deepEqual(validateSettingsPatch({ rewards: { goalCompleted: 20 } }).flat, { "rewards.goalCompleted": 20 });
  assert.equal(validateSettingsPatch({ rewards: { goalCompleted: 999999 } }).ok, false);
  assert.equal(validateSettingsPatch({ rewards: { goalCompleted: -1 } }).ok, false);
  assert.equal(validateSettingsPatch({ rewards: { goalCompleted: 1.5 } }).ok, false);
  assert.equal(validateSettingsPatch({ rewards: { goalCompleted: "20" } }).ok, false);
  assert.equal(validateSettingsPatch({ jwtSecret: 1 }).ok, false, "unknown keys are rejected");
});

import { shouldRemind } from "../utils/reminderRules.js";
// ---------------- goal reminders
const goal = { reminderEnabled: true, status: "active", startDay: "2026-03-01", endDay: "2026-03-31", studyDays: [1, 3], reminderTime: "18:00", targetMinutes: 30 };
// 2026-03-02 is a Monday. 17:30 UTC = 18:30 in Lagos (UTC+1).
test("reminder fires after the local reminder time, on study days, until the target is met", () => {
  const at = new Date("2026-03-02T17:30:00Z");
  assert.equal(shouldRemind({ goal, tz: "Africa/Lagos", now: at, minutesToday: 0 }), true);
  assert.equal(shouldRemind({ goal, tz: "Africa/Lagos", now: at, minutesToday: 30 }), false, "already met today");
  assert.equal(shouldRemind({ goal, tz: "UTC", now: at, minutesToday: 0 }), false, "17:30 UTC is before 18:00 UTC");
  assert.equal(shouldRemind({ goal, tz: "Africa/Lagos", now: new Date("2026-03-02T16:30:00Z"), minutesToday: 0 }), false, "before reminder time (17:30 Lagos)");
});

test("reminder skips non-study days, paused/disabled goals, dates out of range and stale times", () => {
  const tue = new Date("2026-03-03T17:30:00Z");
  assert.equal(shouldRemind({ goal, tz: "Africa/Lagos", now: tue, minutesToday: 0 }), false, "Tuesday isn't a study day");
  const mon = new Date("2026-03-02T17:30:00Z");
  assert.equal(shouldRemind({ goal: { ...goal, status: "paused" }, tz: "Africa/Lagos", now: mon, minutesToday: 0 }), false);
  assert.equal(shouldRemind({ goal: { ...goal, reminderEnabled: false }, tz: "Africa/Lagos", now: mon, minutesToday: 0 }), false);
  assert.equal(shouldRemind({ goal: { ...goal, endDay: "2026-02-28" }, tz: "Africa/Lagos", now: mon, minutesToday: 0 }), false);
  assert.equal(shouldRemind({ goal, tz: "Africa/Lagos", now: new Date("2026-03-02T22:30:00Z"), minutesToday: 0 }), false, "4.5h late is stale");
  assert.equal(shouldRemind({ goal: { ...goal, reminderTime: "bad" }, tz: "Africa/Lagos", now: mon, minutesToday: 0 }), false);
});

import { validateSubscriptionsConfig, DEFAULT_SUBSCRIPTIONS } from "../utils/subscriptionConfig.js";
const plan = (over = {}) => ({ key: "pro", name: "Pro", priceMinor: 250000, durationDays: 30, features: ["snap"], limits: { snap: 100 }, ...over });
test("subscriptions are off and everything free by default", () => {
  assert.equal(DEFAULT_SUBSCRIPTIONS.enabled, false);
  assert.ok(Object.values(DEFAULT_SUBSCRIPTIONS.features).every((f) => f.access === "free"));
  assert.equal(validateSubscriptionsConfig(DEFAULT_SUBSCRIPTIONS).ok, true);
});
test("a paid feature needs an active plan that includes it (no lock-outs)", () => {
  const cfg = { enabled: true, features: { snap: { access: "paid" } }, plans: [] };
  assert.equal(validateSubscriptionsConfig(cfg).ok, false);
  assert.equal(validateSubscriptionsConfig({ ...cfg, plans: [plan({ active: false })] }).ok, false, "inactive plan doesn't count");
  assert.equal(validateSubscriptionsConfig({ ...cfg, plans: [plan({ features: ["flashcards"] })] }).ok, false);
  assert.equal(validateSubscriptionsConfig({ ...cfg, plans: [plan()] }).ok, true);
  assert.equal(validateSubscriptionsConfig({ ...cfg, enabled: false, plans: [] }).ok, true, "while disabled nothing is enforced");
});
test("plan validation: price, duration, keys, features, limits", () => {
  const bad = (over) => validateSubscriptionsConfig({ enabled: false, plans: [plan(over)] }).ok;
  assert.equal(bad({ priceMinor: 10.5 }), false);
  assert.equal(bad({ priceMinor: 5 }), false);
  assert.equal(bad({ durationDays: 0 }), false);
  assert.equal(bad({ key: "Bad Key!" }), false);
  assert.equal(bad({ features: ["teleport"] }), false);
  assert.equal(bad({ limits: { snap: "lots" } }), false);
  assert.equal(bad({ limits: { hack: 5 } }), false);
  assert.equal(bad({ limits: { snap: -1 } }), true, "-1 = unlimited");
  assert.equal(validateSubscriptionsConfig({ enabled: false, plans: [plan(), plan()] }).ok, false, "duplicate keys");
  assert.equal(validateSubscriptionsConfig({ enabled: false, currency: "naira", plans: [] }).ok, false);
  const v = validateSubscriptionsConfig({ enabled: false, plans: [plan({ key: "PRO" })] });
  assert.equal(v.value.plans[0].key, "pro", "keys are normalised");
});
