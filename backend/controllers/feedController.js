import Course from "../models/Course.js";
import Material from "../models/Material.js";
import User from "../models/User.js";
import { generateStudyTip } from "../utils/aiService.js";
import { PUBLIC_MATERIAL_FILTER } from "../utils/materialAccess.js";
import { findContextCourses } from "../utils/academicContext.js";
import { recentInteractions } from "../utils/interactions.js";
import { escapeRegex } from "../utils/regex.js";
import { parseFeedParams, feedMeta, sliceFeed } from "../utils/pagination.js";
import {
  buildInterestProfile, rankMaterials, scoreCourses, compareSchools,
  topProfileTopics, tokenize, topicsOf,
} from "../utils/feedRanking.js";

const COURSE_FIELDS = "code title department level semester session schoolId";
const NO_TEXT = "-extractedText"; // the extracted file text can be huge; cards never need it

const DASHBOARD_SORTS = ["for_you", "recent", "downloads", "session"];
const EXPLORE_SORTS = ["relevance", "school", "popular", "recent", "code"];

// Candidate pool sizes for the ranked feeds. Ranking happens in memory over
// this bounded pool, then the result is paged with a cursor.
const POOL = { ownCourses: 300, popular: 150, topical: 150, exploreCourses: 1500 };
const PRIVATE_PREVIEW = 6;
const DASHBOARD_COURSE_CAP = 60;

const idStr = (v) => String(v?._id || v || "");

