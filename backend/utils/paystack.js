import crypto from "crypto";

// Paystack helpers. The secret key lives only on the server. Nothing the
// browser says about a payment is trusted: access is granted only after the
// server has seen a successful, matching transaction from Paystack itself
// (via verify, or a signed webhook).

/** Paystack signs the RAW request body with HMAC-SHA512 using the secret key. */
export function verifySignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Does a Paystack transaction match what WE recorded when checkout started?
 * Guards against tampered amounts, a different currency, or someone paying
 * a cheap reference and presenting it for an expensive plan.
 */
export function validateTransaction(payment, tx) {
  if (!tx) return { ok: false, reason: "no_transaction" };
  if (tx.status !== "success") return { ok: false, reason: `status_${tx.status || "unknown"}` };
  if (tx.reference !== payment.reference) return { ok: false, reason: "reference_mismatch" };
  if (Number(tx.amount) !== Number(payment.amountMinor)) return { ok: false, reason: "amount_mismatch" };
  if (String(tx.currency || "").toUpperCase() !== String(payment.currency).toUpperCase()) return { ok: false, reason: "currency_mismatch" };
  return { ok: true };
}

export class PaystackError extends Error {
  constructor(message, status = 502) { super(message); this.name = "PaystackError"; this.statusCode = status; }
}

export function createPaystackClient({ secret, fetchImpl = globalThis.fetch, baseUrl = "https://api.paystack.co", timeoutMs = 20000 } = {}) {
  async function call(path, init = {}) {
    if (!secret) throw new PaystackError("Payments aren't configured.", 503);
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init.headers || {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new PaystackError(err?.name === "TimeoutError" ? "The payment provider took too long to respond." : "Couldn't reach the payment provider.");
    }
    let body = null;
    try { body = await res.json(); } catch { /* handled below */ }
    if (!res.ok || !body?.status) throw new PaystackError(body?.message || "The payment provider rejected the request.", res.status === 401 ? 503 : 502);
    return body.data;
  }
  return {
    initialize: ({ email, amountMinor, currency, reference, callbackUrl, metadata }) =>
      call("/transaction/initialize", { method: "POST", body: JSON.stringify({ email, amount: amountMinor, currency, reference, callback_url: callbackUrl, metadata }) }),
    verify: (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`),
  };
}
