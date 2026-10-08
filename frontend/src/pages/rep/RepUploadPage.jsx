import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, FileText } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { repNavItemsFor } from "./RepDashboard.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select, Textarea } from "../../components/FormFields.jsx";
import { listCourses } from "../../services/courseService.js";
import { uploadMaterial } from "../../services/materialService.js";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const MAX_FILES = 10;

export default function RepUploadPage() {
  const { user } = useAuth();
  const navItems = repNavItemsFor(user);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", courseId: "" });
  // Stage 2.1 — multiple files per upload instead of one.
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => { listCourses({ limit: 100 }).then((res) => { setCourses(res.courses); setForm((f) => ({ ...f, courseId: res.courses[0]?._id || "" })); }); }, []);

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
    if (!form.title || files.length === 0) { showToast("Add a title and choose at least one file.", "error"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("courseId", form.courseId);
      fd.append("title", form.title);
      fd.append("description", form.description);
      files.forEach((file) => fd.append("files", file));
      const result = await uploadMaterial(fd);
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
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload up to {MAX_FILES} files at once — each becomes its own material under this course.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <Select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
            {courses.map((c) => <option key={c._id} value={c._id}>{c.code} — {c.title}{c.session ? ` (${c.session})` : ""}</option>)}
          </Select>
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
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
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-danger shrink-0"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Uploading..." : `Upload ${files.length > 1 ? `${files.length} files` : ""}`.trim()}</Button>
        </form>
      </div>
    </AppShell>
  );
}
