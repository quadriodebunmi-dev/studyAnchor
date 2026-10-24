import mongoose from "mongoose";
// Admin-editable runtime settings: one document per key ("overrides", "subscriptions").
const platformSettingSchema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true }, value: { type: mongoose.Schema.Types.Mixed, default: {} }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } },
  { timestamps: true }
);
export default mongoose.model("PlatformSetting", platformSettingSchema);
