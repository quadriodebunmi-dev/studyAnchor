import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A discussion room. Membership lives in RoomMember; this document is only the
// room's identity and settings.
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    topic: { type: String, trim: true, maxlength: 80, default: "" },
    description: { type: String, trim: true, maxlength: 600, default: "" },
    mood: { type: String, enum: ["social", "revision", "brainstorming", "daily_study"], default: "revision" },
    creator: { type: ObjectId, ref: "User", required: true, index: true },

    // public  -> listed in Discover. private -> invisible except to members/invitees.
    visibility: { type: String, enum: ["public", "private"], default: "public", index: true },
    // How people get in: "open" = instantly, "approval" = owner/moderator approves.
    // (Private rooms are always approval-based; this only matters for public ones.)
    joinPolicy: { type: String, enum: ["open", "approval"], default: "open" },
    // "school" = only members of `schoolId` can discover it; "everyone" = any signed-in user.
    audience: { type: String, enum: ["everyone", "school"], default: "everyone" },
    // Private rooms: share /rooms/join/<code>; the code only lets someone ASK to join.
    inviteCode: { type: String, index: true, sparse: true },

    // Optional academic context. Always validated against the creator's school.
    schoolId: { type: ObjectId, ref: "School", index: true },
    department: { type: String, trim: true, default: "" },
    courseId: { type: ObjectId, ref: "Course" },
    materialId: { type: ObjectId, ref: "Material" },

    memberCount: { type: Number, default: 1, min: 0 }, // denormalised; kept in step with RoomMember
    lastActivityAt: { type: Date, default: Date.now, index: true },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

roomSchema.index({ name: "text", topic: "text", description: "text" });
roomSchema.index({ visibility: 1, archivedAt: 1, lastActivityAt: -1 });
roomSchema.index({ visibility: 1, audience: 1, schoolId: 1, lastActivityAt: -1 });

export default mongoose.model("Room", roomSchema);
