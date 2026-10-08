import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { repNavItemsFor } from "./RepDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Button from "../../components/Button.jsx";
import Pager from "../../components/Pager.jsx";
import { Input, Select } from "../../components/FormFields.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { listCourses, createCourse, updateCourse, deleteCourse } from "../../services/courseService.js";
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

function CourseForm({ initial, schoolId, onCancel, onSaved }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();
  const isEdit = !!initial?._id;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.code || !form.title) { showToast("Course code and title are required.", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...form, level: Number(form.level) };
      const saved = isEdit ? await updateCourse(initial._id, payload) : await createCourse(payload);
      showToast(isEdit ? "Course updated" : "Course added", "success");
      onSaved(saved);
    } catch (err) {
      showToast(err.message || "Couldn't save course", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid sm:grid-cols-2 gap-3">
      <Input placeholder="Course code (e.g. CSC301)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
      <Input placeholder="Course title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <DepartmentPicker
        value={form.department}
        onChange={(v) => setForm((f) => ({ ...f, department: v }))}
        schoolId={schoolId}
        placeholder="Search for a department"
      />
      <Select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
        {LEVELS.map((l) => <option key={l}>{l}</option>)}
      </Select>
      <Select value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}>
        {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
      </Select>
    <Select value={form.session} onChange={(e) => setForm((f) => ({ ...f, session: e.target.value }))}>
  {SESSIONS.map((s) => <option key={s} value={s}>{s} Session</option>)}
</Select>
      <div className="sm:col-span-2">
        <Input placeholder="Description (optional)" value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : "Save Course"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export default function RepCoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navItems = repNavItemsFor(user);
  const showToast = useToast();
  // Both Course Reps and Class Reps can fully manage courses (add/edit/delete).
  const canManageCourses = user?.role === "rep" && user?.repStatus === "active";
  

  function refresh(p = page) {
    listCourses({ page: p, limit: 20 }).then((res) => { setCourses(res.courses); setPagination(res.pagination); });
  }
  useEffect(() => { setCourses(null); refresh(page); }, [page]);

  if (!courses) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  // "My courses" filters this page only — a Class Rep managing every course
  // won't usually hit page 2 for a single department's worth of courses.
  const mine = courses.filter((c) => (user.repCourses || "").includes(c.code));
  const display = canManageCourses ? courses : (mine.length ? mine : courses);

  function handleSaved() {
    setShowAddForm(false);
    setEditingCourse(null);
    refresh(page);
  }

  async function handleDelete(course) {
    if (!window.confirm(`Delete ${course.code} — ${course.title}? This can't be undone.`)) return;
    setDeletingId(course._id);
    try {
      await deleteCourse(course._id);
      showToast("Course deleted", "success");
      refresh(page);
    } catch (err) {
      showToast(err.message || "Couldn't delete course", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell sidebarItems={navItems}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{canManageCourses ? "Manage Courses" : "My Courses"}</h1>
        {canManageCourses && !showAddForm && !editingCourse && (
          <Button onClick={() => setShowAddForm(true)}><Plus className="w-4 h-4" /> Add Course</Button>
        )}
      </div>

      {canManageCourses && showAddForm && (
        <CourseForm initial={defaultCourseForm(user)} schoolId={user?.schoolId} onCancel={() => setShowAddForm(false)} onSaved={handleSaved} />
      )}
      {canManageCourses && editingCourse && (
        <CourseForm initial={editingCourse} schoolId={user?.schoolId} onCancel={() => setEditingCourse(null)} onSaved={handleSaved} />
      )}

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        {display.map((c) => (
          <div key={c._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-primary">{c.code}</p>
                <p className="mt-1 font-semibold">{c.title}</p>
              </div>
              {canManageCourses && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => { setEditingCourse(c); setShowAddForm(false); }}
                    className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit course"
                  >
                    <Pencil className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c._id}
                    className="rounded-lg p-1.5 hover:bg-danger/10 disabled:opacity-50"
                    title="Delete course"
                  >
                    <Trash2 className="w-4 h-4 text-danger" />
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.department} · {c.level} Level · {c.semester}{c.session && ` · ${c.session}`}</p>
          </div>
        ))}
        {display.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No courses yet.</p>}
      </div>
      {canManageCourses && <Pager pagination={pagination} onPageChange={setPage} />}
    </AppShell>
  );
}