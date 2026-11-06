import React, { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Sparkles, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import UpgradeNotice, { isUpgradeError } from "../../components/UpgradeNotice.jsx";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Pager from "../../components/Pager.jsx";
import { Textarea } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import CameraCapture, { cameraSupported } from "../../components/CameraCapture.jsx";
import { prepareImage } from "../../utils/image.js";
import { answerSnap, answerTypedQuestion, deleteSnap, extractSnap, snapHistory } from "../../services/studyService.js";

const CONF = { high: ["Confident", "green"], medium: ["Fairly sure", "amber"], low: ["Not sure — double-check", "red"] };

function AnswerCard({ answer }) {
  const [label, tone] = CONF[answer.confidence] || CONF.low;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2"><h3 className="font-display font-semibold">Answer</h3><Badge tone={tone}>{label}</Badge></div>
      {answer.caveats && <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{answer.caveats}</p>}
      {answer.finalAnswer ? <p className="whitespace-pre-wrap rounded-xl bg-success/10 p-3 text-sm font-medium">{answer.finalAnswer}</p> : <p className="text-sm lv-meta">There isn't enough information to give a reliable final answer — see the notes above.</p>}
      {answer.steps?.length > 0 && <div><h4 className="mb-1.5 text-sm font-semibold">How to work it out</h4><ol className="list-decimal space-y-1.5 pl-5 text-sm">{answer.steps.map((s, i) => <li key={i} className="whitespace-pre-wrap">{s}</li>)}</ol></div>}
      {answer.hints?.length > 0 && <div><h4 className="mb-1.5 text-sm font-semibold">Hints to try first</h4><ul className="list-disc space-y-1 pl-5 text-sm">{answer.hints.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      {answer.conceptsToReview?.length > 0 && <div><h4 className="mb-1.5 text-sm font-semibold">Review these topics</h4><div className="flex flex-wrap gap-1.5">{answer.conceptsToReview.map((c, i) => <Badge key={i} tone="violet">{c}</Badge>)}</div></div>}
    </div>
  );
}

export default function SnapQuestionPage() {
  const toast = useToast();
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState("start"); // start | reading | edit | solving | done
  const [snap, setSnap] = useState(null); // { snapId, confidence, notes, needsReview }
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(null);
  const [hp, setHp] = useState(1);
  const [typed, setTyped] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const loadHistory = () => snapHistory({ page: hp }).then(setHistory).catch(() => setHistory({ history: [], pagination: null }));
  useEffect(() => { loadHistory(); }, [hp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function reset() { setStep("start"); setSnap(null); setText(""); setAnswer(null); setError(""); setPreview(null); setTyped(false); }

  // Shared by the in-app camera, the phone camera app and the gallery.
  async function handleImage(raw) {
    if (!raw) return;
    setError(""); setAnswer(null); setUpgrade(false);
    setStep("reading");
    try {
      // Resize + re-encode to JPEG first: raw phone photos are huge and often HEIC.
      const file = await prepareImage(raw);
      setPreview(URL.createObjectURL(file));
      const r = await extractSnap(file);
      setSnap(r); setText(r.text); setStep("edit");
    } catch (err) {
      setPreview(null);
      setUpgrade(isUpgradeError(err));
      const tooBig = err?.status === 413 || err?.message === "Network error. Please try again.";
      setError(err?.message && !tooBig ? err.message : "Couldn't upload that photo. Check your connection and try again.");
      setStep("start");
    }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleImage(file);
  }

  function openCamera() {
    setError("");
    // Live camera inside the app; if it isn't supported, use the device's camera app instead.
    if (cameraSupported()) setCameraOpen(true);
    else camRef.current?.click();
  }

  async function solve() {
    setError(""); setStep("solving");
    try {
      const r = typed && !snap ? await answerTypedQuestion(text) : await answerSnap(snap.snapId, text);
      setAnswer(r.answer); setStep("done"); loadHistory();
    } catch (err) { setUpgrade(isUpgradeError(err)); setError(err.message || "Couldn't get an answer."); setStep("edit"); }
  }

  async function remove(id) {
    await deleteSnap(id).catch(() => {});
    toast("Removed from history", "success");
    loadHistory();
  }

  return (
    <AppShell>
      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => { setCameraOpen(false); handleImage(file); }}
          onUnavailable={(err) => {
            setCameraOpen(false);
            const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
            setError(denied ? "Camera access is blocked. Allow it in your browser settings, or pick a photo instead." : "We couldn't start the camera. Pick a photo instead.");
            if (!denied) camRef.current?.click();
          }}
        />
      )}
      <h1 className="text-2xl font-bold">Snap a Question</h1>
      <p className="text-sm lv-meta">Take a clear photo of a question. We read it, you check the text, then you get an explanation.</p>

      <div className="mt-6 max-w-2xl space-y-5">
        {upgrade && <UpgradeNotice message={error} />}
        {step === "start" && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={openCamera}><Camera className="h-4 w-4" />Take a photo</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><ImageIcon className="h-4 w-4" />Choose from gallery</Button>
              <Button variant="ghost" onClick={() => { setTyped(true); setStep("edit"); }}>Type it instead</Button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFile} />
            <p className="mt-4 text-xs lv-meta">Tips: good light, hold steady, fill the frame with just the question. Photos are read and discarded — we don't store them.</p>
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          </div>
        )}

        {step === "reading" && (
          <div className="space-y-3 text-center">{preview && <img src={preview} alt="Your photo" className="mx-auto max-h-64 rounded-xl" />}<p className="text-sm lv-meta">Reading your question…</p></div>
        )}

        {(step === "edit" || step === "solving" || step === "done") && (
          <div className="space-y-3">
            {preview && <img src={preview} alt="Your photo" className="max-h-48 rounded-xl" />}
            {snap && <div className="flex items-center gap-2"><Badge tone={snap.confidence === "high" ? "green" : snap.confidence === "medium" ? "amber" : "red"}>Read confidence: {snap.confidence}</Badge>{snap.notes && <span className="text-xs lv-meta">{snap.notes}</span>}</div>}
            {snap?.needsReview && <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />We weren't fully sure we read this correctly. Please check and fix the text before continuing.</p>}
            <label className="block text-sm font-medium" htmlFor="snap-text">{typed ? "Your question" : "What we read — fix anything that's wrong"}</label>
            <Textarea id="snap-text" rows={5} maxLength={6000} value={text} onChange={(e) => setText(e.target.value)} />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={solve} disabled={step === "solving" || text.trim().length < 3}><Sparkles className="h-4 w-4" />{step === "solving" ? "Working it out…" : step === "done" ? "Answer again" : "Explain this"}</Button>
              <Button variant="ghost" onClick={reset}><RefreshCw className="h-4 w-4" />Start over</Button>
            </div>
          </div>
        )}

        {answer && <AnswerCard answer={answer} />}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg font-semibold">Recent questions</h2>
        {history === null ? <p className="text-sm lv-meta">Loading…</p> : history.history.length === 0 ? <p className="text-sm lv-meta">Questions you've solved will show up here.</p> : (
          <>
            <ul className="space-y-3">
              {history.history.map((h) => (
                <li key={h._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium"><span className="line-clamp-2 align-top">{h.text}</span></summary>
                    <div className="mt-3"><AnswerCard answer={h.answer} /><Button size="sm" variant="ghost" className="mt-2 text-danger" onClick={() => remove(h._id)}><Trash2 className="h-3.5 w-3.5" />Remove</Button></div>
                  </details>
                </li>
              ))}
            </ul>
            <Pager pagination={history.pagination} onPageChange={setHp} />
          </>
        )}
      </section>
    </AppShell>
  );
}