import api from "./api.js";

export const listPendingReps = async ({ page, limit } = {}) => (await api.get("/admin/reps/pending", { params: { page, limit } })).data; // { reps, pagination }
export const approveRep = async (id) => (await api.post(`/admin/reps/${id}/approve`)).data;
export const rejectRep = async (id, reason) => (await api.post(`/admin/reps/${id}/reject`, { reason })).data;
export const listUsers = async ({ search, page, limit } = {}) => (await api.get("/admin/users", { params: { search, page, limit } })).data; // { users, pagination }
export const toggleSuspendUser = async (id) => (await api.post(`/admin/users/${id}/suspend`)).data.user;
export const listAllMaterials = async ({ page, limit } = {}) => (await api.get("/admin/materials", { params: { page, limit } })).data; // { materials, pagination }
export const listPendingMaterials = async ({ page, limit } = {}) => (await api.get("/admin/materials/pending", { params: { page, limit } })).data; // { materials, pagination }
export const approveMaterial = async (id) => (await api.post(`/admin/materials/${id}/approve`)).data.material;
export const rejectMaterial = async (id, reason) => (await api.post(`/admin/materials/${id}/reject`, { reason })).data.material;
export const removeMaterial = async (id) => (await api.delete(`/admin/materials/${id}`)).data;
export const listReports = async ({ status, page, limit } = {}) => (await api.get("/admin/reports", { params: { status, page, limit } })).data; // { reports, pagination }
export const resolveReport = async (id) => (await api.post(`/admin/reports/${id}/resolve`)).data.report;
export const getActivityLog = async ({ page, limit } = {}) => (await api.get("/admin/activity-log", { params: { page, limit } })).data; // { log, pagination }
export const getPlatformAnalytics = async () => (await api.get("/admin/analytics")).data;
