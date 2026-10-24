import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Send, WifiOff, Check } from "lucide-react";
import Button from "../../components/Button.jsx";
import { Textarea } from "../../components/FormFields.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import useCountdown, { formatClock } from "../../hooks/useCountdown.js";
import { saveAnswers, startAttempt, submitAttempt } from "../../services/roomQuizService.js";

// A focused, distraction-free attempt screen: no sidebar, no search. Answers
// autosave; the server is the only authority on the deadline.
export default function QuizTakePage() {
  const { roomId, quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({});
  const [saveState, setSaveState] = useState("saved"); // saved | saving | offline
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const answersRef = useRef({});
  const submitted = useRef(false);

  useEffect(() => {
    startAttempt(roomId, quizId)
      .then((p) => { setPayload(p); setAnswers(p.answers || {}); answersRef.current = p.answers || {}; })
      .catch((e) => {
        if (e.code === "TIME_EXPIRED" || e.code === "NO_ATTEMPTS_LEFT" || e.code === "CLOSED" || e.code === "NOT_OPEN") toast(e.message, "info");
        if (["TIME_EXPIRED", "NO_ATTEMPTS_LEFT", "CLOSED", "NOT_OPEN"].includes(e.code)) return navigate(`/rooms/${roomId}/quizzes/${quizId}`, { replace: true });
        setError(e.message || "Couldn't open the quiz.");
      });
  }, [roomId, quizId, navigate, toast]);

  const remaining = useCountdown(payload?.attempt?.expiresAt, payload?.attempt?.serverTime);

  const save = useCallback(async () => {
    if (!dirty.current || submitted.current) return;
    setSaveState("saving");
    const snapshot = answersRef.current;
    try {
      await saveAnswers(roomId, quizId, snapshot);
      if (answersRef.current === snapshot) dirty.current = false;
      setSaveState("saved");
    } catch (e) {
      if (e.code === "TIME_EXPIRED" || e.code === "ALREADY_SUBMITTED") { submitted.current = true; toast(e.message, "info"); return navigate(`/rooms/${roomId}/quizzes/${quizId}`, { replace: true }); }
      setSaveState("offline");
    }
  }, [roomId, quizId, navigate, toast]);

  // Debounced autosave, plus a retry loop while offline.
  useEffect(() => {
    if (!payload) return undefined;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [answers, payload, save]);
  useEffect(() => {
    if (saveState !== "offline") return undefined;
    const id = setInterval(save, 5000);
    return () => clearInterval(id);
  }, [saveState, save]);

  // Don't let a stray refresh/close lose work silently.
  useEffect(() => {
    const warn = (e) => { if (!submitted.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function setAnswer(qid, value) {
    const next = { ...answersRef.current, [qid]: value };
    answersRef.current = next;
    dirty.current = true;
    setAnswers(next);
    setSaveState("saving");
  }

  const doSubmit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const r = await submitAttempt(roomId, quizId, answersRef.current);
      toast(auto ? "Time's up — your quiz was submitted." : r.lateNote || "Quiz submitted", "success");
      navigate(`/rooms/${roomId}/quizzes/${quizId}`, { replace: true });
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      toast(e.message || "Couldn't submit — check your connection and try again.", "error");
    }
  }, [roomId, quizId, navigate, toast]);

  // The clock reaching zero submits automatically (the server enforces it regardless).
  useEffect(() => { if (payload && remaining === 0) doSubmit(true); }, [remaining, payload, doSubmit]);

  if (error) return <div className="grid min-h-screen place-items-center p-6 text-center"><div><p className="text-danger">{error}</p><Button className="mt-4" onClick={() => navigate(`/rooms/${roomId}/quizzes/${quizId}`)}>Back</Button></div></div>;
  if (!payload) return <div className="grid min-h-screen place-items-center"><InlineLoader label="Opening your quiz…" /></div>;

  const { questions } = payload;
  const isAnswered = (q) => (q.type === "objective" ? Number.isInteger(answers[q._id]?.selectedIndex) : Boolean(answers[q._id]?.text?.trim()));
  const unanswered = questions.filter((q) => !isAnswered(q)).length;
  const low = remaining !== null && remaining < 60000;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="lv-safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-medium">{questions.length - unanswered}/{questions.length} answered</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs lv-meta" aria-live="polite">
              {saveState === "offline" ? <><WifiOff className="h-3.5 w-3.5 text-danger" />Offline — retrying</> : saveState === "saving" ? "Saving…" : <><Check className="h-3.5 w-3.5 text-success" />Saved</>}
            </span>
            {remaining !== null && <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${low ? "bg-danger/15 text-danger" : "bg-slate-100 dark:bg-slate-800"}`}><Clock className="h-4 w-4" />{formatClock(remaining)}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-32">
        {questions.map((q, i) => (
          <section key={q._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs lv-meta">Question {i + 1} · {q.marks} mark{q.marks === 1 ? "" : "s"}</p>
            <p className="mt-1 whitespace-pre-wrap font-medium">{q.prompt}</p>
            {q.type === "objective" ? (
              <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Question ${i + 1}`}>
                {q.options.map((o, idx) => {
                  const on = answers[q._id]?.selectedIndex === idx;
                  return (
                    <button type="button" key={idx} role="radio" aria-checked={on} onClick={() => setAnswer(q._id, { selectedIndex: idx })}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${on ? "border-accent bg-accent/20" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"}`}>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${on ? "border-accent bg-accent text-accent-fg" : "border-slate-400"}`}>{String.fromCharCode(65 + idx)}</span>{o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4"><Textarea rows={6} maxLength={6000} placeholder="Write your answer…" value={answers[q._id]?.text || ""} onChange={(e) => setAnswer(q._id, { text: e.target.value })} aria-label={`Answer to question ${i + 1}`} /></div>
            )}
          </section>
        ))}
      </main>

      <div className="lv-safe-bottom fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-xs lv-meta">{unanswered > 0 ? `${unanswered} unanswered` : "All questions answered"}</p>
          <Button disabled={submitting} onClick={() => { if (unanswered === 0 || window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) doSubmit(false); }}>
            <Send className="h-4 w-4" />{submitting ? "Submitting…" : "Submit quiz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
