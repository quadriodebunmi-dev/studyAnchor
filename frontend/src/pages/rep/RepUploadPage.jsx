import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, FileText } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { repNavItemsFor } from "./RepDashboard.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select, Textarea } from "../../components/FormFields.jsx";
import { listCourses } from "../../services/courseService.js";
import UploadProgress from "../../components/UploadProgress.jsx";
import { uploadMaterial } from "../../services/materialService.js";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

import { DEPARTMENTS, LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";
const emptyForm = { code: "", title: "", department: DEPARTMENTS[0], level: LEVELS[0], semester: SEMESTERS[0], session: SESSIONS[0], description: "" };
const MAX_FILES = 10;

export default function RepUploadPage() {
  const { user } = useAuth();
  const navItems = repNavItemsFor(user);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ description: "", courseId: "" });
  // Stage 2.1 — multiple files per upload instead of one.
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const showToast = useToast();

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

  useEffect(() => { listCourses({ limit: 100, filters: defaultCourseForm(user) }).then((res) => { setCourses(res.courses); setForm((f) => ({ ...f, courseId: res.courses[0]?._id || "" })); }); }, []);

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    setFiles((prev) => {
      const combined = [...prev, ...incoming].slice(0, MAX_FILES);
      if (prev.length + incoming.length > MAX_FILES) {
        showToast(`You can upload up to ${MAX_FILES} files at once.`, "info");
      }
      return combined;
    });
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) { showToast("Choose at least one file.", "error"); return; }
    setLoading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append("courseId", form.courseId);
      fd.append("description", form.description);
      files.forEach((file) => fd.append("files", file));
      const result = await uploadMaterial(fd, setProgress);
      showToast(result?.materials?.length > 1 ? `${result.materials.length} files uploaded` : "Material uploaded", "success");
      navigate("/");
    } catch (err) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell sidebarItems={navItems}>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold">Upload Material</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload up to {MAX_FILES} files at once — each becomes its own material under this course, titled with its file name.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <Select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
            {courses.map((c) => <option key={c._id} value={c._id}>{c.code} — {c.title}{c.session ? ` (${c.session})` : ""}</option>)}
          </Select>
          <p className="text-xs text-slate-500 dark:text-slate-400">Each file is saved under its own file name. You can rename it later from your uploads.</p>
          <Textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-sm cursor-pointer justify-center text-slate-500 dark:text-slate-400">
            <Upload className="w-4 h-4" /> Choose up to {MAX_FILES} files (PDF, PPT, DOC, XLS, image — max 50MB each)
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
          <Button type="submit" disabled={loading} className="w-full">{loading ? `Uploading… ${progress}%` : `Upload ${files.length > 1 ? `${files.length} files` : ""}`.trim()}</Button>
        </form>
      </div>
    </AppShell>
  );
}
