import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button.jsx";

// Numbered pagination for tables and management lists (as opposed to the
// infinite-scroll feeds — see useInfiniteScroll / InfiniteScrollSentinel).
//
//   <Pager pagination={pagination} onPageChange={setPage} />
//
// `pagination` is the { page, limit, total, totalPages, hasNext, hasPrev }
// object every page-based list endpoint returns (see backend/utils/pagination.js).
export default function Pager({ pagination, onPageChange, className = "" }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, hasPrev, hasNext } = pagination;

  // A handful of nearby page numbers, plus first/last so long lists stay navigable.
  const pages = new Set([1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const withGaps = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) withGaps.push("gap-" + p);
    withGaps.push(p);
  });

  return (
    <div className={`mt-6 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-xs lv-meta">{total} total</p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={!hasPrev} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {withGaps.map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-xs lv-meta">…</span>
          ) : (
            <Button key={p} size="sm" variant={p === page ? "primary" : "ghost"} aria-current={p === page ? "page" : undefined} onClick={() => onPageChange(p)}>
              {p}
            </Button>
          )
        )}
        <Button size="sm" variant="ghost" disabled={!hasNext} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
