// Envío de avisos al móvil: ntfy (recomendado) y/o Telegram. Horario de silencio y límite anti-avalancha.
import { CFG } from "./config.js";
import { horaLocal, log } from "./util.js";
import { mem, guardar } from "./store.js";
import { silenciado, apagado, botones } from "./control.js";

export const NIVEL = {
  4: { n: "EMERGENCIA", p: 5, tags: ["rotating_light"], ico: "🔴" },
  3: { n: "ALERTA", p: 4, tags: ["warning"], ico: "🟠" },
  2: { n: "AVISO", p: 3, tags: ["yellow_circle"], ico: "🟡" },
  1.5: { n: "SEÑAL TEMPRANA (sin confirmar)", p: 4, tags: ["eyes"], ico: "👁" },
  1: { n: "INFO", p: 2, tags: ["information_source"], ico: "ℹ️" }
};
export function enSilencio() {
  const [a, b] = CFG.silencio.split("-").map(Number); if (isNaN(a) || isNaN(b)) return false;
  const [h] = horaLocal(); return a > b ? h >= a || h < b : h >= a && h < b;
}
const cola = [];         // avisos retenidos (silencio o exceso) para el resumen
export const retenidos = () => cola.splice(0);

export async function avisar({ nivel = 2, titulo, texto, url, forzar = false, soloRegistrar = false, sistema = false }) {
  const N = NIVEL[nivel] || NIVEL[2];
  // Primer arranque: lo que ya estaba pasando se anota, pero no suena (salvo emergencias)
  if (soloRegistrar) { mem.alertas.push({ t: Date.now(), nivel, titulo, texto: (texto || "").slice(0, 400), url, previo: true }); guardar(); return false; }
  const ultimaHora = mem.alertas.filter((a) => Date.now() - a.t < 36e5 && a.nivel < 4 && !a.previo && !a.sistema).length;
  if (!sistema && apagado()) { log("(apagado) no se avisa:", titulo); return false; }
  if (!forzar && nivel < 4 && (enSilencio() || silenciado() || ultimaHora >= 8)) { cola.push({ nivel, titulo, texto, url, t: Date.now() }); log("retenido:", titulo); return false; }
  mem.alertas.push({ t: Date.now(), nivel, titulo, texto: (texto || "").slice(0, 400), url, ...(sistema ? { sistema: true } : {}) }); guardar();
  const title = `${N.ico} ${N.n}: ${titulo}`.slice(0, 250);
  log("AVISO", title);
  const tareas = [];
  if (CFG.ntfyTopic) tareas.push(fetch(CFG.ntfyServer.replace(/\/$/, "") + "/", {
    method: "POST", headers: { "Content-Type": "application/json", ...(CFG.ntfyToken ? { Authorization: "Bearer " + CFG.ntfyToken } : {}) },
    body: JSON.stringify({ topic: CFG.ntfyTopic, title, message: (texto || "").slice(0, 3500), priority: N.p, tags: N.tags, click: url || CFG.web,
      actions: sistema ? botones() : url ? [{ action: "view", label: "Fuente", url }, { action: "view", label: "Brújula", url: CFG.web }] : [{ action: "view", label: "Brújula", url: CFG.web }] })
  }).then((r) => { if (!r.ok) throw new Error("ntfy HTTP " + r.status); }));
  if (CFG.telegramToken && CFG.telegramChat) tareas.push(fetch(`https://api.telegram.org/bot${CFG.telegramToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CFG.telegramChat, text: `${title}\n\n${texto || ""}${url ? "\n" + url : ""}`.slice(0, 4000), disable_web_page_preview: true, disable_notification: nivel < 3 })
  }).then((r) => { if (!r.ok) throw new Error("Telegram HTTP " + r.status); }));
  if (!tareas.length) { log("(sin canal de avisos configurado)"); return false; }
  const res = await Promise.allSettled(tareas);
  for (const r of res) if (r.status === "rejected") log("Error al avisar:", r.reason?.message);
  return res.some((r) => r.status === "fulfilled");
}
