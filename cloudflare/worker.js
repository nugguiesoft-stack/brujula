// Intermediario de la Brújula de Emergencia (Cloudflare Worker, plan gratuito) — v3
// Recibe /?u=<dirección> y devuelve el contenido con permiso para que la web de la Brújula lo lea.
// Solo atiende peticiones que vienen de la propia web de la Brújula.
const ORIGENES = ["https://nugguiesoft-stack.github.io", "http://localhost:8765"];
const NAVEGADOR = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const u = new URL(request.url).searchParams.get("u");
    if (!u) return new Response("Brújula: intermediario activo (v3)", { headers: cors });
    if (!ORIGENES.includes(origin)) return new Response("Origen no permitido", { status: 403, headers: cors });

    let destino;
    try { destino = new URL(u); } catch { return new Response("Dirección no válida", { status: 400, headers: cors }); }
    const host = destino.hostname;
    if (destino.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(host)) {
      return new Response("Web no permitida", { status: 403, headers: cors });
    }

    const ttl = host === "api.gdeltproject.org" ? 900 : 300;
    const cache = caches.default;
    const clave = new Request(destino.toString());
    let resp = await cache.match(clave);
    if (!resp) {
      const r = await fetch(destino.toString(), {
        headers: { "User-Agent": NAVEGADOR, "Accept": "application/rss+xml, application/xml, application/json, text/html;q=0.9, */*;q=0.8", "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
        cf: { cacheTtl: ttl }
      });
      resp = new Response(r.body, r);
      resp.headers.set("Cache-Control", "public, max-age=" + ttl);
      if (r.ok) await cache.put(clave, resp.clone());
    }
    const out = new Response(resp.body, resp);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  }
};
