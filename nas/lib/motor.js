// Motor de alertas: agrupa señales por tema y lugar, mide la confirmación entre fuentes INDEPENDIENTES,
// decide el nivel y avisa solo cuando algo sube de nivel (nunca repite lo mismo).
//
// Reglas de «rumor frente a hecho» (v1.3):
//  1. Una sola fuente que no sea un sensor ni un organismo oficial nunca pasa de SEÑAL TEMPRANA (sin confirmar).
//  2. Un dato atribuido («según un sindicato…», «habría muerto…») cuenta como UNA fuente aunque lo repitan diez medios.
//  3. Un desmentido no confirma el suceso: lo corrige. Si lo desmiente una fuente oficial (o dos medios),
//     lo que estaba sin confirmar se retira y se avisa de la corrección.
import { mem, visto, guardar, historial } from "./store.js";
import { avisar, NIVEL } from "./avisar.js";
import { hora, log } from "./util.js";

const CONF_TIPO = { sensor: 0.9, oficial: 0.85, prensa: 0.45, agencia: 0.6, social: 0.2, mercado: 0.3, ia: 0.1, aprendida: 0.5 };
const CONFIRMA = { sensor: 1, oficial: 1 };                 // tipos que confirman por sí solos
const INDEPENDIENTE = { prensa: 1, agencia: 1, aprendida: 1 }; // tipos que confirman si coinciden dos distintos
export const PROX = { asturias: 1, espana: 0.9, ue: 0.65, europa: 0.55, mediterraneo: 0.5, oriente: 0.4, mundo: 0.25 };
const NOMBRE_TEMA = { nuclear: "Nuclear", belico: "Bélico", seguridad: "Terrorismo y seguridad", energia: "Energía", ciber: "Ciber", banca: "Banca", natural: "Natural", industrial: "Accidente industrial", sanitario: "Sanitario", social: "Social", otros: "General" };
// Qué hacer, en una línea prudente. Siempre remite a las fuentes oficiales.
export const QUE_HACER = {
  4: "Qué hacer: sigue las instrucciones de ES-Alert y del 112. No te desplaces si no es necesario y ten el móvil cargado.",
  3: "Qué hacer: infórmate en fuentes oficiales (112 Asturias, AEMET, Policía) y evita la zona afectada. No hace falta más por ahora.",
  2: "Qué hacer: nada especial. Tenlo presente por si cambia.",
  1.5: "Qué hacer: nada todavía. Es una primera señal sin confirmar; te aviso si se confirma o se desmiente."
};

export function nueva(s) { return { tipo: "prensa", S: 3, tema: "otros", lugar: { nombre: "", zona: "mundo" }, ...s }; }

// ¿Está confirmado por algo más que una sola voz?
function confirmado(T) {
  if (Object.keys(T.tipos).some((t) => CONFIRMA[t])) return true;
  return Object.keys(T.indep || {}).length >= 2;
}
function nivelDe(T) {
  if (T.retirado) return 0;
  if (T.forzar) return T.forzar;
  const p = T.maxS * (PROX[T.zona] ?? 0.25), c = T.conf, ok = confirmado(T);
  if (ok && p >= 8 && c >= 0.8) return 4;
  if (ok && p >= 5.5 && c >= 0.6) return 3;
  if (ok && p >= 4 && c >= 0.6) return 2;
  if (p >= 5.5) return 1.5;            // grave pero con una sola voz (o solo redes, apuestas, datos atribuidos)
  return 0;
}
// Busca el suceso al que se refiere un desmentido: mismo tema y lugar, o mismo lugar en las últimas 48 h
function objetivoDe(s) {
  const lugar = s.lugar?.nombre || "", zona = s.lugar?.zona || "mundo";
  const mismoLugar = (t) => (lugar ? t.lugar === lugar || (zona === "asturias" && t.zona === "asturias" && (t.lugar === "Asturias" || lugar === "Asturias")) : t.zona === zona);
  const cand = Object.values(mem.temas).filter((t) => !t.retirado && t.maxS > 0 && Date.now() - t.ultimo < 48 * 36e5 && mismoLugar(t) && (t.tema === s.tema || !s.tema || s.tema === "otros"));
  return cand.sort((a, b) => b.ultimo - a.ultimo)[0] || null;
}

