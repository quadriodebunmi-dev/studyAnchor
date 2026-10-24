import AIUsage from "../models/AIUsage.js";
import { PLATFORM } from "../config/platform.js";
import { isAIConfigured } from "./aiClient.js";
import { checkEntitlement } from "./entitlements.js";
import { effectiveDailyLimit } from "./access.js";

const startOfUtcDay = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Express middleware for every NEW AI endpoint. In order it checks:
 *   1. entitlement   — is the feature available to this user?
 *   2. provider      — is an AI key configured? (these features never fake answers)
 *   3. daily usage   — has the user hit today's ceiling for this feature?
 * Pair it with recordAIUsage() once the AI call has actually been made.
 */
export function requireAIFeature({ entitlement, usage }) {
  return async function aiFeatureGate(req, res, next) {
    try {
      const ent = await checkEntitlement(req.user, entitlement);
      if (!ent.allowed) return res.status(403).json({ code: ent.code, message: ent.message, feature: entitlement });

      if (!isAIConfigured()) {
        return res.status(503).json({ code: "AI_UNAVAILABLE", message: "AI features aren't available right now. Please try again later." });
      }

      // The free ceiling, raised (never lowered) by an active paid plan.
      const limit = effectiveDailyLimit(PLATFORM.ai.dailyLimits[usage], ent.access, usage);
      if (limit && Number.isFinite(limit)) {
        const used = await AIUsage.countDocuments({ user: req.user._id, feature: usage, status: "ok", createdAt: { $gte: startOfUtcDay() } });
        if (used >= limit) {
          return res.status(429).json({ code: "AI_DAILY_LIMIT", message: `You've used all ${limit} of today's AI requests for this tool. It resets at midnight UTC.`, limit });
        }
      }
      next();
    } catch (err) { next(err); }
  };
}

/** Records one AI call. Failures are stored but don't count toward the limit. Never throws. */
export async function recordAIUsage(userId, feature, error) {
  try {
    await AIUsage.create({ user: userId, feature, status: error ? "error" : "ok", errorCode: error ? String(error.name || error.code || "error").slice(0, 60) : undefined });
  } catch (err) {
    console.error("recordAIUsage failed:", err.message);
  }
}

/** Maps AI/parse failures to a friendly HTTP response. Returns true if it handled the error. */
export function respondToAIError(err, res) {
  if (err?.name === "AIError" || err?.name === "AIParseError") {
    const unavailable = err.statusCode === 503;
    res.status(unavailable ? 503 : 502).json({
      code: unavailable ? "AI_UNAVAILABLE" : "AI_FAILED",
      message: unavailable
        ? "AI features aren't available right now."
        : "The AI couldn't complete that request. Please try again in a moment.",
    });
    return true;
  }
  return false;
}

/** How many more AI calls of this kind the user may make today (Infinity when uncapped). */
export async function aiBudgetLeft(userId, usage) {
  const limit = PLATFORM.ai.dailyLimits[usage];
  if (!limit) return Infinity;
  const used = await AIUsage.countDocuments({ user: userId, feature: usage, status: "ok", createdAt: { $gte: startOfUtcDay() } });
  return Math.max(0, limit - used);
}
