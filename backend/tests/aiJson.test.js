import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, AIParseError } from "../utils/aiJson.js";

test("extracts an array from fenced, chatty output", () => {
  const raw = 'Sure! Here you go:\n```json\n[{"a":1,"b":"x ] y"}]\n```\nHope that helps';
  assert.deepEqual(extractJson(raw, "array"), [{ a: 1, b: "x ] y" }]);
});

test("extracts an object", () => {
  assert.deepEqual(extractJson('Result: {"ok": true, "n": {"k": [1,2]}} done', "object"), { ok: true, n: { k: [1, 2] } });
});

test("rejects truncated or empty output instead of guessing", () => {
  assert.throws(() => extractJson('[{"a":1},{"a":', "array"), AIParseError);
  assert.throws(() => extractJson("", "array"), AIParseError);
  assert.throws(() => extractJson("no json here", "object"), AIParseError);
});
