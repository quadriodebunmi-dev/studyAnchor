import React, { useEffect, useState } from "react";
import { LayoutDashboard, Upload, FolderKanban, Plus, Pencil, X, Trash2, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Input, Textarea } from "../../components/FormFields.jsx";
import Pager from "../../components/Pager.jsx";
import { myMaterials, updateMaterial, deleteMaterial, getPendingMaterials } from "../../services/materialService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";

// Nav items live in config/navItems.jsx (shared with AppShell). Re-exported
// so existing imports keep working.
import { repNavItemsFor } from "../../config/navItems.jsx";
export { repNavItemsFor };
export const repNavItems = repNavItemsFor({ repType: "course" });

function EditMaterialModal({ material, onClose, onSaved }) {
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description || "");
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    if (!title.trim()) { showToast("Title can't be empty.", "error"); return; }
    setSaving(true);
    try {
      const updated = await updateMaterial(material._id, { title, description });
      showToast("Material updated", "success");
      onSaved(updated);
    } catch (err) {
      showToast(err.message || "Couldn't update material.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm font-semibold">Edit Material</p>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-2.5">
          <Input className="text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea className="text-sm" placeholder="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button className="w-full text-sm" disabled={saving} onClick={handleSave}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

export default function RepDashboard() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState({ total: 0, downloads: 0, quizzes: 0 });
  const [page, setPage] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const isClassRep = user?.repType === "class";
  const navItems = repNavItemsFor(user, pendingCount);
  const showToast = useToast();

  function load(p = page) {
    // Previously this called the admin-only /api/admin/materials endpoint
    // and filtered client-side — reps aren't admins, so that request 403'd
    // every time and silently fell back to an empty list, making the rep
    // dashboard look broken even when uploads existed. This calls the
    // rep's own dedicated endpoint instead.
    myMaterials({ page: p }).then((res) => {
      setMaterials(res.materials);
      setPagination(res.pagination);
      setStats(res.stats);
    }).catch(() => setMaterials([]));
  }

  useEffect(() => {
    if (isClassRep) return; // Class Reps don't upload materials — nothing to fetch.
    setMaterials(null);
    load(page);
  }, [user, isClassRep, page]);

  useEffect(() => {
    if (isClassRep) return;
    getPendingMaterials({ limit: 1 }).then((res) => setPendingCount(res.pagination.total)).catch(() => {});
  }, [user, isClassRep]);

  if (isClassRep) {
    return (
      <AppShell sidebarItems={navItems}>
        <h1 className="text-lg font-bold">Class Rep Dashboard</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add, edit and delete the courses for your department, level and session.</p>
        <div className="mt-4">
          <Button className="text-sm" onClick={() => navigate("/rep/courses")}><FolderKanban className="w-3.5 h-3.5" /> Manage Courses</Button>
        </div>
      </AppShell>
    );
  }

  if (!materials) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  function handleSaved(updated) {
    setMaterials((ms) => ms.map((m) => (m._id === updated._id ? { ...m, ...updated } : m)));
    setEditing(null);
  }

  async function handleDelete(material) {
    if (!window.confirm(`Delete "${material.title}"? This can't be undone.`)) return;
    setDeletingId(material._id);
    try {
      await deleteMaterial(material._id);
      // Removing an item shifts stats and can leave the page short, so
      // re-fetch instead of filtering locally.
      load(page);
      showToast("Material deleted", "success");
    } catch (err) {
      showToast(err.message || "Couldn't delete material.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-lg font-bold">Course Rep Dashboard</h1>
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"><p className="text-[11px] text-slate-500 dark:text-slate-400">Materials uploaded</p><p className="text-lg font-bold">{stats.total}</p></div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"><p className="text-[11px] text-slate-500 dark:text-slate-400">Total downloads</p><p className="text-lg font-bold">{stats.downloads}</p></div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"><p className="text-[11px] text-slate-500 dark:text-slate-400">Quizzes generated from your uploads</p><p className="text-lg font-bold">{stats.quizzes}</p></div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your materials</h2>
        <Button className="text-sm" onClick={() => navigate("/rep/upload")}><Plus className="w-3.5 h-3.5" /> Upload Material</Button>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {materials.map((m) => (
          <div key={m._id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{m.title}</p>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing(m)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                  <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                </button>
                <button onClick={() => handleDelete(m)} disabled={deletingId === m._id} className="rounded-lg p-1 hover:bg-danger/10 disabled:opacity-50" title="Delete">
                  <Trash2 className="w-3.5 h-3.5 text-danger" />
                </button>
              </div>
            </div>
            {m.description && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{m.description}</p>}
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{m.downloads} downloads · {m.quizzesGenerated} quizzes generated</p>
          </div>
        ))}
        {materials.length === 0 && <EmptyState icon={<Upload className="w-6 h-6" />} title="No uploads yet" message="Upload your first course material to get started." />}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />

      {editing && <EditMaterialModal material={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </AppShell>
  );
}