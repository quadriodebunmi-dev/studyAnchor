import React from "react";
import booksIllustration from "../../public/Books.svg";
// A page turning: three ruled lines filling in sequence. Reads as "reading"
// rather than as a generic spinner.
function PageLoader({ className = "" }) {
  return (
    <span className={`inline-flex items-end gap-1 ${className}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-4 w-1 rounded-full bg-accent animate-ember"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export function FullPageLoader({ label = "Loading your materials..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <img src={booksIllustration} alt="" aria-hidden="true" className="h-28 w-28" />
        <p className="text-sm lv-meta">{label}</p>
      </div>
    </div>
  );
}

export function InlineLoader({ label = "Loading..." }) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <img src={booksIllustration} alt="" aria-hidden="true" className="h-28 w-28" />
        <p className="text-sm lv-meta">{label}</p>
      </div>
    </div>
  );
}

/** Placeholders shaped like the compact material/course cards. */
export function CardSkeleton({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lv-card p-3" aria-hidden="true">
          <div className="flex gap-3">
            <div className="lv-skeleton h-10 w-10 shrink-0" />
            <div className="w-full space-y-2 pt-0.5">
              <div className="lv-skeleton h-3 w-3/5" />
              <div className="lv-skeleton h-2.5 w-2/5" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Row of compact skeleton tiles, for dashboards while data loads. */
export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="lv-skeleton h-14 w-full" />)}
    </div>
  );
}
