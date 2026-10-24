import mongoose from "mongoose";
import FlashcardDeck from "../models/FlashcardDeck.js";
import Material from "../models/Material.js";
import { PLATFORM } from "../config/platform.js";
import { canViewMaterial } from "../utils/materialAccess.js";
import { suggestTopics, generateFlashcards } from "../utils/aiStudy.js";
import { recordAIUsage, respondToAIError } from "../utils/aiGuard.js";
import { parsePageParams, pageMeta } from "../utils/pagination.js";
import { promptKey } from "../utils/quizEngine.js";
import { onFlashcardReviewed } from "../utils/rewardHooks.js";

const clean = (v, n) => String(v ?? "").trim().slice(0, n);

async function viewableMaterial(req, res, id) {
  if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: "Choose a material." }); return null; }
  const material = await Material.findById(id).select("title extractedText uploadedBy visibility status schoolId studyTopics studyTopicsAt");
  if (!material || !canViewMaterial(req.user, material)) { res.status(404).json({ message: "Material not found." }); return null; }
  return material;
}

function handleSourceError(err, res) {
  if (err?.name === "UnreadableDocumentError") { res.status(422).json({ code: err.code, message: err.message }); return true; }
  return respondToAIError(err, res);
}

// POST /api/study/flashcards/topics  body: { materialId }
export async function materialTopics(req, res, next) {
  try {
    const material = await viewableMaterial(req, res, req.body?.materialId); if (!material) return;
    // Topics rarely change for a given document, so they're cached on it.
    if (material.studyTopics?.length) return res.json({ topics: material.studyTopics, cached: true });
    try {
      const topics = await suggestTopics({ text: material.extractedText, title: material.title });
      recordAIUsage(req.user._id, "flashcards");
      await Material.updateOne({ _id: material._id }, { $set: { studyTopics: topics, studyTopicsAt: new Date() } });
      res.json({ topics, cached: false });
    } catch (err) {
      if (err?.name !== "UnreadableDocumentError") recordAIUsage(req.user._id, "flashcards", err);
      if (handleSourceError(err, res)) return;
      throw err;
    }
  } catch (err) { next(err); }
}

// POST /api/study/flashcards/generate  body: { materialId, topic?, count }
export async function generateDeck(req, res, next) {
  try {
    const material = await viewableMaterial(req, res, req.body?.materialId); if (!material) return;
    const topic = clean(req.body?.topic, 160);
    const count = Math.min(PLATFORM.flashcards.maxCards, Math.max(PLATFORM.flashcards.minCards, parseInt(req.body?.count, 10) || 10));
    let cards;
    try {
      cards = await generateFlashcards({ text: material.extractedText, title: material.title, topic, count });
      recordAIUsage(req.user._id, "flashcards");
    } catch (err) {
      if (err?.name !== "UnreadableDocumentError") recordAIUsage(req.user._id, "flashcards", err);
      if (handleSourceError(err, res)) return;
      throw err;
    }
    const deck = await FlashcardDeck.create({
      user: req.user._id, materialId: material._id, materialTitle: material.title, topic,
      title: clean(topic ? `${material.title} — ${topic}` : material.title, 120), cards,
    });
    res.status(201).json({ deck });
  } catch (err) { next(err); }
}

const summary = (d) => ({
  _id: d._id, title: d.title, topic: d.topic, materialTitle: d.materialTitle, materialId: d.materialId,
  total: d.cards.length, understood: d.cards.filter((c) => c.status === "understood").length,
  needsReview: d.cards.filter((c) => c.status === "needs_review").length,
  lastStudiedAt: d.lastStudiedAt, updatedAt: d.updatedAt, createdAt: d.createdAt,
});

// GET /api/study/flashcards
export async function listDecks(req, res, next) {
  try {
    const { page, limit, skip } = parsePageParams(req.query, { defaultLimit: 12, maxLimit: 40 });
    const filter = { user: req.user._id };
    const [decks, total] = await Promise.all([
      FlashcardDeck.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit),
      FlashcardDeck.countDocuments(filter),
    ]);
    res.json({ decks: decks.map(summary), pagination: pageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

async function ownDeck(req, res) {
  if (!mongoose.isValidObjectId(req.params.deckId)) { res.status(404).json({ message: "Deck not found." }); return null; }
  const deck = await FlashcardDeck.findOne({ _id: req.params.deckId, user: req.user._id });
  if (!deck) { res.status(404).json({ message: "Deck not found." }); return null; }
  return deck;
}

export async function getDeck(req, res, next) {
  try { const deck = await ownDeck(req, res); if (deck) res.json({ deck, summary: summary(deck) }); } catch (err) { next(err); }
}

export async function renameDeck(req, res, next) {
  try {
    const deck = await ownDeck(req, res); if (!deck) return;
    const title = clean(req.body?.title, 120);
    if (title.length < 1) return res.status(400).json({ message: "Enter a title." });
    deck.title = title;
    await deck.save();
    res.json({ summary: summary(deck) });
  } catch (err) { next(err); }
}

export async function deleteDeck(req, res, next) {
  try {
    if (mongoose.isValidObjectId(req.params.deckId)) await FlashcardDeck.deleteOne({ _id: req.params.deckId, user: req.user._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

const cardInput = (b) => ({ question: clean(b?.question, 600), answer: clean(b?.answer, 1500), explanation: clean(b?.explanation, 1500) });

export async function addCard(req, res, next) {
  try {
    const deck = await ownDeck(req, res); if (!deck) return;
    const c = cardInput(req.body);
    if (!c.question || !c.answer) return res.status(400).json({ message: "A card needs a question and an answer." });
    if (deck.cards.length >= PLATFORM.flashcards.maxDeckCards) return res.status(400).json({ message: `A deck can hold ${PLATFORM.flashcards.maxDeckCards} cards.` });
    if (deck.cards.some((x) => promptKey(x.question) === promptKey(c.question))) return res.status(409).json({ message: "This deck already has that question." });
    deck.cards.push(c);
    await deck.save();
    res.status(201).json({ card: deck.cards[deck.cards.length - 1] });
  } catch (err) { next(err); }
}

export async function updateCard(req, res, next) {
  try {
    const deck = await ownDeck(req, res); if (!deck) return;
    const card = deck.cards.id(req.params.cardId);
    if (!card) return res.status(404).json({ message: "Card not found." });
    const b = req.body || {};
    if (b.question !== undefined || b.answer !== undefined || b.explanation !== undefined) {
      const c = cardInput({ question: b.question ?? card.question, answer: b.answer ?? card.answer, explanation: b.explanation ?? card.explanation });
      if (!c.question || !c.answer) return res.status(400).json({ message: "A card needs a question and an answer." });
      Object.assign(card, c);
    }
    if (b.status !== undefined) {
      if (!["new", "understood", "needs_review"].includes(b.status)) return res.status(400).json({ message: "Invalid status." });
      card.status = b.status;
      card.lastReviewedAt = new Date();
      card.reviewCount = (card.reviewCount || 0) + 1;
      deck.lastStudiedAt = new Date();
      if (b.status !== "new") onFlashcardReviewed({ user: req.user, deckId: deck._id, cardId: card._id });
    }
    await deck.save();
    res.json({ card, summary: summary(deck) });
  } catch (err) { next(err); }
}

export async function deleteCard(req, res, next) {
  try {
    const deck = await ownDeck(req, res); if (!deck) return;
    const card = deck.cards.id(req.params.cardId);
    if (card) { card.deleteOne(); await deck.save(); }
    res.json({ summary: summary(deck) });
  } catch (err) { next(err); }
}
