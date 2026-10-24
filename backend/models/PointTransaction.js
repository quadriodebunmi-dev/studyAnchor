import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Append-only points ledger. `key` is unique, so awarding the same thing twice
// (retried request, double-click, replayed event) is impossible: the second
// insert fails and no points move. Reversals are new rows with negative points.
const pointTransactionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    points: { type: Number, required: true }, // may be negative (reversal)
    reason: { type: String, required: true },
    sourceType: { type: String, required: true }, // e.g. "room_quiz", "room_created"
    sourceId: { type: ObjectId },
    key: { type: String, required: true, unique: true },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

pointTransactionSchema.index({ user: 1, createdAt: -1 });
pointTransactionSchema.index({ user: 1, sourceType: 1, createdAt: -1 });

export default mongoose.model("PointTransaction", pointTransactionSchema);
