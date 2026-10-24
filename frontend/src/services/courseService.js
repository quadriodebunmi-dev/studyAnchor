import api from "./api.js";

// Lists courses. Pass filters flat ({ department, level, semester, session, q,
// schoolId, page, limit }) or nested under `filters`. Empty values and "All" are
// dropped so they never reach the server as the literal text "undefined".
export async function listCourses({ page, limit, filters = {}, ...flat } = {}) {
  const merged = { ...filters, ...flat };
  const params = { page, limit };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "" || v === "All") continue;
    params[k] = v;
  }
  const res = await api.get("/courses", { params });
  return res.data; // { courses, pagination }
}

// The course, plus one page of its materials. sort: "date" (default) | "downloads"
export async function getCourse(id, { sort, page, limit } = {}) {
  const res = await api.get(`/courses/${id}`, { params: { sort, page, limit } });
  return res.data; // { course, materials, pagination }
}

// Class Rep (or admin) adds a course.
export async function createCourse(data) {
  const res = await api.post("/courses", data);
  return res.data.course;
}

// Class Rep (or admin) edits a course.
export async function updateCourse(id, data) {
  const res = await api.put(`/courses/${id}`, data);
  return res.data.course;
}

// Course Rep, Class Rep (or admin) deletes a course.
export async function deleteCourse(id) {
  const res = await api.delete(`/courses/${id}`);
  return res.data;
}
