import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Auto-delete log entries 24 hours after creation. MongoDB's TTL monitor
// runs roughly once a minute, so entries disappear ~24h (+ up to ~60s) after
// they were created — no manual cleanup job needed.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export default mongoose.model("ActivityLog", activityLogSchema);
