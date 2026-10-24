import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const cardSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, maxlength: 600 },
    answer: { type: String, required: true, maxlength: 1500 },
    explanation: { type: String, maxlength: 1500, default: "" },
    // Study progress for this card.
    status: { type: String, enum: ["new", "understood", "needs_review"], default: "new" },
    lastReviewedAt: { type: Date },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A saved set of flashcards, private to its owner.
const flashcardDeckSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Where it came from (provenance only; the deck outlives the material).
    materialId: { type: ObjectId, ref: "Material" },
    materialTitle: { type: String, maxlength: 200 },
    topic: { type: String, maxlength: 160, default: "" }, // "" = whole material
    cards: { type: [cardSchema], default: [] },
    lastStudiedAt: { type: Date },
  },
  { timestamps: true }
);

flashcardDeckSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model("FlashcardDeck", flashcardDeckSchema);
