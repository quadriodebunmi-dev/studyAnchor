// The feed algorithm. Pure functions only (no database access) so the whole
// thing can be unit-tested and tuned in one place.
//
// How a student's "For you" feed is built
// ---------------------------------------
// 1. Candidates  — the controller pulls a bounded set of approved materials
//                  (their own courses + popular + topic matches at their school).
// 2. Scoring     — every candidate gets a 0..1 score from four signals:
//
//        context   is it for the student's own course / department / level?
//        interest  do its topics overlap what this student actually reads?
//        rank      how well has the material done with other students?
//                  (downloads, bookmarks, quizzes generated, views)
//        recency   newer material scores higher (30-day half-life)
//
//    Already-opened materials are damped so the feed keeps surfacing new things.
// 3. Diversity   — a greedy pass stops one course from filling a whole screen.
// 4. Paging      — the ranked list is sliced by the feed cursor (see pagination.js).
//
// "Interest" comes from an interest profile: topic keywords from the materials
// the student viewed / downloaded / bookmarked / quizzed on (recent activity
// counts more), seeded with the topics of their own registered courses so a
// brand-new student still gets a sensible feed.

const DAY_MS = 86_400_000;

export const FEED_WEIGHTS = { context: 0.30, interest: 0.25, rank: 0.25, recency: 0.20 };
export const COURSE_WEIGHTS = { interest: 0.35, rank: 0.30, context: 0.20, fresh: 0.15 };

const RECENCY_HALF_LIFE_DAYS = 30;
const INTEREST_HALF_LIFE_DAYS = 21;
const SEEN_PENALTY = 0.7;
const DIVERSITY_DECAY = 0.85;
const PROFILE_MAX_TOPICS = 60;
const SCHOOL_AFFINITY_BONUS = 0.15; // added to course score in the all-schools explore feed

// ---------- topic extraction -------------------------------------------------

const STOPWORDS = new Set(`
a about above after again against all also am an and any are as at be because been before being below between both but by
can could did do does doing down during each few for from further had has have having he her here hers him his how i if in
into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so
some such than that the their them then there these they this those through to too under until up us very was we were what
when where which while who whom why will with would you your
lecture lectures note notes chapter course courses material materials pdf ppt pptx doc docx xls xlsx slide slides page pages
introduction intro part unit week class first second third one two three new using use used
`.split(/\s+/).filter(Boolean));

function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Lower-cases, strips digits/punctuation, drops stopwords, light stemming. */
export function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 24 && !STOPWORDS.has(w))
    .map(stem);
}

const MAX_BODY_CHARS = 30_000;
const MAX_BODY_TERM_COUNT = 10; // a word repeated 500 times shouldn't drown out the title

/**
 * Picks the most characteristic keywords of a material.
 * Title words weigh most, then course + description, then the file's own text.
 */
export function extractTopics({ title = "", description = "", courseText = "", body = "" } = {}, max = 12) {
  const scores = new Map();
  const add = (tokens, weight, cap = Infinity) => {
    const local = new Map();
    for (const t of tokens) local.set(t, Math.min(cap, (local.get(t) || 0) + 1));
    for (const [t, n] of local) scores.set(t, (scores.get(t) || 0) + n * weight);
  };
  add(tokenize(title), 5);
  add(tokenize(courseText), 3, 1);
  add(tokenize(description), 3);
  if (body) add(tokenize(String(body).slice(0, MAX_BODY_CHARS)), 1, MAX_BODY_TERM_COUNT);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([t]) => t);
}

/** Stored topics if the material has them (new uploads), else derive from title + description. */
export function topicsOf(material) {
  if (material?.topics?.length) return material.topics;
  return extractTopics({ title: material?.title, description: material?.description });
}

// ---------- signals ----------------------------------------------------------

/** How well a material has done with other students (raw, log-scaled so one viral file can't dominate). */
export function engagementRaw(m) {
  return (
    Math.log1p(m.downloads || 0) * 1.0 +
    Math.log1p(m.bookmarkCount || 0) * 1.5 +
    Math.log1p(m.quizzesGenerated || 0) * 1.2 +
    Math.log1p(m.viewCount || 0) * 0.4
  );
}

export function recencyScore(date, asOf, halfLifeDays = RECENCY_HALF_LIFE_DAYS) {
  const t = new Date(date || 0).getTime();
  const ageDays = Math.max(0, (asOf - t) / DAY_MS);
  return 0.5 ** (ageDays / halfLifeDays);
}

