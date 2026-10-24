import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, FileText, UploadCloud, Lock, Users, Trash2, StickyNote, BookOpen } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Input, Select, Textarea } from "../../components/FormFields.jsx";
import Pager from "../../components/Pager.jsx";
import { listCourses } from "../../services/courseService.js";
import UploadProgress from "../../components/UploadProgress.jsx";
import { uploadMaterial, getMyUploads, deleteMaterial, getMyFolders } from "../../services/materialService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { DEPARTMENTS, LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";

const emptyForm = { code: "", title: "", department: DEPARTMENTS[0], level: LEVELS[0], semester: SEMESTERS[0], session: SESSIONS[0], description: "" };

// New courses default to the rep's own department, level, semester and
// session — that's what they're adding courses for most of the time —
// falling back to the app-wide defaults for anything the rep's profile
// doesn't have set.
function defaultCourseForm(user) {
  return {
    ...emptyForm,
    department: user?.department || emptyForm.department,
    level: user?.level || emptyForm.level,
    semester: user?.semester || emptyForm.semester,
    session: user?.session || emptyForm.session,
  };
}

const MAX_FILES = 10;

const VISIBILITY_OPTIONS = [
  { value: "private", icon: Lock, title: "Just for me", text: "Only you can see it. It appears on your dashboard — no review needed." },
  { value: "class", icon: Users, title: "Share with my class", text: "A Course Rep reviews it first. Once approved, everyone in the course can see it." },
];

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red" };
const STATUS_LABEL = { pending: "Awaiting review", approved: "Approved", rejected: "Rejected" };

