import React, { useEffect, useState } from "react";
import { Check, CreditCard, RefreshCw } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import { getMyBilling, getPlans, startCheckout, setAutoRenew } from "../../services/billingService.js";
import { clearBillingCache } from "../../hooks/useBilling.js";

const money = (minor, cur) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(minor / 100);
const STATUS_TONE = { success: "green", pending: "amber", failed: "red", abandoned: "slate", refunded: "violet" };

export default function BillingPage() {
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState("");
  const [renewOnBuy, setRenewOnBuy] = useState(true); // the "renew automatically" tick at checkout
  const [savingRenew, setSavingRenew] = useState(false);
  useEffect(() => { getPlans().then(setPlans).catch(() => setPlans({ enabled: false, plans: [] })); getMyBilling().then(setMe).catch(() => setMe({ entitlements: [], payments: [] })); }, []);

  async function buy(plan) {
    setBusy(plan.key);
    try { const r = await startCheckout(plan.key, renewOnBuy); window.location.assign(r.authorizationUrl); }
    catch (e) { toast(e.message || "Couldn't start the payment.", "error"); setBusy(""); }
  }

  async function toggleRenew() {
    const next = !me.autoRenew?.enabled;
    setSavingRenew(true);
    try {
      const autoRenew = await setAutoRenew(next);
      setMe((m) => ({ ...m, autoRenew }));
      clearBillingCache();
      toast(next ? "Auto-renew is on." : "Auto-renew is off. You won't be charged again automatically.", "success");
    } catch (e) { toast(e.message || "Couldn't change auto-renew.", "error"); }
    finally { setSavingRenew(false); }
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
          <AutoRenewCard ar={me.autoRenew} onToggle={toggleRenew} saving={savingRenew} />
          {plans.plans.length > 0 && (
            <label className="mt-5 flex max-w-xl cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={renewOnBuy} onChange={(e) => setRenewOnBuy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
              <span>Renew automatically when my plan ends <span className="block text-xs lv-meta">Your card is charged again a day before it expires. You can switch this off here at any time.</span></span>
            </label>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

// The on/off switch for automatic renewal. The server is the source of truth; this only shows it.
function AutoRenewCard({ ar, onToggle, saving }) {
  if (!ar) return null;
  const on = Boolean(ar.enabled);
  const canSwitch = on || ar.hasCard;
  return (
    <section className="mt-5 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-highlight-deep dark:text-accent"><RefreshCw className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold">Auto-renew</h2>
            <p className="mt-0.5 text-sm lv-meta">
              {on ? "Your plan renews by itself using your saved card." : "Off. Your plan ends on its date unless you pay again."}
            </p>
            {ar.card && <p className="mt-1 text-xs lv-meta"><span className="capitalize">{ar.card.brand || "Card"}</span> •••• {ar.card.last4}{ar.card.expMonth ? ` · expires ${ar.card.expMonth}/${String(ar.card.expYear).slice(-2)}` : ""}</p>}
            {on && ar.renewsAt && <p className="mt-0.5 text-xs lv-meta">Next charge around {new Date(ar.renewsAt).toLocaleDateString()}.</p>}
            {ar.disabledReason === "too_many_failures" && !on && <p className="mt-1 text-xs text-warning">We turned this off after a few failed charges. Pay for your plan again, then switch it back on.</p>}
            {!ar.hasCard && <p className="mt-1 text-xs lv-meta">Pay for a plan with a card and tick “Renew automatically” to start.</p>}
          </div>
        </div>
        <button
          type="button" role="switch" aria-checked={on} aria-label="Auto-renew" disabled={saving || !canSwitch} onClick={onToggle}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-success" : "bg-slate-300 dark:bg-slate-700"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
        </button>
      </div>
    </section>
  );
}

export function clearAfterPurchase() { clearBillingCache(); }
