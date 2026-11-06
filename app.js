/* Brújula de Emergencia — se ejecuta entero en el navegador.
   Capa del analista: datos/analisis.json (revisado a mano).
   Capa automática: GDELT, USGS, NOAA y Polymarket, consultados al abrir la página. */
(function () {
"use strict";

/* ===================== Configuración ===================== */
const NIV = {
  rumor: [0.15, "Rumor", 1], fuente_unica: [0.35, "Fuente única", 2], medios_locales: [0.45, "Medios locales", 3],
  varios_medios: [0.65, "Varios medios", 4], oficial: [0.85, "Oficial", 5], confirmado: [1, "Confirmado", 6]
};
const TEND = { escala: [1.15, "↑ Escala"], estable: [1, "→ Estable"], desescala: [0.85, "↓ Se calma"] };
const DOM = [["belico", "Bélico"], ["nuclear", "Nuclear"], ["energia", "Energía y precios"], ["ciber", "Ciber e híbrido"],
  ["banca", "Banca y economía"], ["social", "Social"], ["sanitario", "Sanitario"], ["natural", "Natural y clima"]];
const DOMNAME = Object.fromEntries(DOM);
const ZP = {
  asturias: { asturias: 1, espana: 0.85, ue: 0.7, europa: 0.6, mediterraneo: 0.5, oriente: 0.4, mundo: 0.2 },
  espana:   { asturias: 1, espana: 1,    ue: 0.75, europa: 0.65, mediterraneo: 0.55, oriente: 0.45, mundo: 0.2 }
};
const SCOPES = [["asturias", "Asturias"], ["espana", "España"], ["global", "Escalada global"]];
const HOME = [43.36, -5.85];
const GDELT_GAP_MS = 5600;          // GDELT admite 1 consulta cada 5 s
const CACHE_MIN = 20;               // minutos antes de volver a consultar al abrir

/* Consultas a GDELT (busca en 65 idiomas traducidos al inglés) */
const THEMES = [
  { id: "nuclear", dominio: "nuclear", S: 7, titulo: "Alarma nuclear o radiológica",
    q: '("nuclear strike" OR "nuclear attack" OR "nuclear threat" OR "iodine tablets" OR "radiation leak" OR "nuclear alert")' },
  { id: "guerra", dominio: "belico", S: 6, titulo: "Ataques y movilizaciones",
    q: '("missile strike" OR "airstrike" OR "air raid" OR "declares war" OR "military mobilization" OR "ballistic missile")' },
  { id: "espana", dominio: "social", S: 4, titulo: "Alertas en España",
    q: '(blackout OR cyberattack OR evacuation OR explosion OR "state of emergency" OR "terror attack") sourcecountry:spain' },
  { id: "asturias", dominio: "natural", S: 4, titulo: "Alertas en Asturias",
    q: 'asturias (alert OR emergency OR evacuation OR fire OR flood OR storm OR explosion OR blackout)' },
  { id: "ciberbanca", dominio: "ciber", S: 5, titulo: "Ciberataques y banca",
    q: '(cyberattack OR ransomware OR "bank run" OR "bank collapse" OR "banking system" OR "payment outage")' },
  { id: "energia", dominio: "energia", S: 4, titulo: "Energía y suministros",
    q: '("power outage" OR blackout OR "fuel shortage" OR rationing OR "oil supply" OR "gas supply")' },
  { id: "evacuacion", dominio: "belico", S: 6, titulo: "Evacuaciones y avisos de embajadas",
    q: '("embassy evacuation" OR "evacuate citizens" OR "leave the country" OR "shelter in place" OR "travel warning")' },
  { id: "salud", dominio: "sanitario", S: 4, titulo: "Brotes y emergencias sanitarias",
    q: '(outbreak OR epidemic OR pandemic OR "health emergency") (virus OR disease)' }
];

/* Palabras que suben la gravedad de un titular (varios idiomas) */
const BOOST = [
  [/nuclear (strike|attack|war)|ataque nuclear|guerra nuclear|frappe nucléaire|ядерн/i, 9],
  [/iodine|yodo|iode|йод/i, 8],
  [/declares? war|declara(ción de)? la guerra|déclar.* la guerre/i, 9],
  [/nato|otan/i, 1],
  [/ballistic|balístic|hypersonic|hipersónic/i, 1],
  [/bank run|corralito|colapso bancario|bank collapse|retirada masiva/i, 6],
  [/blackout|apagón|apagon|coupure générale/i, 1],
  [/shelter in place|confinamiento|confínense|stay indoors/i, 2]
];

/* Gazetteer: palabra en el titular o país de origen → lugar */
const PLACES = [
  ["asturias|oviedo|gijón|gijon|avilés|aviles|carreño|siero|langreo", "Asturias", 43.36, -5.85, "asturias"],
  ["spain|españa|espagne|madrid|barcelona|valencia|sevilla|bilbao|galicia|cantabria|león", "España", 40.4, -3.7, "espana"],
  ["portugal|lisbon|lisboa", "Portugal", 39.4, -8.2, "ue"], ["france|francia|paris|parís", "Francia", 46.6, 2.4, "ue"],
  ["germany|alemania|berlin", "Alemania", 51.2, 10.4, "ue"], ["italy|italia|rome|roma", "Italia", 42.8, 12.6, "ue"],
  ["poland|polonia|warsaw|varsovia", "Polonia", 52.1, 19.4, "ue"], ["lithuania|lituania|vilnius", "Lituania", 55.2, 23.9, "ue"],
  ["latvia|letonia|riga", "Letonia", 56.9, 24.6, "ue"], ["estonia|tallinn", "Estonia", 58.6, 25.0, "ue"],
  ["finland|finlandia|helsinki", "Finlandia", 64.0, 26.0, "ue"], ["sweden|suecia|stockholm", "Suecia", 60.1, 18.6, "ue"],
  ["denmark|dinamarca|copenhagen", "Dinamarca", 56.0, 10.0, "ue"], ["netherlands|países bajos|holanda|amsterdam", "Países Bajos", 52.1, 5.3, "ue"],
  ["belgium|bélgica|brussels|bruselas", "Bélgica", 50.5, 4.5, "ue"], ["romania|rumanía|rumania|bucharest", "Rumanía", 45.9, 24.9, "ue"],
  ["greece|grecia|athens|atenas|crete|creta", "Grecia", 39.1, 21.8, "ue"], ["kaliningrad|kaliningrado", "Kaliningrado", 54.7, 20.5, "ue"],
  ["united kingdom|reino unido|britain|london|londres", "Reino Unido", 54.0, -2.0, "europa"],
  ["ukraine|ucrania|kyiv|kiev|kharkiv|odesa|zaporizh", "Ucrania", 48.4, 31.2, "europa"],
  ["russia|rusia|moscow|moscú", "Rusia", 55.8, 37.6, "europa"], ["belarus|bielorrusia|minsk", "Bielorrusia", 53.7, 27.9, "europa"],
  ["serbia|kosovo|balkans|balcanes", "Balcanes", 43.5, 20.8, "europa"], ["turkey|türkiye|turquía|ankara|istanbul", "Turquía", 39.0, 35.0, "mediterraneo"],
  ["morocco|marruecos|rabat", "Marruecos", 31.8, -7.1, "mediterraneo"], ["algeria|argelia|algiers", "Argelia", 28.0, 2.6, "mediterraneo"],
  ["libya|libia|tripoli", "Libia", 26.3, 17.2, "mediterraneo"], ["egypt|egipto|cairo", "Egipto", 26.8, 30.8, "mediterraneo"],
  ["israel|tel aviv|jerusalem|jerusalén", "Israel", 31.4, 35.0, "oriente"], ["gaza|west bank|cisjordania", "Palestina", 31.5, 34.45, "oriente"],
  ["lebanon|líbano|beirut", "Líbano", 33.9, 35.8, "oriente"], ["syria|siria|damascus", "Siria", 35.0, 38.5, "oriente"],
  ["iran|irán|tehran|teherán", "Irán", 32.4, 53.7, "oriente"], ["hormuz|ormuz", "Ormuz", 26.6, 56.3, "oriente"],
  ["iraq|irak|baghdad", "Irak", 33.2, 43.7, "oriente"], ["saudi|arabia saudí|riyadh|medina|mecca", "Arabia Saudí", 23.9, 45.1, "oriente"],
  ["yemen|houthi|hutí", "Yemen", 15.6, 48.5, "oriente"], ["qatar|catar|doha", "Catar", 25.3, 51.2, "oriente"],
  ["jordan|jordania|amman", "Jordania", 31.95, 35.9, "oriente"], ["pakistan|pakistán", "Pakistán", 30.4, 69.3, "mundo"],
  ["india|delhi", "India", 21.0, 78.0, "mundo"], ["china|beijing|pekín", "China", 35.9, 104.2, "mundo"],
  ["taiwan|taiwán|taipei", "Taiwán", 23.7, 121.0, "mundo"], ["north korea|corea del norte|pyongyang", "Corea del Norte", 40.3, 127.5, "mundo"],
  ["japan|japón|tokyo", "Japón", 36.2, 138.3, "mundo"], ["united states|ee\\.? ?uu|washington|pentagon|pentágono|white house", "EE. UU.", 38.9, -77.0, "mundo"],
  ["venezuela|caracas", "Venezuela", 6.4, -66.6, "mundo"], ["paraguay|asunción", "Paraguay", -25.3, -57.6, "mundo"],
  ["sudan|sudán|khartoum", "Sudán", 15.5, 32.5, "mundo"]
].map(([re, name, lat, lon, zona]) => ({ re: new RegExp("\\b(" + re + ")", "i"), name, lat, lon, zona }));
const OFFICIAL = /(\.gov(\.|$)|\.gob\.|\.gouv\.|\.mil(\.|$)|nato\.int|europa\.eu|un\.org|who\.int|iaea\.org|lamoncloa|interior\.gob|112asturias|dsn\.gob)/i;

/* Qué puede significar cada tipo de riesgo para ti */
const RISK_TEXT = {
  belico: "Riesgo militar directo bajo para España salvo que la OTAN entre en combate. Lo normal es que te llegue en forma de precios, vuelos cancelados y alertas de viaje.",
  nuclear: "Es el escenario más grave y el más sujeto a rumores. Fíate solo de comunicados oficiales y de ES-Alert. No actúes por un único titular.",
  energia: "Subidas de gasolina, gasóleo, luz y transporte. En el peor caso, escasez puntual de combustible.",
  ciber: "Caídas de bancos, pagos con tarjeta, administración o aeropuertos durante horas o días. Ten algo de efectivo en casa.",
  banca: "Bloqueos temporales de cuentas, apps o tarjetas, como en Paraguay. En la UE los depósitos están garantizados hasta 100.000 €.",
  social: "Protestas, huelgas y cortes de carreteras o transporte.",
  sanitario: "Medidas sanitarias, saturación de servicios o restricciones si un brote se extiende.",
  natural: "Temporales, inundaciones, incendios o sismos. Sigue los avisos de AEMET y del 112 de Asturias."
};

/* ===================== Utilidades ===================== */
const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v; else if (k === "style") el.style.cssText = v; else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : String(c)); }
  return el;
}
function s(tag, attrs) { const el = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); return el; }
const num = (x, d = 1) => Number(x).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function safeUrl(u) { try { const x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : null; } catch { return null; } }
function fecha(iso) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}$/.test(iso) || /\//.test(iso)) return iso;
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return isNaN(d) ? iso : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
function km(a, b, c, d) { const R = 6371, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
function gdeltDate(sd) { // 20261106T153000Z
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(sd || "");
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

/* ===================== Cálculo ===================== */
function pScope(e, scope) {
  if (scope === "global") return 1;
  let p = ZP[scope][e.zona] ?? 0.2;
  if (e.impacto_espana) p = Math.max(p, 0.9);
  return p;
}
function contrib(e, scope = "asturias") {
  const c = (+e.S || 0) * (NIV[e.nivel]?.[0] ?? 0.35) * pScope(e, scope) * (TEND[e.tendencia]?.[0] ?? 1);
  return e.nivel === "rumor" ? Math.min(c, 1) : c;
}
function indice(evs, scope) {
  const cs = evs.map((e) => contrib(e, scope)).sort((a, b) => b - a);
  if (!cs.length) return 0;
  const sc = cs[0] + (cs[1] ? 0.35 * cs[1] : 0) + 0.15 * cs.slice(2).reduce((a, b) => a + b, 0);
  let v = 10 * (1 - Math.exp(-sc / (scope === "global" ? 16 : 12)));
  if (scope !== "global") for (const e of evs) {
    const c = NIV[e.nivel]?.[0] ?? 0, p = pScope(e, scope);
    if (e.S >= 9 && c >= 0.85 && p >= 0.7) v = Math.max(v, 9);
    else if (e.S >= 8 && c >= 0.85 && p >= 1) v = Math.max(v, 8);
  }
  return Math.round(v * 10) / 10;
}
function dominio(evs, d, scope = "asturias") {
  const cs = evs.filter((e) => e.dominio === d).map((e) => contrib(e, scope)).sort((a, b) => b - a);
  if (!cs.length) return 0;
  const sc = cs[0] + 0.35 * cs.slice(1).reduce((a, b) => a + b, 0);
  return Math.round(100 * (1 - Math.exp(-sc / 6))) / 10;
}
function nivelDe(v) {
  if (v < 2) return ["Calma", "--ok"]; if (v < 4) return ["Vigilancia", "--watch"];
  if (v < 6) return ["Tensión", "--tense"]; if (v < 8) return ["Alerta", "--alert"]; return ["Emergencia", "--crit"];
}
function sevColor(c) { return c >= 4 ? css("--alert") : c >= 2.5 ? css("--tense") : c >= 1.2 ? css("--watch") : css("--ok"); }

/* ===================== Estado ===================== */
const ST = {
  ana: null,            // analisis.json
  auto: [],             // sucesos automáticos
  rumors: [],           // rumores sin contrastar
  markets: [],
  sources: {},          // estado de cada fuente
  scanAt: null, scanning: false, filter: "todos", open: new Set()
};
const allEvents = () => [...(ST.ana?.eventos || []), ...ST.auto];
function setSource(id, name, state, msg) { ST.sources[id] = { name, state, msg, t: new Date() }; renderSources(); }

/* ===================== Fuentes automáticas ===================== */
async function getJSON(url, timeout = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error("HTTP " + r.status);
    try { return JSON.parse(txt); } catch { throw new Error(txt.slice(0, 80) || "Respuesta no válida"); }
  } finally { clearTimeout(t); }
}

function placeOf(title, srcCountry) {
  for (const p of PLACES) if (p.re.test(title)) return p;
  if (srcCountry) for (const p of PLACES) if (p.re.test(srcCountry)) return p;
  return { name: srcCountry || "Sin ubicar", lat: null, lon: null, zona: "mundo" };
}
function levelFromCount(nDom, nCountries, official) {
  if (official && nDom >= 3) return "confirmado";
  if (official) return "oficial";
  if (nDom >= 10 && nCountries >= 3) return "confirmado";
  if (nDom >= 4) return "varios_medios";
  if (nDom === 3) return "medios_locales";
  if (nDom === 2) return "fuente_unica";
  return "rumor";
}

async function scanGdelt(prevCounts) {
  const out = [], rum = [];
  let i = 0;
  for (const th of THEMES) {
    i++;
    setProgress(i / (THEMES.length + 3));
    setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "wait", "Consultando…");
    const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent(th.q) +
      "&mode=artlist&maxrecords=120&format=json&timespan=24h&sort=datedesc";
    try {
      const data = await getJSON(url);
      const arts = Array.isArray(data.articles) ? data.articles : [];
      // agrupar por lugar
      const groups = new Map();
      for (const a of arts) {
        const title = (a.title || "").trim(); if (!title) continue;
        const pl = placeOf(title, a.sourcecountry);
        const key = th.id + "|" + pl.name;
        if (!groups.has(key)) groups.set(key, { pl, arts: [] });
        groups.get(key).arts.push(a);
      }
      for (const [key, g] of groups) {
        const doms = new Set(g.arts.map((a) => a.domain)); const ctry = new Set(g.arts.map((a) => a.sourcecountry));
        const official = g.arts.some((a) => OFFICIAL.test(a.domain || ""));
        const nivel = levelFromCount(doms.size, ctry.size, official);
        let S = th.S;
        for (const a of g.arts) for (const [re, v] of BOOST) if (re.test(a.title || "")) S = v >= 6 ? Math.max(S, v) : Math.min(10, Math.max(S, th.S + v));
        if (th.id === "ciberbanca" && /bank|banc|pago|payment/i.test(g.arts.map((a) => a.title).join(" "))) S = Math.max(S, 5);
        const dominio = th.id === "ciberbanca" && /bank run|corralito|bank collapse|colapso/i.test(g.arts.map((a) => a.title).join(" ")) ? "banca" : th.dominio;
        const prev = prevCounts[key] || 0;
        const tendencia = prev && doms.size >= prev * 1.5 + 1 ? "escala" : prev && doms.size <= prev * 0.6 ? "desescala" : "estable";
        const latest = g.arts.map((a) => gdeltDate(a.seendate)).filter(Boolean).sort().at(-1);
        const ev = {
          id: "auto-" + key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), origen: "auto", tema: th.id,
          titulo: `${th.titulo}: ${g.pl.name}`, resumen: g.arts[0].title, dominio, region: g.pl.name,
          lat: g.pl.lat, lon: g.pl.lon, zona: g.pl.zona, S, nivel, tendencia, fecha: latest, n: doms.size, paises: ctry.size,
          fuentes: g.arts.slice(0, 12).map((a) => ({ n: `${a.domain} · ${a.title}`, url: a.url })),
          fiabilidad: `${doms.size} medio(s) distinto(s) de ${ctry.size} país(es) en 24 h${official ? ", incluida una web oficial" : ""}. Detectado automáticamente: revisa las fuentes.`
        };
        prevCounts[key] = doms.size;
        if (nivel === "rumor" || (nivel === "fuente_unica" && S >= 6)) { if (S >= 5) rum.push(ev); }
        else out.push(ev);
      }
      setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "ok", `${arts.length} artículos`);
    } catch (e) {
      setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "err", String(e.message || e));
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== th.id), ...out.filter((x) => x.tema === th.id)];
    ST.rumors = [...ST.rumors.filter((x) => x.tema !== th.id), ...rum.filter((x) => x.tema === th.id)];
    renderAll();
    if (i < THEMES.length) await sleep(GDELT_GAP_MS);
  }
}

