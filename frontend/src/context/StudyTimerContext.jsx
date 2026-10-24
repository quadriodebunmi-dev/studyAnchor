import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { logSession } from "../services/progressService.js";

/**
 * Goal timer that lives above the router, so it keeps counting while the
 * learner moves between pages (and survives a refresh).
 *
 * Time is always derived from timestamps, never from counting interval ticks,
 * so background tabs and throttled timers can't make it drift. A heartbeat is
 * stored while it runs: if the tab was closed/asleep for a while, the gap is NOT
 * counted — the timer comes back paused, so the logged minutes stay honest.
 * When the countdown reaches zero the session is logged automatically.
 */

const MAX_SESSION_MIN = 480; // mirrors PLATFORM.goals.maxSessionMinutes on the server
const AWAY_LIMIT_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 15 * 1000;

const TimerContext = createContext(null);
const keyFor = (uid) => `study-anchor-timer:${uid}`;
const minKeyFor = (uid) => `study-anchor-timer-min:${uid}`;

function readTimer(uid) {
  try {
    const t = JSON.parse(localStorage.getItem(keyFor(uid)));
    if (!t || !t.id || !t.goalId) return null;
    // Came back after being away: freeze at the last moment we know it was running.
    if (t.runStart && Date.now() - (t.seen || t.runStart) > AWAY_LIMIT_MS) {
      return { ...t, accMs: t.accMs + Math.max(0, (t.seen || t.runStart) - t.runStart), runStart: null };
    }
    return t;
  } catch { return null; }
}
const writeTimer = (uid, t) => {
  try { t ? localStorage.setItem(keyFor(uid), JSON.stringify(t)) : localStorage.removeItem(keyFor(uid)); } catch { /* storage blocked: timer just won't survive a refresh */ }
};

export const elapsedMs = (t, now = Date.now()) => (t ? t.accMs + (t.runStart ? Math.max(0, now - t.runStart) : 0) : 0);

export function StudyTimerProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const uid = user?._id;
  const [timer, setTimer] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [minimized, setMinimizedState] = useState(false);
  const timerRef = useRef(null);
  timerRef.current = timer;

  // Load (and re-load on login/logout) this user's timer.
  useEffect(() => {
    if (!uid) { setTimer(null); return; }
    const t = readTimer(uid);
    setTimer(t);
    if (t) writeTimer(uid, t);
    try { setMinimizedState(localStorage.getItem(minKeyFor(uid)) === "1"); } catch { /* ignore */ }
  }, [uid]);

  // Keep several open tabs in step.
  useEffect(() => {
    if (!uid) return undefined;
    const onStorage = (e) => { if (e.key === keyFor(uid)) setTimer(readTimer(uid)); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [uid]);

  const running = Boolean(timer?.runStart);

  // Tick (display only) + heartbeat (so an abandoned tab isn't counted).
  useEffect(() => {
    if (!running) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const beat = setInterval(() => {
      const t = timerRef.current;
      if (t?.runStart) { const next = { ...t, seen: Date.now() }; timerRef.current = next; writeTimer(uid, next); }
    }, HEARTBEAT_MS);
    setNow(Date.now());
    return () => { clearInterval(tick); clearInterval(beat); };
  }, [running, uid]);

  const update = useCallback((next) => { timerRef.current = next; setTimer(next); writeTimer(uid, next); }, [uid]);

  /** goal: { _id, title }, targetSeconds: how long this session counts down from. */
  const start = useCallback((goal, targetSeconds) => {
    if (!uid || timerRef.current) return false;
    const t = Date.now();
    update({
      id: `${t}-${Math.round(Math.random() * 1e6)}`,
      goalId: goal._id, title: goal.title,
      targetSec: Math.max(60, Math.min(MAX_SESSION_MIN * 60, Math.round(targetSeconds))),
      accMs: 0, runStart: t, seen: t,
    });
    return true;
  }, [uid, update]);

  const pause = useCallback(() => {
    const t = timerRef.current; if (!t?.runStart) return;
    update({ ...t, accMs: elapsedMs(t), runStart: null });
  }, [update]);

  const resume = useCallback(() => {
    const t = timerRef.current; if (!t || t.runStart) return;
    update({ ...t, runStart: Date.now(), seen: Date.now() });
  }, [update]);

  const discard = useCallback(() => update(null), [update]);

  /** Saves the session. `capSeconds` stops a finished countdown from logging more than it was set for. */
  const finish = useCallback(async ({ auto = false } = {}) => {
    const t = timerRef.current;
    if (!t || saving) return;
    // Several tabs may notice the countdown ending at once: the first to claim this timer id logs it.
    try {
      const claim = `study-anchor-timer-done:${t.id}`;
      if (localStorage.getItem(claim)) { setTimer(null); return; }
      localStorage.setItem(claim, "1");
      setTimeout(() => { try { localStorage.removeItem(claim); } catch { /* ignore */ } }, 60 * 1000);
    } catch { /* storage blocked: single-tab use is unaffected */ }

    const seconds = Math.min(elapsedMs(t) / 1000, auto ? t.targetSec : MAX_SESSION_MIN * 60);
    const minutes = Math.min(MAX_SESSION_MIN, Math.round(seconds / 60));
    if (minutes < 1) { update(null); toast("Under a minute — nothing was logged.", "info"); return; }

    setSaving(true);
    update(null); // clear first so a second tab / double click can't log it twice
    try {
      const r = await logSession({ minutes, goalId: t.goalId, note: "Timed session" });
      toast(
        auto ? `Session complete — ${minutes} min logged for “${t.title}”.`
          : r.countsTowardStreak ? `${minutes} min logged — counts toward your streak.` : `${minutes} min logged (sessions under 10 minutes don't count toward the streak).`,
        "success"
      );
      window.dispatchEvent(new Event("sa:session-logged"));
    } catch (e) {
      // Put it back (paused) so the time isn't lost, e.g. when the daily limit was hit.
      update({ ...t, accMs: minutes * 60 * 1000, runStart: null });
      toast(e.message || "Couldn't save that session. Your timer is paused — try again.", "error");
    } finally { setSaving(false); }
  }, [saving, toast, uid, update]);

  // Countdown finished → log it by itself.
  const remaining = timer ? timer.targetSec - elapsedMs(timer, now) / 1000 : null;
  useEffect(() => { if (timer?.runStart && remaining !== null && remaining <= 0) finish({ auto: true }); }, [remaining, timer?.runStart, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMinimized = useCallback((v) => {
    setMinimizedState(v);
    try { localStorage.setItem(minKeyFor(uid), v ? "1" : "0"); } catch { /* ignore */ }
  }, [uid]);

  const value = useMemo(() => ({
    timer, running, remainingSeconds: remaining === null ? null : Math.max(0, Math.ceil(remaining)),
    elapsedSeconds: timer ? Math.floor(elapsedMs(timer, now) / 1000) : 0,
    saving, minimized, setMinimized, start, pause, resume, finish, discard,
  }), [timer, running, remaining, now, saving, minimized, setMinimized, start, pause, resume, finish, discard]);

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useStudyTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useStudyTimer must be used within a StudyTimerProvider");
  return ctx;
}

export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