export async function procesar(senales, { calentar = false } = {}) {
  let n = 0;
  for (const s of senales) {
    if (!s || !s.clave || visto("s:" + s.clave, s.ttl || 72)) continue;
    n++;
    const lugarNombre = s.lugar?.nombre || s.lugar?.zona || "mundo";
    const fuenteTxt = s.fuenteNombre || s.fuente;

    // --- Desmentidos: corrigen, no confirman ---
    if (s.desmiente) {
      const T = objetivoDe(s);
      if (!T) continue;                                   // desmiente algo que no teníamos: no es noticia para nosotros
      const oficial = s.tipo === "oficial" || /polic[ií]a|guardia civil|delegaci[oó]n del gobierno|interior|112|protecci[oó]n civil|ministerio|ayuntamiento|gobierno/i.test(s.titulo || "");
      (T.desmentidos ||= {})[s.fuente] = 1;
      T.senales.push({ t: Date.now(), fuente: fuenteTxt, titulo: s.titulo, url: s.url, tipo: s.tipo, desmiente: true }); T.senales = T.senales.slice(-12);
      const firme = oficial || Object.keys(T.desmentidos).length >= 2;
      if (firme && !T.desmentido) {
        T.desmentido = { t: Date.now(), fuente: fuenteTxt, titulo: s.titulo, url: s.url, oficial };
        const eraFirme = confirmado(T) && !T.soloAtribuido;
        // Si el suceso solo se apoyaba en una voz o en datos atribuidos, se retira. Si estaba bien confirmado, se mantiene y se anota la corrección.
        if (!eraFirme) { T.retirado = true; T.nivelAntes = T.nivel; T.nivel = 0; }
        if (T.nivel >= 1.5 || T.nivelAntes >= 1.5)
          await avisar({ soloRegistrar: calentar, nivel: 1, correccion: true,   // de noche no despierta: va al resumen
            titulo: (eraFirme ? "Corrección · " : "Desmentido · ") + (T.titulo || "").slice(0, 160),
            texto: [`${oficial ? "Fuente oficial" : "Varios medios"} lo ${eraFirme ? "corrigen en parte" : "desmienten"}: «${s.titulo}» (${fuenteTxt}).`,
              eraFirme ? "El suceso principal sigue confirmado; lo desmentido es un dato concreto." : "Lo retiro: no estaba confirmado por fuentes independientes."].join("\n"), url: s.url || T.url });
      }
      continue;
    }

    let g = s.grupo || `${s.tema}|${lugarNombre}`;
    // Si la prensa o las redes hablan de algo que un sensor ya detectó (mismo tema y zona, últimas 3 h, y el titular habla de eso mismo), se suma a ese suceso
    if (!mem.temas[g] && s.tipo !== "sensor") {
      const pariente = Object.values(mem.temas).find((t) => t.tipos.sensor && t.tema === s.tema && t.zona === (s.lugar?.zona || "mundo") && Date.now() - t.ultimo < 3 * 36e5
        && (!t.palabras || new RegExp(t.palabras, "i").test(s.titulo || "")));
      if (pariente) g = pariente.g;
    }
    // En Asturias, «…en Asturias» y «…en Oviedo» suelen ser el mismo suceso: si uno de los dos es genérico, se juntan (12 h)
    if (!mem.temas[g] && !s.grupo && s.lugar?.zona === "asturias") {
      const mismo = Object.values(mem.temas).filter((t) => t.tema === s.tema && t.zona === "asturias" && !t.g.includes("|aemet") && Date.now() - t.ultimo < 12 * 36e5 && (t.lugar === "Asturias" || lugarNombre === "Asturias")).sort((a, b) => b.ultimo - a.ultimo)[0];
      if (mismo) g = mismo.g;
    }
    let T = mem.temas[g];
    // Un suceso retirado por desmentido no revive con más titulares de la misma voz; solo con una fuente que confirme por sí sola.
    if (T?.retirado) { if (CONFIRMA[s.tipo] && !s.atribuido) { T.retirado = false; T.desmentido = null; } else continue; }
    T = (mem.temas[g] ||= { g, primero: Date.now(), fuentes: {}, tipos: {}, indep: {}, maxS: 0, conf: 0, nivel: 0, senales: [], zona: s.lugar?.zona || "mundo", soloAtribuido: true });
    T.indep ||= {};
    T.ultimo = Date.now();
    if (s.palabras) T.palabras = s.palabras;
    let ct = s.conf ?? CONF_TIPO[s.tipo] ?? 0.4;
    if (s.atribuido) ct = Math.min(ct, 0.3);              // «según un sindicato…»: vale poco, lo publique quien lo publique
    else { T.soloAtribuido = false; if (INDEPENDIENTE[s.tipo]) T.indep[s.fuente] = 1; }
    T.fuentes[s.fuente] = Math.max(T.fuentes[s.fuente] || 0, ct);
    if (!s.atribuido) T.tipos[s.tipo] = 1; else T.tipos.atribuido = 1;
    // Confianza combinada: fuentes independientes se refuerzan (1 - producto de dudas).
    // Los datos atribuidos no se acumulan entre sí: diez medios citando al mismo sindicato son una sola voz.
    const firmes = Object.entries(T.fuentes).filter(([, c]) => c > 0.3).map(([, c]) => c), hayAtrib = Object.values(T.fuentes).some((c) => c <= 0.3);
    T.conf = Math.min(0.98, 1 - [...firmes, ...(hayAtrib ? [0.3] : [])].reduce((a, c) => a * (1 - c), 1));
    if (T.soloAtribuido) T.conf = Math.min(T.conf, 0.5);
    if (s.S >= T.maxS && !(s.atribuido && T.maxS > 0 && !T.soloAtribuido)) { T.maxS = s.S; T.titulo = s.titulo; T.url = s.url; T.tema = s.tema; T.lugar = lugarNombre; T.zona = s.lugar?.zona || T.zona; }
    if (s.forzar && (!T.forzar || s.forzar > T.forzar)) T.forzar = s.forzar;
    T.senales.push({ t: Date.now(), fuente: fuenteTxt, titulo: s.titulo, url: s.url, tipo: s.tipo, ...(s.atribuido ? { atribuido: true } : {}) });
    T.senales = T.senales.slice(-12);
    const nuevo = nivelDe(T);
    if (nuevo > T.nivel && nuevo >= 1.5) {
      const antes = T.nivel; T.nivel = nuevo;
      const nf = Object.keys(T.fuentes).length, ok = confirmado(T);
      const confTxt = !ok ? "SIN CONFIRMAR" : T.conf >= 0.8 ? "confirmado" : "bastante probable";
      const lineas = [
        s.detalle || "",
        `Lugar: ${T.lugar} · Tema: ${NOMBRE_TEMA[T.tema] || T.tema} · Gravedad ${T.maxS}/10 · ${confTxt} (${nf} fuente${nf > 1 ? "s" : ""}).`,
        "Fuentes: " + [...new Set(T.senales.filter((x) => !x.desmiente).map((x) => x.fuente))].slice(-5).join(", ") + ".",
        T.soloAtribuido ? "Ojo: es un dato atribuido a una parte, no un hecho comprobado." : "",
        antes === 1.5 && nuevo >= 2 ? "✅ La señal temprana anterior se ha confirmado." : "",
        QUE_HACER[nuevo] || ""
      ].filter(Boolean);
      await avisar({ soloRegistrar: calentar && nuevo < 4, nivel: nuevo, titulo: (antes === 1.5 && nuevo >= 2 ? "Se confirma · " : "") + (T.titulo || s.titulo), texto: lineas.join("\n"), url: T.url || s.url });
    }
  }
  if (n) guardar();
  return n;
}

