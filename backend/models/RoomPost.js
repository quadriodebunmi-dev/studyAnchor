import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A discussion message. Replies are one level deep: `parent` always points at a
// top-level post. Removed posts are kept (so reply threads and reports still
// make sense) but their content is blanked.
const hasText = (v) => typeof v === "string" && v.trim().length > 0;
const roomPostSchema = new mongoose.Schema(
  {
    room: { type: ObjectId, ref: "Room", required: true },
    author: { type: ObjectId, ref: "User", required: true },
    parent: { type: ObjectId, ref: "RoomPost", default: null },
    // Text is optional when the message carries a photo or a sound.
    content: { type: String, default: "", trim: true, maxlength: 2000 },
    attachment: {
      kind: { type: String, enum: ["image", "audio"] },
      url: { type: String },
      publicId: { type: String },
      mime: { type: String },
      bytes: { type: Number },
      width: { type: Number },
      height: { type: Number },
      durationSec: { type: Number },
    },
    replyCount: { type: Number, default: 0 },
    editedAt: { type: Date },
    removedAt: { type: Date },
    removedBy: { type: ObjectId, ref: "User" },
    removalReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

roomPostSchema.pre("validate", function (next) {
  if (!hasText(this.content) && !this.attachment?.url) this.invalidate("content", "A message needs text, a photo or a sound.");
  next();
});

roomPostSchema.index({ room: 1, parent: 1, createdAt: -1 });
roomPostSchema.index({ parent: 1, createdAt: 1 });

export default mongoose.model("RoomPost", roomPostSchema);
