import React, { useEffect, useState } from "react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { getMetrics } from "../../services/adminPlatformService.js";

const Stat = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs lv-meta">{label}</p><p className="font-display text-2xl font-bold">{value ?? 0}</p>{hint && <p className="text-[11px] lv-meta">{hint}</p>}</div>
);
const Section = ({ title, children }) => (<section className="mt-6"><h2 className="mb-2 font-display text-lg font-semibold">{title}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div></section>);
const money = (minor, cur) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(minor / 100);

export default function AdminMetricsPage() {
  const nav = useAdminNavItems();
  const [m, setM] = useState(null);
  useEffect(() => { getMetrics().then(setM).catch(() => setM({})); }, []);
  if (!m) return <AppShell sidebarItems={nav}><InlineLoader /></AppShell>;
  const u = m.users || {}, c = m.content || {}, r = m.rooms || {}, e = m.engagement || {}, b = m.billing || {};
  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Platform health</h1>
      <p className="text-xs lv-meta">{m.definitions?.active}</p>
      <Section title="People">
        <Stat label="Total users" value={u.total} /><Stat label="Active (7 days)" value={u.activeLast7Days} /><Stat label="Active (30 days)" value={u.activeLast30Days} /><Stat label="New (7 days)" value={u.newLast7Days} />
        <Stat label="Students" value={u.students} /><Stat label="Course reps" value={u.reps} /><Stat label="Independent learners" value={u.independent} /><Stat label="Suspended" value={u.suspended} />
      </Section>
      <Section title="Content">
        <Stat label="Schools" value={c.schools} /><Stat label="Courses" value={c.courses} />
        {Object.entries(c.materials || {}).map(([k, v]) => <Stat key={k} label={`Materials · ${k}`} value={v} />)}
      </Section>
      <Section title="Rooms & learning">
        <Stat label="Rooms" value={r.total} hint={`${r.public ?? 0} public`} /><Stat label="Active rooms (7d)" value={r.activeLast7Days} /><Stat label="Messages (7d)" value={r.postsLast7Days} /><Stat label="Quiz submissions (30d)" value={r.quizSubmissionsLast30Days} />
        <Stat label="Learners who studied (7d)" value={e.learnersStudiedLast7Days} /><Stat label="Points awarded (7d)" value={e.pointsAwardedLast7Days} />
      </Section>
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-semibold">AI usage (30 days)</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full text-sm"><thead className="bg-slate-100 text-left dark:bg-slate-800"><tr><th className="px-4 py-2">Feature</th><th className="px-4 py-2">Successful</th><th className="px-4 py-2">Failed</th></tr></thead>
          <tbody>{Object.entries(m.ai?.last30Days || {}).map(([f, v]) => <tr key={f} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-2">{f}</td><td className="px-4 py-2">{v.ok}</td><td className="px-4 py-2">{v.error}</td></tr>)}
            {!Object.keys(m.ai?.last30Days || {}).length && <tr><td className="px-4 py-4 lv-meta" colSpan={3}>No AI usage yet.</td></tr>}</tbody></table></div>
      </section>
      <Section title="Subscriptions & payments">
        <Stat label="Active subscribers" value={b.activeSubscribers} />
        {Object.entries(b.payments || {}).map(([k, v]) => <Stat key={k} label={`Payments · ${k}`} value={v} />)}
        {(b.revenueLast30Days || []).map((x) => <Stat key={x.currency} label={`Revenue (30d, ${x.currency})`} value={money(x.amountMinor, x.currency)} hint={`${x.payments} payment(s)`} />)}
      </Section>
    </AppShell>
  );
}
