import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw, Pencil, Trash2, Plus, Shuffle } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Modal from "../../components/Modal.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Field, Input, Textarea } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { addCard, deleteCard, getDeck, updateCard } from "../../services/studyService.js";

export default function FlashcardStudyPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [deck, setDeck] = useState(null);
  const [mode, setMode] = useState("all"); // all | review
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(null);
  const [order, setOrder] = useState(null);

  const load = useCallback(() => getDeck(deckId).then((r) => setDeck(r.deck)).catch(() => navigate("/study/flashcards")), [deckId, navigate]);
  useEffect(() => { load(); }, [load]);

  const cards = useMemo(() => {
    if (!deck) return [];
    let list = mode === "review" ? deck.cards.filter((c) => c.status !== "understood") : deck.cards;
    if (order) { const pos = new Map(order.map((id, i) => [id, i])); list = [...list].sort((a, b) => (pos.get(a._id) ?? 0) - (pos.get(b._id) ?? 0)); }
    return list;
  }, [deck, mode, order]);

  useEffect(() => { setIdx(0); setFlipped(false); }, [mode, order]);
  useEffect(() => { if (idx >= cards.length && cards.length) setIdx(cards.length - 1); }, [cards.length, idx]);

  const card = cards[idx];
  const understood = deck?.cards.filter((c) => c.status === "understood").length || 0;

  async function mark(status) {
    try {
      await updateCard(deckId, card._id, { status });
      setDeck((d) => ({ ...d, cards: d.cards.map((c) => (c._id === card._id ? { ...c, status } : c)) }));
      setFlipped(false);
      if (mode === "all") setIdx((i) => Math.min(i + 1, cards.length - 1));
    } catch (e) { toast(e.message || "Couldn't save progress.", "error"); }
  }

  async function saveCard() {
    try {
      if (editing._id) await updateCard(deckId, editing._id, editing); else await addCard(deckId, editing);
      setEditing(null); load();
    } catch (e) { toast(e.message || "Couldn't save the card.", "error"); }
  }

  async function removeCard() {
    if (!window.confirm("Delete this card?")) return;
    await deleteCard(deckId, card._id).catch(() => {});
    load();
  }

  if (!deck) return <AppShell><InlineLoader /></AppShell>;

  return (
    <AppShell>
      <button onClick={() => navigate("/study/flashcards")} className="mb-3 inline-flex items-center gap-1 text-sm lv-meta"><ArrowLeft className="h-4 w-4" />All decks</button>
      <h1 className="text-2xl font-bold">{deck.title}</h1>
      <p className="text-sm lv-meta">{understood} of {deck.cards.length} understood</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={mode === "all" ? "primary" : "outline"} onClick={() => setMode("all")}>All cards</Button>
        <Button size="sm" variant={mode === "review" ? "primary" : "outline"} onClick={() => setMode("review")}>Needs review ({deck.cards.length - understood})</Button>
        <Button size="sm" variant="ghost" onClick={() => setOrder(deck.cards.map((c) => c._id).sort(() => Math.random() - 0.5))}><Shuffle className="h-3.5 w-3.5" />Shuffle</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing({ question: "", answer: "", explanation: "" })}><Plus className="h-3.5 w-3.5" />Add card</Button>
      </div>

      {!card ? (
        <p className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm dark:border-slate-700">{mode === "review" ? "🎉 Nothing left to review!" : "This deck has no cards."}</p>
      ) : (
        <div className="mx-auto mt-6 max-w-xl">
          <p className="mb-2 text-center text-xs lv-meta">Card {idx + 1} of {cards.length}{card.status !== "new" && ` · ${card.status === "understood" ? "understood" : "needs review"}`}</p>
          <button type="button" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Show question" : "Show answer"}
            className="flex min-h-[14rem] w-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lift transition-colors hover:border-accent dark:border-slate-800 dark:bg-slate-900">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide lv-meta">{flipped ? "Answer" : "Question"}</span>
            <span className="whitespace-pre-wrap text-lg font-medium">{flipped ? card.answer : card.question}</span>
            {flipped && card.explanation && <span className="mt-3 text-sm lv-meta">{card.explanation}</span>}
            {!flipped && <span className="mt-4 text-xs lv-meta">Tap to reveal</span>}
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>Previous</Button>
            <Button variant="outline" onClick={() => mark("needs_review")}><RotateCcw className="h-4 w-4" />Needs review</Button>
            <Button onClick={() => mark("understood")}><Check className="h-4 w-4" />Got it</Button>
            <Button variant="outline" onClick={() => { setIdx((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }} disabled={idx >= cards.length - 1}>Next</Button>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing({ ...card })}><Pencil className="h-3.5 w-3.5" />Edit</Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={removeCard}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing._id ? "Edit card" : "Add card"} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <Field label="Question"><Textarea rows={2} maxLength={600} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} /></Field>
            <Field label="Answer"><Textarea rows={3} maxLength={1500} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} /></Field>
            <Field label="Explanation (optional)"><Input value={editing.explanation || ""} maxLength={1500} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={!editing.question.trim() || !editing.answer.trim()} onClick={saveCard}>Save</Button></div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
