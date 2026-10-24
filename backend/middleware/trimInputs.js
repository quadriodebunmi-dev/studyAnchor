// Trims leading/trailing whitespace from every string a client sends
// (JSON body, multipart text fields, query string). The browser already trims
// before sending; this makes the API safe for any client.
//
// Passwords are never touched — a space can legitimately be part of one.
const SKIP_KEY = /pass(word|phrase)?$/i;
const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);

export function trimDeep(value, key = "") {
  if (typeof value === "string") return SKIP_KEY.test(key) ? value : value.trim();
  if (Array.isArray(value)) return value.map((v) => trimDeep(v, key));
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value; // Dates, ObjectIds, streams...
    const out = {};
    for (const k of Object.keys(value)) {
      if (DANGEROUS.has(k)) continue;
      out[k] = trimDeep(value[k], k);
    }
    return out;
  }
  return value;
}

export function trimInputs(req, res, next) {
  // The Paystack webhook is verified against req.rawBody, which stays untouched,
  // but there is no reason to rewrite a signed payload.
  if (req.originalUrl?.startsWith("/api/billing/webhook")) return next();
  if (req.body && typeof req.body === "object") req.body = trimDeep(req.body);
  if (req.query && typeof req.query === "object") req.query = trimDeep(req.query);
  next();
}

export default trimInputs;
