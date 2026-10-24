import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// Structured record of administrative actions. Stores WHO did WHAT to which
// object, never secrets, passwords or payment details.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "user.suspend"
    targetType: { type: String },
    targetId: { type: String },
    summary: { type: String, maxlength: 300 },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
export default mongoose.model("AuditLog", auditLogSchema);
