import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// In-app notifications. Created only through utils/notify.js, which checks the
// recipient's preferences and uses `dedupeKey` so a retried event (or a
// re-run scheduler) can never notify the same person twice.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    // Preference bucket — see NOTIFICATION_CATEGORIES in utils/notify.js.
    category: { type: String, required: true, default: "system" },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, maxlength: 400, default: "" },
    link: { type: String, maxlength: 300, default: "" }, // in-app route
    data: { type: mongoose.Schema.Types.Mixed },
    dedupeKey: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
// Unique only when a key is supplied.
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("Notification", notificationSchema);
