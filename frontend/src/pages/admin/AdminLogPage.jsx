import React, { useEffect, useState } from "react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { getActivityLog } from "../../services/adminService.js";

export default function AdminLogPage() {
  const navItems = useAdminNavItems();
  const [log, setLog] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLog(null);
    getActivityLog({ page }).then((res) => { setLog(res.log); setPagination(res.pagination); });
  }, [page]);

  if (!log) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Activity Log</h1>
      <div className="mt-5 space-y-2">
        {log.map((a) => (
          <div key={a._id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm flex justify-between">
            <span>{a.action}</span>
            <span className="text-slate-500 dark:text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
