import React from "react";
import { Link } from "react-router-dom";
import { Minus, Pause, Play, Square, Timer, Maximize2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { formatClock, useStudyTimer } from "../context/StudyTimerContext.jsx";

// Floating goal timer, shown top-right on every page while a goal is being timed.
// Sits just below the sticky navbar and can be minimised to a small pill.
const POS = "fixed right-3 z-50 top-[calc(env(safe-area-inset-top,0px)+4rem)]";

export default function StudyTimerWidget() {
  const { user } = useAuth();
  const { timer, running, remainingSeconds, saving, minimized, setMinimized, pause, resume, finish, discard } = useStudyTimer();
  if (!user || !timer) return null;

  const pct = Math.min(100, Math.round(((timer.targetSec - remainingSeconds) / timer.targetSec) * 100));
  const clock = formatClock(remainingSeconds);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        aria-label={`Study timer for ${timer.title}: ${clock} left. Expand`}
        title={timer.title}
        className={`${POS} flex max-w-[11rem] items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-2.5 pr-3 text-sm shadow-lift backdrop-blur dark:border-slate-700 dark:bg-slate-900/95`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${running ? "animate-pulse bg-success" : "bg-amber-500"}`} />
        <span className="font-display font-semibold tabular-nums">{clock}</span>
        <Maximize2 className="h-3 w-3 shrink-0 opacity-60" />
      </button>
    );
  }

  return (
    <div role="timer" aria-label="Study timer" className={`${POS} w-64 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-lift backdrop-blur dark:border-slate-700 dark:bg-slate-900/95`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide lv-meta"><Timer className="h-3 w-3" />{running ? "Studying" : "Paused"}</p>
          <Link to="/goals" className="block truncate font-display text-sm font-semibold hover:underline" title={timer.title}>{timer.title}</Link>
        </div>
        <button onClick={() => setMinimized(true)} aria-label="Minimise timer" className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><Minus className="h-4 w-4" /></button>
      </div>

      <p className="mt-2 text-center font-display text-4xl font-bold tabular-nums" aria-live="off">{clock}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-accent transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={running ? pause : resume} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-50 dark:border-slate-700">
          {running ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Resume</>}
        </button>
        <button onClick={() => finish()} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-dark disabled:opacity-50">
          <Square className="h-3.5 w-3.5" />{saving ? "Saving…" : "Stop & save"}
        </button>
        <button
          onClick={() => window.confirm("Discard this session without logging it?") && discard()}
          disabled={saving} aria-label="Discard session" title="Discard without logging"
          className="rounded-xl p-1.5 text-danger hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
        ><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
