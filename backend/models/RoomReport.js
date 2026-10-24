import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A member flagging a discussion post. Separate from Report (which is about
// study materials) so the two moderation queues don't get tangled.
const roomReportSchema = new mongoose.Schema(
  {
    room: { type: ObjectId, ref: "Room", required: true },
    post: { type: ObjectId, ref: "RoomPost", required: true },
    reportedBy: { type: ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, maxlength: 300 },
    status: { type: String, enum: ["open", "resolved", "dismissed"], default: "open" },
    resolvedBy: { type: ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// One report per person per post.
roomReportSchema.index({ post: 1, reportedBy: 1 }, { unique: true });
roomReportSchema.index({ room: 1, status: 1, createdAt: -1 });

export default mongoose.model("RoomReport", roomReportSchema);
