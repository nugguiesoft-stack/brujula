// Motor de alertas: agrupa señales por tema y lugar, mide confirmación entre fuentes independientes,
// decide el nivel y avisa solo cuando algo sube de nivel (nunca repite lo mismo).
import { mem, visto, guardar, historial } from "./store.js";
import { avisar, NIVEL } from "./avisar.js";
import { hora, log } from "./util.js";

const CONF_TIPO = { sensor: 0.9, oficial: 0.85, prensa: 0.45, agencia: 0.6, social: 0.2, mercado: 0.3, ia: 0.1, aprendida: 0.5 };
export const PROX = { asturias: 1, espana: 0.9, ue: 0.65, europa: 0.55, mediterraneo: 0.5, oriente: 0.4, mundo: 0.25 };
const NOMBRE_TEMA = { nuclear: "Nuclear", belico: "Bélico", energia: "Energía", ciber: "Ciber", banca: "Banca", natural: "Natural", industrial: "Accidente industrial", sanitario: "Sanitario", social: "Social", otros: "General" };

export function nueva(s) { return { tipo: "prensa", S: 3, tema: "otros", lugar: { nombre: "", zona: "mundo" }, ...s }; }

function nivelDe(T) {
  if (T.forzar) return T.forzar;
  const p = T.maxS * (PROX[T.zona] ?? 0.25), c = T.conf;
  if (p >= 7 && c >= 0.8) return 4;
  if (p >= 5.5 && c >= 0.6) return 3;
  if (p >= 4 && c >= 0.6) return 2;
  if (p >= 6 && c < 0.6) return 1.5;
  return 0;
}

export async function procesar(senales, { calentar = false } = {}) {
  let n = 0;
  for (const s of senales) {
    if (!s || !s.clave || visto("s:" + s.clave, s.ttl || 72)) continue;
    n++;
    const lugarNombre = s.lugar?.nombre || s.lugar?.zona || "mundo";
    let g = s.grupo || `${s.tema}|${lugarNombre}`;
    // Si la prensa o las redes hablan de algo que un sensor ya detectó (mismo tema y zona, últimas 3 h), se suma a ese suceso
    if (!mem.temas[g] && s.tipo !== "sensor") {
      const pariente = Object.values(mem.temas).find((t) => t.tipos.sensor && t.tema === s.tema && t.zona === (s.lugar?.zona || "mundo") && Date.now() - t.ultimo < 3 * 36e5);
      if (pariente) g = pariente.g;
    }
    const T = (mem.temas[g] ||= { g, primero: Date.now(), fuentes: {}, tipos: {}, maxS: 0, conf: 0, nivel: 0, senales: [], zona: s.lugar?.zona || "mundo" });
    T.ultimo = Date.now();
    const ct = s.conf ?? CONF_TIPO[s.tipo] ?? 0.4;
    T.fuentes[s.fuente] = Math.max(T.fuentes[s.fuente] || 0, ct);
    T.tipos[s.tipo] = 1;
    // Confianza combinada: fuentes independientes se refuerzan (1 - producto de dudas)
    T.conf = Math.min(0.98, 1 - Object.values(T.fuentes).reduce((a, c) => a * (1 - c), 1));
    if (s.S >= T.maxS) { T.maxS = s.S; T.titulo = s.titulo; T.url = s.url; T.tema = s.tema; T.lugar = lugarNombre; T.zona = s.lugar?.zona || T.zona; }
    if (s.forzar && (!T.forzar || s.forzar > T.forzar)) T.forzar = s.forzar;
    T.senales.push({ t: Date.now(), fuente: s.fuenteNombre || s.fuente, titulo: s.titulo, url: s.url, tipo: s.tipo });
    T.senales = T.senales.slice(-12);
    const nuevo = nivelDe(T);
    if (nuevo > T.nivel && nuevo >= 1.5) {
      const antes = T.nivel; T.nivel = nuevo;
      const nf = Object.keys(T.fuentes).length;
      const confTxt = T.conf >= 0.8 ? "confirmado" : T.conf >= 0.6 ? "bastante probable" : "SIN CONFIRMAR";
      const lineas = [
        s.detalle || "",
        `Lugar: ${T.lugar} · Tema: ${NOMBRE_TEMA[T.tema] || T.tema} · Gravedad ${T.maxS}/10 · ${confTxt} (${nf} fuente${nf > 1 ? "s" : ""}).`,
        "Fuentes: " + [...new Set(T.senales.map((x) => x.fuente))].slice(-5).join(", ") + ".",
        antes === 1.5 && nuevo >= 2 ? "✅ La señal temprana anterior se ha confirmado." : "",
        nuevo === 1.5 ? "Es una primera señal: no actúes todavía. Te aviso si se confirma." : "",
        nuevo === 4 ? "Sigue ES-Alert y al 112. Comprueba en la Brújula antes de actuar." : ""
      ].filter(Boolean);
      await avisar({ soloRegistrar: calentar && nuevo < 4, nivel: nuevo, titulo: (antes === 1.5 && nuevo >= 2 ? "Se confirma · " : "") + (T.titulo || s.titulo), texto: lineas.join("\n"), url: T.url || s.url });
    }
  }
  if (n) guardar();
  return n;
}

// Índices 0–10 (misma idea que la web): suma ponderada decreciente de los temas de las últimas 48 h
export function indices() {
  const out = {};
  const temas = Object.values(mem.temas).filter((t) => Date.now() - t.ultimo < 48 * 36e5);
  for (const [ambito, k, prox] of [["asturias", 12, PROX], ["espana", 12, { ...PROX, asturias: 1, espana: 1 }], ["global", 16, null]]) {
    const cs = temas.map((t) => t.maxS * t.conf * (prox ? prox[t.zona] ?? 0.25 : 1) * (Date.now() - t.ultimo < 6 * 36e5 ? 1 : 0.8)).sort((a, b) => b - a);
    const W = [1, 0.35, 0.15]; const sc = cs.slice(0, 12).reduce((a, c, i) => a + c * (W[i] ?? 0.15 * 0.5 ** (i - 2)), 0);
    out[ambito] = Math.round(100 * (1 - Math.exp(-sc / k))) / 10;
  }
  return out;
}
let ultimoIdx = null;
export async function vigilarIndices() {
  const I = indices();
  for (const k of ["asturias", "espana", "global"]) historial("idx:" + k, I[k]);
  if (ultimoIdx) for (const [k, nombre] of [["asturias", "Asturias"], ["espana", "España"]]) {
    for (const umbral of [6, 8]) if (ultimoIdx[k] < umbral && I[k] >= umbral)
      await avisar({ nivel: umbral >= 8 ? 4 : 3, titulo: `El índice de ${nombre} sube a ${I[k].toFixed(1).replace(".", ",")}`, texto: `Pasa de ${ultimoIdx[k].toFixed(1)} a ${I[k].toFixed(1)}. Lo que más pesa: ${top(3).join(" · ")}`, url: undefined });
  }
  ultimoIdx = I; guardar();
  return I;
}
export function top(n = 5) {
  return Object.values(mem.temas).filter((t) => Date.now() - t.ultimo < 48 * 36e5)
    .sort((a, b) => b.maxS * b.conf * (PROX[b.zona] ?? 0.25) - a.maxS * a.conf * (PROX[a.zona] ?? 0.25)).slice(0, n).map((t) => t.titulo);
}
export { NIVEL, hora, log };
