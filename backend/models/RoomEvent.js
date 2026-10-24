import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// The room's activity feed: who joined, which quiz opened, whose results were
// released. Written by controllers via utils/roomEvents.js; trimmed after 90 days.
const roomEventSchema = new mongoose.Schema(
  {
    room: { type: ObjectId, ref: "Room", required: true },
    type: {
      type: String,
      required: true,
      enum: ["member_joined", "member_left", "member_removed", "role_changed", "quiz_published", "quiz_closed", "results_released", "room_updated"],
    },
    actor: { type: ObjectId, ref: "User" },
    subject: { type: ObjectId, ref: "User" },
    quiz: { type: ObjectId, ref: "RoomQuiz" },
    text: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

roomEventSchema.index({ room: 1, createdAt: -1 });
roomEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("RoomEvent", roomEventSchema);
