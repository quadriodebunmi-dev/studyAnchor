import api from "./api.js";

export const listNotifications = (params) => api.get("/notifications", { params }).then((r) => r.data);
export const getUnreadCount = () => api.get("/notifications/unread-count").then((r) => r.data.unread);
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => api.post("/notifications/read-all").then((r) => r.data);
export const getNotificationPreferences = () => api.get("/notifications/preferences").then((r) => r.data.preferences);
export const updateNotificationPreferences = (prefs) => api.put("/notifications/preferences", prefs).then((r) => r.data);
