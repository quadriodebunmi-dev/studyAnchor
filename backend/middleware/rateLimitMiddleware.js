import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { ENV } from "../config/env.js";

// ---------------------------------------------------------------------------
// Rate limiting
//
// Layers, from coarse to fine:
//   generalLimiter   every request, keyed by IP             (server.js)
//   userLimiter      every signed-in request, keyed by user (routers)
//   feedLimiter / searchLimiter / zipLimiter / ...          specific routes
//
// Storage
//   No REDIS_URL  -> in-memory (fine for one long-running server, e.g. local dev).
//   REDIS_URL set -> Redis, so limits are shared across instances. This matters
//                    on Vercel/serverless, where every cold start would otherwise
//                    get a fresh, empty counter and the limits would do nothing.
//   If Redis is down the limiters fail OPEN (requests are allowed) rather than
//   taking the whole API down with it.
//
// Keys
//   Signed-in routes are keyed by user id, so classmates on one campus Wi-Fi
//   (one shared IP) don't throttle each other. Only anonymous routes use the IP.
// ---------------------------------------------------------------------------

let redis = null;
function redisClient() {
  if (!ENV.redisUrl) return null;
  if (!redis) {
    redis = new Redis(ENV.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    redis.on("error", (err) => console.error("⚠️  Redis (rate limiting):", err.message));
  }
  return redis;
}

function storeFor(name) {
  const client = redisClient();
  if (!client) return undefined; // express-rate-limit's default in-memory store
  const store = new RedisStore({ prefix: `rl:${name}:`, sendCommand: (...args) => client.call(...args) });
  // rate-limit-redis loads its Lua scripts in the constructor. If Redis is
  // unreachable at that moment the promises reject with no handler, which
  // crashes Node. It re-loads the scripts on first use anyway, so just mark
  // these as handled.
  store.incrementScriptSha?.catch?.(() => {});
  store.getScriptSha?.catch?.(() => {});
  return store;
}

const ipKey = (req) => req.ip;
const userKey = (req) => (req.user?._id ? `u:${req.user._id}` : `ip:${req.ip}`);

function limiterFor(name, { windowMs, max, message, keyGenerator = userKey, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests,
    store: storeFor(name),
    passOnStoreError: true,
    handler: (req, res) => {
      const resetMs = req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime).getTime() - Date.now() : windowMs;
      res.status(429).json({ message, retryAfterSeconds: Math.max(1, Math.ceil(resetMs / 1000)) });
    },
  });
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// ---- anonymous / auth routes (IP-keyed) -----------------------------------

// Coarse ceiling on every request. Generous on purpose: a whole hostel can
// share one IP.
export const generalLimiter = limiterFor("general", {
  windowMs: MIN, max: 300, keyGenerator: ipKey,
  message: "Too many requests. Please slow down.",
});

// Login: only FAILED attempts count, and they're counted per IP + account, so
// one person mistyping a password doesn't lock out a lecture hall on the same
// Wi-Fi — but guessing at one account is capped.
export const loginLimiter = limiterFor("login", {
  windowMs: 15 * MIN, max: 10, skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.identifier || "").toLowerCase().slice(0, 100)}`,
  message: "Too many failed login attempts. Please try again in 15 minutes.",
});

// New accounts: roomy enough for a class signing up together at orientation.
export const signupLimiter = limiterFor("signup", {
  windowMs: HOUR, max: 20, keyGenerator: ipKey,
  message: "Too many sign-ups from this network. Please try again later.",
});

// Forgot / reset password — every request counts (stops email bombing).
export const authLimiter = limiterFor("auth", {
  windowMs: 15 * MIN, max: 5, keyGenerator: ipKey,
  message: "Too many attempts. Please try again in 15 minutes.",
});

export const googleLimiter = limiterFor("google", {
  windowMs: 15 * MIN, max: 30, keyGenerator: ipKey,
  message: "Too many sign-in attempts. Please try again in a few minutes.",
});

// Public "request your school" form.
export const schoolRequestLimiter = limiterFor("school-request", {
  windowMs: HOUR, max: 5, keyGenerator: ipKey,
  message: "Too many school requests. Please try again later.",
});

// Public "request your department" form — same shape as schoolRequestLimiter.
export const departmentRequestLimiter = limiterFor("department-request", {
  windowMs: HOUR, max: 5, keyGenerator: ipKey,
  message: "Too many department requests. Please try again later.",
});

// ---- signed-in routes (user-keyed) ----------------------------------------

// Every signed-in API call, per person.
export const userLimiter = limiterFor("user", {
  windowMs: MIN, max: 240,
  message: "You're making requests too quickly. Please wait a moment.",
});

// Infinite scroll fires a request each time the reader nears the bottom.
export const feedLimiter = limiterFor("feed", {
  windowMs: MIN, max: 90,
  message: "You're scrolling faster than we can keep up. Give it a few seconds.",
});

export const searchLimiter = limiterFor("search", {
  windowMs: MIN, max: 60,
  message: "Too many searches. Please wait a moment.",
});

// Single-file downloads.
export const downloadLimiter = limiterFor("download", {
  windowMs: 10 * MIN, max: 60,
  message: "Download limit reached. Please try again in a few minutes.",
});

// "Download all" zips up to 200 files on the server — by far the heaviest call.
export const zipLimiter = limiterFor("zip", {
  windowMs: HOUR, max: 10,
  message: "You've requested a lot of zip downloads. Please try again in an hour.",
});

export const reportLimiter = limiterFor("report", {
  windowMs: HOUR, max: 10,
  message: "Report limit reached. Please try again later.",
});

// Material uploads — protects storage/Cloudinary usage from abuse.
export const uploadLimiter = limiterFor("upload", {
  windowMs: HOUR, max: 20,
  message: "Upload limit reached. Please try again in an hour.",
});

// AI quiz/theory generation — protects the Groq API quota.
export const aiLimiter = limiterFor("ai", {
  windowMs: HOUR, max: 10,
  message: "AI generation limit reached. Please try again in an hour.",
});

// The AI study tip shown once per login.
export const tipLimiter = limiterFor("tip", {
  windowMs: HOUR, max: 20,
  message: "Too many study-tip requests. Please try again later.",
});

// AI study-assistant chat — more generous than quiz generation since a chat
// is many short turns, but still protects the AI quota.
export const chatLimiter = limiterFor("chat", {
  windowMs: HOUR, max: 60,
  message: "You've reached the AI assistant limit for now. Please try again in an hour.",
});
