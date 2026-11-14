import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

// One row per person: the card Paystack let us reuse, and whether they want it
// used to renew their plan. `enabled` is the user's switch (Billing page).
// The authorization code is an opaque Paystack token (not a card number) and is
// never sent to the browser — hence select:false.
const autoRenewalSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, unique: true },
    enabled: { type: Boolean, default: false },
    planKey: { type: String },
    authorizationCode: { type: String, select: false },
    signature: { type: String, select: false },
    card: { brand: String, last4: String, expMonth: String, expYear: String, bank: String },
    failureCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    lastFailureReason: { type: String, maxlength: 120 },
    // "user" (switched off), "too_many_failures", or empty while on.
    disabledReason: { type: String, maxlength: 40 },
  },
  { timestamps: true }
);
autoRenewalSchema.index({ enabled: 1, failureCount: 1 });
export default mongoose.model("AutoRenewal", autoRenewalSchema);
