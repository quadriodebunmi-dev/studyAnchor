import React, { useEffect, useState } from "react";
import { Layers, Check, Trash2, Pencil, X, ShieldCheck, Plus, Building2, Search } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import { Input } from "../../components/FormFields.jsx";
import SchoolPicker from "../../components/SchoolPicker.jsx";
import {
  listDepartmentsAdmin, requestDepartment, verifyDepartment, updateDepartment, deleteDepartment,
} from "../../services/departmentService.js";
import { useToast } from "../../components/Toast.jsx";

// The school is populated on list/update responses ({ _id, name, city }) but is a bare id elsewhere.
const schoolOf = (d) => (d.schoolId && typeof d.schoolId === "object" ? d.schoolId : null);

// One modal for both adding and editing. `department` is null when adding.
function DepartmentModal({ department, onClose, onSaved }) {
  const editing = Boolean(department);
  const [name, setName] = useState(department?.name || "");
  const [shortName, setShortName] = useState(department?.shortName || "");
  const [school, setSchool] = useState(schoolOf(department || {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Department name is required."); return; }
    setSaving(true);
    try {
      const payload = { name, shortName, schoolId: school?._id || "" };
      const saved = editing ? await updateDepartment(department._id, payload) : await requestDepartment(payload);
      // Newly created rows come back with a bare school id; keep the name we already have for display.
      const withSchool = !editing && school ? { ...saved, schoolId: school } : saved;
      showToast(editing ? "Department updated" : "Department added", "success");
      onSaved(withSchool, editing);
    } catch (err) {
      setError(err.message || "Couldn't save the department.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form onSubmit={handleSave} className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{editing ? "Edit department" : "Add department"}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">School</p>
            <SchoolPicker value={school} onSelect={setSchool} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave empty for a department that isn't tied to one school.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Input placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Department name" /></div>
            <Input placeholder="Short, e.g. MLS" maxLength={20} value={shortName} onChange={(e) => setShortName(e.target.value)} aria-label="Short name" />
          </div>
          {editing && <p className="text-xs text-slate-500 dark:text-slate-400">Renaming also updates this department on that school's courses and students.</p>}
          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add department"}</Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminDepartmentsPage() {
  const navItems = useAdminNavItems();
  const [departments, setDepartments] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // null | { department: dept | null }
  const [busyId, setBusyId] = useState(null);
  const showToast = useToast();

  function refresh(p = page) {
    listDepartmentsAdmin({ page: p, q: q.trim() || undefined })
      .then((res) => { setDepartments(res.departments); setPagination(res.pagination); })
      .catch(() => setDepartments([]));
  }
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => {
    setDepartments(null);
    const t = setTimeout(() => refresh(page), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [page, q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(d) {
    setBusyId(d._id);
    try {
      const updated = await verifyDepartment(d._id);
      setDepartments((ds) => ds.map((x) => (x._id === updated._id ? updated : x)));
      showToast(`${d.name} verified`, "success");
    } catch (err) {
      showToast(err.message || "Couldn't verify department.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(d) {
    if (!window.confirm(`Delete "${d.name}"? This only works if it has no courses yet.`)) return;
    setBusyId(d._id);
    try {
      await deleteDepartment(d._id);
      refresh(page); // deleting can leave the page short, so re-fetch
      showToast("Department removed", "success");
    } catch (err) {
      showToast(err.message || "Couldn't delete department.", "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(saved, wasEdit) {
    setModal(null);
    if (wasEdit) setDepartments((ds) => ds.map((x) => (x._id === saved._id ? saved : x)));
    else if (page === 1) refresh(1); else setPage(1);
  }

  return (
    <AppShell sidebarItems={navItems}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every department, by school. Add, rename, move or remove them, and verify ones that users requested.</p>
        </div>
        <Button size="sm" onClick={() => setModal({ department: null })}><Plus className="h-4 w-4" /> Add department</Button>
      </div>

      <div className="mt-4 max-w-sm">
        <Input icon={<Search className="h-4 w-4" />} placeholder="Search by name or short name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search departments" />
      </div>

      {!departments ? <InlineLoader /> : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {departments.map((d) => {
            const school = schoolOf(d);
            return (
              <div key={d._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold"><Layers className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{d.name}</span>{d.shortName && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800">{d.shortName}</span>}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Building2 className="h-3 w-3" /> {school ? `${school.name}${school.city ? ` · ${school.city}` : ""}` : "No school (global)"}</p>
                  </div>
                  {d.verified ? <Badge tone="green"><ShieldCheck className="h-3 w-3" /> Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!d.verified && <Button size="sm" disabled={busyId === d._id} onClick={() => handleVerify(d)}><Check className="h-4 w-4" /> Verify</Button>}
                  <Button size="sm" variant="outline" onClick={() => setModal({ department: d })}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button size="sm" variant="destructive" disabled={busyId === d._id} onClick={() => handleDelete(d)}><Trash2 className="h-4 w-4" /> Delete</Button>
                </div>
              </div>
            );
          })}
          {departments.length === 0 && <EmptyState icon={<Layers className="h-8 w-8" />} title={q ? "No departments match" : "No departments yet"} message={q ? "Try a different search." : "Departments appear here as users add them, or add one yourself."} />}
        </div>
      )}
      <Pager pagination={pagination} onPageChange={setPage} />
      {modal && <DepartmentModal department={modal.department} onClose={() => setModal(null)} onSaved={handleSaved} />}
    </AppShell>
  );
}
