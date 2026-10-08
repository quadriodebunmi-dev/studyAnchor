import React, { useEffect, useState } from "react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { Input } from "../../components/FormFields.jsx";
import { listUsers, toggleSuspendUser } from "../../services/adminService.js";

export default function AdminUsersPage() {
  const navItems = useAdminNavItems();
  const [users, setUsers] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  function refresh(p = page) {
    listUsers({ search: debouncedSearch, page: p }).then((res) => { setUsers(res.users); setPagination(res.pagination); });
  }
  useEffect(() => { setUsers(null); refresh(page); }, [page, debouncedSearch]);

  async function handleToggle(id) {
    await toggleSuspendUser(id);
    refresh(page);
  }

  if (!users) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">All Users</h1>
      <div className="mt-4 max-w-xs">
        <Input placeholder="Search by name, email or matric number..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800"><tr className="text-left"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 capitalize text-slate-500 dark:text-slate-400">{u.role}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.department || "—"}</td>
                <td className="px-4 py-3">{u.suspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  {u.role !== "admin" && (
                    <button onClick={() => handleToggle(u._id)} className="text-xs font-medium text-primary">{u.suspended ? "Reactivate" : "Suspend"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
