import React, { useEffect, useState } from "react";
import { Check, X, ClipboardCheck, ExternalLink } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Button from "../../components/Button.jsx";
import Pager from "../../components/Pager.jsx";
import { listPendingMaterials, approveMaterial, rejectMaterial } from "../../services/adminService.js";
import { useToast } from "../../components/Toast.jsx";

// Admin-wide view of every student upload awaiting review, across every
// school — a safety net alongside the per-school Course Rep queue at
// /rep/approvals, for schools without an active rep or materials that
// need a second look.
export default function AdminPendingMaterialsPage() {
  const navItems = useAdminNavItems();
  const [materials, setMaterials] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const showToast = useToast();

  function refresh(p = page) {
    listPendingMaterials({ page: p }).then((res) => { setMaterials(res.materials); setPagination(res.pagination); }).catch(() => setMaterials([]));
  }
  useEffect(() => { setMaterials(null); refresh(page); }, [page]);

  async function handleApprove(m) {
    setBusyId(m._id);
    try {
      await approveMaterial(m._id);
      refresh(page);
      showToast(`Approved "${m.title}"`, "success");
    } catch (err) {
      showToast(err.message || "Couldn't approve this upload.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(m) {
    const reason = window.prompt("Reason for rejection (optional):") || undefined;
    setBusyId(m._id);
    try {
      await rejectMaterial(m._id, reason);
      refresh(page);
      showToast(`Rejected "${m.title}"`, "success");
    } catch (err) {
      showToast(err.message || "Couldn't reject this upload.", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!materials) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Pending Materials</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every student upload waiting on review, across all schools.</p>
      <div className="mt-5 space-y-3">
        {materials.map((m) => (
          <div key={m._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{m.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {m.courseId?.code} · uploaded by {m.uploadedBy?.name} ({m.uploadedBy?.email}) · {new Date(m.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a href={m.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Preview file">
                <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </a>
              <Button size="sm" variant="destructive" disabled={busyId === m._id} onClick={() => handleReject(m)}><X className="w-4 h-4" /> Reject</Button>
              <Button size="sm" disabled={busyId === m._id} onClick={() => handleApprove(m)}><Check className="w-4 h-4" /> Approve</Button>
            </div>
          </div>
        ))}
        {materials.length === 0 && <EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title="Nothing pending" message="No student uploads are currently awaiting review." />}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
