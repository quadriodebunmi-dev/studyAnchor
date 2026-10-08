import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    // Multi-tenancy (Stage 1.3) — denormalized for direct filtering even
    // though it's reachable via courseId. See migration note in models/User.js.
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ["pdf", "pptx", "docx", "xlsx", "image"], required: true },
    size: { type: String },
    extractedText: { type: String, default: "" }, // used by the AI question generator
    downloads: { type: Number, default: 0 },
    quizzesGenerated: { type: Number, default: 0 },

    // Stage 2.2 — student uploads must be approved by a Course Rep before
    // other students can see them. Default "approved" keeps every existing
    // (rep-uploaded) row behaving exactly as before, with zero migration.
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String },
    reviewedAt: { type: Date },

    // "class"   -> shared with the class (students' go through Rep approval).
    // "private" -> a student's own upload: only they can see it, it shows on
    //              their dashboard, and it never needs approval.
    visibility: { type: String, enum: ["class", "private"], default: "class" },

    // Feed-ranking signals (see utils/feedRanking.js). Old documents simply
    // don't have them yet — every reader treats a missing value as 0 / derives
    // topics from the title. `npm run backfill:feed` fills them in.
    topics: { type: [String], default: [] }, // keywords used to match a student's interests
    bookmarkCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

materialSchema.index({ title: "text", description: "text" });

// Indexes for the paginated/feed queries (school feed, course page, "my uploads",
// review queue, topic-matched discovery).
materialSchema.index({ schoolId: 1, status: 1, visibility: 1, createdAt: -1 });
materialSchema.index({ courseId: 1, status: 1, createdAt: -1 });
materialSchema.index({ uploadedBy: 1, createdAt: -1 });
materialSchema.index({ status: 1, createdAt: -1 });
materialSchema.index({ topics: 1 });

export default mongoose.model("Material", materialSchema);
