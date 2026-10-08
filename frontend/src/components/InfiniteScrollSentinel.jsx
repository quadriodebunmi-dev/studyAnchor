import React from "react";
import { Loader2 } from "lucide-react";

// Sits at the bottom of an infinite-scroll list. Loads more the moment it
// scrolls into view (see useInfiniteScroll's rootMargin). Renders nothing once
// the list has no more pages, except a small "you've reached the end" note.
export default function InfiniteScrollSentinel({ sentinelRef, hasMore, loadingMore, endLabel = "You're all caught up." }) {
  return (
    <div ref={sentinelRef} className="col-span-full flex justify-center py-6">
      {loadingMore ? (
        <span className="inline-flex items-center gap-2 text-sm lv-meta">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
        </span>
      ) : !hasMore ? (
        <span className="text-xs lv-meta">{endLabel}</span>
      ) : null}
    </div>
  );
}
