import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Select } from "../../components/FormFields.jsx";
import AdminUserEditForm from "../../components/AdminUserEditForm.jsx";
import { useToast } from "../../components/Toast.jsx";
import { changeUserRole, getUserDetail, getUserPoints, reversePoints, revokeEntitlement, suspendUser } from "../../services/adminPlatformService.js";

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const nav = useAdminNavItems();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [pts, setPts] = useState(null);
  const [role, setRole] = useState("");
  const load = useCallback(() => {
    getUserDetail(id).then((r) => { setD(r); setRole(r.user.role); }).catch(() => setD({ error: true }));
    getUserPoints(id).then(setPts).catch(() => setPts({ transactions: [] }));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, ok) => { try { await fn(); toast(ok, "success"); load(); } catch (e) { toast(e.message || "Something went wrong.", "error"); } };

  if (!d) return <AppShell sidebarItems={nav}><InlineLoader /></AppShell>;
  if (d.error) return <AppShell sidebarItems={nav}><p className="text-danger">User not found.</p></AppShell>;
  const u = d.user;
  return (
    <AppShell sidebarItems={nav}>
      <Link to="/admin/users" className="text-sm lv-meta hover:underline">← All users</Link>
      <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{u.name}</h1>{u.suspended && <Badge tone="red">Suspended</Badge>}<Badge>{u.role}</Badge>{u.learnerType === "independent" && <Badge tone="violet">Independent</Badge>}</div>
      <p className="text-sm lv-meta">{u.email}{u.schoolId?.name && ` · ${u.schoolId.name}`}{u.department && ` · ${u.department}`} · joined {new Date(u.createdAt).toLocaleDateString()}{u.lastActiveAt && ` · last active ${new Date(u.lastActiveAt).toLocaleDateString()}`}</p>
      <p className="mt-1 text-sm">{u.points || 0} points · {d.counts.uploads} uploads · {d.counts.roomsCreated} rooms created</p>
      {u.suspended && u.suspendedReason && <p className="mt-1 text-xs text-danger">Reason: {u.suspendedReason}</p>}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display font-semibold">Account actions</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="w-auto"><option value="student">student</option><option value="rep">rep</option><option value="admin">admin</option></Select>
          <Button size="sm" variant="outline" disabled={role === u.role} onClick={() => window.confirm(`Change ${u.name}'s role to ${role}?`) && run(() => changeUserRole(id, role), "Role updated")}>Change role</Button>
          {u.role !== "admin" && <Button size="sm" variant={u.suspended ? "outline" : "destructive"} onClick={() => { const reason = u.suspended ? "" : window.prompt("Reason for suspending (optional):") ?? null; if (reason === null) return; run(() => suspendUser(id, reason), u.suspended ? "Reactivated" : "Suspended"); }}>{u.suspended ? "Reactivate" : "Suspend"}</Button>}
        </div>
        <p className="mt-2 text-xs lv-meta">Every change here is recorded in the audit log.</p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display font-semibold">Edit details</h2>
        <p className="mb-4 mt-1 text-xs lv-meta">Changes are saved to the account right away, recorded in the audit log, and the user is notified. Role and suspension are above; points are adjusted through the ledger below.</p>
        <AdminUserEditForm user={u} onSaved={() => load()} />
      </section>

      <section className="mt-6"><h2 className="mb-2 font-display font-semibold">Plans</h2>
        {d.entitlements.length === 0 ? <p className="text-sm lv-meta">No purchases.</p> : <ul className="space-y-2">{d.entitlements.map((e) => (
          <li key={e._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"><span>{e.planName || e.planKey} · until {new Date(e.expiresAt).toLocaleDateString()} <Badge tone={e.status === "active" ? "green" : "slate"}>{e.status}</Badge></span>
            {e.status === "active" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => { const r = window.prompt("Reason for revoking:"); if (r) run(() => revokeEntitlement(e._id, r), "Access revoked"); }}>Revoke</Button>}</li>))}</ul>}
      </section>

      <section className="mt-6"><h2 className="mb-2 font-display font-semibold">Points ledger</h2>
        {!pts ? <InlineLoader /> : <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {pts.transactions.map((t) => <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm"><span className="min-w-0"><span className="block truncate">{t.reason}</span><span className="text-xs lv-meta">{new Date(t.createdAt).toLocaleString()}</span></span>
            <span className="flex items-center gap-2"><Badge tone={t.points >= 0 ? "green" : "red"}>{t.points}</Badge>{t.points > 0 && <button className="text-xs text-danger" onClick={() => { const r = window.prompt("Why are you reversing these points?"); if (r) run(() => reversePoints(t.key, r), "Points reversed"); }}>Reverse</button>}</span></li>)}
          {pts.transactions.length === 0 && <li className="p-4 text-sm lv-meta">No points yet.</li>}</ul>}
      </section>
    </AppShell>
  );
}
