import React, { useEffect, useState } from "react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Pager from "../../components/Pager.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Select } from "../../components/FormFields.jsx";
import { getAudit } from "../../services/adminPlatformService.js";

const FILTERS = [["", "Everything"], ["user.", "Users"], ["points.", "Points"], ["announcement.", "Announcements"], ["subscriptions.", "Subscriptions"], ["entitlement.", "Entitlements"], ["settings.", "Settings"], ["room", "Rooms & reports"], ["material.", "Materials"]];

export default function AdminAuditPage() {
  const nav = useAdminNavItems();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); getAudit({ action: action || undefined, page }).then(setD).catch(() => setD({ entries: [] })); }, [action, page]);
  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm lv-meta">Who did what, and when. Entries can't be edited or deleted from here.</p>
      <div className="mt-4 max-w-xs"><Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter">{FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm"><thead className="bg-slate-100 text-left dark:bg-slate-800"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Admin</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Details</th></tr></thead>
          <tbody>{!d ? <tr><td colSpan={4} className="p-4"><InlineLoader /></td></tr> : d.entries.map((e) => <tr key={e._id} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="whitespace-nowrap px-4 py-2 text-xs lv-meta">{new Date(e.createdAt).toLocaleString()}</td><td className="px-4 py-2">{e.actor?.name}</td><td className="px-4 py-2 font-mono text-xs">{e.action}</td><td className="px-4 py-2">{e.summary}</td></tr>)}
            {d && d.entries.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center lv-meta">Nothing recorded.</td></tr>}</tbody></table>
      </div>
      {d && <Pager pagination={d.pagination} onPageChange={setPage} />}
    </AppShell>
  );
}
