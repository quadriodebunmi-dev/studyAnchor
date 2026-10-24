import api from "./api.js";

// Discovery & membership
export const discoverRooms = (params) => api.get("/rooms", { params }).then((r) => r.data);
export const myRooms = (params) => api.get("/rooms/mine", { params }).then((r) => r.data);
export const myInvitations = () => api.get("/rooms/invitations").then((r) => r.data.invitations);
export const createRoom = (data) => api.post("/rooms", data).then((r) => r.data.room);
export const previewRoomByCode = (code) => api.get(`/rooms/code/${encodeURIComponent(code)}`).then((r) => r.data.room);
export const getRoom = (id) => api.get(`/rooms/${id}`).then((r) => r.data.room);
export const updateRoom = (id, data) => api.put(`/rooms/${id}`, data).then((r) => r.data.room);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`).then((r) => r.data);
export const joinRoom = (id, inviteCode) => api.post(`/rooms/${id}/join`, { inviteCode }).then((r) => r.data);
export const leaveRoom = (id) => api.post(`/rooms/${id}/leave`).then((r) => r.data);
export const respondToInvitation = (id, accept) => api.post(`/rooms/${id}/invitation`, { accept }).then((r) => r.data);
export const inviteToRoom = (id, email) => api.post(`/rooms/${id}/invite`, { email }).then((r) => r.data);
export const listRequests = (id) => api.get(`/rooms/${id}/requests`).then((r) => r.data.requests);
export const decideRequest = (id, userId, decision) => api.post(`/rooms/${id}/requests/${userId}/${decision}`).then((r) => r.data);
export const listMembers = (id, params) => api.get(`/rooms/${id}/members`, { params }).then((r) => r.data);
export const setMemberRole = (id, userId, role) => api.put(`/rooms/${id}/members/${userId}`, { role }).then((r) => r.data);
export const removeMember = (id, userId, ban = false) => api.delete(`/rooms/${id}/members/${userId}`, { params: { ban } }).then((r) => r.data);
export const roomActivity = (id) => api.get(`/rooms/${id}/activity`).then((r) => r.data.events);

// Discussion
export const listPosts = (id, params) => api.get(`/rooms/${id}/posts`, { params }).then((r) => r.data);
export const listReplies = (id, postId, params) => api.get(`/rooms/${id}/posts/${postId}/replies`, { params }).then((r) => r.data);
// `file` is an optional photo or sound; it makes the request multipart.
export const createPost = (id, content, parent, file, durationSec) => {
  if (!file) return api.post(`/rooms/${id}/posts`, { content, parent }).then((r) => r.data.post);
  const fd = new FormData();
  fd.append("content", content || "");
  if (parent) fd.append("parent", parent);
  if (durationSec) fd.append("durationSec", String(Math.round(durationSec)));
  fd.append("file", file, file.name);
  return api.post(`/rooms/${id}/posts`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.post);
};
export const editPost = (id, postId, content) => api.put(`/rooms/${id}/posts/${postId}`, { content }).then((r) => r.data.post);
export const removePost = (id, postId) => api.delete(`/rooms/${id}/posts/${postId}`).then((r) => r.data);
export const reportPost = (id, postId, reason) => api.post(`/rooms/${id}/posts/${postId}/report`, { reason }).then((r) => r.data);
export const listReports = (id) => api.get(`/rooms/${id}/reports`).then((r) => r.data.reports);
export const dismissReport = (id, reportId) => api.post(`/rooms/${id}/reports/${reportId}/dismiss`).then((r) => r.data);
