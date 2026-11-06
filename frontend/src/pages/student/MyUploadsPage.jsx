import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Upload, X, FileText, UploadCloud, Lock, Users, Trash2, StickyNote, BookOpen, Search, FolderKanban, ChevronRight } from "lucide-react";
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
import PastQuestionFields, { appendKindFields, emptyKindForm } from "../../components/PastQuestionFields.jsx";

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

// Same tints as the student dashboard (full class names on purpose: Tailwind can't see classes built from pieces).
const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
};

const VISIBILITY_OPTIONS = [
  { value: "private", icon: Lock, tone: TONES.violet, title: "Just for me", text: "Only you can see it. It appears on your dashboard — no review needed." },
  { value: "class", icon: Users, tone: TONES.emerald, title: "Share with my class", text: "A Course Rep reviews it first. Once approved, everyone in the course can see it." },
];

const COURSE_OPTIONS = [
  { link: false, icon: StickyNote, tone: TONES.amber, title: "Personal use", text: "No course. Just a note or file for yourself." },
  { link: true, icon: BookOpen, tone: TONES.sky, title: "Keep under a course", text: "Still private, but filed with one of your courses." },
];

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red" };
const STATUS_LABEL = { pending: "Awaiting review", approved: "Approved", rejected: "Rejected" };

const chip = (on) => `rounded-full px-2.5 py-1 text-[11px] font-medium ${on ? "bg-primary text-primary-fg" : "bg-slate-100 dark:bg-slate-800"}`;
const panel = "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

// A selectable tile, used for the visibility and course/personal choices.
function ChoiceTile({ selected, onClick, icon: Icon, tone, title, text }) {
  return (
    <button
      type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={`flex items-start gap-1.5 rounded-lg border p-2 text-left transition-colors ${selected ? "border-accent bg-accent/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}
    >
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${tone}`}><Icon className="h-3 w-3" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold leading-5">{title}</span>
        <span className="block line-clamp-2 text-[10px] leading-snug lv-meta">{text}</span>
      </span>
    </button>
  );
}

