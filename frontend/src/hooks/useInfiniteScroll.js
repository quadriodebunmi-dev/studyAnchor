import { useCallback, useEffect, useRef, useState } from "react";

// Facebook-style infinite scroll: fetches page 1 when `deps` change, then
// fetches the next cursor automatically whenever the sentinel element
// scrolls into view.
//
//   const { items, loading, loadingMore, error, sentinelRef } = useInfiniteScroll({
//     fetchPage: (cursor) => getFeedMaterials({ sort, q, cursor }),
//     getItems: (res) => res.materials,
//     getNextCursor: (res) => res.pagination.nextCursor,
//     deps: [sort, q],
//   });
//
// `fetchPage(cursor)` is called with `undefined` for the first page and the
// previous response's `nextCursor` after that.
export function useInfiniteScroll({ fetchPage, getItems, getNextCursor, deps = [], enabled = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true); // first page
  const [loadingMore, setLoadingMore] = useState(false); // subsequent pages
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef(null);

  const load = useCallback(async (cursor) => {
    const id = ++requestId.current;
    if (cursor) { setLoadingMore(true); loadingMoreRef.current = true; } else { setLoading(true); setError(""); }
    try {
      const res = await fetchPage(cursor);
      if (id !== requestId.current) return; // a newer request (e.g. filters changed) has already started
      const pageItems = getItems(res) || [];
      const next = getNextCursor(res) ?? null;
      setItems((prev) => (cursor ? [...prev, ...pageItems] : pageItems));
      setNextCursor(next);
      setHasMore(!!next);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message || "Couldn't load more.");
      if (!cursor) setItems([]);
    } finally {
      if (id !== requestId.current) return;
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [fetchPage, getItems, getNextCursor]);

  const reload = useCallback(() => load(undefined), [load]);
  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !nextCursor) return;
    load(nextCursor);
  }, [load, nextCursor]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (enabled) reload(); }, deps.concat(enabled));

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "600px" } // start fetching well before the user hits bottom
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, loadMore, items.length]);

  return { items, setItems, loading, loadingMore, error, hasMore, loadMore, reload, sentinelRef };
}
