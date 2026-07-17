// Minimal offline-friendly service worker for Compass (PWA, SPEC §2).
// App data lives in localStorage, so this only needs to keep the shell cached
// for fast loads and basic offline use.

const CACHE = "compass-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Network-first for navigations so updates show; fall back to cache offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }
  // Cache-first for same-origin static assets.
  if (new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});

// Calendar reminder push notifications. Payload shape sent by
// app/api/cron/send-reminders/route.ts: { title, body, url, icon } — icon is
// chosen server-side per APP_VARIANT since this worker file is shared
// between Compass and Lodestone with no per-variant build step of its own.
self.addEventListener("push", (event) => {
  let data = { title: "Reminder", body: "You have an upcoming event.", url: "/", icon: "/icon.svg" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Ignore malformed payloads rather than crashing the worker.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(() => existing.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
