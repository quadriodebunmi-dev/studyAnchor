import Course from "../models/Course.js";

// "Which courses does this person study?" — used by the dashboard feed and by
// the zip "Download all" so both agree.
//
// Students always have department + level + semester (+ session), so this is
// the same match the dashboard has always used. Course Reps sign up with a
// department and session but often no level/semester, so those fields are only
// applied when present; a rep also gets the courses listed in `repCourses`
// (free text such as "CSC101, CSC102").

const REP_CODE_SPLIT = /[\s,;/]+/;

export function repCourseCodes(user) {
  return String(user?.repCourses || "")
    .split(REP_CODE_SPLIT)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

export function contextCourseFilter(user) {
  const school = user?.schoolId ? { schoolId: user.schoolId } : {};
  const filter = { ...school };
  if (user?.department) filter.department = user.department;
  if (user?.level) filter.level = user.level;
  if (user?.semester) filter.semester = user.semester;
  // Include courses that predate the `session` field so they don't silently
  // vanish from everyone's feed (same rule the dashboard used before).
  if (user?.session) {
    filter.$or = [{ session: user.session }, { session: { $exists: false } }, { session: null }, { session: "" }];
  }

  const codes = user?.role === "rep" ? repCourseCodes(user) : [];
  if (codes.length) return { $or: [filter, { ...school, code: { $in: codes } }] };
  return filter;
}

/** The courses that make up this user's own dashboard. Capped defensively. */
export function findContextCourses(user, projection = "code title department level semester session schoolId description", cap = 200) {
  return Course.find(contextCourseFilter(user)).select(projection).sort({ code: 1 }).limit(cap).lean();
}
