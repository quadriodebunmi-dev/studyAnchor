import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Field, Input, Select, Textarea } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { getSubscriptionConfig, saveSubscriptionConfig } from "../../services/adminPlatformService.js";

const blankPlan = () => ({ key: "", name: "", description: "", priceMinor: 250000, durationDays: 30, features: [], limits: {}, active: true });

export default function AdminSubscriptionsPage() {
  const nav = useAdminNavItems();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getSubscriptionConfig().then((r) => { setD(r); setCfg(r.config); }).catch(() => setD({ error: true })); }, []);
  if (!d || (!cfg && !d.error)) return <AppShell sidebarItems={nav}><InlineLoader /></AppShell>;
  if (d.error) return <AppShell sidebarItems={nav}><p className="text-danger">Couldn't load the configuration.</p></AppShell>;

  const setPlan = (i, patch) => setCfg((c) => ({ ...c, plans: c.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const toggleFeature = (i, f) => setPlan(i, { features: cfg.plans[i].features.includes(f) ? cfg.plans[i].features.filter((x) => x !== f) : [...cfg.plans[i].features, f] });

  async function save() {
    setBusy(true); setErrors([]);
    try { const r = await saveSubscriptionConfig(cfg); setCfg(r.config); toast("Subscription settings saved", "success"); }
    catch (e) { setErrors(e.errors || [e.message || "Couldn't save."]); } finally { setBusy(false); }
  }

  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Subscriptions</h1>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs lv-meta">{d.policy.map((p) => <li key={p}>{p}</li>)}</ul>
      {!d.paymentsConfigured && <p className="mt-3 max-w-2xl rounded-xl bg-warning/10 p-3 text-sm text-warning">Payments aren't configured: set <code>PAYSTACK_SECRET_KEY</code> on the server before enabling subscriptions.</p>}

      <div className="mt-5 max-w-3xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />Subscriptions enabled</label>
          <p className="mt-1 text-xs lv-meta">While off, every feature is free for everyone.</p>
          <div className="mt-3 max-w-[8rem]"><Field label="Currency"><Input value={cfg.currency} maxLength={3} onChange={(e) => setCfg({ ...cfg, currency: e.target.value.toUpperCase() })} /></Field></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-display font-semibold">Which features are paid?</h2>
          <div className="grid gap-3 sm:grid-cols-2">{d.featureKeys.map((k) => (
            <Field key={k} label={d.featureLabels[k]}><Select value={cfg.features[k]?.access || "free"} onChange={(e) => setCfg({ ...cfg, features: { ...cfg.features, [k]: { access: e.target.value } } })}><option value="free">Free for everyone</option><option value="paid">Paid plans only</option></Select></Field>))}</div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-display font-semibold">Plans</h2><Button size="sm" variant="outline" onClick={() => setCfg({ ...cfg, plans: [...cfg.plans, blankPlan()] })}><Plus className="h-4 w-4" />Add plan</Button></div>
          {cfg.plans.map((p, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Key" hint="Lowercase, no spaces (used internally)"><Input value={p.key} onChange={(e) => setPlan(i, { key: e.target.value })} /></Field>
                <Field label="Name"><Input value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} /></Field>
                <Field label={`Price in the smallest unit (${cfg.currency === "NGN" ? "kobo" : "cents"})`} hint={`${(Number(p.priceMinor) / 100).toLocaleString()} ${cfg.currency}`}><Input type="number" value={p.priceMinor} onChange={(e) => setPlan(i, { priceMinor: Number(e.target.value) })} /></Field>
                <Field label="Access lasts (days)"><Input type="number" value={p.durationDays} onChange={(e) => setPlan(i, { durationDays: Number(e.target.value) })} /></Field>
              </div>
              <div className="mt-3"><Field label="Description"><Textarea rows={2} value={p.description} onChange={(e) => setPlan(i, { description: e.target.value })} /></Field></div>
              <p className="mt-3 text-sm font-medium">Includes</p>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">{d.featureKeys.map((f) => <label key={f} className="flex items-center gap-1.5"><input type="checkbox" checked={p.features.includes(f)} onChange={() => toggleFeature(i, f)} />{d.featureLabels[f]}</label>)}</div>
              <p className="mt-3 text-sm font-medium">Higher daily AI limits <span className="text-xs font-normal lv-meta">(-1 = unlimited, blank = no change)</span></p>
              <div className="mt-1 grid gap-2 sm:grid-cols-5">{d.limitKeys.map((k) => <label key={k} className="text-xs"><span className="lv-meta">{k}</span><Input type="number" value={p.limits?.[k] ?? ""} onChange={(e) => { const l = { ...(p.limits || {}) }; if (e.target.value === "") delete l[k]; else l[k] = Number(e.target.value); setPlan(i, { limits: l }); }} /></label>)}</div>
              <div className="mt-3 flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.active} onChange={(e) => setPlan(i, { active: e.target.checked })} />Available to buy</label>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => window.confirm("Remove this plan? People who already bought it keep their access until it expires.") && setCfg({ ...cfg, plans: cfg.plans.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" />Remove</Button></div>
            </div>))}
        </section>

        {errors.length > 0 && <ul role="alert" className="space-y-1 rounded-xl bg-danger/10 p-3 text-sm text-danger">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save subscription settings"}</Button>
      </div>
    </AppShell>
  );
}
