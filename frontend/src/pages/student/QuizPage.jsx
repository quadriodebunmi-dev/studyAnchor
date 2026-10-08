import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, CheckCircle2, XCircle, Copy, Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import { submitQuiz } from "../../services/quizService.js";
import { useToast } from "../../components/Toast.jsx";

const card = "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const muted = "text-slate-500 dark:text-slate-400";
const letter = (i) => String.fromCharCode(65 + i);

// Copy-to-clipboard button for the question text and its correct answer.
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — nothing to recover from here.
    }
  }
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${muted} hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied" : `Copy ${label}`}</span>
    </button>
  );
}

export default function QuizPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const quiz = state?.quiz;
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();
  const showToast = useToast();

  // Keyboard: press 1–4 (or however many options there are) to pick an answer.
  useEffect(() => {
    if (!quiz || result) return;
    const count = quiz.questions[current].options.length;
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) setAnswers((a) => ({ ...a, [current]: n - 1 }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, result, current]);

  if (!quiz) {
    return (
      <AppShell>
        <p className={muted}>This quiz session has expired — generate a new one from the material page.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>Back to Dashboard</Button>
      </AppShell>
    );
  }

  const total = quiz.questions.length;
  const answeredCount = Object.keys(answers).length;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const orderedAnswers = quiz.questions.map((_, i) => answers[i]);
      const res = await submitQuiz(id, orderedAnswers);
      setResult(res);
      window.scrollTo({ top: 0 });
      showToast("Quiz completed", "success");
    } catch (err) {
      showToast(err?.message || "Couldn't submit your quiz. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setFilter("all");
    window.scrollTo({ top: 0 });
  }

  /* ---------- RESULTS ---------- */
  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    const tone = pct >= 70 ? "success" : pct >= 40 ? "warning" : "danger";
    const message = pct >= 70 ? "Great work" : pct >= 40 ? "Getting there" : "Worth another look";
    const missed = result.results.filter((r) => !r.correct).length;
    const rows = result.results.map((r, idx) => ({ r, idx })).filter(({ r }) => filter === "all" || !r.correct);

    return (
      <AppShell>
        <div className={`${card} p-6 text-center`} role="status">
          <p className={`text-sm ${muted}`}>{message}</p>
          <p className={`mt-1 text-5xl font-bold text-${tone}`}>{result.score}<span className={`text-2xl font-semibold ${muted}`}>/{result.total}</span></p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-full rounded-full bg-${tone}`} style={{ width: `${pct}%` }} />
          </div>
          <p className={`mt-2 text-sm ${muted}`}>{pct}% correct</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={retake} className="w-full sm:w-auto"><RotateCcw className="mr-1.5 inline h-4 w-4" />Retake quiz</Button>
            <Button variant="outline" onClick={() => navigate(-2)} className="w-full sm:w-auto">Back to material</Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Review your answers</h2>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800" role="group" aria-label="Filter answers">
            {[["all", `All (${result.total})`], ["missed", `Missed (${missed})`]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-lg px-3 py-1.5 font-medium ${filter === key ? "bg-white shadow-sm dark:bg-slate-900" : muted}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {rows.length === 0 && <p className={`${card} p-5 text-sm ${muted}`}>You got every question right. Nothing to review.</p>}
          {rows.map(({ r, idx }) => (
            <div key={idx} className={`${card} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {r.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />}
                  <p className="font-medium leading-snug">{idx + 1}. {r.question}</p>
                </div>
                <CopyButton text={r.question} label="question" />
              </div>

              <div className="mt-3 space-y-2">
                {r.options.map((opt, oi) => {
                  const isCorrect = oi === r.correctAnswer;
                  const isPicked = answers[idx] === oi;
                  const style = isCorrect
                    ? "border-success/50 bg-success/10"
                    : isPicked
                    ? "border-danger/50 bg-danger/10"
                    : "border-slate-200 dark:border-slate-700";
                  return (
                    <div key={oi} className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${style}`}>
                      <span className={`mt-0.5 text-xs font-semibold ${muted}`}>{letter(oi)}</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs font-medium text-success">Correct</span>}
                      {isPicked && !isCorrect && <span className="text-xs font-medium text-danger">Your answer</span>}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-start justify-between gap-3">
                <p className={`text-sm leading-relaxed ${muted}`}>{r.explanation}</p>
                <CopyButton text={r.options[r.correctAnswer]} label="answer" />
              </div>
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  /* ---------- TAKING THE QUIZ ---------- */
  const q = quiz.questions[current];
  const isLast = current === total - 1;
  const firstUnanswered = quiz.questions.findIndex((_, i) => answers[i] === undefined);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
          <h1 className="truncate text-lg font-bold sm:text-xl">Quiz — {quiz.materialTitle}</h1>
        </div>

        <div className="mt-4">
          <div className={`flex justify-between text-sm ${muted}`}>
            <span>Question {current + 1} of {total}</span>
            <span>{answeredCount} answered</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} aria-label="Questions answered"
          >
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(answeredCount / total) * 100}%` }} />
          </div>
        </div>

        {/* Jump between questions; answered ones are tinted so gaps are easy to spot. */}
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Question navigator">
          {quiz.questions.map((_, i) => {
            const answered = answers[i] !== undefined;
            const active = i === current;
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-current={active ? "step" : undefined}
                aria-label={`Question ${i + 1}${answered ? ", answered" : ", not answered"}`}
                className={`h-9 w-9 rounded-lg border text-sm font-medium transition-colors ${
                  active ? "border-primary bg-primary text-white" : answered ? "border-primary/40 bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className={`${card} mt-5 p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="q-title" className="text-lg font-semibold leading-snug">{q.question}</h2>
            <Badge tone={q.difficulty === "Hard" ? "red" : q.difficulty === "Easy" ? "green" : "amber"}>{q.difficulty}</Badge>
          </div>

          <div role="radiogroup" aria-labelledby="q-title" className="mt-5 space-y-3">
            {q.options.map((opt, oi) => {
              const selected = answers[current] === oi;
              return (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-[15px] leading-snug transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
                    selected ? "border-primary bg-primary/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${current}`}
                    checked={selected}
                    onChange={() => setAnswers((a) => ({ ...a, [current]: oi }))}
                    className="sr-only"
                  />
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${selected ? "bg-primary text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{letter(oi)}</span>
                  <span className="pt-0.5">{opt}</span>
                </label>
              );
            })}
          </div>
          <p className={`mt-4 hidden text-xs sm:block ${muted}`}>Tip: press 1–{q.options.length} to choose an answer.</p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
            <ChevronLeft className="mr-1 inline h-4 w-4" />Previous
          </Button>
          {isLast ? (
            <Button onClick={handleSubmit} disabled={answeredCount < total || submitting}>
              {submitting ? "Submitting..." : "Submit quiz"}
            </Button>
          ) : (
            <Button onClick={() => setCurrent((c) => c + 1)}>
              Next<ChevronRight className="ml-1 inline h-4 w-4" />
            </Button>
          )}
        </div>

        {isLast && answeredCount < total && (
          <p className={`mt-3 text-right text-sm ${muted}`}>
            {total - answeredCount} unanswered.{" "}
            <button onClick={() => setCurrent(firstUnanswered)} className="font-medium text-primary hover:underline">
              Go to question {firstUnanswered + 1}
            </button>
          </p>
        )}
      </div>
    </AppShell>
  );
}