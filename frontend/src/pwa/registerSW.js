// Registers the service worker and re-broadcasts its lifecycle as plain DOM
// events, so React components can react without importing SW internals.
//
//   lv:sw-update-ready   a new build is waiting to take over
//   lv:sw-offline-ready  the app shell is cached and works without a network

const UPDATE_READY = "lv:sw-update-ready";
const OFFLINE_READY = "lv:sw-offline-ready";

let waitingWorker = null;

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function trackInstalling(registration) {
  const installing = registration.installing;
  if (!installing) return;
  installing.addEventListener("statechange", () => {
    if (installing.state !== "installed") return;
    if (navigator.serviceWorker.controller) {
      // There was already a worker in charge, so this one is an update.
      waitingWorker = registration.waiting || installing;
      emit(UPDATE_READY);
    } else {
      emit(OFFLINE_READY);
    }
  });
}

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  // The SW is served from /public, so it only exists in a real build/preview.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        emit(UPDATE_READY);
      }

      trackInstalling(registration);
      registration.addEventListener("updatefound", () => trackInstalling(registration));

      // Check for a new deploy when the app is brought back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      });
    } catch {
      // A failed registration must never break the app itself.
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// Called from the "Reload" button in the update toast.
export function applyUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.location.reload();
  }
}

export const SW_EVENTS = { UPDATE_READY, OFFLINE_READY };
