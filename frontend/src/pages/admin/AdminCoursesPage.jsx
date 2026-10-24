import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2, Search, FolderKanban } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { Input, Select, Field } from "../../components/FormFields.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { listCourses, createCourse, updateCourse, deleteCourse } from "../../services/courseService.js";
import { listSchoolsAdmin } from "../../services/schoolService.js";
import { LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";
import { useToast } from "../../components/Toast.jsx";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

function blankForm(schools) {
  return { code: "", title: "", department: "", level: LEVELS[0], semester: SEMESTERS[0], session: SESSIONS[0], description: "", schoolId: schools[0]?._id || "" };
}

// Add / edit a course. Admins aren't in a school, so the school is chosen here
// (and fixed once a course exists).
function CourseForm({ initial, schools, onCancel, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState(() => initial
    ? { ...initial, schoolId: idOf(initial.schoolId), description: initial.description || "" }
    : blankForm(schools));
  const [saving, setSaving] = useState(false);
  const showToast = useToast();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const schoolName = schools.find((s) => s._id === form.schoolId)?.name || initial?.schoolId?.name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.schoolId) return showToast("Choose a school first.", "error");
    if (!form.code.trim() || !form.title.trim()) return showToast("Course code and title are required.", "error");
    if (!form.department.trim()) return showToast("Choose a department.", "error");
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(), title: form.title.trim(), department: form.department.trim(),
        level: Number(form.level), semester: form.semester, session: form.session, description: form.description.trim(),
      };
      const saved = isEdit ? await updateCourse(initial._id, payload) : await createCourse({ ...payload, schoolId: form.schoolId });
      showToast(isEdit ? "Course updated" : "Course added", "success");
      onSaved(saved);
    } catch (err) {
      showToast(err.message || "Couldn't save course", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
      <p className="font-semibold sm:col-span-2">{isEdit ? `Edit ${initial.code}` : "Add a course"}</p>
      <div className="sm:col-span-2">
        <Field label="School">
          {isEdit ? (
            <p className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-800"><Building2 className="h-4 w-4 text-slate-400" /> {schoolName || "—"}</p>
          ) : (
            <Select value={form.schoolId} onChange={(e) => setForm((f) => ({ ...f, schoolId: e.target.value, department: "" }))} aria-label="School">
              {schools.length === 0 && <option value="">No schools yet</option>}
              {schools.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Input placeholder="Course code (e.g. CSC301)" value={form.code} onChange={set("code")} maxLength={20} aria-label="Course code" />
      <Input placeholder="Course title" value={form.title} onChange={set("title")} maxLength={200} aria-label="Course title" />
      <DepartmentPicker
        key={form.schoolId}
        value={form.department}
        onChange={(v) => setForm((f) => ({ ...f, department: v }))}
        schoolId={form.schoolId}
        placeholder="Search for a department"
      />
      <Select value={form.level} onChange={set("level")} aria-label="Level">
        {LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}
      </Select>
      <Select value={form.semester} onChange={set("semester")} aria-label="Semester">
        {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Select value={form.session} onChange={set("session")} aria-label="Session">
        {/* keep an older session selectable when editing a course from before the rolling window */}
        {!SESSIONS.includes(form.session) && <option value={form.session}>{form.session} Session</option>}
        {SESSIONS.map((s) => <option key={s} value={s}>{s} Session</option>)}
      </Select>
      <div className="sm:col-span-2">
        <Input placeholder="Description (optional)" value={form.description} onChange={set("description")} maxLength={500} aria-label="Description" />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : "Save Course"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export default function AdminCoursesPage() {
  const navItems = useAdminNavItems();
  const [courses, setCourses] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [schools, setSchools] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({ q: "", schoolId: "All", level: "All", semester: "All", session: "All" });
  const showToast = useToast();
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    listSchoolsAdmin({ limit: 100 }).then((r) => setSchools(r.schools || [])).catch(() => setSchools([]));
  }, []);

  useEffect(() => { setPage(1); }, [filters]);

  function refresh(p = page) {
    setLoadError("");
    return listCourses({ ...filters, q: filters.q.trim(), page: p, limit: 20 })
      .then((res) => { setCourses(res.courses); setPagination(res.pagination); })
      .catch((err) => { setCourses([]); setPagination(null); setLoadError(err.message || "Couldn't load courses."); });
  }
  useEffect(() => {
    setCourses(null);
    const t = setTimeout(() => refresh(page), filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [page, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    refresh(page);
  }

  async function handleDelete(c) {
    if (!window.confirm(`Delete ${c.code} — ${c.title}? This can't be undone.`)) return;
    setDeletingId(c._id);
    try {
      await deleteCourse(c._id);
      showToast("Course deleted", "success");
      // Deleting the last course on a page would otherwise leave an empty page behind.
      if (courses.length === 1 && page > 1) setPage(page - 1); else refresh(page);
    } catch (err) {
      showToast(err.message || "Couldn't delete course", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filters.q || filters.schoolId !== "All" || filters.level !== "All" || filters.semester !== "All" || filters.session !== "All";

  return (
    <AppShell sidebarItems={navItems}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">All Courses</h1>
          {pagination && <p className="mt-0.5 text-xs lv-meta">{pagination.total} course{pagination.total === 1 ? "" : "s"}{filtered ? " match your filters" : " across all schools"}</p>}
        </div>
        {!showForm && !editing && (
          <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Course</Button>
        )}
      </div>

      {showForm && <CourseForm schools={schools} onCancel={() => setShowForm(false)} onSaved={handleSaved} />}
      {editing && <CourseForm key={editing._id} initial={editing} schools={schools} onCancel={() => setEditing(null)} onSaved={handleSaved} />}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><Input icon={<Search className="h-4 w-4" />} placeholder="Search code or title" value={filters.q} onChange={setFilter("q")} aria-label="Search courses" /></div>
        <Select value={filters.schoolId} onChange={setFilter("schoolId")} aria-label="Filter by school">
          <option value="All">All schools</option>
          {schools.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </Select>
        <Select value={filters.level} onChange={setFilter("level")} aria-label="Filter by level">
          <option value="All">All levels</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}
        </Select>
        <Select value={filters.session} onChange={setFilter("session")} aria-label="Filter by session">
          <option value="All">All sessions</option>
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {loadError && <p className="mt-4 text-sm text-danger">{loadError}</p>}
      {!courses ? <InlineLoader /> : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <div key={c._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{c.code}</p>
                    <p className="mt-1 font-semibold">{c.title}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => { setEditing(c); setShowForm(false); }} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit course" aria-label={`Edit ${c.code}`}>
                      <Pencil className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    </button>
                    <button onClick={() => handleDelete(c)} disabled={deletingId === c._id} className="rounded-lg p-1.5 hover:bg-danger/10 disabled:opacity-50" title="Delete course" aria-label={`Delete ${c.code}`}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.department} · {c.level} Level · {c.semester}{c.session && ` · ${c.session}`}</p>
                <div className="mt-2">
                  {c.schoolId?.name
                    ? <Badge tone="violet"><Building2 className="h-3 w-3" /> {c.schoolId.name}</Badge>
                    : <Badge tone="amber">No school — not visible to students</Badge>}
                </div>
              </div>
            ))}
          </div>
          {courses.length === 0 && !loadError && (
            <EmptyState icon={<FolderKanban className="h-8 w-8" />} title={filtered ? "No courses match" : "No courses yet"} message={filtered ? "Try clearing a filter or search." : "Add the first course to get started."} />
          )}
        </>
      )}
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
