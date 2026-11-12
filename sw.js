// Service worker: la web es instalable, pide siempre la versión más reciente y, si no hay conexión,
// enseña la última copia guardada (en una emergencia puede no haber internet: mejor datos viejos que una pantalla en blanco).
const COPIA = "brujula-copia-1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== COPIA) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const clave = u.origin + u.pathname;          // sin el ?v=… para no acumular copias
    try {
      const r = await fetch(e.request, { cache: "no-cache" });
      if (r.ok) { const c = await caches.open(COPIA); c.put(clave, r.clone()); }
      return r;
    } catch (err) {
      const c = await caches.open(COPIA); const g = await c.match(clave);
      if (g) return g; throw err;
    }
  })());
});
