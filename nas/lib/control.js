// Mando a distancia: el NAS escucha un segundo tema de ntfy (TU-TEMA-control).
// Desde el móvil se manda una palabra (o se pulsa un botón de un aviso) y el vigilante obedece.
//   apaga | apaga 2h   → deja de vigilar (del todo o durante un tiempo)
//   enciende           → vuelve a vigilar
//   silencio | silencio 8h → sigue vigilando, pero solo suenan las EMERGENCIAS
//   normal             → quita el silencio
//   estado             → te responde cómo está
import { CFG } from "./config.js";
import { mem, guardar } from "./store.js";
import { log, sleep, hora } from "./util.js";

const C = (mem.base.ctl ||= { apagadoHasta: 0, silencioHasta: 0 });
export const temaControl = () => (CFG.ntfyTopic ? CFG.ntfyTopic + "-control" : "");
export const apagado = () => C.apagadoHasta === -1 || Date.now() < C.apagadoHasta;
export const silenciado = () => C.silencioHasta === -1 || Date.now() < C.silencioHasta;
const hasta = (t) => (t === -1 ? "hasta que lo vuelvas a activar" : "hasta las " + hora(t));

// Botones que se añaden a los avisos de sistema (ntfy permite 3 por aviso)
export function botones() {
  const url = CFG.ntfyServer.replace(/\/$/, "") + "/" + temaControl(), h = CFG.ntfyToken ? { Authorization: "Bearer " + CFG.ntfyToken } : undefined;
  const b = (label, body) => ({ action: "http", label, url, method: "POST", body, ...(h ? { headers: h } : {}), clear: true });
  if (!temaControl()) return [];
  return apagado() ? [b("▶ Encender", "enciende"), b("Estado", "estado")]
    : [b("⏸ Apagar 2 h", "apaga 2h"), b(silenciado() ? "🔔 Sonido normal" : "🔕 Silenciar 8 h", silenciado() ? "normal" : "silencio 8h"), b("Estado", "estado")];
}

function duracion(txt) {
  const m = txt.match(/(\d+(?:[.,]\d+)?)\s*(m|min|h|d)\b/i); if (!m) return -1;
  const n = parseFloat(m[1].replace(",", ".")), u = m[2].toLowerCase();
  return Date.now() + n * (u.startsWith("m") ? 6e4 : u === "h" ? 36e5 : 864e5);
}

export async function ordenar(texto, responder) {
  const t = (texto || "").trim().toLowerCase();
  let r;
  if (/^(apaga|apagar|off|pausa|para|stop)/.test(t)) { C.apagadoHasta = duracion(t); r = `⏸ Vigilante apagado ${hasta(C.apagadoHasta)}. No consultará fuentes ni te avisará.`; }
  else if (/^(enciende|encender|on|activa|reanuda|start)/.test(t)) { C.apagadoHasta = 0; r = "▶ Vigilante encendido. Vuelve a vigilar."; }
  else if (/^(silencio|silencia|mute)/.test(t)) { C.silencioHasta = duracion(t); r = `🔕 Silencio ${hasta(C.silencioHasta)}: sigo vigilando, pero solo suenan las EMERGENCIAS. El resto va al resumen.`; }
  else if (/^(normal|sonido|unmute)/.test(t)) { C.silencioHasta = 0; r = "🔔 Sonido normal: vuelven a sonar todos los avisos."; }
  else if (/^(estado|status|\?)/.test(t)) r = null;
  else r = "No entiendo «" + texto.slice(0, 40) + "». Puedes escribir: apaga, apaga 2h, enciende, silencio, silencio 8h, normal o estado.";
  guardar(); log("Orden:", t, "→", r || "estado");
  await responder(r);
}

// Escucha permanente del tema de control (se reconecta sola)
export async function escuchar(responder) {
  if (!temaControl() || CFG.mock) return;
  let desde = Math.floor(Date.now() / 1000);
  for (let intento = 0; ; intento++) {
    try {
      const r = await fetch(`${CFG.ntfyServer.replace(/\/$/, "")}/${temaControl()}/json?since=${desde}`, { headers: CFG.ntfyToken ? { Authorization: "Bearer " + CFG.ntfyToken } : {} });
      if (!r.ok) throw new Error("HTTP " + r.status);
      intento = 0; const dec = new TextDecoder(); let buf = "";
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true }); let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const linea = buf.slice(0, i); buf = buf.slice(i + 1);
          let m; try { m = JSON.parse(linea); } catch { continue; }
          if (m.event !== "message") continue;
          desde = m.id;
          await ordenar(m.message, responder).catch((e) => log("control:", e.message));
        }
      }
      throw new Error("conexión cerrada");
    } catch (e) { log("control:", e.message); await sleep(Math.min(120000, 5000 * 2 ** Math.min(intento, 4))); }
  }
}
