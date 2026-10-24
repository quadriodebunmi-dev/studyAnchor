import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Badge from "../../components/Badge.jsx";
import Pager from "../../components/Pager.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Input, Select } from "../../components/FormFields.jsx";
import { getAdminPayments, getPaymentSummary } from "../../services/adminPlatformService.js";

const money = (minor, cur) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(minor / 100);
const TONE = { success: "green", pending: "amber", failed: "red", abandoned: "slate", refunded: "violet" };

export default function AdminPaymentsPage() {
  const nav = useAdminNavItems();
  const [sum, setSum] = useState(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  useEffect(() => { getPaymentSummary().then(setSum).catch(() => {}); }, []);
  useEffect(() => { setD(null); const t = setTimeout(() => getAdminPayments({ status: status || undefined, search: q || undefined, page }).then(setD).catch(() => setD({ payments: [] })), q ? 300 : 0); return () => clearTimeout(t); }, [status, q, page]);

  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Payments</h1>
      {sum && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs lv-meta">Active subscribers</p><p className="font-display text-2xl font-bold">{sum.activeSubscribers}</p></div>
          {sum.revenueLast30Days.map((r) => <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs lv-meta">Revenue, last 30 days</p><p className="font-display text-2xl font-bold">{money(r.amountMinor, r._id)}</p></div>)}
          {sum.revenueAllTime.map((r) => <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs lv-meta">Revenue, all time</p><p className="font-display text-2xl font-bold">{money(r.amountMinor, r._id)}</p></div>)}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">{Object.entries(sum.byStatus).map(([k, v]) => <p key={k}>{k}: <b>{v}</b></p>)}</div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <div className="w-full max-w-xs"><Input placeholder="Search reference, name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status"><option value="">All statuses</option>{Object.keys(TONE).map((s) => <option key={s}>{s}</option>)}</Select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm"><thead className="bg-slate-100 text-left dark:bg-slate-800"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Learner</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Reference</th></tr></thead>
          <tbody>{!d ? <tr><td colSpan={6} className="p-4"><InlineLoader /></td></tr> : d.payments.map((p) => (
            <tr key={p._id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-2">{new Date(p.paidAt || p.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-2">{p.user ? <Link className="text-primary hover:underline" to={`/admin/users/${p.user._id}`}>{p.user.name}</Link> : "—"}</td><td className="px-4 py-2">{p.plan}</td><td className="px-4 py-2">{money(p.amountMinor, p.currency)}</td>
              <td className="px-4 py-2"><Badge tone={TONE[p.status]}>{p.status}</Badge>{p.failureReason && <span className="ml-1 text-xs lv-meta">{p.failureReason}</span>}</td><td className="px-4 py-2 text-xs lv-meta">{p.reference}</td></tr>))}
            {d && d.payments.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center lv-meta">No payments.</td></tr>}</tbody></table>
      </div>
      {d && <Pager pagination={d.pagination} onPageChange={setPage} />}
    </AppShell>
  );
}
