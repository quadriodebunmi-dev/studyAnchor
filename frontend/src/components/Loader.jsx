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

/** Paper-shaped placeholders, used while a grid of cards is loading. */
export function CardSkeleton({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lv-card p-4">
          <div className="flex gap-3">
            <div className="lv-skeleton h-11 w-11 shrink-0" />
            <div className="w-full space-y-2">
              <div className="lv-skeleton h-3.5 w-3/5" />
              <div className="lv-skeleton h-3 w-4/5" />
              <div className="lv-skeleton h-3 w-2/5" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
