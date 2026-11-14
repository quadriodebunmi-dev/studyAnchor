import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X, WifiOff, RefreshCw, Share, Plus } from "lucide-react";
import { applyUpdate, SW_EVENTS } from "../pwa/registerSW.js";
import { isIos, isStandalone, promptInstall, useInstall } from "../pwa/install.js";

/* ---------- shared, persisted dismissal store ---------- */
const DISMISS_KEY = "install-prompt-dismissed-at";
const DISMISS_DAYS = 1;
const listeners = new Set();

function readDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return !!t && Date.now() - t < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

let dismissedState = readDismissed();
let shownThisSession = false; // survives remounts caused by page navigation

function notify() {
  listeners.forEach((l) => l());
}

function dismissInstallPrompt() {
  dismissedState = true; // still works if storage is blocked (lasts until reload)
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
  notify();
}

function subscribe(cb) {
  listeners.add(cb);
  const onStorage = (e) => {
    if (e.key === DISMISS_KEY || e.key === null) {
      dismissedState = readDismissed();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => dismissedState;
const getServerSnapshot = () => false;

function useDismissed() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Slim banner across the top of the app whenever the device drops offline. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-night px-4 py-2 text-center text-xs font-medium text-white sm:text-sm"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span>Offline — showing the materials you've already opened.</span>
    </div>
  );
}

/** Toast shown when a newer build has been downloaded in the background. */
export function UpdateToast() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const show = () => setReady(true);
    window.addEventListener(SW_EVENTS.UPDATE_READY, show);
    return () => window.removeEventListener(SW_EVENTS.UPDATE_READY, show);
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[90] animate-slide-up sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-80 lg:bottom-6">
      <div className="lv-card flex items-center gap-3 p-3.5">
        <span className="shrink-0 rounded-xl bg-accent/15 p-2">
          <RefreshCw className="h-4 w-4 text-accent-fg dark:text-accent" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">A new version of Study Anchor is ready.</p>
        <button
          onClick={applyUpdate}
          className="min-h-[40px] shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-highlight-deep"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/**
 * Invitation to install. Chrome/Edge/Android get the real prompt via
 * `beforeinstallprompt`; iOS Safari never fires that event, so it gets the
 * Share → Add to Home Screen instructions instead.
 *
 * Shows once (after 2s). Dismissing hides it for DISMISS_DAYS across all
 * pages and tabs. It never re-shows on a timer or on navigation.
 */
export function InstallPrompt() {
  const { installed, canPrompt } = useInstall();
  const dismissed = useDismissed();
  const [visible, setVisible] = useState(shownThisSession);
  const deferred = canPrompt;
  const iosEligible = isIos();

  useEffect(() => {
    if (installed || dismissed || isStandalone()) return;
    if (!deferred && !iosEligible) return;
    if (shownThisSession) {
      setVisible(true); // remounted on another page: show instantly, don't restart the timer
      return;
    }

    const t = setTimeout(() => {
      shownThisSession = true;
      setVisible(true);
    }, 2000);
    return () => clearTimeout(t);
  }, [deferred, iosEligible, installed, dismissed]);

  function dismiss() {
    setVisible(false);
    dismissInstallPrompt();
  }

  async function install() {
    if (!deferred) return;
    const outcome = await promptInstall();
    setVisible(false);
    if (outcome !== "accepted") dismissInstallPrompt();
  }

  if (installed || dismissed || !visible || (!deferred && !iosEligible)) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-24 z-[80] animate-slide-up sm:inset-x-auto sm:right-6 sm:w-[22rem] lg:bottom-6"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="lv-card overflow-hidden">
        <div className="h-1 w-full bg-accent" />
        <div className="flex items-start gap-3 p-4">
          <img src="/icons/icon-64.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold leading-tight">Keep Study Anchor on your home screen</p>
            {deferred ? (
              <p className="mt-1 text-sm lv-meta">
                Opens full screen and keeps your materials readable when the network drops.
              </p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-sm lv-meta">
                Tap
                <Share className="mx-0.5 inline h-4 w-4 text-accent" aria-label="Share" />
                then
                <span className="inline-flex items-center gap-1 font-medium text-night dark:text-slate-200">
                  <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                </span>
              </p>
            )}
            {deferred && (
              <button
                onClick={install}
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-glow hover:bg-highlight-deep sm:w-auto"
              >
                <Download className="h-4 w-4" /> Install app
              </button>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="-m-1 shrink-0 rounded-full p-2.5 lv-meta hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** One mount point for every PWA-related surface. */
export default function PwaPrompts() {
  return (
    <>
      <UpdateToast />
      <InstallPrompt />
    </>
  );
}