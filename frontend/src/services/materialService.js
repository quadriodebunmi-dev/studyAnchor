import axios from "axios";
import api from "./api.js";

export async function getMaterial(id) {
  const res = await api.get(`/materials/${id}`);
  return res.data.material;
}

// Uploads one or more files. Same signature as before, so callers don't change:
// `formData` holds the text fields plus one or more "files" entries, and
// `onProgress(percent)` (optional) is called as bytes are sent, 0–100.
//
// Hosts like Vercel reject request bodies over ~4.5 MB, so the files do NOT go through
// our API. Instead:
//   1. ask the API to sign an upload for each file (it checks type and size),
//   2. send each file straight to Cloudinary,
//   3. tell the API what was uploaded; it verifies, extracts text and creates the Materials.
// Returns { materials, failed, status } — students land in "pending", reps in
// "approved" (see Stage 2.2).
const DIRECT_UPLOADS_AT_ONCE = 2;

export async function uploadMaterial(formData, onProgress) {
  const files = formData.getAll("files").filter((f) => typeof f !== "string");
  if (files.length === 0) throw { message: "Choose at least one file to upload." };
  const fields = {};
  for (const [key, value] of formData.entries()) if (key !== "files" && typeof value === "string") fields[key] = value;

  // 1. Signatures (also where an unsupported type or oversized file is refused)
  const sigRes = await api.post("/materials/upload-signature", {
    files: files.map((f) => ({ fileName: f.name, size: f.size })),
  });
  const { signatures } = sigRes.data;

  // 2. Straight to Cloudinary. Plain axios: our `api` instance would send the login token there.
  const totalBytes = files.reduce((n, f) => n + f.size, 0) || 1;
  const sentBytes = files.map(() => 0);
  const report = () => onProgress?.(Math.min(99, Math.round((sentBytes.reduce((a, b) => a + b, 0) / totalBytes) * 100)));
  const uploaded = new Array(files.length).fill(null);
  const errors = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(DIRECT_UPLOADS_AT_ONCE, files.length) }, async () => {
      while (next < files.length) {
        const i = next++;
        const file = files[i];
        const sig = signatures[i];
        const body = new FormData();
        body.append("file", file);
        body.append("api_key", sig.apiKey);
        body.append("signature", sig.signature);
        Object.entries(sig.params).forEach(([k, v]) => body.append(k, String(v)));
        try {
          const res = await axios.post(sig.uploadUrl, body, {
            onUploadProgress: (e) => { sentBytes[i] = Math.min(file.size, e.loaded || 0); report(); },
          });
          sentBytes[i] = file.size;
          uploaded[i] = { publicId: res.data.public_id, version: res.data.version, fileName: file.name };
        } catch (err) {
          const why = err.response?.data?.error?.message || "Network error";
          errors.push(`${file.name}: ${why}`);
        }
        report();
      }
    })
  );

  const done = uploaded.filter(Boolean);
  if (done.length === 0) throw { message: errors[0] || "Upload failed. Please try again." };

  // 3. Register what made it (the bar sits at 100% = "processing" while the API reads the files)
  onProgress?.(100);
  const res = await api.post("/materials/register", { ...fields, files: done });
  return { ...res.data, failed: (res.data.failed || 0) + errors.length };
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
// `kind`: "past_question" | "material" narrows the list; omit for everything.
export async function getMyUploads({ page, limit, folder, q, kind } = {}) {
  const res = await api.get("/materials/mine/student", { params: { page, limit, folder, q, kind } });
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

// Past exam / test papers: your own plus what your school shares.
// `source`: "all" (default) | "class" (shared by the school) | "personal" (your own uploads).
// Returns { materials, years, pagination } — `years` fills the year filter.
export async function getPastQuestions({ q, courseId, year, source, page, limit } = {}) {
  const res = await api.get("/materials/past-questions", {
    params: { q: q || undefined, courseId: courseId || undefined, year: year || undefined, source: source && source !== "all" ? source : undefined, page, limit },
  });
  return res.data;
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
