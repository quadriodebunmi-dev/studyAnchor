import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 1500 },
    // who sees it
    audience: { type: String, enum: ["all", "students", "reps", "independent", "school"], default: "all" },
    schoolId: { type: ObjectId, ref: "School" },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    publishedAt: { type: Date },
    // Optional window for the in-app banner. Notifications are sent once, at publish.
    expiresAt: { type: Date },
    notifiedCount: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
announcementSchema.index({ status: 1, publishedAt: -1 });
export default mongoose.model("Announcement", announcementSchema);
