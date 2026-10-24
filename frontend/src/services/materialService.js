import api from "./api.js";

export async function getMaterial(id) {
  const res = await api.get(`/materials/${id}`);
  return res.data.material;
}

// Stage 2.1 — one request can upload multiple files; returns every created
// Material plus the count of any that failed and the resulting status
// (students land in "pending", reps in "approved" — see Stage 2.2).
// `onProgress(percent)` (optional) is called as bytes are sent, 0–100.
export async function uploadMaterial(formData, onProgress) {
  const res = await api.post("/materials", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress
      ? (e) => { if (e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100))); }
      : undefined,
  });
  return res.data; // { materials, failed, status }
}

// Course Rep edits their own material's title/description.
export async function updateMaterial(id, data) {
  const res = await api.put(`/materials/${id}`, data);
  return res.data.material;
}

// Course Rep deletes their own material (or admin deletes any).
export async function deleteMaterial(id) {
  const res = await api.delete(`/materials/${id}`);
  return res.data;
}

export async function downloadMaterial(id) {
  const res = await api.post(`/materials/${id}/download`);
  return res.data; // { fileUrl, fileName }
}

// Actually triggers a browser "Save As" download instead of just opening the
// file in a new tab (which is all `window.open(fileUrl)` used to do, and
// which just previewed pdfs/images instead of downloading them). Fetches
// the file as a blob and saves it under its real filename.
export async function triggerFileDownload(fileUrl, fileName) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error("Couldn't download the file. Please try again.");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// Downloads a zip of every material passed in. `ids` zips exactly those;
// `courseId` (Stage 2.4) zips that course's approved materials only;
// neither given defaults, server-side, to the student's whole dashboard
// feed — powers both the feed-level and the per-course "Download all" button.
export async function downloadAllMaterials({ ids = [], courseId } = {}) {
  const res = await api.post("/materials/download-all", { ids, courseId }, { responseType: "blob" });
  const blob = res.data;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = "study-anchor-materials.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function toggleBookmark(id) {
  const res = await api.post(`/materials/${id}/bookmark`);
  return res.data.bookmarked;
}

// Course Rep's own uploads. Returns { materials, pagination, stats } —
// `stats` covers ALL of their uploads, not just this page.
export async function myMaterials({ page, limit } = {}) {
  const res = await api.get("/materials/mine", { params: { page, limit } });
  return res.data;
}

// Stage 2.2 — a student's own uploads, across every status ("My uploads").
export async function getMyUploads({ page, limit, folder, q } = {}) {
  const res = await api.get("/materials/mine/student", { params: { page, limit, folder, q } });
  return res.data; // { materials, pagination }
}

// What the study tools can pick from: your own library plus (when you're in a
// school) that school's approved shared materials. Each row has
// `source: "library" | "school"`.
// `scope`: "all" = everything in study-anchor you can see; "mine" = your library
// plus your current department / level / semester / session.
export async function getPickableMaterials({ q, page, limit, scope } = {}) {
  const res = await api.get("/materials/pickable", { params: { q: q || undefined, page, limit, scope: scope || undefined } });
  return res.data; // { materials, pagination }
}

// Personal library folders with counts: [{ name, count }] (name "" = unfiled).
export async function getMyFolders() {
  const res = await api.get("/materials/folders");
  return res.data.folders;
}

// Stage 2.2 — rep-only pending queue + approve/reject actions.
export async function getPendingMaterials({ page, limit } = {}) {
  const res = await api.get("/materials/pending", { params: { page, limit } });
  return res.data; // { materials, pagination }
}

export async function approveMaterial(id) {
  const res = await api.post(`/materials/${id}/approve`);
  return res.data.material;
}

export async function rejectMaterial(id, reason) {
  const res = await api.post(`/materials/${id}/reject`, { reason });
  return res.data.material;
}

export async function myBookmarks({ page, limit } = {}) {
  const res = await api.get("/materials/bookmarks/mine", { params: { page, limit } });
  return res.data; // { materials, pagination }
}

export async function searchMaterials(q, { page, limit } = {}) {
  const res = await api.get("/materials/search", { params: { q, page, limit } });
  return res.data; // { materials, pagination }
}

export async function reportMaterial(id, reason) {
  const res = await api.post(`/materials/${id}/report`, { reason });
  return res.data.report;
}