async function scanUSGS() {
  setSource("usgs", "USGS · Terremotos", "wait", "Consultando…");
  try {
    const [day, week] = await Promise.all([
      getJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"),
      getJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson")
    ]);
    const seen = new Map();
    for (const f of [...(week.features || []), ...(day.features || [])]) seen.set(f.id, f);
    const evs = [];
    for (const f of seen.values()) {
      const p = f.properties || {}, [lon, lat] = f.geometry?.coordinates || [];
      const M = +p.mag || 0, dist = km(HOME[0], HOME[1], lat, lon);
      const near = dist < 1500;
      if (!(M >= 6 || (near && M >= 4.5))) continue;
      let S = M >= 8 ? 7 : M >= 7 ? 5 : M >= 6 ? 3 : 2;
      if (near && M >= 5) S += 2;
      if (p.tsunami) S += 2;
      evs.push({
        id: "usgs-" + f.id, origen: "auto", tema: "usgs", dominio: "natural",
        titulo: `Terremoto M${num(M)} · ${p.place || ""}`, resumen: `Magnitud ${num(M)} a ${Math.round(dist)} km de Asturias.${p.tsunami ? " USGS marca posible tsunami." : ""}${p.alert ? " Alerta PAGER: " + p.alert + "." : ""}`,
        region: p.place || "", lat, lon, zona: dist < 600 ? "espana" : near ? "mediterraneo" : "mundo", S: Math.min(S, 10), nivel: "confirmado", tendencia: "estable",
        fecha: new Date(p.time).toISOString(), fuentes: [{ n: "USGS – ficha del terremoto", url: p.url }], fiabilidad: "Dato instrumental del Servicio Geológico de EE. UU."
      });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "usgs"), ...evs];
    setSource("usgs", "USGS · Terremotos", "ok", `${seen.size} sismos M4,5+ revisados`);
  } catch (e) { setSource("usgs", "USGS · Terremotos", "err", String(e.message || e)); }
  renderAll();
}

