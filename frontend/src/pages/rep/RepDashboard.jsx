import React, { useEffect, useState } from "react";
import { Upload, FolderKanban, Plus, Pencil, X, Trash2, ClipboardCheck, Download, FileText, ChevronRight, Compass, MessagesSquare, Sparkles, Target, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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

// Full class names on purpose: Tailwind can't see classes built from pieces.
const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
};
const heroBtn = "inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-white/90";

// Quick access: only routes that already exist. Class reps don't upload or approve, so they get a different set.
function repQuickLinks(isClassRep, pendingCount) {
  const common = [
    { to: "/explore", label: "Explore", icon: Compass, tone: TONES.sky },
    { to: "/rooms", label: "Rooms", icon: MessagesSquare, tone: TONES.emerald },
    { to: "/study", label: "Study Tools", icon: Sparkles, tone: TONES.amber },
  ];
  if (isClassRep) {
    return [
      { to: "/rep/courses", label: "My Courses", icon: FolderKanban, tone: TONES.violet },
      ...common,
      { to: "/goals", label: "Goals", icon: Target, tone: TONES.rose },
      { to: "/points", label: "Leaderboard", icon: Trophy, tone: TONES.indigo },
    ];
  }
  return [
    { to: "/rep/upload", label: "Upload", icon: Upload, tone: TONES.sky },
    { to: "/rep/approvals", label: "Approvals", icon: ClipboardCheck, tone: TONES.rose, badge: pendingCount },
    { to: "/rep/courses", label: "My Courses", icon: FolderKanban, tone: TONES.violet },
    ...common,
  ];
}

function QuickLinks({ links }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {links.map(({ to, label, icon: Icon, tone, badge }) => (
        <Link key={to} to={to} className="lv-card-interactive relative flex flex-col items-center gap-1 p-2 text-center text-[10.5px] font-medium">
          <span className={`grid h-8 w-8 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>
          {label}
          {badge > 0 && <span className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 text-[9.5px] text-accent-fg">{badge}</span>}
        </Link>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, tone, value, label }) {
  return (
    <div className="lv-card flex flex-col items-center gap-0.5 p-2 text-center">
      <span className={`grid h-7 w-7 place-items-center rounded-full ${tone}`}><Icon className="h-3.5 w-3.5" /></span>
      <p className="text-base font-bold leading-tight">{value}</p>
      <p className="text-[10px] leading-tight lv-meta">{label}</p>
    </div>
  );
}

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
      <div className="w-full max-w-xs rounded-xl bg-white dark:bg-slate-900 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold">Edit material</p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-2">
          <Input className="!py-1.5 !text-xs" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea className="!text-xs" placeholder="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button size="sm" className="w-full !text-xs" disabled={saving} onClick={handleSave}>{saving ? "Saving..." : "Save changes"}</Button>
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
        <div className="mx-auto w-full max-w-4xl text-[13px]">
          <section className="overflow-hidden rounded-2xl bg-primary p-3 text-white">
            <h1 className="lv-page-title !text-lg !text-white sm:!text-xl">Class Rep Dashboard</h1>
            <p className="mt-0.5 text-[10.5px] text-white/80">Add, edit and delete the courses for your department, level and session.</p>
            <button onClick={() => navigate("/rep/courses")} className={`${heroBtn} mt-2.5`}><FolderKanban className="h-3.5 w-3.5" />Manage courses</button>
          </section>
          <QuickLinks links={repQuickLinks(true, 0)} />
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
      {/* Width cap keeps everything moderate on large screens. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        {/* Header panel: title, review queue and the main action. */}
        <section className="overflow-hidden rounded-2xl bg-primary p-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* !-prefixed so these win over the .lv-page-title defaults */}
              <h1 className="lv-page-title !text-lg !text-white sm:!text-xl">Course Rep Dashboard</h1>
              <p className="mt-0.5 text-[10.5px] text-white/80">Upload and manage the materials for your courses.</p>
              {pendingCount > 0 && (
                <Link to="/rep/approvals" className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium hover:bg-white/25">
                  {pendingCount} awaiting review <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            <button onClick={() => navigate("/rep/upload")} className={`${heroBtn} shrink-0`}><Plus className="h-3.5 w-3.5" />Upload</button>
          </div>
        </section>

        <QuickLinks links={repQuickLinks(false, pendingCount)} />

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Stat icon={Upload} tone={TONES.sky} value={stats.total} label="Materials uploaded" />
          <Stat icon={Download} tone={TONES.emerald} value={stats.downloads} label="Total downloads" />
          <Stat icon={ClipboardCheck} tone={TONES.violet} value={stats.quizzes} label="Quizzes generated" />
        </div>

        <h2 className="lv-section-title mb-1.5 mt-4 !text-[13px]">Your materials</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {materials.map((m) => (
            <div key={m._id} className="lv-card flex items-start gap-2 p-2.5">
              <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES.sky}`}><FileText className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight">{m.title}</p>
                {m.description && <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug lv-meta">{m.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-medium">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Download className="h-2.5 w-2.5" />{m.downloads}</span>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ClipboardCheck className="h-2.5 w-2.5" />{m.quizzesGenerated}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button onClick={() => setEditing(m)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit" aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                </button>
                <button onClick={() => handleDelete(m)} disabled={deletingId === m._id} className="rounded-lg p-1 hover:bg-danger/10 disabled:opacity-50" title="Delete" aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </button>
              </div>
            </div>
          ))}
          {materials.length === 0 && <EmptyState icon={<Upload className="h-5 w-5" />} title="No uploads yet" message="Upload your first course material to get started." />}
        </div>
        <Pager pagination={pagination} onPageChange={setPage} />
      </div>

      {editing && <EditMaterialModal material={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </AppShell>
  );
}