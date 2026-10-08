import React from "react";
import { Flame } from "lucide-react";

/**
 * Progress made visible is what separates a study app from a file browser.
 * Every component here spends the peach accent — and nothing else in the
 * interface does, so progress is the thing your eye finds first.
 */

export function ProgressRing({ value = 0, size = 56, stroke = 5, label, className = "" }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(pct)}% complete`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="#f9b17a"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-xs font-bold text-night dark:text-slate-100">
        {label ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}

export function ProgressBar({ value = 0, className = "" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}>
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${pct}%`, transition: "width 500ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </div>
  );
}

/** A single number from the student's week, on its own sheet. */
export function StatTile({ icon, value, label, tone = "plain" }) {
  const isAccent = tone === "accent";
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        isAccent
          ? "border-accent/40 bg-accent/10"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <span
        className={`inline-flex rounded-lg p-1.5 ${
          isAccent ? "bg-accent text-accent-fg" : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </span>
      <p className="mt-2.5 font-display text-2xl font-bold leading-none text-night dark:text-slate-50">
        {value}
      </p>
      <p className="mt-1.5 text-xs lv-meta">{label}</p>
    </div>
  );
}

/** Day streak, shown inline in the header. */
export function StreakChip({ days = 0 }) {
  if (!days) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1.5 text-xs font-semibold text-highlight-deep ring-1 ring-inset ring-accent/40 dark:text-accent">
      <Flame className="h-3.5 w-3.5 animate-ember" />
      {days} day{days === 1 ? "" : "s"} in a row
    </span>
  );
}
