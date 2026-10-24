import { useEffect, useState } from "react";
import { getMyBilling } from "../services/billingService.js";

// What can this user use right now? One shared fetch, so every screen agrees
// with the server (which is the real gate — this only decides what to show).
let cache = null;
let inflight = null;
export const clearBillingCache = () => { cache = null; };

export default function useBilling() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    if (cache) return undefined;
    let live = true;
    inflight ||= getMyBilling().then((d) => { cache = d; return d; }).catch(() => null).finally(() => { inflight = null; });
    inflight.then((d) => live && d && setData(d));
    return () => { live = false; };
  }, []);
  return { billing: data, can: (feature) => data?.access?.[feature]?.allowed !== false };
}