// Índices 0–10 (misma idea que la web): suma ponderada decreciente de los temas de las últimas 48 h,
// con un suelo para lo local: un suceso grave y confirmado en casa no puede quedar diluido entre noticias lejanas.
const vivos = () => Object.values(mem.temas).filter((t) => !t.retirado && Date.now() - t.ultimo < 48 * 36e5);
const peso = (t, prox) => t.maxS * t.conf * (prox ? prox[t.zona] ?? 0.25 : 1) * (Date.now() - t.ultimo < 6 * 36e5 ? 1 : 0.8) * (confirmado(t) ? 1 : 0.5);
export function indices() {
  const out = {}; const temas = vivos();
  for (const [ambito, k, prox, locales] of [["asturias", 12, PROX, ["asturias"]], ["espana", 12, { ...PROX, asturias: 1, espana: 1 }, ["asturias", "espana"]], ["global", 16, null, []]]) {
    const cs = temas.map((t) => peso(t, prox)).sort((a, b) => b - a);
    const W = [1, 0.35, 0.15]; const sc = cs.slice(0, 12).reduce((a, c, i) => a + c * (W[i] ?? 0.15 * 0.5 ** (i - 2)), 0);
    let v = 10 * (1 - Math.exp(-sc / k));
    for (const t of temas) if (locales.includes(t.zona) && confirmado(t) && t.conf >= 0.6) v = Math.max(v, Math.min(9.5, 0.9 * peso(t, prox)));
    out[ambito] = Math.round(v * 10) / 10;
  }
  return out;
}
let ultimoIdx = null;
export async function vigilarIndices() {
  const I = indices();
  for (const k of ["asturias", "espana", "global"]) historial("idx:" + k, I[k]);
  if (ultimoIdx) for (const [k, nombre] of [["asturias", "Asturias"], ["espana", "España"]]) {
    for (const umbral of [6, 8]) if (ultimoIdx[k] < umbral && I[k] >= umbral)
      await avisar({ nivel: umbral >= 8 ? 4 : 3, titulo: `El índice de ${nombre} sube a ${I[k].toFixed(1).replace(".", ",")}`, texto: `Pasa de ${ultimoIdx[k].toFixed(1)} a ${I[k].toFixed(1)}. Lo que más pesa: ${top(3).join(" · ")}\n${QUE_HACER[umbral >= 8 ? 4 : 3]}`, url: undefined });
  }
  ultimoIdx = I; guardar();
  return I;
}
export function top(n = 5) {
  return vivos().sort((a, b) => peso(b, PROX) - peso(a, PROX)).slice(0, n).map((t) => t.titulo);
}
export { NIVEL, hora, log, confirmado };
