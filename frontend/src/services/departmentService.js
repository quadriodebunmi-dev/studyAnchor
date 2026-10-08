import api from "./api.js";

export async function searchDepartments(q, schoolId) {
  const res = await api.get("/departments", { params: { q, schoolId } });
  return res.data.departments;
}

export async function requestDepartment({ name, schoolId }) {
  const res = await api.post("/departments", { name, schoolId });
  return res.data.department;
}

// Admin-only department management (mirrors the "Schools" admin section).
export const listDepartmentsAdmin = async ({ q, page, limit } = {}) => (await api.get("/departments/admin", { params: { q, page, limit } })).data; // { departments, pagination }
export const verifyDepartment = async (id) => (await api.post(`/departments/${id}/verify`)).data.department;
export const updateDepartment = async (id, data) => (await api.put(`/departments/${id}`, data)).data.department;
export const deleteDepartment = async (id) => (await api.delete(`/departments/${id}`)).data;
