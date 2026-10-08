import React from "react";

// Empty screens are an invitation to act, so the accent frames the icon and
// the copy says what to do next rather than just reporting nothing is here.
export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-4 rounded-2xl bg-accent/15 p-3 text-highlight-deep dark:text-accent">{icon}</div>
      <p className="font-display font-semibold text-night dark:text-slate-100">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm lv-meta">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>

  );
}
