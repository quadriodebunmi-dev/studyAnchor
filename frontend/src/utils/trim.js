// Trims leading/trailing whitespace from every string in a value (deeply).
// Passwords are left alone: a space can legitimately be part of one.
const SKIP_KEY = /pass(word|phrase)?$/i;

export function trimDeep(value, key = "") {
  if (typeof value === "string") return SKIP_KEY.test(key) ? value : value.trim();
  if (Array.isArray(value)) return value.map((v) => trimDeep(v, key));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = trimDeep(value[k], k);
    return out;
  }
  return value;
}

export function trimFormData(fd) {
  const out = new FormData();
  for (const [k, v] of fd.entries()) out.append(k, typeof v === "string" && !SKIP_KEY.test(k) ? v.trim() : v);
  return out;
}
