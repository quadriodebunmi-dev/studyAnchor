import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layers, Plus, Sparkles, Trash2 } from "lucide-react";
import UpgradeNotice, { isUpgradeError } from "../../components/UpgradeNotice.jsx";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Modal from "../../components/Modal.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Pager from "../../components/Pager.jsx";
import MaterialPicker from "../../components/MaterialPicker.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import { Field, Input } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { deleteDeck, generateFlashcards, getMaterialTopics, listDecks } from "../../services/studyService.js";

export default function FlashcardsPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const load = () => listDecks({ page }).then(setData).catch(() => setData({ decks: [], pagination: null }));
  useEffect(() => { setData(null); load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(d) {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    await deleteDeck(d._id).catch(() => {});
    toast("Deck deleted", "success");
    load();
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Flashcards</h1><p className="text-sm lv-meta">Generate decks from your materials and track what you've mastered.</p></div>
        <Button onClick={() => setCreating(true)}><Sparkles className="h-4 w-4" />New deck</Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!data ? <CardSkeleton count={3} /> : data.decks.length === 0 ? (
          <EmptyState icon={<Layers className="h-7 w-7" />} title="No decks yet" message="Pick a PDF from your library and we'll turn it into flashcards." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create your first deck</Button>} />
        ) : data.decks.map((d) => {
          const pct = d.total ? Math.round((d.understood / d.total) * 100) : 0;
          return (
            <div key={d._id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <Link to={`/study/flashcards/${d._id}`} className="flex-1">
                <p className="font-display font-semibold leading-snug">{d.title}</p>
                <p className="mt-1 text-xs lv-meta">{d.total} cards{d.needsReview > 0 && ` · ${d.needsReview} to review`}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                <p className="mt-1 text-xs lv-meta">{pct}% understood</p>
              </Link>
              <Button size="sm" variant="ghost" className="mt-2 self-end text-danger" onClick={() => remove(d)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
            </div>
          );
        })}
      </div>
      {data && <Pager pagination={data.pagination} onPageChange={setPage} />}
      {creating && <CreateDeck onClose={() => setCreating(false)} />}
    </AppShell>
  );
}

function CreateDeck({ onClose }) {
  const navigate = useNavigate();
  const [material, setMaterial] = useState([]);
  const [topics, setTopics] = useState(null);
  const [topic, setTopic] = useState(""); // "" = whole material
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState(false);

  async function findTopics(m) {
    setMaterial(m); setTopics(null); setTopic(""); setError("");
    if (!m.length) return;
    setBusy("topics");
    try { setTopics((await getMaterialTopics(m[0]._id)).topics); } catch (e) { setUpgrade(isUpgradeError(e)); setError(e.message || "Couldn't read that material."); } finally { setBusy(""); }
  }
  async function generate() {
    setBusy("deck"); setError("");
    try { const deck = await generateFlashcards({ materialId: material[0]._id, topic, count: Number(count) }); navigate(`/study/flashcards/${deck._id}`); }
    catch (e) { setUpgrade(isUpgradeError(e)); setError(e.message || "Couldn't create the deck."); setBusy(""); }
  }

  return (
    <Modal title="New flashcard deck" onClose={onClose} wide>
      <div className="space-y-4">
        <MaterialPicker selected={material} onChange={findTopics} max={1} label="Choose a document" />
        {busy === "topics" && <p className="text-sm lv-meta">Finding topics…</p>}
        {topics && (
          <Field label="Topic">
            <div className="flex flex-wrap gap-2">
              {[{ title: "", label: "Whole document" }, ...topics.map((t) => ({ title: t.title, label: t.title }))].map((t) => (
                <button type="button" key={t.label} onClick={() => setTopic(t.title)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${topic === t.title ? "bg-primary text-primary-fg" : "bg-slate-100 dark:bg-slate-800"}`}>{t.label}</button>
              ))}
            </div>
          </Field>
        )}
        {material.length > 0 && <Field label="Number of cards"><Input type="number" min="3" max="40" value={count} onChange={(e) => setCount(e.target.value)} /></Field>}
        {upgrade ? <UpgradeNotice message={error} /> : error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" disabled={!material.length || !topics || busy === "deck"} onClick={generate}><Sparkles className="h-4 w-4" />{busy === "deck" ? "Creating…" : "Create deck"}</Button></div>
      </div>
    </Modal>
  );
}
