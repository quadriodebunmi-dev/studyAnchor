import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, UserCheck } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import { Input } from "../../components/FormFields.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { listPendingReps, approveRep, rejectRep } from "../../services/adminService.js";
import { useToast } from "../../components/Toast.jsx";

export default function AdminApprovalsPage() {
  const navItems = useAdminNavItems();
  const [reps, setReps] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");
  const showToast = useToast();

  function refresh(p = page) {
    listPendingReps({ page: p }).then((res) => { setReps(res.reps); setPagination(res.pagination); });
  }
  useEffect(() => { setReps(null); refresh(page); }, [page]);

  async function handleApprove(id, name, repType) {
    await approveRep(id);
    showToast(`${name} approved as ${repType === "class" ? "Class Rep" : "Course Rep"}`, "success");
    refresh(page);
  }
  async function handleReject(id, name) {
    await rejectRep(id, reason);
    showToast(`${name}'s application rejected`, "error");
    setRejectingId(null); setReason("");
    refresh(page);
  }

  if (!reps) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Pending Rep Approvals</h1>
      <div className="mt-5 space-y-4">
        {reps.map((r) => (
          <div key={r._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{r.name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.repType === "class" ? "bg-secondary-purple/10 text-secondary-purple" : "bg-primary/10 text-primary"}`}>
                    {r.repType === "class" ? "Class Rep" : "Course Rep"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{r.department} · Matric {r.matricNumber} · Reps: {r.repCourses}</p>
                {r.repNote && <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">"{r.repNote}"</p>}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleApprove(r._id, r.name, r.repType)}><CheckCircle2 className="w-4 h-4" /> Approve</Button>
                <Button variant="destructive" onClick={() => setRejectingId(rejectingId === r._id ? null : r._id)}><XCircle className="w-4 h-4" /> Reject</Button>
              </div>
            </div>
            {rejectingId === r._id && (
              <div className="mt-3 flex gap-2">
                <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button variant="destructive" onClick={() => handleReject(r._id, r.name)}>Confirm</Button>
              </div>
            )}
          </div>
        ))}
        {reps.length === 0 && <EmptyState icon={<UserCheck className="w-8 h-8" />} title="All caught up" message="No pending Rep applications right now." />}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
