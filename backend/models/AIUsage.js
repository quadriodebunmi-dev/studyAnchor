import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// One row per AI call a user triggers. Powers the per-feature daily limits in
// utils/aiGuard.js and gives admins real usage numbers later. Deliberately
// stores NO prompt or document text.
const aiUsageSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    feature: { type: String, required: true },
    status: { type: String, enum: ["ok", "error"], default: "ok" },
    errorCode: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiUsageSchema.index({ user: 1, feature: 1, createdAt: -1 });
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("AIUsage", aiUsageSchema);