/**
 * Builds { topic -> weight (0..1) } from what the student has actually done.
 * `interactions`: [{ topics, views, downloads, quizzes, bookmarked, lastAt }]
 * `contextTopics`: topics of the student's own registered courses (cold start).
 */
export function buildInterestProfile(interactions = [], contextTopics = [], asOf = Date.now()) {
  const raw = new Map();
  for (const it of interactions) {
    const ageDays = Math.max(0, (asOf - new Date(it.lastAt || 0).getTime()) / DAY_MS);
    const decay = 0.5 ** (ageDays / INTEREST_HALF_LIFE_DAYS);
    const strength =
      Math.min(it.views || 0, 3) * 1 +
      Math.min(it.downloads || 0, 3) * 3 +
      (it.bookmarked ? 4 : 0) +
      Math.min(it.quizzes || 0, 3) * 3;
    if (strength <= 0) continue;
    for (const t of it.topics || []) raw.set(t, (raw.get(t) || 0) + strength * decay);
  }
  for (const t of contextTopics) raw.set(t, (raw.get(t) || 0) + 1);

  const top = [...raw.entries()].sort((a, b) => b[1] - a[1]).slice(0, PROFILE_MAX_TOPICS);
  const max = top.length ? top[0][1] : 0;
  return new Map(max > 0 ? top.map(([t, w]) => [t, w / max]) : []);
}

/** 0..1 — the strongest few topic matches, so a single shared word isn't "interest". */
export function interestScore(topics = [], profile) {
  if (!profile || profile.size === 0 || !topics.length) return 0;
  const matches = [];
  for (const t of topics) {
    const w = profile.get(t);
    if (w) matches.push(w);
  }
  if (!matches.length) return 0;
  matches.sort((a, b) => b - a);
  const sum = matches.slice(0, 5).reduce((s, w) => s + w, 0);
  return Math.min(1, sum / 3);
}

/** Top-N profile topics, used to pull topic-matching candidates from the database. */
export function topProfileTopics(profile, n = 15) {
  return [...profile.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

function academicContext(course, user) {
  if (!course || !user) return 0;
  let s = 0;
  if (user.department && course.department === user.department) s += 0.5;
  if (user.level && Number(course.level) === Number(user.level)) s += 0.3;
  if (user.semester && course.semester === user.semester) s += 0.2;
  return s;
}

// ---------- material ranking -------------------------------------------------

function greedyDiversify(scored) {
  const remaining = [...scored];
  const out = [];
  const perCourse = new Map();
  while (remaining.length) {
    let bestIdx = 0;
    let best = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i];
      const eff = r.score * DIVERSITY_DECAY ** (perCourse.get(r.courseKey) || 0);
      if (eff > best) { best = eff; bestIdx = i; }
    }
    const [pick] = remaining.splice(bestIdx, 1);
    perCourse.set(pick.courseKey, (perCourse.get(pick.courseKey) || 0) + 1);
    out.push(pick);
  }
  return out;
}

function reasonFor(parts, inContext) {
  const contributions = [
    ["context", parts.context * FEED_WEIGHTS.context],
    ["interest", parts.interest * FEED_WEIGHTS.interest],
    ["rank", parts.rank * FEED_WEIGHTS.rank],
    ["recency", parts.recency * FEED_WEIGHTS.recency],
  ].sort((a, b) => b[1] - a[1]);
  const top = contributions[0][0];
  if (top === "context") return inContext ? "In your courses" : "Your department";
  if (top === "interest") return "Matches your interests";
  if (top === "rank") return "Popular with students";
  return "New";
}

/**
 * Ranks candidate materials for one student.
 *
 * @param materials  plain objects (lean) with courseId as an id
 * @param opts.courseById        Map<courseIdString, course> for the candidates
 * @param opts.contextCourseIds  Set<string> of the student's own course ids
 * @param opts.profile           Map from buildInterestProfile
 * @param opts.seenIds           Set<string> of material ids the student already opened
 * @param opts.user              the student (department / level / semester)
 * @param opts.asOf              snapshot time in ms
 * @returns materials in feed order, each with `feedReason` added
 */
