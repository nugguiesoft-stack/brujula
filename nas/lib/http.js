// Peticiones a internet: tiempo límite, reintentos, pausa mínima por web y caché condicional (ahorra datos).
import fs from "node:fs";
import { CFG } from "./config.js";
import { sleep } from "./util.js";
const UA = "BrujulaEmergencia/1.0 (+https://github.com/nugguiesoft-stack/brujula; uso personal, sin fines comerciales)";
const UA_NAV = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const ultimo = new Map(), cond = new Map(), comoNavegador = new Set();
const MAX_COND = 40, MAX_CUERPO = 250000;   // la caché condicional no puede crecer sin límite (1 GB de RAM en el NAS)
const PAUSA = { "api.gdeltproject.org": 6000, "news.google.com": 2500, "opensky-network.org": 2000, "api.adsb.lol": 1500, "t.me": 1500 };

export async function pedir(url, { json = false, timeout = 20000, headers = {}, reintentos = 1, condicional = true } = {}) {
  if (CFG.mock) return simulado(url, json);
  const host = new URL(url).hostname;
  const gap = PAUSA[host] || 300;
  const espera = (ultimo.get(host) || 0) + gap - Date.now();
  if (espera > 0) await sleep(espera);
  ultimo.set(host, Date.now());
  const h = { "User-Agent": comoNavegador.has(host) ? UA_NAV : UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8", ...headers };
  const c = condicional && cond.get(url);
  if (c?.etag) h["If-None-Match"] = c.etag; else if (c?.mod) h["If-Modified-Since"] = c.mod;
  for (let i = 0; ; i++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { headers: h, signal: ctl.signal, redirect: "follow" });
      if (r.status === 304 && c) return json ? JSON.parse(c.body) : c.body;
      const body = await r.text();
      // Algunas webs (p. ej. La Nueva España) rechazan identificadores que no parecen un navegador: se reintenta una vez como navegador y se recuerda
      if ((r.status === 403 || r.status === 406) && !comoNavegador.has(host)) { comoNavegador.add(host); h["User-Agent"] = UA_NAV; delete h["If-None-Match"]; delete h["If-Modified-Since"]; i--; continue; }
      if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status });
      if (condicional && (r.headers.get("etag") || r.headers.get("last-modified")) && body.length < MAX_CUERPO && !/[?&](start|from|until|start_date|fecha|since)=/.test(url)) {
        cond.delete(url); cond.set(url, { etag: r.headers.get("etag"), mod: r.headers.get("last-modified"), body });
        if (cond.size > MAX_COND) cond.delete(cond.keys().next().value);
      }
      return json ? JSON.parse(body) : body;
    } catch (e) {
      const transitorio = e.name === "AbortError" || /429|50\d/.test(String(e.status || "")) || /fetch failed|ECONN|ETIMEDOUT|EAI_AGAIN/.test(e.message);
      if (i >= reintentos || !transitorio) throw e.name === "AbortError" ? new Error("Tiempo agotado") : e;
      await sleep(e.status === 429 ? 15000 : 3000 * (i + 1));
    } finally { clearTimeout(t); }
  }
}

// Modo de prueba: lee respuestas guardadas en una carpeta (nombre = host + ruta resumida)
function simulado(url, json) {
  const u = new URL(url);
  const nombre = (u.hostname + u.pathname).replace(/[^a-z0-9.]+/gi, "_").slice(0, 120);
  const ruta = `${CFG.mock}/${nombre}`;
  if (!fs.existsSync(ruta)) return Promise.reject(new Error("HTTP 404 (simulado: falta " + nombre + ")"));
  const body = fs.readFileSync(ruta, "utf8");
  return Promise.resolve(json ? JSON.parse(body) : body);
}
