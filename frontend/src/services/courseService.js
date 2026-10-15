import api from "./api.js";

export async function listCourses({ page, limit, ...filters } = {}) {
  //console.log({...filters})
  const filter = {...filters};
  console.log(filter)
  const res = await api.get(`/courses?department=${filter.filters.department}&level=${filter.filters.level}&semester=${filter.filters.semester}&session=${filter.filters.session}`, { params: { ...filters, page, limit } });
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
