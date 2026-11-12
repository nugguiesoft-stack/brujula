// Intermediario de la Brújula de Emergencia (Cloudflare Worker, plan gratuito) — v4
// Recibe /?u=<dirección> y devuelve el contenido con permiso para que la web de la Brújula lo lea.
// Cambios de la v4 (12 nov 2026):
//  · GDACS rechaza las peticiones que dicen ser un navegador: para esa web se usa un identificador propio.
//  · Lista de webs permitidas: antes cualquiera que fingiera el origen podía usar tu Worker para leer cualquier web.
const ORIGENES = ["https://nugguiesoft-stack.github.io", "http://localhost:8765"];
const NAVEGADOR = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const PROPIO = "BrujulaEmergencia/1.0 (+https://github.com/nugguiesoft-stack/brujula; uso personal)";
const CON_PROPIO = /(^|\.)gdacs\.org$/;
// Webs que la Brújula necesita leer. Para añadir una, pon aquí su dominio.
const PERMITIDAS = /(^|\.)(usgs\.gov|seismicportal\.eu|noaa\.gov|ree\.es|gatech\.edu|incibe\.es|aemet\.es|gdacs\.org|state\.gov|auswaertiges-amt\.de|gov\.uk|t\.me|polymarket\.com|gdeltproject\.org|google\.com|fxtwitter\.com|copernicus\.eu|who\.int|ecdc\.europa\.eu|open-meteo\.com|ign\.es|dsn\.gob\.es|abc\.es|europapress\.es|elpais\.com|uecdn\.es|elmundo\.es|eldebate\.com|20minutos\.es|lne\.es|elcomercio\.es|rtpa\.es|bbci\.co\.uk|bbc\.com|aljazeera\.com|dw\.com|france24\.com|theguardian\.com|un\.org)$/;

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
    if (!u) return new Response("Brújula: intermediario activo (v4)", { headers: cors });
    if (!ORIGENES.includes(origin)) return new Response("Origen no permitido", { status: 403, headers: cors });

    let destino;
    try { destino = new URL(u); } catch { return new Response("Dirección no válida", { status: 400, headers: cors }); }
    const host = destino.hostname.toLowerCase();
    if (destino.protocol !== "https:" || !PERMITIDAS.test(host)) {
      return new Response("Web no permitida: " + host, { status: 403, headers: cors });
    }

    const ttl = host === "api.gdeltproject.org" ? 900 : 300;
    const cache = caches.default;
    const clave = new Request(destino.toString());
    let resp = await cache.match(clave);
    if (!resp) {
      const r = await fetch(destino.toString(), {
        headers: { "User-Agent": CON_PROPIO.test(host) ? PROPIO : NAVEGADOR, "Accept": "application/rss+xml, application/xml, application/json, text/html;q=0.9, */*;q=0.8", "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
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
