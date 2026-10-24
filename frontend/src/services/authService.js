import api from "./api.js";

export async function signup(data) {
  const res = await api.post("/auth/signup", data);
  localStorage.setItem("study-anchor-token", res.data.token);
  return res.data.user;
}

export async function repSignup(data) {
  const res = await api.post("/auth/rep-signup", data);
  return res.data;
}

export async function login(identifier, password) {
  const res = await api.post("/auth/login", { identifier, password });
  localStorage.setItem("study-anchor-token", res.data.token);
  return res.data.user;
}

export async function googleLogin(payload) {
  const res = await api.post("/auth/google", payload);
  if (res.data.token) localStorage.setItem("study-anchor-token", res.data.token);
  return res.data;
}

export async function updateProfile(data) {
  const res = await api.put("/auth/me", data);
  return res.data.user;
}

// `file` must be the already-edited picture (see AvatarEditor); `onProgress(percent)` is optional.
export async function uploadAvatar(file, onProgress) {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await api.put("/auth/me/avatar", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress ? (e) => { if (e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100))); } : undefined,
  });
  return res.data.user;
}

export async function removeAvatar() {
  const res = await api.delete("/auth/me/avatar");
  return res.data.user;
}

export async function fetchMe() {
  const res = await api.get("/auth/me");
  return res.data.user;
}

export async function logout() {
  localStorage.removeItem("study-anchor-token");
  await api.post("/auth/logout").catch(() => {});
}

export async function forgotPassword(email) {
  const res = await api.post("/auth/forgot-password", { email });
  return res.data;
}

export async function resetPassword(token, password) {
  const res = await api.post("/auth/reset-password", { token, password });
  return res.data;
}
