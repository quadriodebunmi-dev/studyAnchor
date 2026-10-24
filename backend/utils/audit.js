import AuditLog from "../models/AuditLog.js";

const SECRET_KEY = /pass|token|secret|key|card|authorization/i;
const scrub = (meta) => {
  if (!meta || typeof meta !== "object") return undefined;
  return Object.fromEntries(Object.entries(meta).filter(([k]) => !SECRET_KEY.test(k)).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 200) : v]));
};

/** Records an admin action. Fire-and-forget: auditing must never block or fail the action itself. */
export function audit(req, action, { targetType, targetId, summary, meta } = {}) {
  return AuditLog.create({ actor: req.user._id, action, targetType, targetId: targetId ? String(targetId) : undefined, summary: summary ? String(summary).slice(0, 300) : undefined, meta: scrub(meta) })
    .catch((err) => console.error("audit failed:", err.message));
}
