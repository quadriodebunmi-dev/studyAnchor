import test from "node:test";
import assert from "node:assert/strict";
import { computeQuizRewards } from "../utils/rewardRules.js";
import { PLATFORM, deepMerge, PLATFORM_DEFAULTS } from "../config/platform.js";

test("participation needs enough answered questions", () => {
  assert.equal(computeQuizRewards({ answeredCount: 1, questionCount: 10, percentage: 10, gradingStatus: "complete" }).length, 0);
  const r = computeQuizRewards({ answeredCount: 5, questionCount: 10, percentage: 20, gradingStatus: "complete" });
  assert.deepEqual(r.map((x) => x.suffix), ["participation"]);
});

test("accuracy bonus only once grading is complete and score is high enough", () => {
  const base = { answeredCount: 10, questionCount: 10, percentage: 90 };
  assert.deepEqual(computeQuizRewards({ ...base, gradingStatus: "provisional" }).map((x) => x.suffix), ["participation"]);
  assert.deepEqual(computeQuizRewards({ ...base, gradingStatus: "complete" }).map((x) => x.suffix), ["participation", "accuracy"]);
  assert.deepEqual(computeQuizRewards({ ...base, percentage: 79, gradingStatus: "complete" }).map((x) => x.suffix), ["participation"]);
});

test("empty quiz earns nothing; rules are configurable", () => {
  assert.equal(computeQuizRewards({ answeredCount: 0, questionCount: 0, percentage: 0, gradingStatus: "complete" }).length, 0);
  const r = computeQuizRewards({ answeredCount: 1, questionCount: 1, percentage: 100, gradingStatus: "complete" }, { roomQuizParticipation: 99, roomQuizMinAnsweredRatio: 0.5, roomQuizAccuracyBonus: { minPercentage: 50, points: 1 } });
  assert.equal(r[0].points, 99);
});

test("config deep-merge overrides only what is given", () => {
  const m = deepMerge(PLATFORM_DEFAULTS, { rewards: { roomQuizParticipation: 20 }, ai: { dailyLimits: { snap: 5 } } });
  assert.equal(m.rewards.roomQuizParticipation, 20);
  assert.equal(m.rewards.roomCreated, PLATFORM.rewards.roomCreated);
  assert.equal(m.ai.dailyLimits.snap, 5);
  assert.equal(m.ai.dailyLimits.exams, PLATFORM.ai.dailyLimits.exams);
});
