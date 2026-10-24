import api from "./api.js";

export const getProgressSummary = () => api.get("/progress/summary").then((r) => r.data);
export const listGoals = () => api.get("/progress/goals").then((r) => r.data);
export const createGoal = (data) => api.post("/progress/goals", data).then((r) => r.data.goal);
export const updateGoal = (id, data) => api.put(`/progress/goals/${id}`, data).then((r) => r.data.goal);
export const deleteGoal = (id) => api.delete(`/progress/goals/${id}`).then((r) => r.data);
export const completeGoal = (id) => api.post(`/progress/goals/${id}/complete`).then((r) => r.data);
export const logSession = (data) => api.post("/progress/goals/sessions", data).then((r) => r.data);
export const recentSessions = () => api.get("/progress/goals/sessions").then((r) => r.data.sessions);
export const getPointsHistory = (params) => api.get("/progress/points", { params }).then((r) => r.data);
export const getPointRules = () => api.get("/progress/rules").then((r) => r.data);
export const getLeaderboard = (period) => api.get("/progress/leaderboard", { params: { period } }).then((r) => r.data);
export const getPreferences = () => api.get("/progress/preferences").then((r) => r.data.preferences);
export const updatePreferences = (data) => api.put("/progress/preferences", data).then((r) => r.data.preferences);
export const getPushConfig = () => api.get("/progress/push-config").then((r) => r.data);
export const savePushSubscription = (sub) => api.post("/progress/push", sub).then((r) => r.data);
export const removePushSubscription = (endpoint) => api.delete("/progress/push", { data: { endpoint } }).then((r) => r.data);
export const getStudyAnalytics = (days = 30) => api.get("/progress/analytics", { params: { days } }).then((r) => r.data);
