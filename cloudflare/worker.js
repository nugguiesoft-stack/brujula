// Intermediario de la Brújula de Emergencia (Cloudflare Worker, plan gratuito).
// Recibe /?u=<dirección> y devuelve el contenido con permiso para que la web lo lea.
// Solo deja pasar las webs de esta lista, para que nadie pueda usarlo para otra cosa.
const PERMITIDOS = [
  "api.gdeltproject.org", "news.google.com", "api.fxtwitter.com", "www.youtube.com", "t.me",
  "www.gdacs.org", "gdacs.org", "public.api.bsky.app", "api.bsky.app", "gamma-api.polymarket.com",
  "earthquake.usgs.gov", "services.swpc.noaa.gov", "api.elections.kalshi.com", "apidatos.ree.es",
  "www.aemet.es", "travel.state.gov", "www.auswaertiges-amt.de", "feeds.meteoalarm.org"
];
// Además, cualquier web oficial (gobiernos y organismos internacionales):
const SUFIJOS = [".gob.es", ".gov", ".gov.uk", ".gouv.fr", ".bund.de", ".europa.eu", ".int", ".mil", ".un.org"];
const ORIGENES = ["https://nugguiesoft-stack.github.io", "http://localhost:8765"];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (origin && !ORIGENES.includes(origin)) return new Response("Origen no permitido", { status: 403, headers: cors });

    const u = new URL(request.url).searchParams.get("u");
    if (!u) return new Response("Brújula: intermediario activo (v2)", { headers: cors });
    let destino;
    try { destino = new URL(u); } catch { return new Response("Dirección no válida", { status: 400, headers: cors }); }
    const host = destino.hostname;
    const ok = PERMITIDOS.includes(host) || SUFIJOS.some((x) => host.endsWith(x));
    if (destino.protocol !== "https:" || !ok) {
      return new Response("Web no permitida", { status: 403, headers: cors });
    }

    const cache = caches.default;
    const clave = new Request(destino.toString());
    let resp = await cache.match(clave);
    if (!resp) {
      const r = await fetch(destino.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (BrujulaEmergencia; uso personal)", "Accept": "*/*" },
        cf: { cacheTtl: host === "api.gdeltproject.org" ? 900 : 300 }
      });
      resp = new Response(r.body, r);
      // GDELT se guarda 15 min para no saturarlo; el resto 5 min
      resp.headers.set("Cache-Control", "public, max-age=" + (host === "api.gdeltproject.org" ? 900 : 300));
      if (r.ok) await cache.put(clave, resp.clone());
    }
    const out = new Response(resp.body, resp);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  }
};
