import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Study progress tracked on the device.
 *
 * Deliberately client-side: it works offline, needs no backend change, and
 * "which handouts have I actually opened" is a per-device question anyway.
 * If the API later returns real progress, swap the reads here.
 */

const OPENED_KEY = "study-anchor-opened";
const STREAK_KEY = "study-anchor-streak";

const today = () => new Date().toISOString().slice(0, 10);

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — progress is a nicety, never a blocker */
  }
}

/** Marks a material as read. Call it when a material page is opened. */
export function markMaterialOpened(id) {
  if (!id) return;
  const opened = read(OPENED_KEY, {});
  opened[id] = today();
  write(OPENED_KEY, opened);
  window.dispatchEvent(new Event("sa:progress"));
}

/** Consecutive days the student has opened the app, counted locally. */
function bumpStreak() {
  const state = read(STREAK_KEY, { days: 0, last: null });
  const t = today();
  if (state.last === t) return state;

  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const next = { days: state.last === yesterday ? state.days + 1 : 1, last: t };
  write(STREAK_KEY, next);
  return next;
}

export function useStudyProgress(materials = []) {
  const [opened, setOpened] = useState(() => read(OPENED_KEY, {}));
  const [streak, setStreak] = useState(() => read(STREAK_KEY, { days: 0, last: null }));

  useEffect(() => {
    setStreak(bumpStreak());
    const sync = () => setOpened(read(OPENED_KEY, {}));
    window.addEventListener("sa:progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sa:progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const openedIds = useMemo(() => new Set(Object.keys(opened)), [opened]);

  const readCount = useMemo(
    () => materials.filter((m) => openedIds.has(m._id)).length,
    [materials, openedIds]
  );

  const percentRead = materials.length ? Math.round((readCount / materials.length) * 100) : 0;

  const quizReadyCount = useMemo(
    () => materials.filter((m) => m.quizzesGenerated > 15).length,
    [materials]
  );

  /** Share of one course's materials that have been opened. */
  const courseProgress = useCallback(
    (courseId) => {
      const own = materials.filter((m) => (m.courseId?._id || m.courseId) === courseId);
      if (!own.length) return 0;
      return Math.round((own.filter((m) => openedIds.has(m._id)).length / own.length) * 100);
    },
    [materials, openedIds]
  );

  return {
    openedIds,
    readCount,
    percentRead,
    quizReadyCount,
    courseProgress,
    streakDays: streak.days,
    isOpened: (id) => openedIds.has(id),
  };
}
