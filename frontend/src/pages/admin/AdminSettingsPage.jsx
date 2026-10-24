import React, { useEffect, useState } from "react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Input } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { getAdminSettings, updateAdminSettings } from "../../services/adminPlatformService.js";

const GROUPS = { rewards: "Points", ai: "AI daily limits (per learner)", rooms: "Rooms", quizzes: "Quizzes", goals: "Goals" };
const nice = (k) => k.split(".").slice(1).join(" › ").replace(/([A-Z])/g, " $1").toLowerCase();

export default function AdminSettingsPage() {
  const nav = useAdminNavItems();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [draft, setDraft] = useState({});
  useEffect(() => { getAdminSettings().then((r) => { setD(r); setDraft({}); }).catch(() => setD({ settings: {}, editable: [] })); }, []);
  if (!d) return <AppShell sidebarItems={nav}><InlineLoader /></AppShell>;

  async function save() {
    const patch = {};
    for (const [k, v] of Object.entries(draft)) { const parts = k.split("."); let cur = patch; for (const p of parts.slice(0, -1)) cur = cur[p] ??= {}; cur[parts.at(-1)] = Number(v); }
    try { const r = await updateAdminSettings(patch); setD((x) => ({ ...x, settings: r.settings })); setDraft({}); toast("Settings saved — live within a minute on every server", "success"); }
    catch (e) { toast(e.message || "Couldn't save.", "error"); }
  }
  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Platform settings</h1>
      <p className="text-sm lv-meta">Numbers are bounded to sensible ranges. Every change is written to the audit log.</p>
      <div className="mt-5 max-w-2xl space-y-6">
        {Object.entries(GROUPS).map(([g, label]) => {
          const keys = d.editable.filter((k) => k.startsWith(`${g}.`));
          if (!keys.length) return null;
          return (
            <section key={g} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 font-display font-semibold">{label}</h2>
              <div className="grid gap-3 sm:grid-cols-2">{keys.map((k) => (
                <label key={k} className="text-sm"><span className="mb-1 block text-xs lv-meta">{nice(k)}</span>
                  <Input type="number" value={draft[k] ?? d.settings[k] ?? ""} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} /></label>))}</div>
            </section>
          );
        })}
        <Button disabled={!Object.keys(draft).length} onClick={save}>Save changes</Button>
      </div>
    </AppShell>
  );
}
