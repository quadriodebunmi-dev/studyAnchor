import api from "./api.js";

export async function searchSchools(q) {
  const res = await api.get("/schools", { params: { q } });
  return res.data.schools;
}

export async function requestSchool(payload) {
  const res = await api.post("/schools", payload);
  return res.data.school;
}

export async function getSchoolStructure(schoolId) {
  const res = await api.get(`/schools/${schoolId}/structure`);
  return res.data; // { orgUnitLabel, termStructure, levels, departments }
}

// Admin-only school management (new "Schools" admin section).
export const listSchoolsAdmin = async ({ q, page, limit } = {}) => (await api.get("/schools/admin", { params: { q, page, limit } })).data; // { schools, pagination }
export const verifySchool = async (id) => (await api.post(`/schools/${id}/verify`)).data.school;
export const updateSchool = async (id, data) => (await api.put(`/schools/${id}`, data)).data.school;
export const deleteSchool = async (id) => (await api.delete(`/schools/${id}`)).data;
