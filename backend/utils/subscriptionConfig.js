// Subscription configuration: defaults + strict validation. Pure, so the rules
// that stop an admin from locking people out are unit-tested.

export const FEATURE_KEYS = ["snap", "flashcards", "mockExams", "rooms", "roomQuizzes"];
export const FEATURE_LABELS = { snap: "Snap a Question", flashcards: "Flashcards", mockExams: "Mock exams", rooms: "Creating discussion rooms", roomQuizzes: "Creating room quizzes" };
// Daily AI ceilings a plan can raise (see config/platform.js ai.dailyLimits).
export const LIMIT_KEYS = ["snap", "flashcards", "exams", "roomQuizGeneration", "theoryGrading"];

export const DEFAULT_SUBSCRIPTIONS = {
  enabled: false, // OFF until an admin deliberately turns it on
  currency: "NGN",
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, { access: "free" }])),
  plans: [],
};

const SLUG = /^[a-z0-9][a-z0-9_-]{1,29}$/;

/** Returns { ok: true, value } or { ok: false, errors: [...] }. */
export function validateSubscriptionsConfig(input) {
  const errors = [];
  const src = input && typeof input === "object" ? input : {};
  const enabled = Boolean(src.enabled);

  const currency = String(src.currency || "NGN").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.push("Currency must be a 3-letter code such as NGN.");

  const features = {};
  for (const k of FEATURE_KEYS) {
    const a = src.features?.[k]?.access ?? "free";
    if (!["free", "paid"].includes(a)) errors.push(`"${FEATURE_LABELS[k]}" must be free or paid.`);
    features[k] = { access: a === "paid" ? "paid" : "free" };
  }

  const plans = [];
  const seen = new Set();
  if (!Array.isArray(src.plans) || src.plans.length > 10) errors.push("Provide up to 10 plans.");
  for (const p of Array.isArray(src.plans) ? src.plans.slice(0, 10) : []) {
    const key = String(p?.key || "").trim().toLowerCase();
    const name = String(p?.name || "").trim().slice(0, 60);
    if (!SLUG.test(key)) { errors.push(`Plan key "${p?.key}" must be 2–30 letters, digits, - or _.`); continue; }
    if (seen.has(key)) { errors.push(`Plan key "${key}" is used twice.`); continue; }
    seen.add(key);
    if (!name) errors.push(`Plan "${key}" needs a name.`);
    const priceMinor = Number(p.priceMinor);
    if (!Number.isInteger(priceMinor) || priceMinor < 100 || priceMinor > 1_000_000_000) errors.push(`Plan "${key}": price must be a whole number of the smallest currency unit (e.g. kobo), at least 100.`);
    const durationDays = Number(p.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) errors.push(`Plan "${key}": duration must be 1–3660 days.`);
    const pf = Array.isArray(p.features) ? [...new Set(p.features)] : [];
    if (pf.some((f) => !FEATURE_KEYS.includes(f))) errors.push(`Plan "${key}" lists an unknown feature.`);
    const limits = {};
    for (const [lk, lv] of Object.entries(p.limits || {})) {
      if (!LIMIT_KEYS.includes(lk) || !Number.isInteger(lv) || lv < -1 || lv > 100000) errors.push(`Plan "${key}": limit "${lk}" must be a whole number (-1 = unlimited).`);
      else limits[lk] = lv;
    }
    plans.push({ key, name, description: String(p.description || "").trim().slice(0, 200), priceMinor, currency, durationDays, features: pf.filter((f) => FEATURE_KEYS.includes(f)), limits, active: p.active !== false });
  }

  // The guard that prevents a lock-out: a paid feature nobody can buy is a bug, not a policy.
  if (enabled) {
    for (const k of FEATURE_KEYS) {
      if (features[k].access === "paid" && !plans.some((pl) => pl.active && pl.features.includes(k))) {
        errors.push(`"${FEATURE_LABELS[k]}" is marked paid but no active plan includes it.`);
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { enabled, currency, features, plans } };
}
