import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
    userAgent: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);
pushSubscriptionSchema.index({ user: 1 });
export default mongoose.model("PushSubscription", pushSubscriptionSchema);
