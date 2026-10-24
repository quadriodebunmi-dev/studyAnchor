import PointTransaction from "../models/PointTransaction.js";
import User from "../models/User.js";
import { PLATFORM } from "../config/platform.js";
import { computeQuizRewards } from "./rewardRules.js";
import { toObjectId } from "./objectId.js";

export { computeQuizRewards };

// Points. Two rules keep this honest:
//  1. Every award has a deterministic `key` (e.g. room_quiz:<quiz>:<user>:participation)
//     and the ledger enforces uniqueness on it — replaying a request or a
//     retried event can't pay out twice.
//  2. The ledger (PointTransaction) is the truth; User.points is a cached total
//     that recomputePoints() can rebuild.
// Reward amounts come from config/platform.js, never from the client.

/** Idempotent. Resolves { awarded, duplicate?, points? }. Never throws into the caller's flow. */
export async function awardPoints({ userId, points, reason, sourceType, sourceId, key, meta }) {
  if (!points || !userId || !key) return { awarded: false };
  try {
    await PointTransaction.create({ user: userId, points, reason, sourceType, sourceId, key, meta });
  } catch (err) {
    if (err?.code === 11000) return { awarded: false, duplicate: true };
    console.error("awardPoints failed:", err.message);
    return { awarded: false, error: true };
  }
  try {
    await User.updateOne({ _id: userId }, { $inc: { points } });
  } catch (err) {
    console.error("points total update failed (ledger is correct; run recomputePoints):", err.message);
  }
  return { awarded: true, points };
}

export async function recomputePoints(userId) {
  const [row] = await PointTransaction.aggregate([{ $match: { user: toObjectId(userId) } }, { $group: { _id: null, total: { $sum: "$points" } } }]);
  const total = row?.total || 0;
  await User.updateOne({ _id: userId }, { $set: { points: total } });
  return total;
}

const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Points for creating a room — once per room, with a daily cap so it can't be farmed. */
export async function awardRoomCreated(userId, roomId) {
  const { roomCreated, roomCreatedDailyCap } = PLATFORM.rewards;
  if (!roomCreated) return { awarded: false };
  const today = await PointTransaction.countDocuments({ user: userId, sourceType: "room_created", createdAt: { $gte: startOfUtcDay() } });
  if (today >= roomCreatedDailyCap) return { awarded: false, capped: true };
  return awardPoints({
    userId, points: roomCreated, reason: "Created a discussion room",
    sourceType: "room_created", sourceId: roomId, key: `room_created:${roomId}`,
  });
}

/** Awards everything a quiz attempt currently earns. Safe to call repeatedly. */
export async function awardQuizAttempt(attempt, quiz) {
  const rewards = computeQuizRewards({
    answeredCount: attempt.answeredCount,
    questionCount: quiz.questionCount,
    percentage: attempt.percentage,
    gradingStatus: attempt.gradingStatus,
  });
  const results = [];
  for (const r of rewards) {
    results.push(await awardPoints({
      userId: attempt.user, points: r.points, reason: r.reason,
      sourceType: "room_quiz", sourceId: quiz._id,
      key: `room_quiz:${quiz._id}:${attempt.user}:${r.suffix}`,
      meta: { room: String(quiz.room), attempt: String(attempt._id) },
    }));
  }
  return results;
}

/**
 * awardPoints with a per-day ceiling for one kind of source, so a repeatable
 * action (reviewing cards, finishing quizzes) can't be farmed for unlimited points.
 */
export async function awardCapped({ dailyCap, ...award }) {
  if (dailyCap !== undefined) {
    const [row] = await PointTransaction.aggregate([
      { $match: { user: toObjectId(award.userId), sourceType: award.sourceType, points: { $gt: 0 }, createdAt: { $gte: startOfUtcDay() } } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    if ((row?.total || 0) + award.points > dailyCap) return { awarded: false, capped: true };
  }
  return awardPoints(award);
}

/**
 * Reverses a previously awarded transaction (admin investigation of suspicious points).
 * The original row is never edited: a new negative row is appended, keyed so a
 * reversal can only happen once.
 */
export async function reversePoints({ key, reason, actorId }) {
  const original = await PointTransaction.findOne({ key });
  if (!original) return { reversed: false, message: "That transaction doesn't exist." };
  if (original.points <= 0) return { reversed: false, message: "Only awards can be reversed." };
  const res = await awardPoints({
    userId: original.user, points: -original.points, reason: `Reversal: ${reason || "admin adjustment"}`,
    sourceType: "reversal", sourceId: original.sourceId, key: `reversal:${key}`, meta: { original: String(original._id), actor: String(actorId) },
  });
  return res.awarded ? { reversed: true, points: -original.points } : { reversed: false, message: "Already reversed." };
}
