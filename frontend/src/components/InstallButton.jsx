import React, { useState, useSyncExternalStore } from "react";
import { Download, Share, Plus, MoreVertical } from "lucide-react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import { useToast } from "./Toast.jsx";
import { isAndroid, isIos, isIosSafari, promptInstall, useInstall } from "../pwa/install.js";
import { APP_CONFIG } from "../config/appConfig.js";

/* ---------- shared dismissal store (one source of truth for all instances) ---------- */
const DISMISS_KEY = "install-dismissed-at";
const DISMISS_DAYS = 14;
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

function notify() {
  listeners.forEach((l) => l());
}

function dismissInstall() {
  dismissedState = true; // works even if storage is blocked (lasts until reload)
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

/* ---------- platform instructions ---------- */
const icon = "mx-0.5 inline h-4 w-4 align-text-bottom";

function HowTo() {
  if (isIos() && !isIosSafari()) {
    return (
      <p className="text-sm leading-relaxed sm:text-base">
        On iPhone and iPad, installing only works from <b>Safari</b>. Open this page in Safari, then tap{" "}
        <Share className={icon} /> <b>Share</b> → <b>Add to Home Screen</b>.
      </p>
    );
  }
  if (isIos()) {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed sm:text-base">
        <li>Tap the <Share className={icon} /> <b>Share</b> button in Safari.</li>
        <li>
          Scroll down and tap{" "}
          <span className="inline-flex items-center gap-1 font-semibold">
            <Plus className="h-3.5 w-3.5" />Add to Home Screen
          </span>.
        </li>
        <li>Tap <b>Add</b>.</li>
      </ol>
    );
  }
  if (isAndroid()) {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed sm:text-base">
        <li>Tap the <MoreVertical className={icon} /> menu in your browser.</li>
        <li>Choose <b>Install app</b> (or <b>Add to Home screen</b>).</li>
        <li>Confirm, and {APP_CONFIG.name} appears with your other apps.</li>
      </ol>
    );
  }
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed sm:text-base">
      <li>In Chrome or Edge, click the <b>install icon</b> at the right end of the address bar (or open the ⋮ menu → <b>Install {APP_CONFIG.name}</b>).</li>
      <li>On Mac Safari: <b>File → Add to Dock</b>.</li>
      <li>Firefox on desktop doesn't support installing web apps. Use Chrome or Edge.</li>
    </ol>
  );
}

/**
 * "Install app" button. Hidden once installed, or for DISMISS_DAYS after dismissal.
 * The help modal only opens from a click on this button.
 *
 * variant: "solid" | "outline" | "nav" | "navLight"
 * respectDismiss: set false for a manual entry (settings/menu) that should always show.
 */
export default function InstallButton({
  variant = "solid",
  className = "",
  label = "Install app",
  iconOnlyOnMobile = false,
  respectDismiss = true,
}) {
  const { installed, canPrompt } = useInstall();
  const dismissed = useDismissed();
  const [help, setHelp] = useState(false);
  const toast = useToast();

  if (installed || (respectDismiss && dismissed)) return null;

  function closeHelp() {
    setHelp(false);
    dismissInstall();
  }

  async function onClick() {
    if (!canPrompt) return setHelp(true);
    const outcome = await promptInstall();
    if (outcome === "accepted") toast(`Installing ${APP_CONFIG.name}…`, "success");
    else if (outcome === "unavailable") setHelp(true);
    else dismissInstall(); // "dismissed" or anything else: user declined the browser prompt
  }

  const styles = {
    solid: "bg-accent text-accent-fg shadow-glow hover:bg-highlight-deep px-4 text-sm font-semibold rounded-xl",
    outline: "border border-slate-300 text-night hover:border-accent hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 px-4 text-sm font-medium rounded-xl",
    nav: "border border-white/25 text-white hover:bg-white/10 px-3 sm:px-3.5 text-sm font-medium rounded-full",
    navLight: "border border-slate-200 bg-white text-night hover:border-accent dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 px-3 text-xs font-semibold rounded-full",
  }[variant];

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap transition active:scale-[0.98] sm:min-h-[40px] ${styles} ${className}`}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className={iconOnlyOnMobile ? "hidden sm:inline" : ""}>{label}</span>
      </button>

      {help && (
        <Modal title={`Install ${APP_CONFIG.name}`} onClose={closeHelp}>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <p className="mb-3 text-sm leading-relaxed lv-meta sm:text-base">
              Opens full screen, launches from your home screen and keeps opened materials readable offline.
            </p>
            <HowTo />
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={closeHelp}>Got it</Button>
          </div>
        </Modal>
      )}
    </>
  );
}