export function rankMaterials(materials, { courseById, contextCourseIds, profile, seenIds, user, asOf }) {
  if (!materials.length) return [];
  const raws = materials.map(engagementRaw);
  const maxRaw = Math.max(...raws, 1e-9);

  const scored = materials.map((m, i) => {
    const courseKey = String(m.courseId?._id || m.courseId);
    const inContext = contextCourseIds.has(courseKey);
    const context = inContext ? 1 : academicContext(courseById.get(courseKey), user) * 0.75;
    const interest = interestScore(topicsOf(m), profile);
    const parts = {
      context,
      interest,
      rank: raws[i] / maxRaw,
      recency: recencyScore(m.createdAt, asOf),
    };
    let score =
      FEED_WEIGHTS.context * parts.context +
      FEED_WEIGHTS.interest * parts.interest +
      FEED_WEIGHTS.rank * parts.rank +
      FEED_WEIGHTS.recency * parts.recency;
    if (seenIds?.has(String(m._id))) score *= SEEN_PENALTY;
    return { m, score, parts, inContext, courseKey };
  });

  scored.sort((a, b) =>
    b.score - a.score ||
    new Date(b.m.createdAt) - new Date(a.m.createdAt) ||
    String(b.m._id).localeCompare(String(a.m._id))
  );

  return greedyDiversify(scored).map(({ m, parts, inContext }) => ({ ...m, feedReason: reasonFor(parts, inContext) }));
}

// ---------- course ranking (Explore feed) -----------------------------------

/** "2025/2026" -> 2025. */
export function sessionStartYear(session) {
  const m = /^(\d{4})\s*\/\s*\d{4}$/.exec(String(session || "").trim());
  return m ? Number(m[1]) : null;
}

function currentSessionStartYear(asOf) {
  const d = new Date(asOf);
  // Academic sessions start around September (matches config/appConfig.js).
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
}

function sessionFreshness(session, asOf) {
  const y = sessionStartYear(session);
  if (y == null) return 0.3;
  const behind = Math.max(0, currentSessionStartYear(asOf) - y);
  return 0.6 ** behind;
}

const idOf = (v) => String(v?._id || v || "");

/** Own school first, then A→Z by school name (stable across pages). */
export function compareSchools(a, b, ownSchoolId) {
  const ia = idOf(a?.schoolId);
  const ib = idOf(b?.schoolId);
  if (ia === ib) return 0;
  const own = idOf(ownSchoolId);
  if (own && ia === own) return -1;
  if (own && ib === own) return 1;
  const na = (a?.schoolId?.name || "\uffff").toLowerCase(); // unnamed / unassigned last
  const nb = (b?.schoolId?.name || "\uffff").toLowerCase();
  return na.localeCompare(nb) || ia.localeCompare(ib);
}

/**
 * Scores courses for the Explore feed.
 * @param opts.statsById  Map<courseIdString, { materialCount, downloads, bookmarks, quizzes, views }>
 * @param opts.schoolBoost  true in the all-schools view, so the student's own school edges ahead
 * @returns courses with `feedReason`, `materialCount` and a private `_score`
 */
export function scoreCourses(courses, { statsById, profile, user, ownSchoolId, schoolBoost, asOf }) {
  const raws = courses.map((c) => {
    const s = statsById.get(String(c._id));
    if (!s) return 0;
    return engagementRaw({ downloads: s.downloads, bookmarkCount: s.bookmarks, quizzesGenerated: s.quizzes, viewCount: s.views }) +
      0.3 * Math.log1p(s.materialCount);
  });
  const maxRaw = Math.max(...raws, 1e-9);

  return courses.map((c, i) => {
    const interest = interestScore(tokenize(`${c.code} ${c.title} ${c.department} ${c.description || ""}`), profile);
    const parts = {
      interest,
      rank: raws[i] / maxRaw,
      context: academicContext(c, user),
      fresh: sessionFreshness(c.session, asOf),
    };
    let score =
      COURSE_WEIGHTS.interest * parts.interest +
      COURSE_WEIGHTS.rank * parts.rank +
      COURSE_WEIGHTS.context * parts.context +
      COURSE_WEIGHTS.fresh * parts.fresh;
    if (schoolBoost && ownSchoolId && idOf(c.schoolId) === idOf(ownSchoolId)) score += SCHOOL_AFFINITY_BONUS;

    const top = Object.entries({
      interest: parts.interest * COURSE_WEIGHTS.interest,
      rank: parts.rank * COURSE_WEIGHTS.rank,
      context: parts.context * COURSE_WEIGHTS.context,
      fresh: parts.fresh * COURSE_WEIGHTS.fresh,
    }).sort((a, b) => b[1] - a[1])[0][0];
    const feedReason = { interest: "Matches your interests", rank: "Popular with students", context: "Your department", fresh: "Current session" }[top];

    return {
      ...c,
      feedReason,
      materialCount: statsById.get(String(c._id))?.materialCount || 0,
      _score: score,
      _raw: raws[i],
    };
  });
}
