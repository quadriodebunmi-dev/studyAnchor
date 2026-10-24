import React from "react";
import { Loader2 } from "lucide-react";

// Live upload progress: a bar plus the percentage. The browser reports how many
// bytes have left the device; once they all have (100%) the server still has to
// store and read the files, so that last stretch is shown as "processing".
export default function UploadProgress({ percent = 0, fileCount = 1, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const sent = pct >= 100;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900" role="status" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {sent ? (label ? `${label}…` : "Processing your file" + (fileCount > 1 ? "s" : "") + "…") : label ? `${label}…` : `Uploading ${fileCount > 1 ? `${fileCount} files` : "file"}…`}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress"
      >
        <div className={`h-full rounded-full bg-accent transition-[width] duration-200 ${sent ? "animate-pulse" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
