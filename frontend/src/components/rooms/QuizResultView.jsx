import React from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import Badge from "../Badge.jsx";

const pct = (n) => `${Math.round(n * 10) / 10}%`;

export function ResultSummary({ result }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm lv-meta">Your score</p>
      <p className="font-display text-4xl font-bold">{result.score}<span className="text-xl text-slate-400"> / {result.maxScore}</span></p>
      <p className="mt-1 text-lg font-semibold text-primary">{pct(result.percentage)}</p>
      {result.gradingStatus !== "complete" && (
        <p className="mx-auto mt-3 flex max-w-md items-start gap-2 rounded-xl bg-warning/10 p-3 text-left text-xs text-warning">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{result.gradingNote}
        </p>
      )}
    </div>
  );
}

export function ReviewList({ review }) {
  return (
    <ol className="space-y-3">
      {review.map((q, i) => (
        <li key={q._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium"><span className="mr-1.5 text-slate-400">{i + 1}.</span>{q.prompt}</p>
            <span className="flex shrink-0 items-center gap-1.5">
              {q.type === "objective" && q.correct !== null && (q.correct ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Correct" /> : <XCircle className="h-4 w-4 text-danger" aria-label="Incorrect" />)}
              <Badge tone={q.marksAwarded === null ? "amber" : "slate"}>{q.marksAwarded === null ? "Not marked" : `${q.marksAwarded}/${q.marks}`}</Badge>
            </span>
          </div>

          {q.type === "objective" ? (
            <ul className="mt-3 space-y-1.5">
              {q.options.map((o, idx) => {
                const mine = q.yourAnswer === idx;
                const right = q.correctIndex === idx;
                return (
                  <li key={idx} className={`rounded-lg border px-3 py-2 text-sm ${right ? "border-success/50 bg-success/10" : mine ? "border-danger/50 bg-danger/10" : "border-slate-200 dark:border-slate-700"}`}>
                    {o}{mine && <span className="ml-2 text-xs lv-meta">(your answer)</span>}{right && <span className="ml-2 text-xs text-success">(correct)</span>}
                  </li>
                );
              })}
              {q.yourAnswer === null && <li className="text-xs lv-meta">You didn't answer this question.</li>}
            </ul>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <div><p className="text-xs lv-meta">Your answer</p><p className="whitespace-pre-wrap rounded-lg bg-slate-100 p-3 dark:bg-slate-800">{q.yourAnswer || "No answer given."}</p></div>
              {q.expectedAnswer && <div><p className="text-xs lv-meta">Model answer</p><p className="whitespace-pre-wrap rounded-lg bg-success/10 p-3">{q.expectedAnswer}</p></div>}
            </div>
          )}

          {q.feedback && <p className="mt-2 text-sm"><span className="text-xs lv-meta">Feedback · </span>{q.feedback}</p>}
          {q.graderType === "ai" && <p className="mt-1 text-xs text-warning">{q.gradingStatus === "final" ? "AI-assisted marking, confirmed." : "Marked with AI assistance — awaiting confirmation. This mark may change."}</p>}
          {q.explanation && <p className="mt-2 rounded-lg bg-primary/5 p-3 text-sm"><span className="font-medium">Explanation: </span>{q.explanation}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Leaderboard({ data }) {
  if (!data) return null;
  if (!data.available) return <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm lv-meta dark:border-slate-700">{data.message}</p>;
  if (!data.entries.length) return <p className="text-sm lv-meta">No submissions yet.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase lv-meta"><tr><th className="px-4 py-2">Rank</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Score</th>{data.tieBreak === "time" && <th className="px-4 py-2">Time</th>}</tr></thead>
        <tbody>
          {data.entries.map((e, i) => (
            <tr key={i} className={`border-t border-slate-200 dark:border-slate-800 ${e.me ? "bg-accent/15 font-semibold" : ""}`}>
              <td className="px-4 py-2">{e.rank}</td>
              <td className="px-4 py-2">{e.name}{e.me && " (you)"}</td>
              <td className="px-4 py-2">{e.score}/{e.maxScore} · {pct(e.percentage)}{e.provisional && <span className="ml-2 text-xs text-warning" title="Some written answers aren't finalised yet">provisional</span>}</td>
              {data.tieBreak === "time" && <td className="px-4 py-2">{e.durationSeconds != null ? `${Math.floor(e.durationSeconds / 60)}m ${e.durationSeconds % 60}s` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
