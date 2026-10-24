import api from "./api.js";

export const getPlans = () => api.get("/billing/plans").then((r) => r.data);
export const getMyBilling = () => api.get("/billing/me").then((r) => r.data);
export const startCheckout = (planKey) => api.post("/billing/checkout", { planKey }).then((r) => r.data);
export const verifyPayment = (reference) => api.get(`/billing/verify/${encodeURIComponent(reference)}`).then((r) => r.data);
