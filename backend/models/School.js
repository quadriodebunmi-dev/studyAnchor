import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    domain: { type: String, trim: true, lowercase: true }, // e.g. "unilag.edu.ng"
    city: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    orgUnitLabel: { type: String, enum: ["Faculty", "College", "School"], default: "Faculty" },
    termStructure: { type: String, enum: ["semester", "trimester", "term"], default: "semester" },
    levels: { type: [String], default: ["100", "200", "300", "400"] },
  },
  { timestamps: true }
);

schoolSchema.index({ name: "text" });

export default mongoose.model("School", schoolSchema);
