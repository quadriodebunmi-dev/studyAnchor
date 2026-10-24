import React, { useState } from "react";
import { Download, Share, Plus, MoreVertical } from "lucide-react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import { useToast } from "./Toast.jsx";
import { isAndroid, isIos, isIosSafari, promptInstall, useInstall } from "../pwa/install.js";
import { APP_CONFIG } from "../config/appConfig.js";

function HowTo() {
  if (isIos() && !isIosSafari()) {
    return <p className="text-sm">On iPhone and iPad, installing only works from <b>Safari</b>. Open this page in Safari, then tap <Share className="mx-0.5 inline h-4 w-4" /> <b>Share</b> → <b>Add to Home Screen</b>.</p>;
  }
  if (isIos()) {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Tap the <Share className="mx-0.5 inline h-4 w-4" /> <b>Share</b> button in Safari.</li>
        <li>Scroll down and tap <span className="inline-flex items-center gap-1 font-semibold"><Plus className="h-3.5 w-3.5" />Add to Home Screen</span>.</li>
        <li>Tap <b>Add</b>.</li>
      </ol>
    );
  }
  if (isAndroid()) {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Tap the <MoreVertical className="mx-0.5 inline h-4 w-4" /> menu in your browser.</li>
        <li>Choose <b>Install app</b> (or <b>Add to Home screen</b>).</li>
        <li>Confirm, and {APP_CONFIG.name} appears with your other apps.</li>
      </ol>
    );
  }
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>In Chrome or Edge, click the <b>install icon</b> at the right end of the address bar (or open the ⋮ menu → <b>Install {APP_CONFIG.name}</b>).</li>
      <li>On Mac Safari: <b>File → Add to Dock</b>.</li>
      <li>Firefox on desktop doesn't support installing web apps — use Chrome or Edge.</li>
    </ol>
  );
}

/**
 * "Install app" button. Hidden once the app is installed/running standalone.
 * Uses the browser's real install prompt when available; otherwise shows
 * platform-specific instructions (iOS never exposes a prompt).
 *
 * variant: "solid" (default, filled), "outline", "nav" (compact, for headers on dark bars), "navLight"
 */
export default function InstallButton({ variant = "solid", className = "", label = "Install app", iconOnlyOnMobile = false }) {
  const { installed, canPrompt } = useInstall();
  const [help, setHelp] = useState(false);
  const toast = useToast();

  if (installed) return null;

  async function onClick() {
    if (!canPrompt) return setHelp(true);
    const outcome = await promptInstall();
    if (outcome === "accepted") toast(`Installing ${APP_CONFIG.name}…`, "success");
    else if (outcome === "unavailable") setHelp(true);
  }

  const styles = {
    solid: "bg-accent text-accent-fg shadow-glow hover:bg-highlight-deep px-4 py-2.5 text-sm font-semibold rounded-xl",
    outline: "border border-slate-300 text-night hover:border-accent hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 px-4 py-2.5 text-sm font-medium rounded-xl",
    nav: "border border-white/25 text-white hover:bg-white/10 px-3.5 py-2 text-sm font-medium rounded-full",
    navLight: "border border-slate-200 bg-white text-night hover:border-accent dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold rounded-full",
  }[variant];

  return (
    <>
      <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 transition active:scale-[0.98] ${styles} ${className}`}>
        <Download className="h-4 w-4 shrink-0" />
        <span className={iconOnlyOnMobile ? "hidden sm:inline" : ""}>{label}</span>
        {iconOnlyOnMobile && <span className="sr-only sm:hidden">{label}</span>}
      </button>
      {help && (
        <Modal title={`Install ${APP_CONFIG.name}`} onClose={() => setHelp(false)}>
          <p className="mb-3 text-sm lv-meta">Opens full screen, launches from your home screen and keeps opened materials readable offline.</p>
          <HowTo />
          <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={() => setHelp(false)}>Got it</Button></div>
        </Modal>
      )}
    </>
  );
}
