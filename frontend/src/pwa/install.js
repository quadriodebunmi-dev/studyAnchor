// Shared "install the app" state. The browser fires `beforeinstallprompt` only
// once and often before React has mounted, so we capture it at module load and
// let any number of components (login button, navbars, popup) share it.
import { useEffect, useState } from "react";

let deferred = null;
let installed = false;
const subs = new Set();
const notify = () => subs.forEach((fn) => fn());

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)); // iPadOS reports as a Mac

export const isIosSafari = () => isIos() && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
export const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** Opens the browser's native install dialog. Resolves "accepted" | "dismissed" | "unavailable". */
export async function promptInstall() {
  if (!deferred) return "unavailable";
  const evt = deferred;
  deferred = null; // an install event can only be used once
  notify();
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return {
    // Already running as an installed app, or just got installed.
    installed: installed || isStandalone(),
    // The browser handed us a real install prompt.
    canPrompt: !!deferred,
  };
}
