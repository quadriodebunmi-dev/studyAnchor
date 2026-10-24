import test from "node:test";
import assert from "node:assert/strict";
import { buildSeries, rankTopics } from "../controllers/analyticsController.js";

test("daily series covers every day, filling gaps with zero", () => {
  const s = buildSeries({ "2026-10-22": 30, "2026-10-20": 15 }, "2026-10-22", 7);
  assert.equal(s.length, 7);
  assert.deepEqual(s.map((p) => p.value), [0, 0, 0, 0, 15, 0, 30]);
  assert.equal(s[0].day, "2026-10-16");
});

test("90-day range is bucketed by week", () => {
  const s = buildSeries({ "2026-10-22": 30, "2026-10-21": 10 }, "2026-10-22", 90);
  assert.equal(s.length, 13);
  assert.equal(s[s.length - 1].value, 40);
});

test("topic ranking ignores thin evidence and splits weak from strong", () => {
  const r = rankTopics([
    { _id: "Algebra", marks: 2, maxMarks: 10, n: 5 },
    { _id: "Calculus", marks: 9, maxMarks: 10, n: 5 },
    { _id: "Tiny", marks: 0, maxMarks: 1, n: 1 },
  ]);
  assert.deepEqual(r.weakest.map((t) => t.topic), ["Algebra"]);
  assert.deepEqual(r.strongest.map((t) => t.topic), ["Calculus"]);
  assert.equal(r.all, 2);
});
