// Memoria persistente en /data (sobrevive a reinicios): lo ya visto, líneas base, historial y alertas enviadas.
import fs from "node:fs";
import { DATA } from "./config.js";
const RUTA = `${DATA}/memoria.json`;
let M = { visto: {}, base: {}, hist: {}, alertas: [], temas: {}, fuentes: {} };
try { fs.mkdirSync(DATA, { recursive: true }); M = { ...M, ...JSON.parse(fs.readFileSync(RUTA, "utf8")) }; } catch {}
export const mem = M;
export function visto(clave, ttlHoras = 72) {
  const ya = M.visto[clave]; M.visto[clave] = Date.now();
  return !!ya && Date.now() - ya < ttlHoras * 36e5;
}
// Línea base que aprende sola: media móvil exponencial por clave (y por franja horaria si se pide)
export function base(clave, valor, alfa = 0.15) {
  const b = M.base[clave];
  M.base[clave] = b == null ? valor : b + alfa * (valor - b);
  return b;
}
export function historial(clave, valor, max = 96) { (M.hist[clave] ||= []).push([Date.now(), valor]); if (M.hist[clave].length > max) M.hist[clave].splice(0, M.hist[clave].length - max); }
// Escribe en disco como mucho cada 10 min (o al apagar): así los discos del NAS pueden dormir
let pendiente = null, ultimaEscritura = 0;
export function guardar(yaMismo = false) {
  if (pendiente && !yaMismo) return;
  clearTimeout(pendiente);
  const espera = yaMismo ? 0 : Math.max(2000, ultimaEscritura + 10 * 60000 - Date.now());
  pendiente = setTimeout(() => {
    pendiente = null; ultimaEscritura = Date.now();
    const lim = Date.now() - 7 * 864e5;
    for (const [k, t] of Object.entries(M.visto)) if (t < lim) delete M.visto[k];
    M.alertas = M.alertas.slice(-300);
    for (const [k, t] of Object.entries(M.temas)) if (Date.now() - t.ultimo > 3 * 864e5) delete M.temas[k];
    fs.writeFileSync(RUTA + ".tmp", JSON.stringify(M)); fs.renameSync(RUTA + ".tmp", RUTA);
  }, espera);
}
