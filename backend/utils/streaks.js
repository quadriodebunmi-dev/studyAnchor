// Study streaks and goal progress — pure functions over "local days"
// (YYYY-MM-DD strings in the learner's own time zone). A streak counts days on
// which the learner did something that counts as studying (see utils/activity.js),
// never merely opening the app.

export const isValidTimeZone = (tz) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return typeof tz === "string" && tz.length > 0; } catch { return false; }
};

/** The learner's calendar day for an instant, e.g. "2026-03-01". Falls back to UTC for a bad zone. */
export function localDay(date = new Date(), tz = "UTC") {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Minutes since local midnight (0–1439) for an instant in a zone. */
export function localMinutes(date = new Date(), tz = "UTC") {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  return h * 60 + m;
}

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD string. */
export const weekdayOf = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();

export const isDayString = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** "HH:MM" -> minutes since midnight, or null when invalid. */
export function parseClock(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Current/longest streak from a collection of active days.
 * The current streak survives until the END of the next day: if you studied
 * yesterday but not yet today it is still alive ("at risk"), and it only
 * resets once a whole day has been missed.
 */
export function computeStreak(days, today) {
  const set = new Set(days);
  const yesterday = addDays(today, -1);
  let current = 0;
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  while (cursor && set.has(cursor)) { current += 1; cursor = addDays(cursor, -1); }

  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return {
    current, longest,
    lastDay: sorted.length ? sorted[sorted.length - 1] : null,
    activeToday: set.has(today),
    atRisk: current > 0 && !set.has(today),
  };
}

/** Start day of the streak that currently ends today/yesterday (used for milestone keys). */
export function currentStreakStart(days, today) {
  const { current } = computeStreak(days, today);
  if (!current) return null;
  const set = new Set(days);
  const end = set.has(today) ? today : addDays(today, -1);
  return addDays(end, -(current - 1));
}

/**
 * Progress of a goal: on each scheduled study day (weekday in `studyDays`,
 * between start and end, up to today) did the learner log >= targetMinutes?
 */
export function goalProgress({ startDay, endDay, studyDays, targetMinutes, minutesByDay = {}, today }) {
  const days = Array.isArray(studyDays) && studyDays.length ? studyDays : [0, 1, 2, 3, 4, 5, 6];
  const last = endDay && endDay < today ? endDay : today;
  let scheduledSoFar = 0;
  let metDays = 0;
  let totalScheduled = 0;
  for (let d = startDay, i = 0; d <= (endDay || last) && i < 800; d = addDays(d, 1), i += 1) {
    if (!days.includes(weekdayOf(d))) continue;
    totalScheduled += 1;
    if (d <= last) {
      scheduledSoFar += 1;
      if ((minutesByDay[d] || 0) >= targetMinutes) metDays += 1;
    }
  }
  const todayInRange = today >= startDay && (!endDay || today <= endDay);
  const todayScheduled = todayInRange && days.includes(weekdayOf(today));
  const todayMinutes = minutesByDay[today] || 0;
  return {
    scheduledSoFar, metDays, totalScheduled,
    percent: scheduledSoFar ? Math.round((metDays / scheduledSoFar) * 100) : 0,
    todayScheduled, todayMinutes, todayTarget: targetMinutes, todayMet: todayMinutes >= targetMinutes,
    ended: Boolean(endDay) && today > endDay,
  };
}

/** Anti-abuse gate for the completion reward: real, repeated effort — not one click. */
export function goalCompletionEligible(progress, { minMetDays, minPercent }) {
  return progress.metDays >= minMetDays && progress.percent >= minPercent;
}

/**
 * Which days count as "studied"? rows: [{ day, type, n }] (activity grouped by day+type).
 * Anything substantial (a session, an exam, a quiz, a solved question) counts on
 * its own. Flashcards count only once at least `minCards` distinct cards were reviewed
 * that day — flipping one card isn't studying.
 */
export function qualifyingDays(rows, { minCards = 5 } = {}) {
  const byDay = new Map();
  for (const r of rows) {
    const d = byDay.get(r.day) || { other: 0, cards: 0 };
    if (r.type === "flashcards") d.cards += r.n; else d.other += r.n;
    byDay.set(r.day, d);
  }
  return [...byDay].filter(([, d]) => d.other > 0 || d.cards >= minCards).map(([day]) => day).sort();
}
