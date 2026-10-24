import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// One row per (room, user). `status` is the whole membership lifecycle:
//   active   a member            invited  owner/mod invited them, awaiting their answer
//   pending  they asked to join  banned   removed and blocked from rejoining
const roomMemberSchema = new mongoose.Schema(
  {
    room: { type: ObjectId, ref: "Room", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "moderator", "member"], default: "member" },
    status: { type: String, enum: ["active", "pending", "invited", "banned"], default: "active" },
    invitedBy: { type: ObjectId, ref: "User" },
    // When the membership became active — used by the "late joiners" quiz policy.
    joinedAt: { type: Date },
  },
  { timestamps: true }
);

roomMemberSchema.index({ room: 1, user: 1 }, { unique: true });
roomMemberSchema.index({ user: 1, status: 1, updatedAt: -1 });
roomMemberSchema.index({ room: 1, status: 1, role: 1 });

export default mongoose.model("RoomMember", roomMemberSchema);