async function scanNOAA() {
  setSource("noaa", "NOAA · Tormentas solares", "wait", "Consultando…");
  try {
    const d = await getJSON("https://services.swpc.noaa.gov/products/noaa-scales.json");
    const cur = d["0"] || d[0] || {};
    let maxG = +cur?.G?.Scale || 0;
    for (const k of ["1", "2", "3"]) maxG = Math.max(maxG, +d?.[k]?.G?.Scale || 0);
    const evs = [];
    if (maxG >= 3) evs.push({
      id: "noaa-g", origen: "auto", tema: "noaa", dominio: "energia", titulo: `Tormenta geomagnética G${maxG}`,
      resumen: `La NOAA marca o prevé tormenta solar de nivel G${maxG} (escala 1–5). Desde G4 puede haber problemas en redes eléctricas y GPS.`,
      region: "Global", lat: null, lon: null, zona: "mundo", impacto_espana: maxG >= 4, S: maxG >= 5 ? 7 : maxG === 4 ? 5 : 3,
      nivel: "oficial", tendencia: "estable", fecha: new Date().toISOString(),
      fuentes: [{ n: "NOAA SWPC – escalas", url: "https://www.spaceweather.gov/content/data-access" }], fiabilidad: "Servicio meteorológico espacial de EE. UU."
    });
    ST.auto = [...ST.auto.filter((x) => x.tema !== "noaa"), ...evs];
    setSource("noaa", "NOAA · Tormentas solares", "ok", `Nivel geomagnético máximo previsto: G${maxG}`);
  } catch (e) { setSource("noaa", "NOAA · Tormentas solares", "err", String(e.message || e)); }
  renderAll();
}

