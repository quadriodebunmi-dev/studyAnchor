import mongoose from "mongoose";
// Processed webhook events. The unique `eventKey` makes webhook delivery idempotent:
// Paystack may send the same event several times; only the first is acted on.
const paymentEventSchema = new mongoose.Schema(
  { eventKey: { type: String, required: true, unique: true }, event: String, reference: String, outcome: String },
  { timestamps: { createdAt: true, updatedAt: false } }
);
paymentEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
export default mongoose.model("PaymentEvent", paymentEventSchema);
