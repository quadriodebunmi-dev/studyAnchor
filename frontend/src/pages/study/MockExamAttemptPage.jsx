import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Clock, Send, WifiOff, Info } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { Textarea } from "../../components/FormFields.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import { ReviewList } from "../../components/rooms/QuizResultView.jsx";
import useCountdown, { formatClock } from "../../hooks/useCountdown.js";
import { adjustTheoryMarks, checkExamAnswer, getExamAttempt, saveExamAnswers, submitExam } from "../../services/studyService.js";

// One route, two states: in progress (take it) or submitted (results).
export default function MockExamAttemptPage() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getExamAttempt(attemptId).then(setData).catch((e) => setError(e.message || "Attempt not found.")); }, [attemptId]);
  if (error) return <AppShell><p className="py-16 text-center text-danger">{error}</p></AppShell>;
  if (!data) return <AppShell><InlineLoader /></AppShell>;
  return data.attempt.status === "in_progress" ? <Taking initial={data} attemptId={attemptId} onDone={setData} /> : <Results data={data} attemptId={attemptId} onChange={setData} />;
}

function Taking({ initial, attemptId, onDone }) {
  const toast = useToast();
  const { exam, questions } = initial;
  const [answers, setAnswers] = useState(initial.answers || {});
  const [checked, setChecked] = useState(() => Object.fromEntries((initial.attempt.checked || []).map((id) => [id, null])));
  const [saveState, setSaveState] = useState("saved");
  const [busy, setBusy] = useState(false);
  const ref = useRef(initial.answers || {});
  const dirty = useRef(false);
  const submitted = useRef(false);
  const remaining = useCountdown(initial.attempt.expiresAt, initial.attempt.serverTime);

  const save = useCallback(async () => {
    if (!dirty.current || submitted.current) return;
    setSaveState("saving");
    const snap = ref.current;
    try { await saveExamAnswers(attemptId, snap); if (ref.current === snap) dirty.current = false; setSaveState("saved"); }
    catch (e) {
      if (e.code === "TIME_EXPIRED" || e.code === "ALREADY_SUBMITTED") { submitted.current = true; getExamAttempt(attemptId).then(onDone); return; }
      setSaveState("offline");
    }
  }, [attemptId, onDone]);

  useEffect(() => { const t = setTimeout(save, 1200); return () => clearTimeout(t); }, [answers, save]);
  useEffect(() => { if (saveState !== "offline") return undefined; const id = setInterval(save, 5000); return () => clearInterval(id); }, [saveState, save]);
  useEffect(() => { const warn = (e) => { if (!submitted.current) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, []);

  function setAnswer(qid, value) {
    if (qid in checked) return; // locked after "check"
    const next = { ...ref.current, [qid]: value };
    ref.current = next; dirty.current = true; setAnswers(next); setSaveState("saving");
  }

  const finish = useCallback(async (auto = false) => {
    if (submitted.current) return;
    submitted.current = true; setBusy(true);
    try { const r = await submitExam(attemptId, ref.current); if (auto) toast("Time's up — exam submitted.", "info"); onDone(r); window.scrollTo(0, 0); }
    catch (e) { submitted.current = false; setBusy(false); toast(e.message || "Couldn't submit. Check your connection.", "error"); }
  }, [attemptId, onDone, toast]);
  useEffect(() => { if (remaining === 0) finish(true); }, [remaining, finish]);

  async function check(q) {
    await save();
    try { const r = await checkExamAnswer(attemptId, q._id); setChecked((c) => ({ ...c, [q._id]: r })); }
    catch (e) { toast(e.message || "Couldn't check.", "error"); }
  }

  const done = (q) => (q.type === "objective" ? Number.isInteger(answers[q._id]?.selectedIndex) : Boolean(answers[q._id]?.text?.trim()));
  const unanswered = questions.filter((q) => !done(q)).length;
  const low = remaining !== null && remaining < 60000;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="lv-safe-top sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="min-w-0"><p className="truncate font-display font-semibold">{exam.title}</p><p className="text-xs lv-meta">{questions.length - unanswered}/{questions.length} answered</p></div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs lv-meta">{saveState === "offline" ? <><WifiOff className="h-3.5 w-3.5 text-danger" />Offline</> : saveState === "saving" ? "Saving…" : <><Check className="h-3.5 w-3.5 text-success" />Saved</>}</span>
          {remaining !== null && <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${low ? "bg-danger/15 text-danger" : "bg-slate-100 dark:bg-slate-800"}`}><Clock className="h-4 w-4" />{formatClock(remaining)}</span>}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28">
        {questions.map((q, i) => {
          const res = checked[q._id];
          const locked = q._id in checked;
          return (
            <section key={q._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between"><p className="text-xs lv-meta">Question {i + 1} · {q.marks} mark(s)</p><Badge tone="violet">{q.topic}</Badge></div>
              <p className="mt-1 whitespace-pre-wrap font-medium">{q.prompt}</p>
              {q.type === "objective" ? (
                <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Question ${i + 1}`}>
                  {q.options.map((o, idx) => {
                    const on = answers[q._id]?.selectedIndex === idx;
                    const tone = res ? (idx === res.correctIndex ? "border-success bg-success/10" : on ? "border-danger bg-danger/10" : "border-slate-200 dark:border-slate-700") : on ? "border-accent bg-accent/20" : "border-slate-200 hover:border-slate-400 dark:border-slate-700";
                    return <button type="button" key={idx} role="radio" aria-checked={on} disabled={locked} onClick={() => setAnswer(q._id, { selectedIndex: idx })} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm ${tone}`}><span className="text-xs text-slate-400">{String.fromCharCode(65 + idx)}</span>{o}</button>;
                  })}
                  {exam.explanationMode === "immediate" && !locked && <Button size="sm" variant="outline" disabled={!Number.isInteger(answers[q._id]?.selectedIndex)} onClick={() => check(q)}>Check answer</Button>}
                  {res && <p className="rounded-xl bg-primary/5 p-3 text-sm"><b>{res.correct ? "Correct. " : "Not quite. "}</b>{res.explanation}</p>}
                </div>
              ) : <div className="mt-4"><Textarea rows={6} maxLength={6000} placeholder="Write your answer…" value={answers[q._id]?.text || ""} onChange={(e) => setAnswer(q._id, { text: e.target.value })} aria-label={`Answer to question ${i + 1}`} /></div>}
            </section>
          );
        })}
      </div>

      <div className="lv-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-xs lv-meta">{unanswered ? `${unanswered} unanswered` : "All answered"}</p>
          <Button disabled={busy} onClick={() => (unanswered === 0 || window.confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) && finish(false)}><Send className="h-4 w-4" />{busy ? "Submitting…" : "Submit exam"}</Button>
        </div>
      </div>
    </div>
  );
}

const LEVEL = { strong: ["Strong", "green"], developing: ["Developing", "amber"], weak: ["Needs work", "red"], insufficient_data: ["Too few questions", "slate"] };

function Results({ data, attemptId, onChange }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { attempt, review, topics, exam } = data;
  const [marks, setMarks] = useState({});
  const theory = review.filter((q) => q.type === "theory");

  async function apply(body) {
    try { onChange(await adjustTheoryMarks(attemptId, body)); toast("Marks updated", "success"); } catch (e) { toast(e.message || "Couldn't update marks.", "error"); }
  }

  return (
    <AppShell>
      <button onClick={() => navigate("/study/exams")} className="mb-3 text-sm lv-meta hover:underline">← All exams</button>
      <h1 className="text-2xl font-bold">{exam.title}</h1>
      {data.lateNote && <p className="mt-2 text-sm text-warning">{data.lateNote}</p>}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
        <p className="font-display text-4xl font-bold">{attempt.score}<span className="text-xl text-slate-400"> / {attempt.maxScore}</span></p>
        <p className="mt-1 text-lg font-semibold text-primary">{attempt.percentage}%</p>
        {attempt.gradingStatus !== "complete" && (
          <div className="mx-auto mt-3 max-w-md rounded-xl bg-warning/10 p-3 text-left text-xs text-warning">
            <p className="flex items-start gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{attempt.gradingNote}</p>
            {attempt.gradingStatus === "provisional" && <Button size="sm" variant="outline" className="mt-2" onClick={() => apply({ acceptAi: true })}>Accept the AI marks</Button>}
          </div>
        )}
      </div>

      {topics?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-lg font-semibold">By topic</h2>
          <ul className="space-y-2">
            {topics.map((t) => (
              <li key={t.topic} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{t.topic}</span><span>{t.marks}/{t.maxMarks} · {t.percentage}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className={`h-full ${t.percentage >= 75 ? "bg-success" : t.percentage >= 50 ? "bg-warning" : "bg-danger"}`} style={{ width: `${t.percentage}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {theory.length > 0 && attempt.gradingStatus !== "complete" && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display font-semibold">Mark your written answers</h2>
          <p className="text-xs lv-meta">Compare with the model answer, then enter the marks you'd give.</p>
          <div className="mt-3 space-y-3">
            {theory.map((q) => (
              <div key={q._id} className="grid items-center gap-2 sm:grid-cols-[1fr_7rem]"><p className="text-sm">{q.prompt.slice(0, 120)}{q.prompt.length > 120 && "…"}</p><input type="number" min="0" max={q.marks} step="0.5" value={marks[q._id] ?? q.marksAwarded ?? ""} onChange={(e) => setMarks((m) => ({ ...m, [q._id]: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder={`/ ${q.marks}`} aria-label="Marks" /></div>
            ))}
          </div>
          <Button className="mt-3" size="sm" onClick={() => apply({ marks: Object.fromEntries(Object.entries(marks).filter(([, v]) => v !== "")) })}>Save my marks</Button>
        </section>
      )}

      <section className="mt-6"><h2 className="mb-3 font-display text-lg font-semibold">Review</h2><ReviewList review={review} /></section>
    </AppShell>
  );
}