export default function MyUploadsPage() {
  const { user } = useAuth();
  // Independent learners have no school, so no courses: everything is a private personal upload.
  const independent = user.learnerType === "independent";
  const [folders, setFolders] = useState([]);
  const [folderFilter, setFolderFilter] = useState("");
  const [q, setQ] = useState("");
  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ description: "", courseId: "", visibility: "private", folder: "", tags: "" });
  // For "Just for me" uploads: false = personal use (no course), true = file it under a course.
  const [linkCourse, setLinkCourse] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const showToast = useToast();

  function loadUploads(p = page) {
    getMyUploads({ page: p, folder: folderFilter || undefined, q: q.trim() || undefined }).then((res) => { setUploads(res.materials); setPagination(res.pagination); }).catch(() => setUploads([]));
    getMyFolders().then(setFolders).catch(() => {});
  }

  useEffect(() => {
    if (independent) return;
    listCourses({ limit: 100 , filters: defaultCourseForm(user)})
      .then((res) => setCourses(res.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoaded(true));
  }, [independent]);

  // A course is only used when sharing with the class, or when a private upload is
  // explicitly linked to one. Keep the selected course valid in those cases and
  // clear it otherwise, so "personal use" can never carry a stale course along.
  const usesCourse = !independent && (form.visibility === "class" || linkCourse);
  useEffect(() => {
    setForm((f) => {
      if (!usesCourse) return f.courseId ? { ...f, courseId: "" } : f;
      const valid = courses.some((c) => c._id === f.courseId);
      if (valid) return f;
      return { ...f, courseId: courses[0]?._id || "" };
    });
  }, [usesCourse, courses]);

  useEffect(() => { setPage(1); }, [folderFilter, q]);
  useEffect(() => {
    setUploads(null);
    const t = setTimeout(() => loadUploads(page), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [page, folderFilter, q]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const personal = independent || !usesCourse;
    if (files.length === 0) { showToast("Choose at least one file.", "error"); return; }
    if (!personal && !form.courseId) { showToast("Pick a course first, or switch to personal use.", "error"); return; }
    setLoading(true); setProgress(0);
    try {
      const fd = new FormData();
      if (!personal && form.courseId) fd.append("courseId", form.courseId);
      fd.append("description", form.description);
      fd.append("visibility", personal ? "private" : form.visibility);
      if (form.folder.trim()) fd.append("folder", form.folder.trim());
      if (form.tags.trim()) fd.append("tags", form.tags);
      files.forEach((file) => fd.append("files", file));
      const result = await uploadMaterial(fd, setProgress);
      showToast(
        personal || form.visibility === "private"
          ? "Saved to your dashboard — only you can see it."
          : "Submitted — a Course Rep will review it before it's visible to others.",
        "success"
      );
      if (result?.failed) showToast(`${result.failed} file(s) couldn't be uploaded.`, "error");
      setForm((f) => ({ ...f, description: "", tags: "" }));
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

  const isPrivate = independent || form.visibility === "private";

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">My Uploads</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{independent ? "Your private library — PDFs, Word, PowerPoint, Excel files and images that only you can see. Use them with the AI study tools." : "Keep your own materials on your dashboard, or share them with your class for a Course Rep to review."}</p>

      <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="font-semibold flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Upload material</p>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {!independent && <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who can see this upload">
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
          </div>}
          {!independent && form.visibility === "private" && (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Course or personal use">
              {[
                { link: false, icon: StickyNote, title: "Personal use", text: "No course. Just a note or file for yourself." },
                { link: true, icon: BookOpen, title: "Keep under a course", text: "Still private, but filed with one of your courses." },
              ].map(({ link, icon: Icon, title, text }) => (
                <button type="button" key={title} role="radio" aria-checked={linkCourse === link}
                  onClick={() => setLinkCourse(link)}
                  className={`rounded-xl border p-3 text-left transition-colors ${linkCourse === link ? "border-accent bg-accent/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" /> {title}</span>
                  <span className="mt-1 block text-xs lv-meta">{text}</span>
                </button>
              ))}
            </div>
          )}
          {usesCourse && (
            coursesLoaded && courses.length === 0 ? (
              <p className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                No courses are available for you yet.{form.visibility === "private" ? " Switch to personal use to save this file without a course." : " Switch to \"Just for me\" to keep it private instead."}
              </p>
            ) : (
              <Select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))} aria-label="Course">
                {courses.map((c) => <option key={c._id} value={c._id}>{c.code} — {c.title}</option>)}
              </Select>
            )
          )}
          <p className="text-xs lv-meta">Each file is saved under its own file name.</p>
          {isPrivate && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Folder (optional), e.g. Biology" maxLength={60} list="folder-list" value={form.folder} onChange={(e) => setForm((f) => ({ ...f, folder: e.target.value }))} aria-label="Folder" />
              <Input placeholder="Tags, comma separated (optional)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} aria-label="Tags" />
              <datalist id="folder-list">{folders.filter((f) => f.name).map((f) => <option key={f.name} value={f.name} />)}</datalist>
            </div>
          )}
          <Textarea placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-sm cursor-pointer justify-center text-slate-500 dark:text-slate-400">
            <Upload className="w-4 h-4" /> Choose up to {MAX_FILES} files ({"PDF, PPT, DOC, XLS, image"} — max 50MB each)
            <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 truncate"><FileText className="w-4 h-4 shrink-0 text-slate-400" /> <span className="truncate">{file.name}</span></span>
                  <button type="button" onClick={() => removeFile(i)} disabled={loading} aria-label={`Remove ${file.name}`} className="text-slate-400 hover:text-danger shrink-0 disabled:opacity-40"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
          {loading && <UploadProgress percent={progress} fileCount={files.length} />}
          <Button type="submit" disabled={loading || (usesCourse && coursesLoaded && courses.length === 0)} className="w-full">{loading ? `Uploading… ${progress}%` : isPrivate ? "Save to my dashboard" : "Submit for review"}</Button>
        </form>
      </div>

      <h2 className="mt-8 font-semibold">{independent ? "Your library" : "Your submissions"}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1"><Input placeholder="Search your uploads" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your uploads" /></div>
        {folders.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFolderFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-medium ${folderFilter === "" ? "bg-primary text-primary-fg" : "bg-slate-100 dark:bg-slate-800"}`}>All</button>
            {folders.map((f) => <button key={f.name || "__none__"} onClick={() => setFolderFilter(f.name || "__none__")} className={`rounded-full px-3 py-1.5 text-xs font-medium ${folderFilter === (f.name || "__none__") ? "bg-primary text-primary-fg" : "bg-slate-100 dark:bg-slate-800"}`}>{f.name || "Unfiled"} ({f.count})</button>)}
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {!uploads && <InlineLoader />}
        {uploads?.map((m) => {
          const priv = m.visibility === "private";
          return (
            <div key={m._id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3">
              <button onClick={() => navigate(`/material/${m._id}`)} className="min-w-0 flex-1 text-left">
                <p className="font-medium truncate hover:text-primary">{m.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{[m.courseId?.code, m.folder, new Date(m.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}</p>
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
