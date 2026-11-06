import api from "./api.js";

// Events the signed-in person may see that overlap [from, to] (ISO strings or Dates).
export const listEvents = ({ from, to, type, scope } = {}) =>
  api.get("/calendar", { params: { from: from?.toISOString?.() ?? from, to: to?.toISOString?.() ?? to, type: type || undefined, scope: scope && scope !== "all" ? scope : undefined } })
    .then((r) => r.data.events);

// The next few events (dashboards).
export const upcomingEvents = (limit = 5) => api.get("/calendar/upcoming", { params: { limit } }).then((r) => r.data.events);

export const createEvent = (data) => api.post("/calendar", data).then((r) => r.data.event);
export const updateEvent = (id, data) => api.put(`/calendar/${id}`, data).then((r) => r.data.event);
export const deleteEvent = (id) => api.delete(`/calendar/${id}`).then((r) => r.data);
