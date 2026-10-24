import React from "react";

// Empty screens are an invitation to act: a small accent icon, a short title,
// one line of guidance and (optionally) the next step.
export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-3 rounded-xl bg-accent/15 p-2.5 text-highlight-deep dark:text-accent">{icon}</div>
      <p className="font-display text-sm font-semibold text-night dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed lv-meta">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
