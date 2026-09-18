// LevlCast Service Worker — caches app shell + handles web push notifications
const CACHE_NAME = "levlcast-v1";

// App shell files to cache on install
const APP_SHELL = ["/dashboard", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Push Notifications ─────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "LevlCast";
  const options = {
    body: data.body || "Your stream report is ready.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: data.data || {},
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const vodId = event.notification.data?.vodId;
  const url = vodId ? `/dashboard/vods/${vodId}` : "/dashboard/vods";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ─── Fetch / Cache ──────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET and API/auth requests
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;
  if (request.url.includes("/auth/")) return;

  // Skip anything not served by us.
  //
  // This handler used to intercept cross-origin GETs too, and the catch
  // branch below ends in `caches.match(request)`, which resolves to
  // undefined for a URL that was never cached. Passing undefined to
  // respondWith() is a hard failure, so ANY third-party request that hit
  // an error was converted into a broken one by this service worker
  // rather than being allowed to fail on its own terms. Letting these fall
  // through to the network is both correct and what the browser does
  // without us.
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful page responses
        if (response.ok && request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === "navigate") {
          return caches.match("/offline") || caches.match("/dashboard");
        }
        return caches.match(request);
      })
  );
});
