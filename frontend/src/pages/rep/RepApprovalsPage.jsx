import React, { useEffect, useState } from "react";
import { ClipboardCheck, Check, X, FileText, ExternalLink } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { repNavItemsFor } from "./RepDashboard.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Textarea } from "../../components/FormFields.jsx";
import Pager from "../../components/Pager.jsx";
import { getPendingMaterials, approveMaterial, rejectMaterial } from "../../services/materialService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";

function RejectModal({ material, onClose, onRejected }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToast();

  async function handleReject() {
    setSubmitting(true);
    try {
      await rejectMaterial(material._id, reason || undefined);
      showToast("Upload rejected", "success");
      onRejected(material._id);
    } catch (err) {
      showToast(err.message || "Couldn't reject this upload.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold mb-3">Reject "{material.title}"</p>
        <Textarea placeholder="Reason (optional) — the student will see this" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-3 flex gap-2">
          <Button variant="destructive" disabled={submitting} onClick={handleReject} className="flex-1">{submitting ? "Rejecting..." : "Reject upload"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function RepApprovalsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const showToast = useToast();

  function load(p = page) {
    getPendingMaterials({ page: p }).then((res) => { setMaterials(res.materials); setPagination(res.pagination); }).catch(() => setMaterials([]));
  }
  useEffect(() => { setMaterials(null); load(page); }, [page]);

  // The nav badge should always show the true total pending count, not just
  // how many are on this page.
  const navItems = repNavItemsFor(user, pagination?.total ?? 0);

  async function handleApprove(material) {
    setBusyId(material._id);
    try {
      await approveMaterial(material._id);
      // Removing an item can leave the page short of a full page's worth
      // (or empty), so re-fetch instead of just filtering it out locally.
      load(page);
      showToast(`Approved "${material.title}"`, "success");
    } catch (err) {
      showToast(err.message || "Couldn't approve this upload.", "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleRejected() {
    load(page);
    setRejecting(null);
  }

  if (!materials) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Student Upload Approvals</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Materials students upload wait here until a Course Rep approves them — nothing goes live for the class until then.</p>

      <div className="mt-5 space-y-3">
        {materials.map((m) => (
          <div key={m._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{m.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {m.courseId?.code} · uploaded by {m.uploadedBy?.name} · {new Date(m.createdAt).toLocaleDateString()}
              </p>
              {m.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{m.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a href={m.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Preview file">
                <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </a>
              <Button size="sm" variant="destructive" onClick={() => setRejecting(m)}>
                <X className="w-4 h-4" /> Reject
              </Button>
              <Button size="sm" disabled={busyId === m._id} onClick={() => handleApprove(m)}>
                <Check className="w-4 h-4" /> {busyId === m._id ? "Approving..." : "Approve"}
              </Button>
            </div>
          </div>
        ))}
        {materials.length === 0 && (
          <EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title="Nothing pending" message="Student uploads waiting for your review will show up here." />
        )}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />

      {rejecting && <RejectModal material={rejecting} onClose={() => setRejecting(null)} onRejected={handleRejected} />}
    </AppShell>
  );
}
