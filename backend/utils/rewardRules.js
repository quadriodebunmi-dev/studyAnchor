import { PLATFORM } from "../config/platform.js";

/** Pure: which awards does a finished attempt earn? (kept DB-free so it's unit-testable) */
export function computeQuizRewards({ answeredCount, questionCount, percentage, gradingStatus }, rules = PLATFORM.rewards) {
  const out = [];
  if (!questionCount) return out;
  const ratio = answeredCount / questionCount;
  if (rules.roomQuizParticipation > 0 && ratio >= rules.roomQuizMinAnsweredRatio) {
    out.push({ suffix: "participation", points: rules.roomQuizParticipation, reason: "Completed a room quiz" });
  }
  const bonus = rules.roomQuizAccuracyBonus;
  // Accuracy only counts once the marks are final, so a provisional AI mark can't be farmed.
  if (bonus?.points > 0 && gradingStatus === "complete" && percentage >= bonus.minPercentage) {
    out.push({ suffix: "accuracy", points: bonus.points, reason: `Scored ${bonus.minPercentage}%+ on a room quiz` });
  }
  return out;
}
