import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Static regression guard: no database needed. It reads the route files and checks
// that nobody added an endpoint above the auth wall by accident.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "routes");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const handlerRe = /router\.(get|post|put|patch|delete)\(/;

// Files that are deliberately partly public, each with a reason.
const MIXED = new Set(["authRoutes.js", "schoolRoutes.js", "departmentRoutes.js", "internalRoutes.js", "billingRoutes.js"]);

test("every protected endpoint sits behind authMiddleware (router-level or per-route)", () => {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js") && !MIXED.has(x))) {
    const src = read(f);
    const use = src.indexOf("router.use(authMiddleware");
    if (use >= 0) {
      assert.ok(use < src.search(handlerRe), `${f} declares an endpoint before authMiddleware`);
    } else {
      // No router-level wall: then EVERY endpoint line must carry the middleware itself.
      const lines = src.split("\n").filter((l) => handlerRe.test(l));
      assert.ok(lines.length > 0);
      for (const l of lines) assert.match(l, /authMiddleware/, `${f}: unauthenticated endpoint: ${l.trim()}`);
    }
  }
});

test("admin routes require the admin role", () => {
  assert.match(read("adminRoutes.js"), /router\.use\(authMiddleware, adminMiddleware/);
});

test("the only unauthenticated billing endpoint is the signed webhook", () => {
  const src = read("billingRoutes.js");
  const authAt = src.indexOf("router.use(authMiddleware");
  const before = src.slice(0, authAt).match(/router\.(get|post|put|delete)\("[^"]+"/g) || [];
  assert.deepEqual(before, ['router.post("/webhook"']);
  const ctl = fs.readFileSync(path.join(dir, "..", "controllers", "billingController.js"), "utf8");
  assert.match(ctl.slice(ctl.indexOf("export async function webhook")), /verifySignature\(/, "the webhook must verify the signature before doing anything");
  assert.ok(ctl.indexOf("verifySignature(") < ctl.indexOf("PaymentEvent.create"), "signature is checked before any state changes");
});

test("the cron endpoint compares its secret in constant time and refuses when unset", () => {
  const src = read("internalRoutes.js");
  assert.match(src, /timingSafeEqual/);
  assert.match(src, /CRON_SECRET|cronSecret/);
  assert.match(src, /503/);
});

test("every AI endpoint passes through the AI gate (entitlement, provider, daily limit)", () => {
  const study = read("studyRoutes.js").split("\n").filter((l) => handlerRe.test(l) && /(generate|extract|\/answer-text|\/answer"|topics)/.test(l) && !/attempts\//.test(l));
  assert.ok(study.length >= 5);
  for (const l of study) assert.match(l, /AI\b|aiGen|aiGrade|snapAI|cardsAI|examAI/, `unguarded AI route: ${l.trim()}`);
  const rooms = read("roomRoutes.js").split("\n").filter((l) => /questions\/generate|ai-grade/.test(l));
  for (const l of rooms) assert.match(l, /aiGen|aiGrade/, `unguarded AI route: ${l.trim()}`);
});

test("paid-capable creation endpoints are feature-gated on the server", () => {
  const rooms = read("roomRoutes.js");
  assert.match(rooms, /requireFeature\("rooms"\), createRoom/);
  assert.match(rooms, /requireFeature\("roomQuizzes"\), createQuiz/);
});

test("price and plan come from server config, never the checkout request body", () => {
  const ctl = fs.readFileSync(path.join(dir, "..", "controllers", "billingController.js"), "utf8");
  const checkout = ctl.slice(ctl.indexOf("export async function checkout"), ctl.indexOf("export async function settlePayment"));
  assert.doesNotMatch(checkout, /req\.body\??\.(amount|price|priceMinor|currency)/);
  assert.match(checkout, /subs\.plans\.find/);
});
