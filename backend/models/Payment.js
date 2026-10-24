import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// A checkout attempt. Price, currency and plan are copied from the SERVER's plan
// configuration when the checkout starts — never from the browser — and the
// `planSnapshot` is what the resulting entitlement is built from.
const paymentSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    reference: { type: String, required: true, unique: true },
    provider: { type: String, default: "paystack" },
    planKey: { type: String, required: true },
    planSnapshot: {
      key: String, name: String, priceMinor: Number, currency: String, durationDays: Number,
      features: [String], limits: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["pending", "success", "failed", "abandoned", "refunded"], default: "pending" },
    failureReason: { type: String, maxlength: 120 },
    paidAt: { type: Date },
    verifiedAt: { type: Date },
    entitlement: { type: ObjectId, ref: "Entitlement" },
  },
  { timestamps: true }
);
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 });
export default mongoose.model("Payment", paymentSchema);
