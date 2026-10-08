import mongoose from "mongoose";

// One small document per (user, material): what this person has done with it.
// It powers the feed's "topics you're interested in" — see utils/feedRanking.js.
// Counters are updated in place (upsert), so the collection grows with the
// number of materials a person has *touched*, not with every click, and old
// activity expires by itself.
const interactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    // Copied from the material the first time it's touched, so building a
    // student's interest profile never has to join back to Material.
    topics: { type: [String], default: [] },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    quizzes: { type: Number, default: 0 },
    bookmarked: { type: Boolean, default: false },
    lastAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

interactionSchema.index({ user: 1, material: 1 }, { unique: true });
interactionSchema.index({ user: 1, lastAt: -1 });
// Interest fades: forget activity older than ~6 months.
interactionSchema.index({ lastAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("Interaction", interactionSchema);
