import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select } from "../../components/FormFields.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { listCourses } from "../../services/courseService.js";
import api from "../../services/api.js";
import { DEPARTMENTS, LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";
import { useToast } from "../../components/Toast.jsx";

export default function AdminCoursesPage() {
  const navItems = useAdminNavItems();
  const [courses, setCourses] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("All");
  const [form, setForm] = useState({ department: DEPARTMENTS[0], level: LEVELS[0], semester: SEMESTERS[0], session: SESSIONS[0] });
  const showToast = useToast();

  useEffect(() => { setPage(1); }, [sessionFilter]);

  function refresh(p = page) {
    listCourses({ session: sessionFilter, page: p }).then((res) => { setCourses(res.courses); setPagination(res.pagination); });
  }
  useEffect(() => { setCourses(null); refresh(page); }, [page, sessionFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post("/courses", { ...form, level: Number(form.level) });
      showToast("Course added", "success");
      setShowForm(false);
      refresh(page);
    } catch (err) {
      showToast(err.message || "Couldn't add course", "error");
    }
  }

  if (!courses) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">All Courses</h1>
        <div className="flex items-center gap-2">
          <Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="w-auto">
            <option>All</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Button onClick={() => setShowForm((s) => !s)}><Plus className="w-4 h-4" /> Add Course</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid sm:grid-cols-2 gap-3">
          <Input placeholder="Course code (e.g. CSC301)" onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <Input placeholder="Course title" onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <DepartmentPicker
            value={form.department}
            onChange={(v) => setForm((f) => ({ ...f, department: v }))}
            placeholder="Search for a department"
          />
          <Select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </Select>
          <Select value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}>
            {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={form.session} onChange={(e) => setForm((f) => ({ ...f, session: e.target.value }))}>
            {SESSIONS.map((s) => <option key={s}>{s} Session</option>)}
          </Select>
          <Button type="submit" className="sm:col-span-2">Save Course</Button>
        </form>
      )}

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        {(courses || []).map((c) => (
          <div key={c._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-semibold text-primary">{c.code}</p>
            <p className="mt-1 font-semibold">{c.title}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.department} · {c.level} Level · {c.semester}{c.session && ` · ${c.session}`}</p>
          </div>
        ))}
        {(courses || []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No courses match that session.</p>}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