async function scanPolymarket() {
  setSource("poly", "Polymarket · Geopolítica", "wait", "Consultando…");
  try {
    const d = await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&tag_slug=geopolitics&order=volume24hr&ascending=false&limit=15");
    const list = [];
    for (const ev of (Array.isArray(d) ? d : [])) {
      const m = (ev.markets || []).find((x) => x.active !== false && x.closed !== true) || (ev.markets || [])[0];
      if (!m) continue;
      let prices = m.outcomePrices, outs = m.outcomes;
      try { if (typeof prices === "string") prices = JSON.parse(prices); if (typeof outs === "string") outs = JSON.parse(outs); } catch {}
      const iy = Array.isArray(outs) ? outs.findIndex((o) => /^yes$/i.test(o)) : 0;
      const p = Array.isArray(prices) ? +prices[Math.max(0, iy)] : NaN;
      if (!isFinite(p)) continue;
      list.push({ q: m.question || ev.title, p, url: "https://polymarket.com/event/" + (ev.slug || "") });
    }
    ST.markets = list.slice(0, 10);
    setSource("poly", "Polymarket · Geopolítica", "ok", `${list.length} mercados`);
  } catch (e) { setSource("poly", "Polymarket · Geopolítica", "err", String(e.message || e)); }
  renderMarkets();
}

