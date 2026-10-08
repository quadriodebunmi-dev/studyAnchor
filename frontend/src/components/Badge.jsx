import React from "react";

const TONES = {
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20",
  indigo: "bg-primary/10 text-primary ring-primary/20",
  accent: "bg-accent/25 text-[#8a4a12] dark:bg-accent/20 dark:text-accent ring-accent/40",
  green: "bg-success/10 text-success ring-success/20",
  amber: "bg-warning/10 text-warning ring-warning/20",
  red: "bg-danger/10 text-danger ring-danger/20",
  violet: "bg-secondary-purple/10 text-secondary-purple ring-secondary-purple/20",
};

export default function Badge({ children, tone = "slate", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium
        ring-1 ring-inset ${TONES[tone] || TONES.slate} ${className}`}
    >
      {children}
    </span>
  );
}
