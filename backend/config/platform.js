// Business rules that should be tunable without a code change live here, not
// scattered through controllers. Every value can be overridden at deploy time
// with PLATFORM_CONFIG_JSON (deep-merged), e.g.
//   PLATFORM_CONFIG_JSON='{"rewards":{"roomQuizParticipation":15},"ai":{"dailyLimits":{"snap":40}}}'
//
// Phase I (subscriptions) will move the `features` / `ai.dailyLimits` section
// into the database behind utils/entitlements.js; callers don't need to change.

const DEFAULTS = {
  ai: {
    // Per-user, per-UTC-day ceilings for each AI feature (see utils/aiGuard.js).
    dailyLimits: { snap: 20, flashcards: 20, exams: 10, roomQuizGeneration: 20, theoryGrading: 150 },
    // Characters of source text sent to the model per request.
    maxSourceChars: 12000,
    // A document with less readable text than this is treated as unreadable
    // (typically a scanned PDF with no text layer).
    minSourceChars: 200,
    maxImageBytes: 8 * 1024 * 1024,
    requestTimeoutMs: 45000,
  },
  // Profile picture: the app sends an already-cropped 512px JPEG (~50–150 KB), so this is generous.
  profile: { avatarMaxBytes: 1024 * 1024 },
  // Study materials go browser -> Cloudinary directly (serverless hosts reject request
  // bodies over ~4.5 MB), so this cap is enforced when the upload is signed and again
  // when it is registered. Your Cloudinary plan has its own per-file cap (the free
  // plan allows 10 MB) — raise this only as far as that allows.
  materials: {
    maxFileBytes: 50 * 1024 * 1024,
    maxFiles: 10,
    // Text extraction reads the whole file into memory; skip it above this size.
    extractMaxBytes: 15 * 1024 * 1024,
  },
  rooms: {
    maxMembers: 500,
    maxRoomsCreatedPerDay: 5,
    postMaxChars: 2000,
    // One photo or one sound per message. Kept under serverless request limits (~4.5 MB).
    attachmentMaxBytes: 4 * 1024 * 1024,
    maxPostsPerMinute: 12,
  },
  quizzes: {
    maxQuestions: 50,
    maxAiQuestionsPerRequest: 30,
    maxTimeLimitMinutes: 300,
    // Members who haven't submitted are reminded this long before the deadline.
    deadlineReminderLeadMinutes: 60,
    // Grace for network latency when a time-limited attempt is submitted.
    submitGraceSeconds: 15,
  },
  flashcards: { minCards: 3, maxCards: 40, maxDeckCards: 80, maxTopics: 12 },
  exams: { minQuestions: 3, maxQuestions: 40, maxTimeLimitMinutes: 240, maxMaterials: 5 },
  goals: {
    maxActive: 10,
    maxSessionMinutes: 480,   // one logged session
    maxDailyMinutes: 960,     // all sessions in a local day
    // A logged session shorter than this doesn't count as a streak day.
    minSessionMinutesForStreak: 10,
    // A goal pays its completion reward only after this many scheduled days were actually met.
    completionMinMetDays: 3,
    completionMinPercent: 80,
    // Reminders are skipped when the reminder time is older than this (no stale "study now" at midnight).
    reminderWindowMinutes: 180,
  },
  leaderboard: { size: 100 },
  billing: {
    currency: "NGN",
    // A checkout left unpaid this long is marked abandoned.
    pendingTtlHours: 24,
  },
  // Points. Every rule is idempotent per (user, source) — see utils/rewards.js.
  rewards: {
    flashcardsPer10Cards: 2, flashcardsDailyCap: 10,
    mockExamCompleted: 5, mockExamDailyCap: 3, mockExamMinAnsweredRatio: 0.5,
    personalQuizCompleted: 3, personalQuizDailyCap: 3, personalQuizMinQuestions: 5,
    goalCompleted: 15,
    // streak length -> one-off bonus
    streakMilestones: { 7: 10, 30: 40, 100: 150 },
    // 0 = off. Posting rewards invite spam, so they ship disabled.
    roomPost: 0, roomPostDailyCap: 3, roomPostMinChars: 40,
    roomCreated: 5,
    roomCreatedDailyCap: 3,
    roomQuizParticipation: 10,
    // Needs at least this share of the questions answered to count as "participation".
    roomQuizMinAnsweredRatio: 0.5,
    roomQuizAccuracyBonus: { minPercentage: 80, points: 5 },
  },
  // Feature keys for utils/entitlements.js. tier "free" = available to everyone.
  features: {
    snap: { tier: "free" },
    flashcards: { tier: "free" },
    mockExams: { tier: "free" },
    rooms: { tier: "free" },
    roomQuizzes: { tier: "free" },
  },
};

function deepMerge(base, extra) {
  if (!extra || typeof extra !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof base?.[k] === "object" ? deepMerge(base[k], v) : v;
  }
  return out;
}

function load() {
  try {
    const raw = process.env.PLATFORM_CONFIG_JSON;
    return raw ? deepMerge(DEFAULTS, JSON.parse(raw)) : DEFAULTS;
  } catch (err) {
    console.error("⚠️  PLATFORM_CONFIG_JSON is not valid JSON — using defaults:", err.message);
    return DEFAULTS;
  }
}

// A private copy: admin overrides mutate PLATFORM at runtime and must never touch the shipped defaults.
export const PLATFORM = structuredClone(load());
export { deepMerge, DEFAULTS as PLATFORM_DEFAULTS };