/* ===================== Escaneo completo ===================== */
async function scan(force) {
  if (ST.scanning) return;
  const cache = store.get("brujula.cache", null);
  if (!force && cache && Date.now() - cache.t < CACHE_MIN * 60000) {
    Object.assign(ST, { auto: cache.auto || [], rumors: cache.rumors || [], markets: cache.markets || [], scanAt: new Date(cache.t) });
    for (const [k, v] of Object.entries(cache.sources || {})) ST.sources[k] = v;
    renderAll(); renderSources(); renderMarkets();
    return;
  }
  ST.scanning = true; $("rescan").disabled = true; renderStamp();
  const prev = store.get("brujula.prev", {});
  setProgress(0.02);
  await Promise.all([scanUSGS(), scanNOAA(), scanPolymarket()]);
  await scanGdelt(prev);
  store.set("brujula.prev", prev);
  ST.scanAt = new Date(); ST.scanning = false; $("rescan").disabled = false; setProgress(1);
  setTimeout(() => setProgress(0), 800);
  store.set("brujula.cache", { t: Date.now(), auto: ST.auto, rumors: ST.rumors, markets: ST.markets, sources: ST.sources });
  addLog();
  renderAll();
}
function setProgress(f) { const i = $("progress").firstElementChild; i.style.width = Math.round(f * 100) + "%"; }
function addLog() {
  const evs = allEvents(); const log = store.get("brujula.log", []);
  const top = [...evs].sort((a, b) => contrib(b) - contrib(a))[0];
  log.unshift({ t: Date.now(), a: indice(evs, "asturias"), e: indice(evs, "espana"), g: indice(evs, "global"), top: top ? top.titulo : "", rum: ST.rumors.length });
  store.set("brujula.log", log.slice(0, 300));
}

