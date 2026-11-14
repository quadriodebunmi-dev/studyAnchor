import api from "./api.js";

export const getPlans = () => api.get("/billing/plans").then((r) => r.data);
export const getMyBilling = () => api.get("/billing/me").then((r) => r.data);
export const startCheckout = (planKey, autoRenew = false) => api.post("/billing/checkout", { planKey, autoRenew }).then((r) => r.data);
export const setAutoRenew = (enabled, planKey) => api.put("/billing/auto-renew", { enabled, ...(planKey ? { planKey } : {}) }).then((r) => r.data.autoRenew);
export const verifyPayment = (reference) => api.get(`/billing/verify/${encodeURIComponent(reference)}`).then((r) => r.data);