export default function MyUploadsPage() {
  const { user } = useAuth();
  // Independent learners have no school, so no courses: everything is a private personal upload.
  const independent = user.learnerType === "independent";
  const [folders, setFolders] = useState([]);
  const [folderFilter, setFolderFilter] = useState("");
  // Upload as study material or as a past question; /my-uploads?kind=past_question pre-selects it.
  const [params] = useSearchParams();
  const [kindForm, setKindForm] = useState({ ...emptyKindForm, kind: params.get("kind") === "past_question" ? "past_question" : "material" });
  const [kindFilter, setKindFilter] = useState(""); // "" = all, "past_question" = only past questions
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
    getMyUploads({ page: p, folder: folderFilter || undefined, q: q.trim() || undefined, kind: kindFilter || undefined }).then((res) => { setUploads(res.materials); setPagination(res.pagination); }).catch(() => setUploads([]));
    getMyFolders().then(setFolders).catch(() => {});
  }

  useEffect(() => {
    if (independent) return;
    listCourses({ limit: 100, filters: defaultCourseForm(user) })
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

  useEffect(() => { setPage(1); }, [folderFilter, q, kindFilter]);
  useEffect(() => {
    setUploads(null);
    const t = setTimeout(() => loadUploads(page), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [page, folderFilter, q, kindFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      appendKindFields(fd, kindForm);
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
      setKindForm((k) => ({ ...k, examYear: "" }));
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
  const total = pagination?.total ?? uploads?.length;

  return (
    <AppShell>
      {/* Width cap keeps everything moderate on large screens, same as the dashboard. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        {/* Compact header: title, one-line hint and upload count. */}
        <section className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-white">
          <div className="min-w-0 flex-1">
            <h1 className="lv-page-title !text-base !text-white truncate">My Uploads</h1>
            <p className="truncate text-[10.5px] text-white/80">
              {independent ? "Your private library, only you can see it." : "Keep files private or share them with your class."}
            </p>
          </div>
          {typeof total === "number" && (
            <span className="shrink-0 rounded-full bg-black/15 px-2 py-0.5 text-[10.5px] font-medium text-white/90">{total} upload{total === 1 ? "" : "s"}</span>
          )}
        </section>

        {/* Upload form */}
        <section className={`${panel} mt-3 p-3`}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className={`grid h-6 w-6 place-items-center rounded-md ${TONES.sky}`}><UploadCloud className="h-3.5 w-3.5" /></span>
            Upload material
          </p>
          <form onSubmit={handleSubmit} className="mt-2.5 space-y-2.5">
            <PastQuestionFields value={kindForm} onChange={(patch) => setKindForm((k) => ({ ...k, ...patch }))} disabled={loading} />

            {!independent && (
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Who can see this upload">
                {VISIBILITY_OPTIONS.map(({ value, ...rest }) => (
                  <ChoiceTile key={value} selected={form.visibility === value} onClick={() => setForm((f) => ({ ...f, visibility: value }))} {...rest} />
                ))}
              </div>
            )}

            {!independent && form.visibility === "private" && (
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Course or personal use">
                {COURSE_OPTIONS.map(({ link, ...rest }) => (
                  <ChoiceTile key={rest.title} selected={linkCourse === link} onClick={() => setLinkCourse(link)} {...rest} />
                ))}
              </div>
            )}

            {usesCourse && (
              coursesLoaded && courses.length === 0 ? (
                <p className="rounded-xl border border-amber-300/60 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  No courses are available for you yet.{form.visibility === "private" ? " Switch to personal use to save this file without a course." : " Switch to \"Just for me\" to keep it private instead."}
                </p>
              ) : (
                <Select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))} aria-label="Course" className="!py-1.5 !text-xs">
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.code} — {c.title}</option>)}
                </Select>
              )
            )}

            {isPrivate && (
              <div className="grid grid-cols-2 gap-1.5">
                <Input className="!py-1.5 !text-xs" placeholder="Folder (optional), e.g. Biology" maxLength={60} list="folder-list" value={form.folder} onChange={(e) => setForm((f) => ({ ...f, folder: e.target.value }))} aria-label="Folder" />
                <Input className="!py-1.5 !text-xs" placeholder="Tags, comma separated (optional)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} aria-label="Tags" />
                <datalist id="folder-list">{folders.filter((f) => f.name).map((f) => <option key={f.name} value={f.name} />)}</datalist>
              </div>
            )}

            <Textarea className="!text-xs" placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500 hover:border-accent dark:border-slate-700 dark:text-slate-400">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${TONES.sky}`}><Upload className="h-4 w-4" /></span>
              <span className="font-medium">Choose up to {MAX_FILES} files</span>
              <span className="text-[10.5px] lv-meta">PDF, PPT, DOC, XLS, image — max 50MB each. Each file is saved under its own file name.</span>
              <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>

            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-800">
                    <span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{file.name}</span></span>
                    <button type="button" onClick={() => removeFile(i)} disabled={loading} aria-label={`Remove ${file.name}`} className="shrink-0 text-slate-400 hover:text-danger disabled:opacity-40"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}

            {loading && <UploadProgress percent={progress} fileCount={files.length} />}
            <Button type="submit" size="sm" disabled={loading || (usesCourse && coursesLoaded && courses.length === 0)} className="w-full !font-semibold">
              <span className="inline-flex items-center justify-center gap-1.5">
                <UploadCloud className="h-4 w-4" />
                {loading
                  ? `Uploading… ${progress}%`
                  : `${isPrivate ? "Save" : "Submit"}${files.length ? ` ${files.length} file${files.length === 1 ? "" : "s"}` : ""} ${isPrivate ? "to my dashboard" : "for review"}`}
              </span>
            </Button>
          </form>
        </section>

        {/* Submissions list */}
        <section className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5">
            <h2 className="lv-section-title !text-[13px]">{independent ? "Your library" : "Your submissions"}</h2>
            {typeof total === "number" && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium lv-meta dark:bg-slate-800">{total}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-[12rem] flex-1 max-w-sm">
              <Input icon={<Search className="h-3.5 w-3.5" />} className="!py-1.5 !text-xs" placeholder="Search your uploads" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your uploads" />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {[["", "Everything"], ["past_question", "Past questions"]].map(([k, l]) => (
                <button key={k || "all"} onClick={() => setKindFilter(k)} className={chip(kindFilter === k)}>{l}</button>
              ))}
            </div>
          </div>

          {folders.length > 1 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button onClick={() => setFolderFilter("")} className={chip(folderFilter === "")}>All</button>
              {folders.map((f) => (
                <button key={f.name || "__none__"} onClick={() => setFolderFilter(f.name || "__none__")} className={chip(folderFilter === (f.name || "__none__"))}>
                  {f.name || "Unfiled"} ({f.count})
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 space-y-1.5">
            {!uploads && <InlineLoader />}
            {uploads?.map((m) => {
              const priv = m.visibility === "private";
              const isPast = m.kind === "past_question";
              return (
                <div key={m._id} className="lv-card-interactive flex items-center gap-2.5 p-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isPast ? TONES.indigo : TONES.sky}`}><FileText className="h-4 w-4" /></span>
                  <button onClick={() => navigate(`/material/${m._id}`)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-semibold hover:text-primary">
                      {m.title}
                      {isPast && <Badge tone="indigo" className="ml-2 align-middle">Past question{m.examYear ? ` · ${m.examYear}` : ""}</Badge>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] lv-meta">
                      {m.courseId?.code && <span className="inline-flex items-center gap-0.5"><FolderKanban className="h-2.5 w-2.5" />{m.courseId.code}</span>}
                      <span className="truncate">{[m.folder, new Date(m.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}</span>
                    </p>
                    {!priv && m.status === "rejected" && m.reviewNote && <p className="mt-1 text-[10.5px] text-danger">Reason: {m.reviewNote}</p>}
                  </button>
                  {priv ? <Badge tone="violet"><Lock className="h-3 w-3" /> Only me</Badge> : <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>}
                  <button onClick={() => handleDelete(m)} disabled={deletingId === m._id} aria-label={`Delete ${m.title}`} className="shrink-0 rounded-lg p-1.5 hover:bg-danger/10 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </button>
                </div>
              );
            })}
            {uploads?.length === 0 && <EmptyState icon={<UploadCloud className="h-5 w-5" />} title="No uploads yet" message="Materials you save privately or share with your class show up here." />}
          </div>
          <Pager pagination={pagination} onPageChange={setPage} />
        </section>

        {/* Closing banner, same pattern as the dashboard. */}
        <button onClick={() => navigate("/study")} className="group mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-night p-3 text-left text-white transition-opacity hover:opacity-95 dark:bg-slate-800">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15"><BookOpen className="h-4 w-4" /></span>
            <span>
              <span className="block text-xs font-semibold">Study with your uploads</span>
              <span className="block text-[10.5px] text-white/70">Open the AI study tools</span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </AppShell>
  );
}