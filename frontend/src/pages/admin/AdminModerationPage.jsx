import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Pager from "../../components/Pager.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Input } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { deleteAdminRoom, getAdminRooms, getRoomReports, getTopEarners, resolveRoomReport } from "../../services/adminPlatformService.js";

const TABS = [["reports", "Reported messages"], ["rooms", "Rooms"], ["points", "Points watch"]];

export default function AdminModerationPage() {
  const nav = useAdminNavItems();
  const [tab, setTab] = useState("reports");
  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Moderation</h1>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-accent" : "border-transparent text-slate-500"}`}>{l}</button>)}
      </div>
      <div className="mt-6">{tab === "reports" ? <Reports /> : tab === "rooms" ? <Rooms /> : <Points />}</div>
    </AppShell>
  );
}

function Reports() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const load = useCallback(() => getRoomReports({ page }).then(setD).catch(() => setD({ reports: [] })), [page]);
  useEffect(() => { setD(null); load(); }, [load]);
  async function act(id, action) { try { await resolveRoomReport(id, action); toast(action === "remove" ? "Message removed" : "Dismissed", "success"); load(); } catch (e) { toast(e.message, "error"); } }
  if (!d) return <InlineLoader />;
  return (
    <div className="max-w-3xl space-y-3">
      {d.reports.length === 0 && <p className="text-sm lv-meta">No open reports. 🎉</p>}
      {d.reports.map((r) => (
        <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs lv-meta">In <b>{r.room?.name || "deleted room"}</b> · reported by {r.reportedBy} · {new Date(r.createdAt).toLocaleString()}</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{r.post?.content || "[message unavailable]"}</p>
          <p className="mt-2 text-sm"><span className="lv-meta">Reason: </span>{r.reason}</p>
          <div className="mt-3 flex gap-2"><Button size="sm" variant="ghost" onClick={() => act(r._id, "dismiss")}>Dismiss</Button><Button size="sm" variant="destructive" onClick={() => act(r._id, "remove")}>Remove message</Button></div>
        </div>
      ))}
      <Pager pagination={d.pagination} onPageChange={setPage} />
    </div>
  );
}

function Rooms() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const load = useCallback(() => getAdminRooms({ search: q || undefined, page }).then(setD).catch(() => setD({ rooms: [] })), [q, page]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  async function remove(r) {
    if (!window.confirm(`Permanently delete "${r.name}" with all its messages, quizzes and results?`)) return;
    try { await deleteAdminRoom(r._id); toast("Room deleted", "success"); load(); } catch (e) { toast(e.message, "error"); }
  }
  return (
    <div className="max-w-3xl">
      <div className="mb-3 max-w-xs"><Input placeholder="Search rooms" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      {!d ? <InlineLoader /> : (
        <><ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {d.rooms.map((r) => <li key={r._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{r.name} <Badge tone={r.visibility === "private" ? "amber" : "green"}>{r.visibility}</Badge></span><span className="text-xs lv-meta">by {r.creator} · {r.memberCount} members · active {new Date(r.lastActivityAt).toLocaleDateString()}</span></span><Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(r)}>Delete</Button></li>)}
          {d.rooms.length === 0 && <li className="p-4 text-sm lv-meta">No rooms.</li>}</ul>
          <Pager pagination={d.pagination} onPageChange={setPage} /></>
      )}
    </div>
  );
}

function Points() {
  const [hours, setHours] = useState(24);
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); getTopEarners(hours).then(setD).catch(() => setD({ entries: [] })); }, [hours]);
  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex gap-2">{[[24, "24 hours"], [168, "7 days"]].map(([h, l]) => <button key={h} onClick={() => setHours(h)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${hours === h ? "bg-primary text-primary-fg" : "bg-slate-100 dark:bg-slate-800"}`}>{l}</button>)}</div>
      <p className="mb-3 text-xs lv-meta">Highest earners in the period. A high number isn't proof of abuse — open the user to review their ledger and reverse specific awards.</p>
      {!d ? <InlineLoader /> : <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {d.entries.map((e) => <li key={e._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><Link to={`/admin/users/${e._id}`} className="min-w-0 truncate text-primary hover:underline">{e.name} <span className="lv-meta">({e.email})</span></Link><span>{e.points} pts · {e.awards} awards{e.suspended && <Badge tone="red" className="ml-2">suspended</Badge>}</span></li>)}
        {d.entries.length === 0 && <li className="p-4 text-sm lv-meta">No points awarded in this period.</li>}</ul>}
    </div>
  );
}
