import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, FileText, UploadCloud, Lock, Users, Trash2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Input, Select, Textarea } from "../../components/FormFields.jsx";
import Pager from "../../components/Pager.jsx";
import { listCourses } from "../../services/courseService.js";
import { uploadMaterial, getMyUploads, deleteMaterial } from "../../services/materialService.js";
import { useToast } from "../../components/Toast.jsx";

const MAX_FILES = 10;

const VISIBILITY_OPTIONS = [
  { value: "private", icon: Lock, title: "Just for me", text: "Only you can see it. It appears on your dashboard — no review needed." },
  { value: "class", icon: Users, title: "Share with my class", text: "A Course Rep reviews it first. Once approved, everyone in the course can see it." },
];

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red" };
const STATUS_LABEL = { pending: "Awaiting review", approved: "Approved", rejected: "Rejected" };

export default function MyUploadsPage() {
  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: "", description: "", courseId: "", visibility: "private" });
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  function loadUploads(p = page) {
    getMyUploads({ page: p }).then((res) => { setUploads(res.materials); setPagination(res.pagination); }).catch(() => setUploads([]));
  }

  useEffect(() => {
    listCourses({ limit: 100 }).then((res) => { setCourses(res.courses); setForm((f) => ({ ...f, courseId: res.courses[0]?._id || "" })); });
  }, []);

  useEffect(() => { setUploads(null); loadUploads(page); }, [page]);

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    setFiles((prev) => {
      const combined = [...prev, ...incoming].slice(0, MAX_FILES);
      if (prev.length + incoming.length > MAX_FILES) showToast(`You can upload up to ${MAX_FILES} files at once.`, "info");
      return combined;
    });
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || files.length === 0 || !form.courseId) { showToast("Pick a course, add a title, and choose at least one file.", "error"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("courseId", form.courseId);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("visibility", form.visibility);
      files.forEach((file) => fd.append("files", file));
      const result = await uploadMaterial(fd);
      showToast(
        form.visibility === "private"
          ? "Saved to your dashboard — only you can see it."
          : "Submitted — a Course Rep will review it before it's visible to others.",
        "success"
      );
      if (result?.failed) showToast(`${result.failed} file(s) couldn't be uploaded.`, "error");
      setForm((f) => ({ ...f, title: "", description: "" }));
      setFiles([]);
      // New uploads sort first — jump back to page 1 so it's visible.
      if (page === 1) loadUploads(1); else setPage(1);
    } catch (err) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(m) {
    if (!window.confirm(`Delete "${m.title}"? This can't be undone.`)) return;
    setDeletingId(m._id);
    try {
      await deleteMaterial(m._id);
      loadUploads(page); // refreshes the list and the total count together
      showToast("Upload deleted", "success");
    } catch (err) {
      showToast(err.message || "Couldn't delete this upload.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const isPrivate = form.visibility === "private";

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">My Uploads</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep your own materials on your dashboard, or share them with your class for a Course Rep to review.</p>

      <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="font-semibold flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Upload material</p>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who can see this upload">
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, title, text }) => (
              <button
                type="button" key={value} role="radio" aria-checked={form.visibility === value}
                onClick={() => setForm((f) => ({ ...f, visibility: value }))}
                className={`rounded-xl border p-3 text-left transition-colors ${form.visibility === value ? "border-accent bg-accent/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" /> {title}</span>
                <span className="mt-1 block text-xs lv-meta">{text}</span>
              </button>
            ))}
          </div>
          <Select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
            {courses.length === 0 && <option value="">No courses available</option>}
            {courses.map((c) => <option key={c._id} value={c._id}>{c.code} — {c.title}</option>)}
          </Select>
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Textarea placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-sm cursor-pointer justify-center text-slate-500 dark:text-slate-400">
            <Upload className="w-4 h-4" /> Choose up to {MAX_FILES} files (PDF, PPT, DOC, XLS, image — max 50MB each)
            <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 truncate"><FileText className="w-4 h-4 shrink-0 text-slate-400" /> <span className="truncate">{file.name}</span></span>
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-danger shrink-0"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Uploading..." : isPrivate ? "Save to my dashboard" : "Submit for review"}</Button>
        </form>
      </div>

      <h2 className="mt-8 font-semibold">Your submissions</h2>
      <div className="mt-3 space-y-2">
        {!uploads && <InlineLoader />}
        {uploads?.map((m) => {
          const priv = m.visibility === "private";
          return (
            <div key={m._id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3">
              <button onClick={() => navigate(`/material/${m._id}`)} className="min-w-0 flex-1 text-left">
                <p className="font-medium truncate hover:text-primary">{m.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.courseId?.code} · {new Date(m.createdAt).toLocaleDateString()}</p>
                {!priv && m.status === "rejected" && m.reviewNote && <p className="mt-1 text-xs text-danger">Reason: {m.reviewNote}</p>}
              </button>
              {priv ? <Badge tone="violet"><Lock className="h-3 w-3" /> Only me</Badge> : <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>}
              <button onClick={() => handleDelete(m)} disabled={deletingId === m._id} aria-label={`Delete ${m.title}`} className="shrink-0 rounded-lg p-1.5 hover:bg-danger/10 disabled:opacity-50">
                <Trash2 className="h-4 w-4 text-danger" />
              </button>
            </div>
          );
        })}
        {uploads?.length === 0 && <EmptyState icon={<UploadCloud className="w-8 h-8" />} title="No uploads yet" message="Materials you save privately or share with your class show up here." />}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
