import test from "node:test";
import assert from "node:assert/strict";
import { trimDeep, trimInputs } from "../middleware/trimInputs.js";

test("trims nested strings but leaves passwords alone", () => {
  const out = trimDeep({ name: "  Ada  ", password: " keep me ", newPassword: " x ", tags: [" a ", "b "], nested: { t: "\n hi\t" }, n: 5, ok: true });
  assert.deepEqual(out, { name: "Ada", password: " keep me ", newPassword: " x ", tags: ["a", "b"], nested: { t: "hi" }, n: 5, ok: true });
});

test("middleware trims body and query, skips the billing webhook", () => {
  const req = { originalUrl: "/api/x", body: { a: " 1 " }, query: { q: " search " } };
  trimInputs(req, {}, () => {});
  assert.equal(req.body.a, "1");
  assert.equal(req.query.q, "search");
  const hook = { originalUrl: "/api/billing/webhook", body: { a: " 1 " }, query: {} };
  trimInputs(hook, {}, () => {});
  assert.equal(hook.body.a, " 1 ");
});

test("drops prototype-pollution keys", () => {
  const out = trimDeep(JSON.parse('{"__proto__":{"x":1},"a":" b "}'));
  assert.equal(out.a, "b");
  assert.equal(({}).x, undefined);
});
