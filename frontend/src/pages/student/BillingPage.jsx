import React, { useEffect, useState } from "react";
import { Check, CreditCard } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import { getMyBilling, getPlans, startCheckout } from "../../services/billingService.js";
import { clearBillingCache } from "../../hooks/useBilling.js";

const money = (minor, cur) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(minor / 100);
const STATUS_TONE = { success: "green", pending: "amber", failed: "red", abandoned: "slate", refunded: "violet" };

export default function BillingPage() {
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { getPlans().then(setPlans).catch(() => setPlans({ enabled: false, plans: [] })); getMyBilling().then(setMe).catch(() => setMe({ entitlements: [], payments: [] })); }, []);

  async function buy(plan) {
    setBusy(plan.key);
    try { const r = await startCheckout(plan.key); window.location.assign(r.authorizationUrl); }
    catch (e) { toast(e.message || "Couldn't start the payment.", "error"); setBusy(""); }
  }

  if (!plans || !me) return <AppShell><InlineLoader /></AppShell>;
  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Plans &amp; billing</h1>
      {!plans.enabled ? (
        <p className="mt-4 max-w-xl rounded-2xl bg-slate-100 p-5 text-sm dark:bg-slate-800">Everything is free right now — there's nothing to buy. 🎉</p>
      ) : (
        <>
          {plans.paidFeatures.length > 0 && <p className="mt-1 text-sm lv-meta">Paid features: {plans.paidFeatures.map((f) => f.label).join(", ")}.</p>}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.plans.map((p) => {
              const active = me.entitlements.find((e) => e.planKey === p.key);
              return (
                <div key={p.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="font-display text-lg font-semibold">{p.name}</h2>
                  <p className="mt-1 font-display text-3xl font-bold">{money(p.priceMinor, p.currency)}<span className="text-sm font-normal lv-meta"> / {p.durationDays} days</span></p>
                  {p.description && <p className="mt-2 text-sm lv-meta">{p.description}</p>}
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">{p.featureLabels.map((l) => <li key={l} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{l}</li>)}</ul>
                  {active && <p className="mt-3 text-xs text-success">Active until {new Date(active.expiresAt).toLocaleDateString()}</p>}
                  <Button className="mt-4" disabled={!plans.paymentsConfigured || busy === p.key} onClick={() => buy(p)}><CreditCard className="h-4 w-4" />{busy === p.key ? "Redirecting…" : active ? "Extend" : "Choose plan"}</Button>
                </div>
              );
            })}
            {plans.plans.length === 0 && <p className="text-sm lv-meta">No plans are available right now.</p>}
          </div>
          {!plans.paymentsConfigured && <p className="mt-3 text-xs text-warning">Payments aren't available at the moment.</p>}
        </>
      )}

      {me.payments.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-lg font-semibold">Payment history</h2>
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {me.payments.map((p) => <li key={p.reference} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><span className="block">{p.plan}</span><span className="text-xs lv-meta">{new Date(p.at).toLocaleDateString()} · {p.reference}</span></span><span className="flex items-center gap-2">{money(p.amountMinor, p.currency)}<Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></span></li>)}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

export function clearAfterPurchase() { clearBillingCache(); }
