import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// What a paid plan unlocked, frozen at purchase time (features + limits), valid
// from startsAt until expiresAt. Renewals are new rows starting when the
// previous one ends. Edits to the plan later never shorten or remove this.
const entitlementSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    planKey: { type: String, required: true },
    planName: { type: String },
    features: [{ type: String }],
    limits: { type: mongoose.Schema.Types.Mixed, default: {} },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    revokedReason: { type: String, maxlength: 160 },
    // One entitlement per payment: granting twice is impossible.
    payment: { type: ObjectId, ref: "Payment", required: true, unique: true },
  },
  { timestamps: true }
);
entitlementSchema.index({ user: 1, status: 1, expiresAt: -1 });
export default mongoose.model("Entitlement", entitlementSchema);
