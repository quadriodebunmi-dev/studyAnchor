import api from "./api.js";

// A fresh AI-generated study tip, shown to students once per login.
export async function getStudyTip() {
  const res = await api.get("/feed/study-tip");
  return res.data.tip;
}

// The non-scrolling part of the dashboard: the caller's own courses and a
// short preview of their private uploads. The material list itself is
// getFeedMaterials() below (infinite scroll).
export async function getDashboard() {
  const res = await api.get("/feed/dashboard");
  return res.data; // { courses, privateMaterials, privateTotal, scope }
}

// Infinite-scroll dashboard feed. Pass the previous response's
// `pagination.nextCursor` as `cursor` to get the next batch.
//   sort: "for_you" (default, personalised) | "recent" | "downloads" | "session"
export async function getFeedMaterials({ sort = "for_you", q, cursor, limit } = {}) {
  const res = await api.get("/feed/materials", { params: { sort, q: q || undefined, cursor, limit } });
  return res.data; // { materials, pagination, sort }
}

// Infinite-scroll Explore feed.
//   scope: "mine" (default) | "all"
//   schoolId: a specific school (from SchoolPicker) — overrides `scope` when set
//   sort: "relevance" (default) | "school" | "popular" | "recent" | "code"
export async function getExploreFeed({ scope = "mine", schoolId, sort, q, department, level, semester, session, cursor, limit } = {}) {
  const res = await api.get("/feed/explore", {
    params: { scope, schoolId: schoolId || undefined, sort, q: q || undefined, department, level, semester, session, cursor, limit },
  });
  return res.data; // { courses, pagination, sort }
}
