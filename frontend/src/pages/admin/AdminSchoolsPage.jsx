import React, { useEffect, useState } from "react";
import { Building2, Check, Trash2, Pencil, X, ShieldCheck } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select } from "../../components/FormFields.jsx";
import { listSchoolsAdmin, verifySchool, updateSchool, deleteSchool } from "../../services/schoolService.js";
import { useToast } from "../../components/Toast.jsx";

const ORG_UNIT_LABELS = ["Faculty", "College", "School"];
const TERM_STRUCTURES = ["semester", "trimester", "term"];

function EditSchoolModal({ school, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: school.name,
    domain: school.domain || "",
    city: school.city || "",
    orgUnitLabel: school.orgUnitLabel,
    termStructure: school.termStructure,
    levels: (school.levels || []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateSchool(school._id, {
        ...form,
        levels: form.levels.split(",").map((l) => l.trim()).filter(Boolean),
      });
      showToast("School updated", "success");
      onSaved(updated);
    } catch (err) {
      showToast(err.message || "Couldn't update school.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Edit School</p>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Input placeholder="School name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Domain" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
            <Input placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.orgUnitLabel} onChange={(e) => setForm((f) => ({ ...f, orgUnitLabel: e.target.value }))}>
              {ORG_UNIT_LABELS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
            <Select value={form.termStructure} onChange={(e) => setForm((f) => ({ ...f, termStructure: e.target.value }))}>
              {TERM_STRUCTURES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <Input placeholder="Levels, comma-separated (e.g. 100, 200, 300, 400)" value={form.levels} onChange={(e) => setForm((f) => ({ ...f, levels: e.target.value }))} />
          <Button className="w-full" disabled={saving} onClick={handleSave}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSchoolsPage() {
  const navItems = useAdminNavItems();
  const [schools, setSchools] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const showToast = useToast();

  function refresh(p = page) {
    listSchoolsAdmin({ page: p }).then((res) => { setSchools(res.schools); setPagination(res.pagination); }).catch(() => setSchools([]));
  }
  useEffect(() => { setSchools(null); refresh(page); }, [page]);

  async function handleVerify(school) {
    setBusyId(school._id);
    try {
      const updated = await verifySchool(school._id);
      setSchools((ss) => ss.map((s) => (s._id === updated._id ? updated : s)));
      showToast(`${school.name} verified`, "success");
    } catch (err) {
      showToast(err.message || "Couldn't verify school.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(school) {
    if (!window.confirm(`Delete "${school.name}"? This only works if it has no courses yet.`)) return;
    setBusyId(school._id);
    try {
      await deleteSchool(school._id);
      // Deleting can leave the page short, so re-fetch instead of filtering locally.
      refresh(page);
      showToast("School removed", "success");
    } catch (err) {
      showToast(err.message || "Couldn't delete school.", "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(updated) {
    setSchools((ss) => ss.map((s) => (s._id === updated._id ? updated : s)));
    setEditing(null);
  }

  if (!schools) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Schools</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every school signed-up users belong to. Verify schools visitors requested, or adjust a school's department/level structure.</p>
      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        {schools.map((s) => (
          <div key={s._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> {s.name}</p>
                {s.city && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.city}</p>}
              </div>
              {s.verified ? <Badge tone="green"><ShieldCheck className="w-3 h-3" /> Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{s.orgUnitLabel} structure · {s.termStructure} · levels: {(s.levels || []).join(", ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!s.verified && (
                <Button size="sm" disabled={busyId === s._id} onClick={() => handleVerify(s)}><Check className="w-4 h-4" /> Verify</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditing(s)}><Pencil className="w-4 h-4" /> Edit</Button>
              <Button size="sm" variant="destructive" disabled={busyId === s._id} onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4" /> Delete</Button>
            </div>
          </div>
        ))}
        {schools.length === 0 && <EmptyState icon={<Building2 className="w-8 h-8" />} title="No schools yet" message="Schools appear here as soon as someone signs up or requests one." />}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
      {editing && <EditSchoolModal school={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </AppShell>
  );
}
