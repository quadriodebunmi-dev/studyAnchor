import React, { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { listReports, resolveReport } from "../../services/adminService.js";

export default function AdminReportsPage() {
  const navItems = useAdminNavItems();
  const [reports, setReports] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  function refresh(p = page) {
    listReports({ page: p }).then((res) => { setReports(res.reports); setPagination(res.pagination); });
  }
  useEffect(() => { setReports(null); refresh(page); }, [page]);

  async function handleResolve(id) {
    await resolveReport(id);
    refresh(page);
  }

  if (!reports) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Flagged Content</h1>
      <div className="mt-5 space-y-3">
        {reports.map((r) => (
          <div key={r._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{r.materialId?.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reported by {r.reportedBy?.name} — {r.reason}</p>
            </div>
            {r.status === "resolved" ? <Badge tone="green">Resolved</Badge> : <Button variant="outline" onClick={() => handleResolve(r._id)}>Resolve</Button>}
          </div>
        ))}
        {reports.length === 0 && <EmptyState icon={<Flag className="w-8 h-8" />} title="No reports" message="Nothing has been flagged by students." />}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