/* ===================== Pintado ===================== */
function drawGauge(svg, v) {
  svg.replaceChildren();
  const cx = 160, cy = 160, r = 128, ang = (t) => Math.PI * (1 - t / 10), pt = (t, rr) => [cx + rr * Math.cos(ang(t)), cy - rr * Math.sin(ang(t))];
  for (const [a, b, c] of [[0, 2, "--ok"], [2, 4, "--watch"], [4, 6, "--tense"], [6, 8, "--alert"], [8, 10, "--crit"]]) {
    const [x1, y1] = pt(a + 0.06, r), [x2, y2] = pt(b - 0.06, r);
    svg.append(s("path", { d: `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`, fill: "none", stroke: css(c), "stroke-width": 16, opacity: (v >= a && v < b) || (b === 10 && v >= 10) ? 1 : 0.28 }));
  }
  for (let t = 0; t <= 10; t++) {
    const [x1, y1] = pt(t, r - 14), [x2, y2] = pt(t, r - (t % 2 ? 20 : 26));
    svg.append(s("line", { x1, y1, x2, y2, stroke: css("--muted"), "stroke-width": t % 2 ? 1 : 2 }));
    if (t % 2 === 0) { const [tx, ty] = pt(t, r - 40); const tl = s("text", { x: tx, y: ty + 4, "text-anchor": "middle", "font-size": 12, fill: css("--muted"), "font-family": "IBM Plex Mono, monospace" }); tl.textContent = t; svg.append(tl); }
  }
  const [, col] = nivelDe(v);
  const needle = s("g", { class: "needle" });
  needle.style.transformOrigin = `${cx}px ${cy}px`; needle.style.transform = `rotate(${(+svg.dataset.v || 0) / 10 * 180 - 90}deg)`;
  needle.append(s("path", { d: `M${cx - 5},${cy} L${cx},${cy - r + 22} L${cx + 5},${cy} Z`, fill: css("--ink") }));
  svg.append(needle, s("circle", { cx, cy, r: 9, fill: css("--panel-2"), stroke: css("--ink"), "stroke-width": 2 }));
  const tv = s("text", { x: cx, y: cy + 44, "text-anchor": "middle", "font-size": 40, "font-weight": 600, fill: css(col), "font-family": "Barlow Condensed, sans-serif" });
  tv.textContent = num(v); svg.append(tv);
  svg.dataset.v = v; svg.setAttribute("aria-label", `Índice ${num(v)} de 10`);
  requestAnimationFrame(() => requestAnimationFrame(() => { needle.style.transform = `rotate(${(v / 10) * 180 - 90}deg)`; }));
}
function drawSpark(svg, vals) {
  svg.replaceChildren();
  if (vals.length < 2) { svg.style.display = "none"; return; }
  svg.style.display = "";
  const W = 240, H = 40, p = 4, xs = vals.map((_, i) => p + i * (W - 2 * p) / (vals.length - 1)), ys = vals.map((v) => H - p - (v / 10) * (H - 2 * p));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join("");
  svg.append(s("path", { d: d + `L${xs.at(-1)},${H}L${xs[0]},${H}Z`, fill: css("--accent"), opacity: 0.12 }),
    s("path", { d, fill: "none", stroke: css("--accent"), "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    s("circle", { cx: xs.at(-1), cy: ys.at(-1), r: 3, fill: css("--accent") }));
}

function renderStamp() {
  const st = $("stamp"); const parts = [];
  if (ST.ana?.estado?.actualizado) {
    const t = new Date(ST.ana.estado.actualizado), hrs = (Date.now() - t) / 36e5;
    parts.push("Analista: " + t.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + (hrs > 48 ? ` (hace ${Math.round(hrs / 24)} días)` : ""));
  }
  parts.push(ST.scanning ? "Escaneando internet…" : ST.scanAt ? "Escaneo: " + ST.scanAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "Sin escanear");
  st.textContent = parts.join(" · ");
}

function renderAll() {
  const evs = allEvents();
  renderStamp();
  document.querySelectorAll(".gauge-box").forEach((box) => {
    const scope = box.dataset.scope, v = indice(evs, scope), [lvl, col] = nivelDe(v);
    drawGauge(box.querySelector(".gauge"), v);
    const L = box.querySelector(".level"); L.textContent = lvl; L.style.color = css(col);
    const key = scope === "asturias" ? "a" : scope === "espana" ? "e" : "g";
    drawSpark(box.querySelector(".spark"), store.get("brujula.log", []).slice(0, 30).reverse().map((x) => +x[key] || 0));
  });
  renderAlerts(evs); renderAnalysis(evs); renderMap(evs); renderRumors(); renderFilters(); renderEvents(); renderChains(); renderScen(); renderLog();
}

function renderAlerts(evs) {
  const box = $("alerts"); box.replaceChildren();
  const ast = indice(evs, "asturias"), esp = indice(evs, "espana");
  const crit = evs.filter((e) => e.S >= 8 && (NIV[e.nivel]?.[0] ?? 0) >= 0.65 && pScope(e, "espana") >= 0.7);
  for (const e of crit) box.append(h("div", { class: "alert crit" }, h("b", null, "⚠ " + e.titulo), h("span", null, e.resumen)));
  if (Math.max(ast, esp) >= 6) box.append(h("div", { class: "alert high" }, h("b", null, `Nivel de ${nivelDe(Math.max(ast, esp))[0].toLowerCase()} para España/Asturias`), h("span", null, "Revisa los sucesos de abajo y sigue a ES-Alert y al 112.")));
  for (const r of ST.rumors.filter((x) => x.S >= 8)) box.append(h("div", { class: "alert mid" }, h("b", null, "Rumor grave sin confirmar: " + r.titulo), h("span", null, "Solo lo publica una fuente. No actúes hasta que se confirme.")));
}

function renderAnalysis(evs) {
  const ana = ST.ana?.estado;
  const ast = indice(evs, "asturias"), esp = indice(evs, "espana"), glo = indice(evs, "global");
  const auto = ST.auto.length ? ` La capa automática añade ${ST.auto.length} suceso(s) y ${ST.rumors.length} rumor(es) sin contrastar.` : "";
  $("takeaway").textContent = (ana?.resumen || `Asturias ${num(ast)}, España ${num(esp)}, escalada global ${num(glo)}.`) + auto;
  const dm = $("domains"); dm.replaceChildren();
  for (const [k, name] of DOM) {
    const dv = dominio(evs, k), [, c] = nivelDe(dv);
    dm.append(h("div", { class: "dom" }, h("span", { class: "dom-name" }, name),
      h("div", { class: "bar", role: "img", "aria-label": `${name}: ${num(dv)} de 10` }, h("i", { style: `width:${dv * 10}%;background:var(${c})` })),
      h("span", { class: "mono small", style: "text-align:right" }, num(dv))));
  }
  const rk = $("risks"); rk.replaceChildren(h("h3", null, "Qué te puede afectar"));
  const ranked = DOM.map(([k, name]) => [k, name, dominio(evs, k)]).filter((x) => x[2] >= 3).sort((a, b) => b[2] - a[2]);
  if (!ranked.length) rk.append(h("p", { class: "muted small" }, "Ningún tipo de riesgo supera el nivel de vigilancia."));
  for (const [k, name, v] of ranked) {
    const top = evs.filter((e) => e.dominio === k).sort((a, b) => contrib(b) - contrib(a))[0];
    rk.append(h("div", { class: "risk", style: `--sev:var(${nivelDe(v)[1]})` },
      h("b", null, `${name} · ${num(v)} (${nivelDe(v)[0]})`), h("span", null, RISK_TEXT[k]),
      top ? h("span", { class: "small muted" }, "Lo que más pesa: " + top.titulo) : null));
  }
  const nt = $("notes"); nt.replaceChildren(...(ana?.notas || []).map((n) => h("li", null, n)));
}

function renderMap(evs) {
  if (!$("land").getAttribute("d") && window.LAND_PATH) $("land").setAttribute("d", window.LAND_PATH);
  const g = $("dots"); g.replaceChildren();
  const tip = $("tip"), box = $("map");
  const xy = (lat, lon) => [(+lon + 180) / 360 * 1000, (85 - lat) * 1000 / 360];
  const [hx, hy] = xy(HOME[0], HOME[1]);
  g.append(s("circle", { cx: hx, cy: hy, r: 5, fill: "none", stroke: css("--accent"), "stroke-width": 2 }));
  const home = s("text", { x: hx - 8, y: hy - 8, "text-anchor": "end", "font-size": 13, fill: css("--accent") }); home.textContent = "Tú"; g.append(home);
  const items = [...evs.map((e) => [e, false]), ...ST.rumors.map((e) => [e, true])]
    .filter(([e]) => e.lat != null && e.lon != null && isFinite(+e.lat)).sort((a, b) => contrib(a[0]) - contrib(b[0]));
  for (const [e, isRumor] of items) {
    const [x, y] = xy(+e.lat, +e.lon), c = contrib(e, "global"), col = isRumor ? css("--watch") : sevColor(contrib(e)), r = 3.5 + Math.min(c, 9) * 1.1;
    const dot = s("circle", { cx: x, cy: y, r, fill: isRumor ? "none" : col, stroke: isRumor ? col : "#0a1015", "stroke-width": isRumor ? 2 : 1.2, "stroke-dasharray": isRumor ? "3 2" : "", opacity: 0.9, tabindex: 0, role: "button", "aria-label": e.titulo });
    const show = () => { const b = box.getBoundingClientRect(), k = b.width / 1000; tip.replaceChildren(h("b", null, (isRumor ? "Rumor: " : "") + e.titulo), h("br"), h("span", { class: "muted" }, `${e.region || ""} · ${NIV[e.nivel]?.[1] || ""}`)); tip.style.display = "block"; const tw = tip.offsetWidth; tip.style.left = Math.min(Math.max(4, x * k - tw / 2), b.width - tw - 4) + "px"; tip.style.top = Math.max(4, y * k - tip.offsetHeight - r * k - 8) + "px"; };
    const hide = () => { tip.style.display = "none"; };
    const go = () => { ST.filter = "todos"; ST.open.add(e.id); renderFilters(); renderEvents(); renderRumors(); document.getElementById("ev-" + e.id)?.scrollIntoView({ behavior: "smooth", block: "center" }); };
    dot.addEventListener("mouseenter", show); dot.addEventListener("mouseleave", hide); dot.addEventListener("focus", show); dot.addEventListener("blur", hide);
    dot.addEventListener("click", go); dot.addEventListener("keydown", (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); go(); } });
    g.append(dot);
  }
}

function eventCard(e, isRumor) {
  const c = contrib(e), nv = NIV[e.nivel] || NIV.fuente_unica, open = ST.open.has(e.id);
  const steps = h("span", { class: "steps", "aria-hidden": "true" }, ...[1, 2, 3, 4, 5, 6].map((i) => h("i", { class: i <= nv[2] ? "on" : null })));
  const head = h("button", { type: "button", class: "ev-head", "aria-expanded": String(open) },
    h("div", { class: "ev-top" }, h("h3", null, e.titulo), h("span", { class: "score", title: "Puntuación para Asturias" }, num(c, 2))),
    h("div", { class: "chips" },
      h("span", { class: "chip " + (e.origen === "auto" ? "auto" : "ana") }, e.origen === "auto" ? "Automático" : "Analista"),
      h("span", { class: "chip" }, DOMNAME[e.dominio] || e.dominio),
      e.region ? h("span", { class: "chip" }, e.region) : null,
      h("span", { class: "chip" }, `Gravedad ${num(e.S, e.S % 1 ? 1 : 0)}`),
      h("span", { class: "chip" }, TEND[e.tendencia]?.[1] || e.tendencia),
      e.fecha ? h("span", { class: "chip mono" }, fecha(e.fecha)) : null),
    h("div", { class: "ladder" }, steps, h("span", null, `Confirmación: ${nv[1]}`)),
    h("span", { class: "more" }, open ? "Ocultar detalles ▲" : "Ver detalles ▼"));
  const srcs = (e.fuentes || []).map((f) => { const u = safeUrl(f.url); return u ? h("a", { href: u, target: "_blank", rel: "noopener" }, f.n) : h("span", null, f.n); });
  const body = h("div", { class: "ev-body", hidden: open ? null : "" },
    h("p", null, e.resumen),
    e.fiabilidad ? h("p", { class: "rel" }, e.fiabilidad) : null,
    isRumor ? h("p", { class: "small warn-text" }, "Sin contrastar. Se moverá a «Sucesos» si más medios lo publican.") : null,
    (e.vigilar && e.vigilar.length) ? h("div", null, h("p", { class: "small", style: "font-weight:600" }, "Señales a vigilar"), h("ul", null, ...e.vigilar.map((x) => h("li", null, x)))) : null,
    h("p", { class: "small muted" }, `Puntuación · Asturias ${num(contrib(e, "asturias"), 2)} · España ${num(contrib(e, "espana"), 2)} · Escalada ${num(contrib(e, "global"), 2)}`),
    srcs.length ? h("div", { class: "srcs" }, h("span", { class: "small", style: "font-weight:600" }, "Fuentes"), ...srcs) : null);
  const card = h("article", { class: "ev", id: "ev-" + e.id, style: `--sev:${isRumor ? css("--watch") : sevColor(c)}` }, head, body);
  head.addEventListener("click", () => {
    const now = body.hidden; body.hidden = !now; head.setAttribute("aria-expanded", String(now));
    head.querySelector(".more").textContent = now ? "Ocultar detalles ▲" : "Ver detalles ▼";
    if (now) ST.open.add(e.id); else ST.open.delete(e.id);
  });
  return card;
}

function renderRumors() {
  const box = $("rumors"); box.replaceChildren();
  const list = [...ST.rumors].sort((a, b) => b.S - a.S).slice(0, 12);
  if (!list.length) box.append(h("p", { class: "empty" }, ST.scanAt ? "No hay rumores alarmantes en las últimas 24 h." : "Se mostrarán tras el escaneo."));
  for (const e of list) box.append(eventCard(e, true));
}
function renderFilters() {
  const f = $("filters"); f.replaceChildren();
  const present = new Set(allEvents().map((e) => e.dominio));
  for (const [k, name] of [["todos", "Todos"], ["analista", "Analista"], ["auto", "Automáticos"], ...DOM.filter(([k]) => present.has(k))]) {
    const b = h("button", { type: "button", "aria-pressed": String(ST.filter === k) }, name);
    b.addEventListener("click", () => { ST.filter = k; renderFilters(); renderEvents(); });
    f.append(b);
  }
}
function renderEvents() {
  const box = $("events"); box.replaceChildren();
  const F = ST.filter;
  const evs = allEvents().filter((e) => F === "todos" || (F === "analista" && e.origen !== "auto") || (F === "auto" && e.origen === "auto") || e.dominio === F)
    .sort((a, b) => contrib(b) - contrib(a));
  if (!evs.length) { box.append(h("p", { class: "empty" }, "No hay sucesos en esta categoría.")); return; }
  for (const e of evs.slice(0, 60)) box.append(eventCard(e, false));
}
function renderChains() {
  const box = $("chains"); box.replaceChildren();
  for (const ch of (ST.ana?.cadenas || [])) box.append(h("div", { style: "display:grid;gap:8px" },
    h("div", { style: "display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline" }, h("h3", null, ch.titulo), h("span", { class: "chip" }, ch.estado)),
    h("ol", { class: "timeline" }, ...(ch.pasos || []).map((p) => h("li", null, h("span", { class: "mono small muted" }, fecha(p.fecha)), h("span", { class: "dot" }), h("span", { class: "t" }, p.texto)))),
    (ch.siguiente && ch.siguiente.length) ? h("div", { class: "next" }, h("span", { style: "font-weight:600;color:var(--ink)" }, "Próximos pasos posibles"), ...ch.siguiente.map((x) => h("span", null, "→ " + x))) : null));
}
function renderScen() {
  const box = $("scen"); box.replaceChildren();
  for (const sc of (ST.ana?.escenarios || [])) box.append(h("div", { class: "sc" }, h("b", null, sc.titulo), h("span", { class: "small", style: "color:var(--accent)" }, "Probabilidad: " + sc.prob), h("span", null, sc.impacto), (sc.senales && sc.senales.length) ? h("span", { class: "small muted" }, "Señales: " + sc.senales.join(" · ")) : null));
}
function renderMarkets() {
  const box = $("markets"); box.replaceChildren();
  if (!ST.markets.length) { box.append(h("p", { class: "empty" }, ST.sources.poly?.state === "err" ? "No se pudo consultar Polymarket desde este navegador." : "Cargando…")); return; }
  for (const m of ST.markets) { const u = safeUrl(m.url); box.append(h("div", { class: "mk" }, u ? h("a", { href: u, target: "_blank", rel: "noopener" }, m.q) : h("span", null, m.q), h("span", { class: "p" }, Math.round(m.p * 100) + " %"))); }
}
function renderLog() {
  const box = $("log"); box.replaceChildren();
  const log = store.get("brujula.log", []);
  if (!log.length) { box.append(h("li", { class: "empty" }, "Aún no hay registros.")); return; }
  box.append(h("li", { class: "muted" }, h("span", null, "Fecha"), h("span", null, "Ast."), h("span", null, "Esp."), h("span", null, "Glob."), h("span", null, "Lo que más pesaba")));
  for (const x of log.slice(0, 60)) box.append(h("li", null,
    h("span", { class: "mono" }, new Date(x.t).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })),
    h("span", { class: "mono" }, num(x.a)), h("span", { class: "mono" }, num(x.e)), h("span", { class: "mono" }, num(x.g)), h("span", null, x.top)));
}
function renderSources() {
  const box = $("srcstatus"); box.replaceChildren();
  const order = ["usgs", "noaa", "poly", ...THEMES.map((t) => "gdelt-" + t.id)];
  for (const k of order) {
    const v = ST.sources[k]; if (!v) continue;
    box.append(h("div", { class: "st " + v.state }, h("i"), h("span", null, v.name), h("span", { class: "small muted" }, v.state === "err" ? "Error: " + v.msg : v.msg)));
  }
  if (!box.children.length) box.append(h("p", { class: "empty" }, "Todavía no se ha consultado ninguna fuente."));
  const cat = $("sources");
  if (!cat.children.length && ST.ana?.fuentes) for (const g of ST.ana.fuentes.grupos || []) cat.append(h("div", { class: "src-group" }, h("h3", null, g.nombre),
    h("div", { class: "src-list" }, ...g.items.map((it) => { const u = safeUrl(it.url); return h("div", { class: "src" }, u ? h("a", { href: u, target: "_blank", rel: "noopener" }, h("b", null, it.n)) : h("b", null, it.n), h("span", { class: "small" }, it.uso), h("span", { class: "small muted" }, it.acceso)); }))));
}

/* ===================== Arranque ===================== */
async function init() {
  $("rescan").addEventListener("click", () => scan(true));
  try { ST.ana = await getJSON("datos/analisis.json?v=" + Math.floor(Date.now() / 600000)); }
  catch (e) { ST.ana = { eventos: [], estado: { resumen: "No se pudo cargar el análisis del analista." } }; }
  renderAll(); renderSources(); renderMarkets();
  scan(false);
}
init();
})();
