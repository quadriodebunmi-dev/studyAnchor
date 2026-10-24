// Web Push needs the service worker to handle two events. Your service worker is
// frontend/public/sw.js (the `public/` folder isn't part of this delivery), so paste
// this at the bottom of it. Subscriptions are created by the "Turn on push" button in
// Profile; the server only sends push once VAPID keys are configured.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text payload */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Study Anchor", {
      body: data.body || "",
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
