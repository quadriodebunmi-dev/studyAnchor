import test from "node:test";
import assert from "node:assert/strict";
import { localDay, localMinutes, addDays, weekdayOf, computeStreak, currentStreakStart, goalProgress, goalCompletionEligible, parseClock, isValidTimeZone } from "../utils/streaks.js";

test("local day follows the learner's time zone, not the server's", () => {
  const instant = new Date("2026-03-01T23:30:00Z");
  assert.equal(localDay(instant, "UTC"), "2026-03-01");
  assert.equal(localDay(instant, "Africa/Lagos"), "2026-03-02"); // UTC+1
  assert.equal(localDay(instant, "America/Los_Angeles"), "2026-03-01");
  assert.equal(localDay(instant, "Not/AZone"), "2026-03-01", "bad zone falls back to UTC");
  assert.equal(localMinutes(new Date("2026-03-01T23:30:00Z"), "Africa/Lagos"), 30);
  assert.equal(isValidTimeZone("Africa/Lagos"), true);
  assert.equal(isValidTimeZone("nope"), false);
});

test("date arithmetic crosses month and leap-year boundaries", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(weekdayOf("2026-03-01"), 0); // Sunday
  assert.equal(parseClock("07:30"), 450);
  assert.equal(parseClock("24:00"), null);
  assert.equal(parseClock("7:30"), null);
});

test("streak: consecutive days, grace until end of next day, then reset", () => {
  const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
  assert.equal(computeStreak(days, "2026-03-03").current, 3);
  const grace = computeStreak(days, "2026-03-04");
  assert.equal(grace.current, 3, "studied yesterday -> still alive");
  assert.equal(grace.atRisk, true);
  assert.equal(grace.activeToday, false);
  assert.equal(computeStreak(days, "2026-03-05").current, 0, "a full missed day resets");
});

test("streak: longest is remembered after a reset; duplicates and gaps are handled", () => {
  const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-10", "2026-01-10", "2026-01-11"];
  const s = computeStreak(days, "2026-01-11");
  assert.equal(s.current, 2);
  assert.equal(s.longest, 4);
  assert.equal(computeStreak([], "2026-01-11").current, 0);
  assert.equal(currentStreakStart(days, "2026-01-11"), "2026-01-10");
});

test("goal progress counts only scheduled days that met the target", () => {
  // 2026-03-02 is Monday. Study Mon/Wed/Fri, 30 min target.
  const base = { startDay: "2026-03-02", endDay: "2026-03-13", studyDays: [1, 3, 5], targetMinutes: 30 };
  const p = goalProgress({ ...base, today: "2026-03-06", minutesByDay: { "2026-03-02": 45, "2026-03-04": 10, "2026-03-03": 120 } });
  assert.equal(p.scheduledSoFar, 3); // Mon, Wed, Fri up to the 6th
  assert.equal(p.metDays, 1);        // only Monday met; Tuesday isn't a study day
  assert.equal(p.percent, 33);
  assert.equal(p.totalScheduled, 6);
  assert.equal(p.todayScheduled, true);
  assert.equal(p.todayMet, false);
});

test("goal progress: future start, past end, no minutes", () => {
  const f = goalProgress({ startDay: "2026-04-01", studyDays: [1], targetMinutes: 20, today: "2026-03-01" });
  assert.equal(f.scheduledSoFar, 0);
  assert.equal(f.percent, 0);
  const ended = goalProgress({ startDay: "2026-03-02", endDay: "2026-03-04", studyDays: [1, 2, 3], targetMinutes: 10, today: "2026-03-20", minutesByDay: { "2026-03-02": 10, "2026-03-03": 10, "2026-03-04": 10 } });
  assert.equal(ended.ended, true);
  assert.equal(ended.percent, 100);
});

test("goal completion reward needs sustained effort", () => {
  const rule = { minMetDays: 3, minPercent: 80 };
  assert.equal(goalCompletionEligible({ metDays: 1, percent: 100 }, rule), false, "one lucky day isn't enough");
  assert.equal(goalCompletionEligible({ metDays: 5, percent: 50 }, rule), false);
  assert.equal(goalCompletionEligible({ metDays: 5, percent: 90 }, rule), true);
});

import { qualifyingDays } from "../utils/streaks.js";
test("qualifying days: flashcards need several cards, other activity counts alone", () => {
  const rows = [
    { day: "2026-03-01", type: "flashcards", n: 2 },
    { day: "2026-03-02", type: "flashcards", n: 5 },
    { day: "2026-03-03", type: "mock_exam", n: 1 },
    { day: "2026-03-04", type: "flashcards", n: 3 }, { day: "2026-03-04", type: "snap", n: 1 },
  ];
  assert.deepEqual(qualifyingDays(rows), ["2026-03-02", "2026-03-03", "2026-03-04"]);
});
