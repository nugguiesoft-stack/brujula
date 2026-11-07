// Service worker: hace la web instalable y obliga a pedir siempre la versión más reciente de la propia web.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method === "GET" && u.origin === self.location.origin) e.respondWith(fetch(e.request, { cache: "no-cache" }));
});
