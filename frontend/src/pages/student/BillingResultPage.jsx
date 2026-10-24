import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import { verifyPayment } from "../../services/billingService.js";
import { clearBillingCache } from "../../hooks/useBilling.js";

// Paystack sends people back here. The redirect itself proves nothing, so we ask
// OUR server (which asks Paystack) and only then show success.
export default function BillingResultPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [state, setState] = useState({ status: "checking" });
  const tries = useRef(0);

  useEffect(() => {
    if (!reference) { setState({ status: "failed", message: "No payment reference was provided." }); return undefined; }
    let live = true;
    let timer;
    const check = async () => {
      try {
        const r = await verifyPayment(reference);
        if (!live) return;
        if (r.status === "pending" && tries.current++ < 8) { timer = setTimeout(check, 3000); setState({ status: "checking" }); return; }
        if (r.status === "success") clearBillingCache();
        setState(r);
      } catch (e) { if (live) setState({ status: "failed", message: e.message || "We couldn't confirm the payment." }); }
    };
    check();
    return () => { live = false; clearTimeout(timer); };
  }, [reference]);

  return (
    <AppShell>
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lift dark:border-slate-800 dark:bg-slate-900">
        {state.status === "checking" ? <><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><p className="mt-4 font-semibold">Confirming your payment…</p><p className="mt-1 text-sm lv-meta">This usually takes a few seconds.</p></>
          : state.status === "success" ? <><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><p className="mt-4 font-display text-xl font-semibold">Payment confirmed</p><p className="mt-1 text-sm lv-meta">{state.plan ? `${state.plan} is now active.` : state.message}</p></>
          : state.status === "pending" ? <><Loader2 className="mx-auto h-10 w-10 text-warning" /><p className="mt-4 font-semibold">Still confirming</p><p className="mt-1 text-sm lv-meta">Your bank is taking a little longer. Check your payment history shortly — your plan activates automatically once it clears.</p></>
          : <><XCircle className="mx-auto h-10 w-10 text-danger" /><p className="mt-4 font-semibold">The payment didn't complete</p><p className="mt-1 text-sm lv-meta">{state.message || "You haven't been charged for this attempt."}</p></>}
        <Link to="/billing"><Button className="mt-6" variant="outline">Back to plans</Button></Link>
      </div>
    </AppShell>
  );
}
