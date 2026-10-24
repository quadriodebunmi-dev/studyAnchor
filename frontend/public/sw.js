/* Study Anchor service worker
 *
 * Deliberately dependency-free: no Workbox, no build-step injection, so it
 * works with the plain Vite setup already in this repo.
 *
 * Strategies
 *   navigations  → network-first, falling back to the cached shell, then to
 *                  /offline.html. Keeps SPA routing working offline.
 *   hashed build assets (/assets/*) → cache-first; the filename changes on
 *                  every deploy so they are safe to keep forever.
 *   icons, fonts → stale-while-revalidate.
 *   GET API reads → network-first with a short-lived cache, so a student who
 *                  loses signal still sees the last version of their feed.
 *   anything non-GET → straight to the network, never cached.
 *   auth, upload, billing, push, admin → never cached.
 *   push events → shown as system notifications (bottom of file).
 */

const VERSION = "lv-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const API_CACHE = `${VERSION}-api`;
const OFFLINE_URL = "/offline.html";

// Pre-cache the shell and all critical icon assets.
// Icons must be available offline for the app to look correct.
// If adding new icons, update this list and bump VERSION above.
const SHELL_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/favicon.svg",
  "/icons/icon-16.png",
  "/icons/icon-32.png",
  "/icons/icon-48.png",
  "/icons/icon-64.png",
  "/icons/icon-192.png",
  "/icons/icon-256.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/og-cover.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

const API_CACHE_MAX_ENTRIES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is all-or-nothing; add individually so one 404 can't abort the
      // whole install and leave the app permanently un-installable.
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

// The page asks us to activate a waiting worker when the user taps "Reload".
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/", preloaded.clone());
      return preloaded;
    }
    const fresh = await fetch(event.request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put("/", fresh.clone());
    return fresh;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    // Any in-app route is served by the same shell document.
    return (await cache.match("/")) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || network;
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(API_CACHE, API_CACHE_MAX_ENTRIES);
    }
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) {
      // Flag it so the UI can say "showing your last saved copy".
      const headers = new Headers(hit.headers);
      headers.set("X-LV-From-Cache", "1");
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Never cache auth, upload, payment, push or admin traffic (payment status must always be live).
  if (/\/(auth|login|logout|upload|billing|push|admin)\b/.test(url.pathname)) return;

  if (sameOrigin && url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Icons, SVGs, fonts, and images - use stale-while-revalidate so we serve
  // cached versions quickly but check for updates in the background.
  if (sameOrigin && /\.(png|svg|ico|webp|jpg|jpeg|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  if (/\/api\//.test(url.pathname)) {
    event.respondWith(networkFirstApi(request));
  }
});

// ---- Web Push ---------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text payload */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Study Anchor", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      data: { link: data.link || "/" },
      tag: data.type || undefined, // collapses repeats of the same kind
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => "focus" in w);
      if (open) { open.navigate(url); return open.focus(); }
      return self.clients.openWindow(url);
    })
  );
});