// GET /api/feed/dashboard
// The non-scrolling part of the dashboard: the caller's own courses and a short
// preview of their private uploads. The material feed itself is
// GET /api/feed/materials (infinite scroll).
export async function getDashboard(req, res, next) {
  try {
    const { department, level, semester, session } = req.user;
    const [courses, privateMaterials, privateTotal] = await Promise.all([
      findContextCourses(req.user, COURSE_FIELDS, DASHBOARD_COURSE_CAP),
      // "Just for you" is a preview; the full, paginated list lives on My Uploads.
      Material.find({ uploadedBy: req.user._id, visibility: "private" })
        .select(NO_TEXT)
        .populate("courseId", COURSE_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .limit(PRIVATE_PREVIEW)
        .lean(),
      Material.countDocuments({ uploadedBy: req.user._id, visibility: "private" }),
    ]);
    res.json({
      courses,
      privateMaterials,
      privateTotal,
      scope: { department, level, semester, session: session || null },
    });
  } catch (err) { next(err); }
}

// GET /api/feed/materials?sort=for_you|recent|downloads|session&q=&cursor=&limit=
//
// The dashboard feed, infinite-scroll style: send back `pagination.nextCursor`
// as `cursor` to get the next batch.
//
//   for_you    (default) personalised ranking — see utils/feedRanking.js. Draws
//              from the caller's whole school, favouring their own courses,
//              topics they read, and materials that do well with other students.
//   recent / downloads / session
//              only the caller's own courses, in that order.
export async function getFeedMaterials(req, res, next) {
  try {
    const user = req.user;
    const sort = DASHBOARD_SORTS.includes(req.query.sort) ? req.query.sort : "for_you";
    const q = String(req.query.q || "").trim().slice(0, 80);
    const { limit, offset, asOf } = parseFeedParams(req.query);

    const school = user.schoolId ? { schoolId: user.schoolId } : {};
    const base = { ...school, ...PUBLIC_MATERIAL_FILTER, createdAt: { $lte: new Date(asOf) } };

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const byCourse = await Course.find({ ...school, $or: [{ code: rx }, { title: rx }] }).select("_id").limit(100).lean();
      base.$or = [{ title: rx }, { description: rx }, { fileName: rx }, { courseId: { $in: byCourse.map((c) => c._id) } }];
    }

    const contextCourses = await findContextCourses(user);
    const contextIds = contextCourses.map((c) => c._id);

    // ---- simple orderings: the caller's own courses only ---------------------
    if (sort !== "for_you") {
      const filter = { ...base, courseId: { $in: contextIds } };
      let rows;
      if (sort === "session") {
        // Session lives on the course, so join it in the database and page there.
        rows = await Material.aggregate([
          { $match: filter },
          { $project: { extractedText: 0 } },
          { $lookup: { from: Course.collection.name, localField: "courseId", foreignField: "_id", as: "course" } },
          { $unwind: "$course" },
          { $sort: { "course.session": -1, createdAt: -1, _id: -1 } },
          { $skip: offset },
          { $limit: limit + 1 },
        ]);
        rows = rows.map(({ course, ...m }) => ({
          ...m,
          courseId: { _id: course._id, code: course.code, title: course.title, department: course.department, level: course.level, semester: course.semester, session: course.session, schoolId: course.schoolId },
        }));
        await User.populate(rows, { path: "uploadedBy", select: "name" });
      } else {
        const order = sort === "downloads" ? { downloads: -1, createdAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
        rows = await Material.find(filter)
          .select(NO_TEXT).sort(order).skip(offset).limit(limit + 1)
          .populate("uploadedBy", "name").populate("courseId", COURSE_FIELDS)
          .lean();
      }
      const hasMore = rows.length > limit;
      return res.json({ materials: rows.slice(0, limit), pagination: feedMeta({ limit, offset, asOf, hasMore }), sort });
    }

    // ---- "For you": candidates -> score -> diversify -> page ------------------
    const interactions = await recentInteractions(user._id);

    // 1) The caller's own courses' materials (always candidates).
    const ownDocs = contextIds.length
      ? await Material.find({ ...base, courseId: { $in: contextIds } })
          .select(NO_TEXT).sort({ createdAt: -1, _id: -1 }).limit(POOL.ownCourses).lean()
      : [];

    // Cold start: a student with no activity yet is profiled from their own courses.
    const contextTopics = [...new Set([
      ...contextCourses.flatMap((c) => tokenize(`${c.code} ${c.title}`)),
      ...ownDocs.flatMap((m) => topicsOf(m).slice(0, 5)),
    ])];
    const profile = buildInterestProfile(interactions, contextTopics, asOf);

    // 2) Discovery: what's popular at the school, and what matches their topics.
    const exclude = { $nin: ownDocs.map((m) => m._id) };
    const topTopics = topProfileTopics(profile, 15);
    const [popular, topical] = await Promise.all([
      Material.find({ ...base, _id: exclude }).select(NO_TEXT).sort({ downloads: -1, createdAt: -1, _id: -1 }).limit(POOL.popular).lean(),
      topTopics.length
        ? Material.find({ ...base, _id: exclude, topics: { $in: topTopics } }).select(NO_TEXT).sort({ createdAt: -1, _id: -1 }).limit(POOL.topical).lean()
        : [],
    ]);

    const pool = new Map();
    for (const m of [...ownDocs, ...topical, ...popular]) pool.set(idStr(m._id), m);
    const candidates = [...pool.values()];

    const courseIds = [...new Set(candidates.map((m) => idStr(m.courseId)))];
    const courseDocs = courseIds.length ? await Course.find({ _id: { $in: courseIds } }).select(COURSE_FIELDS).lean() : [];
    const courseById = new Map(courseDocs.map((c) => [idStr(c._id), c]));

    const seenIds = new Set(interactions.filter((i) => i.views > 0 || i.downloads > 0).map((i) => idStr(i.material)));
    const ranked = rankMaterials(candidates, {
      courseById,
      contextCourseIds: new Set(contextIds.map(idStr)),
      profile,
      seenIds,
      user,
      asOf,
    });

    const { items, pagination } = sliceFeed(ranked, { limit, offset, asOf });

    // Attach course + uploader for just this page (not the whole pool).
    const uploaderIds = [...new Set(items.map((m) => idStr(m.uploadedBy)))];
    const uploaders = uploaderIds.length ? await User.find({ _id: { $in: uploaderIds } }).select("name").lean() : [];
    const uploaderById = new Map(uploaders.map((u) => [idStr(u._id), u]));
    const materials = items.map((m) => ({
      ...m,
      courseId: courseById.get(idStr(m.courseId)) || m.courseId,
      uploadedBy: uploaderById.get(idStr(m.uploadedBy)) || m.uploadedBy,
    }));

    res.json({ materials, pagination, sort });
  } catch (err) { next(err); }
}

// GET /api/feed/study-tip  — a fresh AI-generated study tip, shown on login
export async function getStudyTip(req, res, next) {
  try {
    const tip = await generateStudyTip();
    res.json({ tip });
  } catch (err) { next(err); }
}

// GET /api/feed/explore?scope=mine|all&sort=&q=&department=&level=&semester=&session=&cursor=&limit=
//
// Read-only browsing of courses, infinite-scroll. `scope` defaults to "mine"
// (the caller's own school); "all" spans every school.
//
//   sort=relevance  personalised: topics the student reads + how well the
//                   course's materials do + how close it is to their own
//   sort=school     grouped by school — the caller's own school first, then
//                   the others A→Z — each group in relevance order
//   sort=popular    most-used materials first
//   sort=recent     newest session first
//   sort=code       course code A→Z
// Default: "school" for scope=all, "relevance" for scope=mine.
export async function getExploreFeed(req, res, next) {
  try {
    const user = req.user;
    const { department, level, semester, session, scope = "mine" } = req.query;
    // A specific school picked from the search box (see SchoolPicker on the
    // frontend) takes over from `scope` entirely — it's a more specific ask
    // than "my school" or "all schools".
    const schoolId = /^[a-f0-9]{24}$/i.test(req.query.schoolId || "") ? req.query.schoolId : null;
    const q = String(req.query.q || "").trim().slice(0, 80);
    const defaultSort = schoolId ? "relevance" : scope === "all" ? "school" : "relevance";
    const sort = EXPLORE_SORTS.includes(req.query.sort) ? req.query.sort : defaultSort;
    const { limit, offset, asOf } = parseFeedParams(req.query, { defaultLimit: 18, maxLimit: 40 });

    const filter = { createdAt: { $lte: new Date(asOf) } };
    if (schoolId) filter.schoolId = schoolId;
    else if (scope !== "all" && user.schoolId) filter.schoolId = user.schoolId;
    if (department && department !== "All") filter.department = department;
    if (level && level !== "All") filter.level = Number(level);
    if (semester && semester !== "All") filter.semester = semester;
    if (session && session !== "All") filter.session = session;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ code: rx }, { title: rx }, { department: rx }];
    }

    // ---- plain orderings: the database does the paging -----------------------
    if (sort === "recent" || sort === "code") {
      const order = sort === "code" ? { code: 1, _id: 1 } : { session: -1, code: 1, _id: 1 };
      const rows = await Course.find(filter)
        .sort(order).skip(offset).limit(limit + 1)
        .populate("schoolId", "name city verified").lean();
      return res.json({ courses: rows.slice(0, limit), pagination: feedMeta({ limit, offset, asOf, hasMore: rows.length > limit }), sort });
    }

    // ---- personalised orderings ---------------------------------------------
    const candidates = await Course.find(filter)
      .select("code title department level semester session schoolId description")
      .sort({ session: -1, _id: 1 }) // if the pool is capped, keep the newest sessions
      .limit(POOL.exploreCourses)
      .populate("schoolId", "name city verified")
      .lean();

    const ids = candidates.map((c) => c._id);
    const [statRows, interactions, contextCourses] = await Promise.all([
      ids.length
        ? Material.aggregate([
            { $match: { courseId: { $in: ids }, ...PUBLIC_MATERIAL_FILTER, createdAt: { $lte: new Date(asOf) } } },
            { $group: {
              _id: "$courseId",
              materialCount: { $sum: 1 },
              downloads: { $sum: "$downloads" },
              bookmarks: { $sum: "$bookmarkCount" },
              quizzes: { $sum: "$quizzesGenerated" },
              views: { $sum: "$viewCount" },
            } },
          ])
        : [],
      recentInteractions(user._id),
      findContextCourses(user),
    ]);
    const statsById = new Map(statRows.map((s) => [idStr(s._id), s]));
    const profile = buildInterestProfile(
      interactions,
      [...new Set(contextCourses.flatMap((c) => tokenize(`${c.code} ${c.title}`)))],
      asOf
    );

    const scored = scoreCourses(candidates, {
      statsById, profile, user, ownSchoolId: user.schoolId, schoolBoost: scope === "all", asOf,
    });
    const byRelevance = (a, b) => b._score - a._score || a.code.localeCompare(b.code) || idStr(a._id).localeCompare(idStr(b._id));
    scored.sort(
      sort === "school"
        ? (a, b) => compareSchools(a, b, user.schoolId) || byRelevance(a, b)
        : sort === "popular"
          ? (a, b) => b._raw - a._raw || byRelevance(a, b)
          : byRelevance
    );

    const { items, pagination } = sliceFeed(scored, { limit, offset, asOf });
    res.json({ courses: items.map(({ _score, _raw, ...c }) => c), pagination, sort });
  } catch (err) { next(err); }
}
