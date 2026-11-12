const VERSION = "12 nov 2026 · 2.0";
/* Brújula de Emergencia — se ejecuta entero en el navegador.
   Capa del analista: datos/analisis.json (revisado a mano).
   Capa automática: GDELT, USGS, NOAA y Polymarket, consultados al abrir la página. */
(function () {
"use strict";

/* ===================== Configuración ===================== */
// El cálculo de los índices vive en nucleo.js (se prueba aparte con node pruebas/indices.mjs)
const { NIV, TEND, ZP, pScope, contrib, indice, dominio, nivelDe, QUE_HACER } = window.BRUJULA_NUCLEO;
const DOM = [["seguridad", "Terrorismo y seguridad"], ["belico", "Bélico"], ["nuclear", "Nuclear"], ["energia", "Energía y precios"], ["ciber", "Ciber e híbrido"],
  ["banca", "Banca y economía"], ["social", "Social"], ["sanitario", "Sanitario"], ["natural", "Natural y clima"]];
const DOMNAME = Object.fromEntries(DOM);
const SCOPES = [["asturias", "Asturias"], ["espana", "España"], ["global", "Escalada global"]];
const HOME = [43.36, -5.85];
const GDELT_GAP_MS = 7000;          // GDELT admite 1 consulta cada 5 s
const CACHE_MIN = 20;               // minutos antes de volver a consultar al abrir

/* Consultas a GDELT (busca en 65 idiomas traducidos al inglés) */
const THEMES = [
  { id: "nuclear", gn: '"ataque nuclear" OR "amenaza nuclear" OR "pastillas de yodo" OR "fuga radiactiva" OR "nuclear strike" OR "radiation leak"', dominio: "nuclear", S: 7, titulo: "Alarma nuclear o radiológica",
    q: '("nuclear strike" OR "nuclear attack" OR "nuclear threat" OR "iodine tablets" OR "radiation leak" OR "nuclear alert")' },
  { id: "guerra", gn: '"ataque con misiles" OR bombardeo OR "movilización militar" OR "missile strike" OR airstrike OR "ballistic missile"', dominio: "belico", S: 6, titulo: "Ataques y movilizaciones",
    q: '("missile strike" OR "airstrike" OR "air raid" OR "declares war" OR "military mobilization" OR "ballistic missile")' },
  { id: "espana", gn: 'España (apagón OR ciberataque OR evacuación OR explosión OR "estado de emergencia" OR atentado)', dominio: "social", S: 4, titulo: "Alertas en España",
    q: '(blackout OR cyberattack OR evacuation OR explosion OR "state of emergency" OR "terror attack") sourcecountry:spain' },
  { id: "asturias", gn: 'Asturias (alerta OR emergencia OR evacuación OR incendio OR inundación OR temporal OR explosión OR apagón)', dominio: "natural", S: 4, titulo: "Alertas en Asturias",
    q: 'asturias (alert OR emergency OR evacuation OR fire OR flood OR storm OR explosion OR blackout)' },
  { id: "ciberbanca", gn: 'ciberataque OR ransomware OR "caída bancaria" OR corralito OR "bank run" OR "payment outage"', dominio: "ciber", S: 5, titulo: "Ciberataques y banca",
    q: '(cyberattack OR ransomware OR "bank run" OR "bank collapse" OR "banking system" OR "payment outage")' },
  { id: "energia", gn: 'apagón OR "escasez de combustible" OR racionamiento OR "suministro de gas" OR "power outage" OR "fuel shortage"', dominio: "energia", S: 4, titulo: "Energía y suministros",
    q: '("power outage" OR blackout OR "fuel shortage" OR rationing OR "oil supply" OR "gas supply")' },
  { id: "evacuacion", gn: '"evacuación de la embajada" OR "abandonen el país" OR "embassy evacuation" OR "leave the country" OR "travel warning"', dominio: "belico", S: 6, titulo: "Evacuaciones y avisos de embajadas",
    q: '("embassy evacuation" OR "evacuate citizens" OR "leave the country" OR "shelter in place" OR "travel warning")' },
  { id: "salud", gn: 'brote OR epidemia OR "emergencia sanitaria" OR outbreak OR "health emergency"', dominio: "sanitario", S: 4, titulo: "Brotes y emergencias sanitarias",
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
  ["asturias|asturian[oa]s?|oviedo|uvi[eé]u|gij[oó]n|xix[oó]n|avil[eé]s|carre[ñn]o|cand[aá]s|siero|lugones|langreo|mieres|llanes|cangas de on[ií]s|cangas del narcea|navia|luarca|ribadesella|villaviciosa|pravia|llanera|castrill[oó]n|cudillero|tineo|cabrales|covadonga|picos de europa|pajares|villafr[ií]a", "Asturias", 43.36, -5.85, "asturias"],
  ["spain|españa|espagne|spanien|madrid|barcelona|valencia|sevilla|zaragoza|m[aá]laga|c[aá]diz|rota|mor[oó]n|canarias|baleares|ceuta|melilla|tarragona|lleida|girona|castell[oó]n|alicante|murcia|cartagena|almer[ií]a|granada|ja[eé]n|c[oó]rdoba|huelva|algeciras|badajoz|c[aá]ceres|extremadura|salamanca|zamora|valladolid|palencia|burgos|soria|segovia|[aá]vila|toledo|guadalajara|cuenca|albacete|ciudad real|teruel|huesca|navarra|pamplona|la rioja|logro[ñn]o|vitoria|san sebasti[aá]n|donostia|bilbao|euskadi|pa[ií]s vasco|galicia|lugo|ourense|coru[ñn]a|vigo|pontevedra|cantabria|santander|le[oó]n|tenerife|gran canaria|las palmas|lanzarote|mallorca|ibiza|menorca|andaluc[ií]a|catalu[ñn]a|arag[oó]n|castilla", "España", 40.4, -3.7, "espana"],
  ["portugal|lisbon|lisboa", "Portugal", 39.4, -8.2, "ue"], ["france|francia|paris|parís", "Francia", 46.6, 2.4, "ue"],
  ["germany|alemania|berlin", "Alemania", 51.2, 10.4, "ue"], ["italy|italia|rome|roma|sicilia|sicily", "Italia", 42.8, 12.6, "ue"],
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
].map(([re, name, lat, lon, zona]) => ({ re: new RegExp("(^|[^\\p{L}])(" + re + ")(?![\\p{L}]{3})", "iu"), name, lat, lon, zona }));
// Nombres que contienen el de otro lugar o que no son un lugar (equipos de fútbol, «Sierra Leona»…)
const NO_LUGAR = /sierra leon[ae]|nuevo le[oó]n|porto alegre|puerto rico|costa rica|cartagena de indias|santiago de chile|georgia|as roma|real madrid|atl[eé]tico de madrid|fc barcelona|bar[cç]a\b|sporting de gij[oó]n|real oviedo|valencia cf|sevilla fc|celta de vigo/giu;
const OFFICIAL = /(\.gov(\.|$)|\.gob\.|\.gouv\.|\.mil(\.|$)|nato\.int|europa\.eu|un\.org|who\.int|iaea\.org|lamoncloa|interior\.gob|112asturias|dsn\.gob)/i;

/* Qué puede significar cada tipo de riesgo para ti */
const RISK_TEXT = {
  seguridad: "Atentados, tiroteos o amenazas de bomba. Evita la zona, no difundas rumores y sigue a la Policía (091), la Guardia Civil (062) y el 112.",
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

/* ===================== Cálculo (ver nucleo.js) ===================== */
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
const allEvents = () => [...(ST.ana?.eventos || []), ...ST.auto, ...buzonAsEvents()];
let fuentesPend = 0;
function setSource(id, name, state, msg) { ST.sources[id] = { name, state, msg, t: new Date() }; if (!fuentesPend) fuentesPend = setTimeout(() => { fuentesPend = 0; renderSources(); }, 150); }

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
  title = String(title || "").replace(NO_LUGAR, " ");
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

function gnToArt(it) {
  let host = ""; try { host = new URL(it.sourceUrl || it.url).hostname.replace(/^www\./, ""); } catch {}
  const tld = host.split(".").pop();
  const country = { es: "Spain", fr: "France", de: "Germany", it: "Italy", uk: "United Kingdom", pt: "Portugal", mx: "Mexico", ar: "Argentina" }[tld] || "";
  const d = new Date(it.date); const seendate = isNaN(d) ? "" : d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const title = (it.title || "").replace(/\s+-\s+[^-]+$/, "");
  return { title, url: it.url, domain: host || it.source, sourcecountry: country, seendate };
}
async function scanGdelt(prevCounts) {
  const out = [], rum = [];
  let i = 0, seguidos = 0;
  for (const th of THEMES) {
    i++;
    setProgress(i / (THEMES.length + 3));
    // Si GDELT y Google Noticias fallan dos veces seguidas (lo normal desde el intermediario de Cloudflare), no se insiste: ahorra un minuto de espera
    if (seguidos >= 2) { setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "err", "Omitido: GDELT y Google Noticias no responden a través del intermediario"); continue; }
    setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "wait", "Consultando…");
    const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent(th.q) +
      "&mode=artlist&maxrecords=120&format=json&timespan=24h&sort=datedesc";
    try {
      let data, via = "GDELT";
      try { data = await pget(url, true, 20000); }
      catch (e) {
        // GDELT saturado o lento: plan B con Google Noticias (español + inglés)
        setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "wait", "GDELT saturado: probando Google Noticias…");
        const q = "(" + (th.gn || th.q) + ") when:1d";
        const res = await Promise.allSettled([googleNews(q, "es"), googleNews(q, "en")]);
        const items = res.flatMap((r) => r.status === "fulfilled" ? r.value : []);
        if (!items.length) throw new Error("GDELT y Google Noticias sin respuesta (" + String(e.message || e).slice(0, 40) + ")");
        data = { articles: items.map(gnToArt) }; via = "Google Noticias";
      }
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
        if (nivel === "rumor" || nivel === "fuente_unica") { ev.sinConfirmar = true; if (S >= 5) rum.push(ev); }
        else out.push(ev);
      }
      seguidos = 0;
      setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "ok", `${arts.length} artículos` + (via === "GDELT" ? "" : " (vía Google Noticias)"));
    } catch (e) {
      seguidos++;
      setSource("gdelt-" + th.id, "GDELT · " + th.titulo, "err", String(e.message || e));
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== th.id), ...out.filter((x) => x.tema === th.id)];
    ST.rumors = [...ST.rumors.filter((x) => x.tema !== th.id), ...rum.filter((x) => x.tema === th.id)];
    renderAll();
    if (i < THEMES.length && seguidos < 2) await sleep(GDELT_GAP_MS);
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
    sens("usgs", { n: seen.size, max: Math.max(0, ...[...seen.values()].map((f) => +f.properties?.mag || 0)) });
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
    sens("noaa", { g: maxG });
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
/* ===================== Fuentes oficiales y prensa (vía intermediario) ===================== */
const KW_ES = 'alerta OR emergencia OR ataque OR misil OR amenaza OR evacuación OR explosión OR apagón OR ciberataque OR nuclear OR terremoto OR atentado OR movilización';
const KW_EN = 'alert OR emergency OR attack OR missile OR threat OR evacuation OR explosion OR blackout OR cyberattack OR nuclear OR earthquake OR terror OR mobilization';
const GRUPOS = [
  { id: "of-es", titulo: "Organismos oficiales de España", tipo: "oficial", lang: "es", kw: KW_ES,
    sites: ["interior.gob.es", "proteccioncivil.es", "dsn.gob.es", "lamoncloa.gob.es", "defensa.gob.es", "exteriores.gob.es", "policia.es", "guardiacivil.es", "incibe.es", "112asturias.es", "asturias.es"] },
  { id: "of-int", titulo: "OTAN, ONU, OIEA, OMS y UE", tipo: "oficial", lang: "en", kw: KW_EN,
    sites: ["nato.int", "news.un.org", "un.org", "iaea.org", "who.int", "consilium.europa.eu", "ec.europa.eu", "eeas.europa.eu"] },
  { id: "of-gob", titulo: "Gobiernos: EE. UU., Reino Unido, Francia, Alemania", tipo: "oficial", lang: "en", kw: KW_EN,
    sites: ["whitehouse.gov", "state.gov", "defense.gov", "war.gov", "centcom.mil", "gov.uk", "diplomatie.gouv.fr", "elysee.fr", "auswaertiges-amt.de", "bundesregierung.de"] },
  { id: "pr-es", titulo: "Prensa española", tipo: "medio", lang: "es", kw: KW_ES,
    sites: ["elpais.com", "abc.es", "eldebate.com", "elmundo.es", "rtve.es", "efe.com", "europapress.es", "cnnespanol.cnn.com", "elconfidencial.com"] },
  { id: "pr-ast", titulo: "Prensa asturiana", tipo: "medio", lang: "es",
    kw: 'alerta OR emergencia OR evacuación OR incendio OR explosión OR apagón OR temporal OR inundación OR accidente OR desaparecido OR ciberataque',
    sites: ["lne.es", "elcomercio.es", "rtpa.es", "migijon.com", "asturias24.es"] },
  { id: "pr-int", titulo: "Prensa internacional", tipo: "medio", lang: "en", kw: KW_EN,
    sites: ["reuters.com", "apnews.com", "bbc.com", "cnn.com", "aljazeera.com", "france24.com", "dw.com", "theguardian.com"] },
  { id: "tertulias", titulo: "Programas de debate (Horizonte…)", tipo: "tertulia", lang: "es", kw: "",
    sites: ["cuatro.com/horizonte", "mediasetinfinity.mediaset.es"], extra: "Horizonte" }
];

async function scanGrupo(g) {
  const sid = "grp-" + g.id;
  setSource(sid, g.titulo, "wait", "Consultando…");
  const sites = "(" + g.sites.map((s) => "site:" + s).join(" OR ") + ")";
  const q = [sites, g.extra || "", g.kw ? "(" + g.kw + ")" : "", "when:1d"].filter(Boolean).join(" ");
  try {
    const items = await googleNews(q, g.lang);
    const groups = new Map();
    for (const it of items) {
      const a = gnToArt(it); if (!a.title) continue;
      const c = classifyPost(a.title);
      if (g.tipo !== "tertulia" && c.S < (g.tipo === "oficial" ? 3 : 4)) continue;
      const key = g.id + "|" + c.dominio + "|" + c.pl.name;
      if (!groups.has(key)) groups.set(key, { c, arts: [] });
      groups.get(key).arts.push(a);
    }
    const evs = [], rum = [];
    for (const [key, x] of groups) {
      const doms = new Set(x.arts.map((a) => a.domain));
      const nivel = g.tipo === "oficial" ? "oficial" : g.tipo === "tertulia" ? "rumor" : levelFromCount(doms.size + 1, 1, false);
      const S = Math.max(...x.arts.map((a) => classifyPost(a.title).S));
      const latest = x.arts.map((a) => gdeltDate(a.seendate)).filter(Boolean).sort().at(-1);
      const ev = { id: "grp-" + key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), origen: "auto", tema: sid,
        titulo: `${g.titulo}: ${x.arts[0].title}`, resumen: x.arts[0].title, dominio: x.c.dominio, region: x.c.pl.name,
        lat: x.c.pl.lat, lon: x.c.pl.lon, zona: x.c.pl.zona, S, nivel, tendencia: "estable", fecha: latest, n: doms.size,
        fuentes: x.arts.slice(0, 10).map((a) => ({ n: `${a.domain} · ${a.title}`, url: a.url })),
        fiabilidad: g.tipo === "oficial" ? `Publicado en web oficial (${[...doms].join(", ")}).`
          : g.tipo === "tertulia" ? "Programa de debate o especulación: se trata como rumor hasta que lo confirme otra fuente."
          : `${doms.size} medio(s): ${[...doms].join(", ")}.` };
      (nivel === "rumor" ? rum : evs).push(ev);
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== sid), ...evs.slice(0, 12)];
    ST.rumors = [...ST.rumors.filter((x) => x.tema !== sid), ...rum.slice(0, 6)];
    setSource(sid, g.titulo, "ok", `${items.length} titulares, ${evs.length + rum.length} de alerta`);
  } catch (e) { setSource(sid, g.titulo, "err", String(e.message || e).slice(0, 80)); }
}

function rssItems(xml) {
  let doc = new DOMParser().parseFromString(xml, "text/xml");
  // Si el XML viene con algún defecto, se reintenta en modo tolerante (HTML)
  if (doc.querySelector("parsererror") || !doc.querySelector("item, entry")) doc = new DOMParser().parseFromString(xml, "text/html");
  return [...doc.querySelectorAll("item, entry")].map((it) => ({
    title: it.querySelector("title")?.textContent?.trim() || "",
    desc: (it.querySelector("description, summary, content")?.textContent || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    url: it.querySelector("link")?.getAttribute("href") || it.querySelector("link")?.textContent?.trim() || "",
    date: it.querySelector("pubDate, updated, published")?.textContent || ""
  }));
}
const reciente = (d, h = 72) => { const t = new Date(d); return !isNaN(t) && Date.now() - t < h * 36e5; };
function evOficial(tema, fuente, titulo, desc, url, S, dominio, fecha) {
  const c = classifyPost(titulo + " " + desc);
  return { id: tema + "-" + (titulo + url).replace(/[^a-z0-9]+/gi, "").slice(-40).toLowerCase(), origen: "auto", tema,
    titulo: `${fuente}: ${titulo}`, resumen: desc.slice(0, 240) || titulo, dominio: dominio || c.dominio, region: c.pl.name,
    lat: c.pl.lat, lon: c.pl.lon, zona: c.pl.zona, S, nivel: "oficial", tendencia: "estable",
    fecha: fecha && !isNaN(new Date(fecha)) ? new Date(fecha).toISOString() : null,
    fuentes: [{ n: fuente, url }], fiabilidad: `Aviso oficial publicado por ${fuente}.` };
}

async function scanOficiales() {
  const tareas = [
    ["aemet", "AEMET · Avisos meteorológicos", async () => {
      const its = rssItems(await pget("https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml", false, 20000));
      const out = [];
      // Formato comprobado el 12 nov 2026: «Aviso. Nivel naranja. Vientos. Litoral oriental asturiano».
      // Las zonas de Asturias no llevan la palabra «Asturias»: se reconocen por nombre (y por el código 63 del enlace, sin verificar).
      let nAst = 0; const vistos = new Set();
      for (const it of its) {
        const nivel = ((it.title.match(/nivel\s+(amarillo|naranja|rojo)/i) || [])[1] || "").toLowerCase();
        const ast = /asturian|asturias|valles mineros|cordillera y picos de europa/i.test(it.title) || /AFAZ63\d{4}/.test(it.url);
        if (ast) nAst++;
        if (!(nivel === "rojo" || (nivel === "naranja" && ast))) continue;
        const k = it.title.replace(/^Aviso\.\s*/, ""); if (vistos.has(k)) continue; vistos.add(k);
        const ev = evOficial("aemet", "AEMET", k, it.desc, "https://www.aemet.es/es/eltiempo/prediccion/avisos", nivel === "rojo" ? (ast ? 8 : 4) : 5, "natural", it.date);
        if (ast) Object.assign(ev, { region: "Asturias", lat: 43.36, lon: -5.85, zona: "asturias" }); else if (ev.zona !== "espana" && ev.zona !== "asturias") Object.assign(ev, { region: "España", lat: 40.4, lon: -3.7, zona: "espana" });
        out.push(ev);
      }
      return [out, `${its.length} avisos en España (${nAst} en Asturias); ${out.length} naranja/rojo relevantes`, { n: its.length, rel: out.length, ast: nAst }];
    }],
    ["gdacs", "GDACS · Desastres (ONU/UE)", async () => {
      const raw = await pget("https://www.gdacs.org/xml/rss.xml", false, 20000);
      const its = rssItems(raw);
      if (!its.length) throw new Error("Respuesta sin sucesos: " + raw.replace(/\s+/g, " ").slice(0, 50));
      const out = its.filter((it) => /^(red|orange)/i.test(it.title) && reciente(it.date, 96))
        .map((it) => evOficial("gdacs", "GDACS", it.title, it.desc, it.url, /^red/i.test(it.title) ? 5 : 3, "natural", it.date));
      return [out, `${its.length} sucesos; ${out.length} naranja/rojo`, { n: its.length, rel: out.length }];
    }],
    ["usstate", "EE. UU. · Avisos de viaje", async () => {
      const its = rssItems(await pget("https://travel.state.gov/_res/rss/TAsTWs.xml", false, 20000));
      const out = its.filter((it) => /level [34]/i.test(it.title) && reciente(it.date, 96))
        .map((it) => evOficial("usstate", "Departamento de Estado EE. UU.", it.title, it.desc, it.url, /level 4/i.test(it.title) ? 5 : 3,
          /terror|armed conflict|war|unrest|kidnap/i.test(it.desc) ? "belico" : "social", it.date));
      return [out, `${its.length} países; ${out.length} subidos a nivel 3–4 en 4 días`, { n: out.length }];
    }],
    ["alemania", "Alemania · Avisos de viaje", async () => {
      const d = await pget("https://www.auswaertiges-amt.de/opendata/travelwarning", true, 20000);
      const r = d.response || {}; const out = [];
      for (const [k, v] of Object.entries(r)) {
        if (!v || typeof v !== "object" || !v.title) continue;
        const t = (v.lastModified || 0) * 1000;
        if (Date.now() - t > 96 * 36e5) continue;
        if (!(v.warning || v.partialWarning || v.situationWarning || v.situationPartWarning)) continue;
        out.push(evOficial("alemania", "Ministerio de Exteriores de Alemania", v.title, v.warning ? "Aviso de viaje (Reisewarnung)" : "Aviso de viaje parcial",
          "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit", v.warning ? 5 : 3, "belico", new Date(t).toISOString()));
      }
      return [out, `${out.length} avisos nuevos o cambiados en 4 días`, { n: out.length }];
    }]
  ];
  await Promise.all(tareas.map(async ([id, nombre, fn]) => {
    setSource("of-" + id, nombre, "wait", "Consultando…");
    try { const [evs, msg, extra] = await fn(); if (extra) sens(id, extra); ST.auto = [...ST.auto.filter((x) => x.tema !== id), ...evs.slice(0, 10)]; setSource("of-" + id, nombre, "ok", msg); }
    catch (e) { setSource("of-" + id, nombre, "err", String(e.message || e).slice(0, 80)); }
  }));
}


/* --- prensa leída directamente (sin pasar por Google) --- */
const PRENSA = [
  { id: "pd-es", titulo: "Prensa española (directo)", feeds: [
    ["ABC · Última hora", "https://www.abc.es/rss/feeds/abc_ultima.xml"],
    ["Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=94"],
    ["El País", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada"],
    ["El Mundo", "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml"],
    ["El Debate", "https://www.eldebate.com/rss/home.xml"],
    ["20minutos", "https://www.20minutos.es/rss"]
  ] },
  { id: "pd-ast", titulo: "Prensa asturiana (directo)", local: true, feeds: [
    ["La Nueva España", "https://www.lne.es/rss/"],
    ["El Comercio", "https://www.elcomercio.es/rss/2.0/?section=asturias"],
    ["RTPA", "https://www.rtpa.es/rss"]
  ] },
  { id: "pd-int", titulo: "Prensa internacional (directo)", feeds: [
    ["BBC Mundo (inglés)", "https://feeds.bbci.co.uk/news/world/rss.xml"],
    ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"],
    ["DW español", "https://rss.dw.com/rdf/rss-sp-all"],
    ["France 24 español", "https://www.france24.com/es/rss"],
    ["The Guardian · Mundo", "https://www.theguardian.com/world/rss"],
    ["ONU Noticias", "https://news.un.org/feed/subscribe/es/news/all/rss.xml"]
  ] },
  { id: "pd-of", titulo: "Avisos de viaje de Reino Unido", oficial: true, feeds: [
    ["Gobierno británico · Avisos de viaje", "https://www.gov.uk/foreign-travel-advice.atom"]
  ] }
];

/* Busca el canal RSS de una web leyendo su portada (<link rel="alternate" type="application/rss+xml">) y lo recuerda. */
async function descubrirFeed(web) {
  const mem = store.get("brujula.feeds", {});
  if (mem[web]) return mem[web];
  const html = await pget(web, false, 20000);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [...doc.querySelectorAll('link[type*="rss"], link[type*="atom"], a[href*="rss"]')].map((l) => l.getAttribute("href")).filter(Boolean);
  const cand = [...links.map((h) => new URL(h, web).href), web + "rss", web + "elementosInt/rss/1", web + "rss/section/1"];
  for (const u of cand) {
    try { const its = rssItems(await pget(u, false, 15000)); if (its.length) { mem[web] = u; store.set("brujula.feeds", mem); return u; } } catch {}
  }
  throw new Error("no se encontró su canal RSS");
}
// Fecha de un titular: RTPA no la trae en el canal (va en la dirección: …/2026-11-12/…)
function fechaItem(it) {
  let t = +new Date(it.date);
  if (!t) { const m = (it.url || "").match(/\/(20\d{2})-(\d{2})-(\d{2})\//); if (m) t = `${m[1]}-${m[2]}-${m[3]}` === new Date().toISOString().slice(0, 10) ? Date.now() - 36e5 : +new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`); }
  return t || 0;
}
async function scanPrensaDirecta(g) {
  const sid = "pd-" + g.id;
  setSource(sid, g.titulo, "wait", "Consultando…");
  const res = await Promise.allSettled(g.feeds.map(async ([n, u]) => {
    if (u.startsWith("auto:")) u = await descubrirFeed(u.slice(5));
    const its = rssItems(await pget(u, false, 20000));
    if (!its.length) throw new Error("sin noticias");
    return its.map((it) => ({ ...it, medio: n }));
  }));
  const okN = res.filter((r) => r.status === "fulfilled").length;
  const fallos = g.feeds.filter((f, i) => res[i].status !== "fulfilled").map((f) => f[0]);
  const items = res.flatMap((r) => r.status === "fulfilled" ? r.value : []).map((it) => ({ ...it, t: fechaItem(it) }))
    .filter((it) => (!it.t || (Date.now() - it.t < 24 * 36e5 && it.t - Date.now() < 2 * 36e5)) && !/\/(agenda|club|opinion|deportes|cultura|ocio|gastronomia)\//i.test(it.url || ""));
  const sel = [];
  for (const it of items) {
    const c = classifyPost(it.title + " " + (g.oficial ? "" : it.desc.slice(0, 200))), ct = classifyPost(it.title);
    // Un medio asturiano que no nombra el lugar habla, casi siempre, de Asturias
    const pl = g.local && c.pl.lat == null && !/nacional|internacional|espana|mundo|economia|politica/i.test(it.url || "") ? PLACES[0] : c.pl;
    const min = g.oficial ? 2 : pl.zona === "asturias" ? 3 : pl.zona === "espana" ? 4 : 5;
    const deAqui = pl.zona === "asturias" || pl.zona === "espana";
    if (c.S < min && !(ct.desmiente && deAqui)) continue;
    if (g.oficial && !/(terror|conflict|war|unrest|evacuat|do not travel|against all|military|attack|security)/i.test(it.title + " " + it.desc)) continue;
    sel.push({ ...it, dominio: c.dominio, S: Math.max(ct.S, g.oficial ? c.S : 0) || c.S, pl, desmiente: ct.desmiente, atribuido: ct.atribuido, oficial: !!g.oficial });
  }
  ST.prensa = ST.prensa || {}; ST.prensa[sid] = sel;
  agruparPrensa();
  setSource(sid, g.titulo, okN ? "ok" : "err", okN ? `${okN}/${g.feeds.length} medios leídos, ${items.length} noticias de hoy, ${sel.length} de alerta` + (fallos.length ? ` · fallan: ${fallos.join(", ")}` : "") : "Ningún medio respondió");
}
/* Junta los titulares de TODOS los medios leídos (españoles, asturianos, internacionales) por tipo de suceso y lugar.
   Reglas (las mismas que el vigilante del NAS):
   · un solo medio no oficial = «sin confirmar»: va al cuadro de rumores y no cuenta para el índice;
   · un dato atribuido («según un sindicato…») sigue siendo una sola voz aunque lo repitan varios medios;
   · un titular que desmiente no confirma: marca el suceso como corregido o desmentido. */
function agruparPrensa() {
  const groups = new Map();
  for (const it of Object.values(ST.prensa || {}).flat()) {
    const key = (it.oficial ? "of|" : "") + it.dominio + "|" + it.pl.name;
    if (!groups.has(key)) groups.set(key, { pl: it.pl, dominio: it.dominio, oficial: it.oficial, its: [] });
    groups.get(key).its.push(it);
  }
  const evs = [], rum = [];
  for (const [key, x] of groups) {
    const hechos = x.its.filter((i) => !i.desmiente && !i.atribuido), atrib = x.its.filter((i) => i.atribuido), desm = x.its.filter((i) => i.desmiente);
    const base = hechos.length ? hechos : atrib; if (!base.length) continue;      // un desmentido suelto, sin nada que desmentir, no es un suceso
    const medios = new Set(hechos.map((i) => i.medio)), todos = new Set(x.its.map((i) => i.medio));
    const nivel = x.oficial ? "oficial" : medios.size >= 3 ? "varios_medios" : medios.size === 2 ? "medios_locales" : "fuente_unica";
    const firme = x.oficial || medios.size >= 2;
    const top = [...base].sort((a, b) => b.S - a.S || b.t - a.t)[0];
    const ev = { id: "prensa-" + key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), origen: "auto", tema: x.oficial ? "pd-pd-of" : "prensa",
      titulo: `${top.medio}: ${top.title}`, resumen: top.desc.slice(0, 240) || top.title, dominio: x.dominio,
      region: x.pl.name, lat: x.pl.lat, lon: x.pl.lon, zona: x.pl.zona, S: Math.max(...base.map((i) => i.S)), nivel, tendencia: "estable", n: todos.size,
      fecha: x.its.map((i) => i.t ? new Date(i.t).toISOString() : "").filter(Boolean).sort().at(-1) || null,
      fuentes: [...desm, ...hechos, ...atrib].slice(0, 10).map((i) => ({ n: `${i.medio} · ${i.desmiente ? "DESMIENTE · " : i.atribuido ? "atribuido · " : ""}${i.title}`, url: i.url })),
      fiabilidad: (hechos.length ? `${medios.size} medio(s) lo publican como hecho: ${[...medios].join(", ")}.` : "Solo hay datos atribuidos a una parte («según…»), no hechos comprobados.")
        + (atrib.length && hechos.length ? ` Además, ${atrib.length} titular(es) con datos atribuidos, que no cuentan como confirmación.` : "") };
    if (desm.length) {
      const d = desm[0];
      if (firme) { ev.correccion = `${d.medio}: ${d.title}`; ev.fiabilidad += ` Corrección: «${d.title}» (${d.medio}). El suceso principal sigue en pie; lo desmentido es un dato concreto.`; }
      else { ev.desmentido = true; ev.fiabilidad = `DESMENTIDO: «${d.title}» (${d.medio}). ` + ev.fiabilidad; }
    }
    if (!firme) { ev.sinConfirmar = true; ev.nivel = hechos.length ? "fuente_unica" : "rumor"; if (ev.S >= 3) rum.push(ev); }
    else evs.push(ev);
  }
  const mia = (x) => x.tema === "prensa" || x.tema === "pd-pd-of" || /^pd-/.test(x.tema || "");
  ST.auto = [...ST.auto.filter((x) => !mia(x)), ...evs.sort((a, b) => b.S - a.S).slice(0, 25)];
  ST.rumors = [...ST.rumors.filter((x) => !mia(x)), ...rum.sort((a, b) => b.S - a.S).slice(0, 10)];
}

async function scanPrensaYOrganismos() {
  await Promise.all([scanOficiales(), ...PRENSA.map(scanPrensaDirecta)]);
  renderAll();
  // Google Noticias solo para las webs oficiales que no tienen canal propio (va en cola, de una en una)
  for (const g of GRUPOS.filter((g) => g.tipo !== "medio")) { await scanGrupo(g); renderAll(); }
}

/* --- canales de Telegram públicos (t.me/s/…) --- */
async function readTelegram(handle) {
  const html = await pget(`https://t.me/s/${handle}`, false, 20000);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const msgs = [...doc.querySelectorAll(".tgme_widget_message")].map((m) => ({
    text: (m.querySelector(".tgme_widget_message_text")?.textContent || "").trim(),
    date: m.querySelector("time")?.getAttribute("datetime") || "",
    url: m.getAttribute("data-post") ? "https://t.me/" + m.getAttribute("data-post") : `https://t.me/${handle}`
  })).filter((m) => m.text);
  const title = doc.querySelector(".tgme_channel_info_header_title")?.textContent?.trim() || handle;
  if (!msgs.length && !doc.querySelector(".tgme_channel_info")) throw new Error("Canal no encontrado o privado");
  return { title, msgs: msgs.reverse() };
}

/* ===================== Fuentes nuevas (estudio de herramientas similares) ===================== */
/* Sismos cercanos (EMSC, centro sismológico euromediterráneo): completa a USGS con terremotos pequeños cerca de casa */
/* Sol: llamaradas de los últimos 7 días (GOES) y probabilidad oficial de llamaradas M y X (NOAA) */
async function scanSol() {
  const id = "sol", nombre = "NOAA · Llamaradas solares";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    const [fl, pr] = await Promise.all([
      getJSON("https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json"),
      getJSON("https://services.swpc.noaa.gov/json/solar_probabilities.json").catch(() => [])]);
    const flares = (fl || []).map((f) => ({ c: String(f.max_class || ""), t: f.max_time || f.begin_time })).filter((f) => /^[MX]/.test(f.c));
    const uniq = [...new Map(flares.map((f) => [f.t + f.c, f])).values()];
    const val = (c) => ({ X: 10, M: 1 }[c[0]] || 0) * (parseFloat(c.slice(1)) || 1);
    const top = uniq.reduce((a, b) => (!a || val(b.c) > val(a.c) ? b : a), null);
    const p0 = Array.isArray(pr) ? pr[0] || {} : {};
    const pM = +p0.m_class_1_day || 0, pX = +p0.x_class_1_day || 0;
    const dias = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); dias.push([d.slice(8, 10) + "/" + d.slice(5, 7), uniq.filter((f) => (f.t || "").startsWith(d)).length]); }
    const xs24 = uniq.filter((f) => f.c[0] === "X" && Date.now() - new Date(f.t) < 864e5);
    const evs = xs24.map((f) => ({ id: "sol-" + f.t, origen: "auto", tema: "sol", titulo: `Llamarada solar ${f.c}`, dominio: "natural", region: "Global", lat: null, lon: null, zona: "mundo",
      resumen: `Llamarada de clase ${f.c}. Corta la radio de onda corta en la cara iluminada de la Tierra durante minutos u horas. Si lanzó una eyección hacia la Tierra, puede haber tormenta geomagnética en 1–3 días: vigila el nivel G.`,
      S: val(f.c) >= 50 ? 4 : 3, nivel: "oficial", tendencia: "estable", fecha: f.t,
      fuentes: [{ n: "NOAA SWPC – flujo de rayos X", url: "https://www.swpc.noaa.gov/products/goes-x-ray-flux" }], fiabilidad: "Medida del satélite GOES (NOAA)." }));
    ST.auto = [...ST.auto.filter((x) => x.tema !== "sol"), ...evs];
    sens("sol", { m: uniq.filter((f) => f.c[0] === "M").length, x: uniq.filter((f) => f.c[0] === "X").length, top: top?.c || null, pM, pX, dias });
    setSource(id, nombre, "ok", `${uniq.length} llamaradas M/X en 7 días; mayor ${top?.c || "–"}; prob. X mañana ${pX} %`);
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}
async function scanEMSC() {
  setSource("emsc", "EMSC · Sismos cerca de Asturias", "wait", "Consultando…");
  try {
    const start = new Date(Date.now() - 48 * 36e5).toISOString().slice(0, 19);
    const d = await pget(`https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=3&limit=300&start=${start}`, true, 20000);
    const evs = [];
    for (const f of d.features || []) {
      const p = f.properties || {}; const lat = +p.lat, lon = +p.lon, M = +p.mag;
      const dist = km(HOME[0], HOME[1], lat, lon);
      if (!(dist < 300 && M >= 3) && !(dist < 1200 && M >= 4.5)) continue;
      const S = M >= 6 ? 6 : M >= 5 ? 4 : M >= 4 ? 3 : 2;
      evs.push({ id: "emsc-" + p.unid, origen: "auto", tema: "emsc", titulo: `Terremoto M${M.toFixed(1)} · ${p.flynn_region || "zona sin nombre"}`,
        resumen: `A ${Math.round(dist)} km de Oviedo. Profundidad ${p.depth ?? "?"} km.`, dominio: "natural", region: p.flynn_region || "Sismo",
        lat, lon, zona: dist < 250 ? "asturias" : dist < 900 ? "espana" : "europa", S, nivel: "oficial", tendencia: "estable", fecha: p.time,
        fuentes: [{ n: "EMSC – ficha del terremoto", url: `https://www.emsc-csem.org/Earthquake_information/earthquake.php?id=${p.source_id || ""}` }],
        fiabilidad: "Dato instrumental del Centro Sismológico Euromediterráneo (EMSC)." });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "emsc"), ...evs.slice(0, 8)];
    const todos = (d.features || []).map((f) => ({ M: +f.properties.mag, dist: km(HOME[0], HOME[1], +f.properties.lat, +f.properties.lon), r: f.properties.flynn_region }));
    const prox = todos.reduce((a, b) => (!a || b.dist < a.dist ? b : a), null);
    sens("emsc", { n: todos.length, mags: todos.map((x) => x.M), cerca: evs.length, prox });
    setSource("emsc", "EMSC · Sismos cerca de Asturias", "ok", `${(d.features || []).length} sismos M3+ en 48 h; ${evs.length} cerca`);
  } catch (e) { setSource("emsc", "EMSC · Sismos cerca de Asturias", "err", String(e.message || e).slice(0, 80)); }
}

/* Apagón: compara la demanda eléctrica real con la prevista (Red Eléctrica). Una caída brusca indica un corte grande. */
async function scanREE() {
  const id = "ree", nombre = "Red Eléctrica · Detector de apagón";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    // Red Eléctrica interpreta las fechas en hora de Madrid. Antes se pedían en UTC y el dato llegaba con 1–2 h de retraso.
    const f = (t) => new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Madrid", hour12: false }).replace(" ", "T").slice(0, 16);
    const d = await pget(`https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real?start_date=${f(Date.now() - 6 * 36e5)}&end_date=${f(Date.now() + 10 * 60000)}&time_trunc=hour`, true, 20000);
    const series = (d.included || []).map((s) => ({ t: (s.attributes?.title || s.type || "").toLowerCase(), v: (s.attributes?.values || []).filter((x) => x.value != null) }));
    const real = series.find((s) => /^real|demanda real/.test(s.t)), prev = series.find((s) => /prevista/.test(s.t)) || series.find((s) => /^programada$|demanda programada/.test(s.t));
    if (!real || !real.v.length || !prev) throw new Error("Formato no reconocido");
    const last = real.v[real.v.length - 1];
    const minutos = Math.round((Date.now() - new Date(last.datetime)) / 60000);
    if (!(minutos < 120)) throw new Error(`Red Eléctrica no publica datos desde hace ${minutos} min`);
    const ref = prev.v.find((x) => x.datetime === last.datetime) || prev.v[prev.v.length - 1];
    const antes = real.v[real.v.length - 3] || real.v[real.v.length - 2];
    const ratio = Math.min(ref?.value ? last.value / ref.value : 1, antes?.value ? last.value / antes.value : 1);
    const evs = [];
    if (ratio < 0.85) {
      const S = ratio < 0.6 ? 8 : ratio < 0.75 ? 6 : 4;
      evs.push({ id: "ree-apagon", origen: "auto", tema: "ree", titulo: `Posible apagón: la demanda eléctrica cae al ${Math.round(ratio * 100)} % de lo previsto`,
        resumen: `Demanda real ${Math.round(last.value)} MW frente a ${Math.round(ref.value)} MW previstos (${new Date(last.datetime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}). Una caída así suele indicar un corte masivo.`,
        dominio: "energia", region: "Península (incluida Asturias)", lat: 40.4, lon: -3.7, zona: "asturias", S, nivel: "oficial", tendencia: "escala", fecha: last.datetime,
        fuentes: [{ n: "Red Eléctrica – demanda en tiempo real", url: "https://demanda.ree.es/visiona/peninsula/demandaqh/total" }],
        fiabilidad: "Dato oficial de Red Eléctrica. Puede haber retrasos de unos minutos." });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "ree"), ...evs];
    sens("ree", { real: real.v.map((x) => ({ t: x.datetime, v: x.value })), prev: prev.v.map((x) => ({ t: x.datetime, v: x.value })), ratio });
    setSource(id, nombre, "ok", `Demanda ${Math.round(last.value)} MW (${Math.round(ratio * 100)} % de lo esperado; dato de hace ${minutos} min)` + (evs.length ? " · ¡caída anómala!" : " · normal"));
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}

/* Cortes de internet a escala de país (IODA, Georgia Tech). Un corte nacional suele acompañar a guerras, ciberataques o apagones. */
const PAIS_ES = { ES: "España", PT: "Portugal", FR: "Francia", IR: "Irán", IL: "Israel", UA: "Ucrania", RU: "Rusia", IQ: "Irak", SY: "Siria", LB: "Líbano", YE: "Yemen", SA: "Arabia Saudí", AE: "Emiratos", QA: "Catar", KW: "Kuwait", BH: "Baréin", JO: "Jordania", PL: "Polonia", LT: "Lituania", LV: "Letonia", EE: "Estonia", FI: "Finlandia", DE: "Alemania", IT: "Italia", GB: "Reino Unido", MA: "Marruecos", DZ: "Argelia", TW: "Taiwán", CN: "China", KP: "Corea del Norte", KR: "Corea del Sur", VE: "Venezuela", PK: "Pakistán", IN: "India", BY: "Bielorrusia", MD: "Moldavia", RO: "Rumanía" };
async function scanIODA() {
  const id = "ioda", nombre = "IODA · Cortes de internet por país";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    const until = Math.floor(Date.now() / 1000), from = until - 24 * 3600;
    const d = await pget(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?from=${from}&until=${until}&entityType=country&limit=100`, true, 25000);
    const raw = Array.isArray(d.data) ? d.data : Array.isArray(d.data?.events) ? d.data.events : [];
    const byC = new Map();
    for (const ev of raw) {
      const code = (ev.location || ev.entity?.code || "").split("/").pop().toUpperCase().slice(0, 2);
      if (!code) continue;
      const sc = +ev.score || 0, o = byC.get(code) || { code, score: 0, tec: new Set(), name: ev.location_name || ev.entity?.name };
      o.tec.add(ev.datasource || "?"); if (sc >= o.score) Object.assign(o, { score: sc, start: ev.start, dur: ev.duration }); byC.set(code, o);
    }
    // IODA marca decenas de países al día con una sola técnica de medida (muy ruidosa). Solo cuenta si lo ven dos técnicas distintas;
    // con una sola, y solo en España o vecinos, se muestra como «posible» y sin confirmar.
    for (const [c, o] of byC) { o.firme = o.tec.size >= 2; if (!o.firme && !["ES", "PT", "FR"].includes(c)) byC.delete(c); }
    const evs = [];
    for (const o of [...byC.values()].sort((a, b) => b.score - a.score)) {
      const nm = PAIS_ES[o.code] || o.name || o.code;
      const cerca = ["ES", "PT", "FR"].includes(o.code);
      if (!cerca && !PAIS_ES[o.code]) continue;
      const pl = placeOf(nm, "");
      evs.push({ id: "ioda-" + o.code, origen: "auto", tema: "ioda", titulo: `${o.firme ? "Corte" : "Posible corte"} de internet detectado en ${nm}`, sinConfirmar: !o.firme,
        resumen: `IODA detecta una caída de conectividad a escala nacional${o.dur ? ` de unos ${Math.round(o.dur / 60)} min` : ""}. No dice la causa: puede ser un ciberataque, un apagón o un corte ordenado por el gobierno.`,
        dominio: "ciber", region: nm, lat: pl.lat, lon: pl.lon, zona: o.code === "ES" ? "espana" : cerca ? "ue" : pl.zona, S: cerca ? 5 : 3, nivel: o.firme ? "oficial" : "fuente_unica", tendencia: "estable",
        fecha: o.start ? new Date(o.start * 1000).toISOString() : null,
        fuentes: [{ n: "IODA – panel del país", url: `https://ioda.inetintel.cc.gatech.edu/country/${o.code}` }],
        fiabilidad: o.firme ? `Medición técnica independiente (Georgia Tech), vista por ${o.tec.size} técnicas distintas. Detecta el corte, no su causa.` : "Solo lo ve una técnica de medida: puede ser ruido. Sin confirmar." });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "ioda"), ...evs.slice(0, 6)];
    sens("ioda", { n: byC.size, paises: [...byC.values()].sort((a, b) => b.score - a.score).map((o) => PAIS_ES[o.code] || o.name || o.code).slice(0, 12), cerca: evs.filter((e) => e.zona === "espana" || e.zona === "ue").length });
    setSource(id, nombre, "ok", `${byC.size} país(es) con cortes fiables en 24 h` + (evs.some((e) => e.zona === "espana" || e.zona === "ue") ? " · ¡incluye España o vecinos!" : ""));
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}

/* Avisos de ciberseguridad del INCIBE-CERT (incluidos los de sistemas industriales: luz, agua, gas…) */
async function scanINCIBE() {
  const id = "incibe", nombre = "INCIBE-CERT · Avisos de ciberseguridad";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    const [av, sci] = await Promise.allSettled([
      pget("https://www.incibe.es/incibe-cert/alerta-temprana/avisos/feed", false, 20000),
      pget("https://www.incibe.es/incibe-cert/alerta-temprana/avisos-sci/feed", false, 20000)]);
    if (av.status !== "fulfilled" && sci.status !== "fulfilled") throw new Error(String(av.reason?.message || "Sin respuesta"));
    const its = [...(av.status === "fulfilled" ? rssItems(av.value).map((i) => ({ ...i, sci: false })) : []),
                 ...(sci.status === "fulfilled" ? rssItems(sci.value).map((i) => ({ ...i, sci: true })) : [])].filter((i) => !i.date || reciente(i.date, 48));
    const crit = its.filter((i) => /cr[ií]tica|5 - /i.test(i.title + " " + i.desc) || i.sci && /alta|4 - /i.test(i.desc));
    const evs = crit.slice(0, 3).map((i) => ({ id: "incibe-" + i.title.replace(/[^a-z0-9]+/gi, "").slice(0, 40).toLowerCase(), origen: "auto", tema: "incibe",
      titulo: `INCIBE${i.sci ? " (infraestructuras)" : ""}: ${i.title}`, resumen: i.desc.slice(0, 220), dominio: "ciber", region: "España", lat: 40.4, lon: -3.7,
      zona: "espana", S: i.sci ? 3 : 2, nivel: "oficial", tendencia: "estable", fecha: i.date ? new Date(i.date).toISOString() : null,
      fuentes: [{ n: "INCIBE-CERT", url: i.url }], fiabilidad: "Aviso técnico oficial: indica un fallo de seguridad grave, no un ataque en curso." }));
    ST.auto = [...ST.auto.filter((x) => x.tema !== "incibe"), ...evs];
    setSource(id, nombre, "ok", `${its.length} avisos en 48 h; ${crit.length} críticos`);
    sens("incibe", { n: its.length, crit: crit.length, ult: its.slice(0, 3).map((i) => ({ t: i.title, u: i.url })) });
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}

/* Copernicus EMS (UE): activaciones de cartografía de emergencia. Formato comprobado el 12 nov 2026. */
async function scanCopernicus() {
  const id = "copernicus", nombre = "Copernicus EMS · Desastres en Europa";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    const d = await pget("https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=15", true, 20000);
    const evs = [];
    for (const a of d.results || []) {
      const t = +new Date(a.activationTime + (/[zZ]|[+-]\d\d:?\d\d$/.test(a.activationTime) ? "" : "Z")); if (!t || Date.now() - t > 7 * 864e5) continue;
      const paises = (a.countries || []).map((c) => c.short_name);
      const cerca = paises.includes("Spain") ? "espana" : paises.some((p) => /Portugal|France|Andorra/.test(p)) ? "ue" : null; if (!cerca) continue;
      const m = String(a.centroid || "").match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)/); const lon = m ? +m[1] : null, lat = m ? +m[2] : null;
      const ast = lat != null && km(HOME[0], HOME[1], lat, lon) < 200;
      evs.push({ id: "ems-" + a.code, origen: "auto", tema: "copernicus", titulo: `Copernicus activa cartografía de emergencia: ${a.name}`, dominio: "natural",
        resumen: `Tipo: ${a.category?.name || "?"}. Las autoridades han pedido a la UE mapas urgentes de la zona afectada: señal de que el desastre es serio.`,
        region: ast ? "Asturias" : paises.join(", "), lat, lon, zona: ast ? "asturias" : cerca, S: ast ? 7 : cerca === "espana" ? 5 : 3, nivel: "oficial", tendencia: "estable", fecha: new Date(t).toISOString(),
        fuentes: [{ n: `Copernicus EMS – activación ${a.code}`, url: `https://mapping.emergency.copernicus.eu/activations/${a.code}/` }], fiabilidad: "Servicio oficial de emergencias de la Unión Europea." });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "copernicus"), ...evs];
    setSource(id, nombre, "ok", `${(d.results || []).length} activaciones recientes; ${evs.length} en España o vecinos esta semana`);
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}
/* OMS: brotes publicados (Disease Outbreak News). Lectura directa, sin intermediario. Formato comprobado el 12 nov 2026. */
async function scanOMS() {
  const id = "oms", nombre = "OMS · Brotes";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    const d = await pget("https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDate%20desc&$top=8", true, 25000);
    const evs = [];
    for (const x of d.value || []) {
      if (Date.now() - new Date(x.PublicationDate) > 5 * 864e5) continue;
      const pl = placeOf(x.Title || "", ""); const cerca = ["asturias", "espana", "ue"].includes(pl.zona);
      evs.push({ id: "oms-" + (x.Id || x.UrlName), origen: "auto", tema: "oms", titulo: "OMS: " + x.Title, resumen: "Parte de brote publicado por la Organización Mundial de la Salud.", dominio: "sanitario",
        region: pl.name, lat: pl.lat, lon: pl.lon, zona: pl.zona, S: cerca ? 5 : 3, nivel: "oficial", tendencia: "estable", fecha: x.PublicationDate,
        fuentes: [{ n: "OMS – Disease Outbreak News", url: "https://www.who.int/emergencies/disease-outbreak-news/item/" + (x.UrlName || "") }], fiabilidad: "Publicación oficial de la OMS." });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "oms"), ...evs.slice(0, 4)];
    setSource(id, nombre, "ok", `${(d.value || []).length} partes; ${evs.length} en los últimos 5 días`);
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}
/* Calidad del aire y rachas de viento en Asturias (Open-Meteo, modelo europeo CAMS). Lectura directa. Es un modelo, no una estación:
   sirve para detectar un episodio serio (humo de incendios, accidente industrial), no para medir tu calle. */
async function scanAire() {
  const id = "aire", nombre = "Open-Meteo · Aire y viento en Asturias";
  setSource(id, nombre, "wait", "Consultando…");
  try {
    const [a, w] = await Promise.all([
      pget(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${HOME[0]}&longitude=${HOME[1]}&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=Europe%2FMadrid`, true, 15000),
      pget(`https://api.open-meteo.com/v1/forecast?latitude=${HOME[0]}&longitude=${HOME[1]}&current=wind_gusts_10m,precipitation&daily=wind_gusts_10m_max,precipitation_sum&forecast_days=2&timezone=Europe%2FMadrid`, true, 15000).catch(() => null)]);
    const c = a.current || {}, aqi = +c.european_aqi;
    if (!isFinite(aqi)) throw new Error("Formato no reconocido");
    const racha = w?.daily?.wind_gusts_10m_max ? Math.max(...w.daily.wind_gusts_10m_max.filter(isFinite)) : null;
    const evs = [];
    if (aqi >= 100) evs.push({ id: "aire-aqi", origen: "auto", tema: "aire", titulo: `Aire muy contaminado en Asturias (índice europeo ${Math.round(aqi)})`, dominio: "natural",
      resumen: `PM10 ${c.pm10} · PM2,5 ${c.pm2_5} · NO₂ ${c.nitrogen_dioxide} · SO₂ ${c.sulphur_dioxide} µg/m³. Puede deberse a humo de incendios, a una inversión térmica o a un accidente industrial. Mira los avisos del Principado.`,
      region: "Asturias", lat: HOME[0], lon: HOME[1], zona: "asturias", S: aqi >= 150 ? 5 : 4, nivel: "medios_locales", tendencia: "estable", fecha: new Date().toISOString(),
      fuentes: [{ n: "Open-Meteo (modelo CAMS de Copernicus)", url: "https://open-meteo.com/en/docs/air-quality-api" }, { n: "Calidad del aire del Principado", url: "https://calidaddelaireweb.asturias.es/" }], fiabilidad: "Estimación de un modelo europeo, no una medida de estación. Contrástalo con la red del Principado." });
    ST.auto = [...ST.auto.filter((x) => x.tema !== "aire"), ...evs];
    sens("aire", { aqi: Math.round(aqi), pm25: c.pm2_5, pm10: c.pm10, racha: racha != null ? Math.round(racha) : null });
    setSource(id, nombre, "ok", `Índice europeo de calidad del aire: ${Math.round(aqi)}` + (racha != null ? ` · racha máxima prevista ${Math.round(racha)} km/h` : ""));
  } catch (e) { setSource(id, nombre, "err", String(e.message || e).slice(0, 80)); }
}

/* ---- Análisis cruzado (inspirado en World Monitor): convergencia y aceleración ---- */
const familia = (e) => e.origen === "analista" ? "analista" : e.origen === "mio" ? "tuyo"
  : /^(usgs|emsc|noaa|gdacs|aemet|ree|ioda|ucrania)/.test(e.tema || "") ? "sensor"
  : /^(of-|incibe|usstate|alemania|pd-pd-of|grp-of)/.test(e.tema || "") || e.nivel === "oficial" ? "oficial"
  : /^(gdelt|pd-|grp-|prensa)/.test(e.tema || "") || /^(nuclear|guerra|espana|asturias|ciberbanca|energia|evacuacion|salud)$/.test(e.tema || "") ? "prensa" : "otros";
function analizarCruce() {
  // 1) Convergencia: varias familias de fuentes independientes señalan el mismo lugar en 48 h.
  const base = [...(ST.ana?.eventos || []), ...ST.auto.filter((e) => e.tema !== "cruce"), ...buzonAsEvents()]
    .filter((e) => e.region && e.region !== "Sin ubicar" && (!e.fecha || Date.now() - new Date(e.fecha) < 48 * 36e5));
  const porLugar = new Map();
  for (const e of base) { const k = e.region; if (!porLugar.has(k)) porLugar.set(k, []); porLugar.get(k).push(e); }
  const cruces = [];
  for (const [lugar, list] of porLugar) {
    const fams = new Set(list.map(familia));
    const top = list.reduce((a, b) => (b.S > a.S ? b : a));
    if (fams.size >= 3 && top.S >= 5) {
      cruces.push({ id: "cruce-" + lugar.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), origen: "auto", tema: "cruce",
        titulo: `Convergencia en ${lugar}: ${fams.size} tipos de fuente señalan lo mismo`,
        resumen: `Coinciden ${[...fams].join(", ")} en las últimas 48 h. Lo más grave: «${top.titulo}». Cuando fuentes independientes coinciden, la situación suele ser real y estar moviéndose.`,
        dominio: top.dominio, region: lugar, lat: top.lat, lon: top.lon, zona: top.zona, S: Math.min(9, top.S), nivel: fams.has("oficial") || fams.has("sensor") ? "confirmado" : "varios_medios",
        tendencia: "escala", fecha: new Date().toISOString(), fuentes: list.slice(0, 8).flatMap((x) => (x.fuentes || []).slice(0, 1)),
        fiabilidad: "Señal calculada por la Brújula al cruzar fuentes; revisa los sucesos de origen." });
    }
  }
  ST.auto = [...ST.auto.filter((x) => x.tema !== "cruce"), ...cruces.slice(0, 5)];
  // 2) Aceleración: cuántos titulares hay de cada lugar frente a la media de escaneos anteriores.
  const vel = store.get("brujula.vel", {}); const ahora = {};
  for (const e of ST.auto) if (e.region && e.n) ahora[e.region] = (ahora[e.region] || 0) + e.n;
  for (const e of ST.auto) {
    const hist = vel[e.region] || []; const media = hist.length >= 3 ? hist.reduce((a, b) => a + b, 0) / hist.length : null;
    if (media != null && ahora[e.region] >= 6 && ahora[e.region] >= 3 * media) { e.tendencia = "escala"; e.acelera = Math.round(ahora[e.region] / Math.max(media, 1)); }
  }
  for (const [r, n] of Object.entries(ahora)) vel[r] = [...(vel[r] || []), n].slice(-10);
  store.set("brujula.vel", vel);
}


/* ===================== Panel de sensores (resumen gráfico) ===================== */
function stitle(t) { const e = s("title"); e.textContent = t; return e; }
let sensPend = 0;
function sens(id, data) { ST.sens = ST.sens || {}; ST.sens[id] = { ...data, t: Date.now() }; if (!sensPend) sensPend = setTimeout(() => { sensPend = 0; renderSensores(); }, 150); }
const SENS_METRICA = { aire: (d) => d.aqi, sol: (d) => d.m + 10 * d.x, usgs: (d) => d.n, emsc: (d) => d.n, noaa: (d) => d.g, ree: (d) => Math.round(d.ratio * 100), ioda: (d) => d.n, incibe: (d) => d.n, ucrania: (d) => d.n, aemet: (d) => d.n, gdacs: (d) => d.rel };
function guardarHistSensores() {
  const hist = store.get("brujula.senshist", {});
  for (const [k, f] of Object.entries(SENS_METRICA)) if (ST.sens?.[k]) hist[k] = [...(hist[k] || []), { t: Date.now(), v: f(ST.sens[k]) }].slice(-30);
  store.set("brujula.senshist", hist);
}
function sparkline(k) {
  const pts = (store.get("brujula.senshist", {})[k] || []).filter((p) => Number.isFinite(p.v));
  if (pts.length < 2) return h("span", { class: "small muted" }, "Historial: se irá llenando con cada escaneo");
  const W = 140, H = 28, vs = pts.map((p) => p.v), mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1;
  const xy = pts.map((p, i) => [i * (W - 4) / (pts.length - 1) + 2, H - 3 - (p.v - mn) / r * (H - 6)]);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Evolución en los últimos ${pts.length} escaneos: de ${vs[0]} a ${vs.at(-1)}` });
  svg.append(s("polyline", { points: xy.map((p) => p.join(",")).join(" "), fill: "none", stroke: css("--accent"), "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const [lx, ly] = xy.at(-1); svg.append(s("circle", { cx: lx, cy: ly, r: 3, fill: css("--accent") }));
  pts.forEach((p, i) => { const c = s("circle", { cx: xy[i][0], cy: xy[i][1], r: 6, fill: "transparent" }); c.append(stitle(`${new Date(p.t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: ${p.v}`)); svg.append(c); });
  return h("div", { class: "spark" }, svg, h("span", { class: "small muted" }, `últimos ${pts.length} escaneos`));
}
function tile(titulo, valor, unidad, estado, detalle, extra, k) {
  const ICON = { ok: "●", watch: "▲", alert: "■" }, TXT = { ok: "Normal", watch: "Atención", alert: "Alerta" };
  return h("div", { class: "stile st-" + estado },
    h("div", { class: "stile-h" }, h("span", null, titulo), h("span", { class: "stile-badge" }, h("span", { style: `color:var(${estado === "ok" ? "--ok" : estado === "watch" ? "--watch" : "--alert"})` }, ICON[estado]), " " + TXT[estado])),
    h("div", { class: "stile-v" }, h("b", null, String(valor)), unidad ? h("span", { class: "muted" }, " " + unidad) : null),
    detalle ? h("div", { class: "small muted" }, detalle) : null, extra || null, k ? sparkline(k) : null);
}
function lineaREE(d) {
  const W = 300, H = 110, L = 38, B = 18, all = [...d.real, ...d.prev].map((p) => p.v), mn = Math.min(...all) * 0.95, mx = Math.max(...all) * 1.02;
  const ts = [...d.real, ...d.prev].map((p) => +new Date(p.t)), t0 = Math.min(...ts), t1 = Math.max(...ts) || t0 + 1;
  const X = (t) => L + (+new Date(t) - t0) / (t1 - t0 || 1) * (W - L - 6), Y = (v) => H - B - (v - mn) / (mx - mn || 1) * (H - B - 8);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Demanda eléctrica real frente a prevista, últimas horas" });
  for (const v of [mn, (mn + mx) / 2, mx]) { svg.append(s("line", { x1: L, x2: W - 4, y1: Y(v), y2: Y(v), stroke: css("--line"), "stroke-width": 1 })); const tx = s("text", { x: L - 4, y: Y(v) + 3, "text-anchor": "end", class: "axis" }); tx.textContent = Math.round(v / 1000) + " GW"; svg.append(tx); }
  for (const t of [t0, t1]) { const tx = s("text", { x: X(t), y: H - 4, "text-anchor": t === t0 ? "start" : "end", class: "axis" }); tx.textContent = new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); svg.append(tx); }
  const path = (pts, col, dash) => svg.append(s("polyline", { points: pts.map((p) => `${X(p.t)},${Y(p.v)}`).join(" "), fill: "none", stroke: col, "stroke-width": 2, "stroke-dasharray": dash || "", "stroke-linejoin": "round", "stroke-linecap": "round" }));
  path(d.prev, css("--muted"), "5 4"); path(d.real, css("--accent"));
  d.real.forEach((p) => { const c = s("circle", { cx: X(p.t), cy: Y(p.v), r: 7, fill: "transparent" }); const pr = d.prev.find((q) => q.t === p.t); c.append(stitle(`${new Date(p.t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · real ${Math.round(p.v)} MW${pr ? ` · prevista ${Math.round(pr.v)} MW` : ""}`)); svg.append(c); });
  return h("div", null, svg, h("div", { class: "legend small" }, h("span", null, h("i", { style: `background:${css("--accent")}` }), "Real"), h("span", null, h("i", { class: "dash" }), "Prevista")));
}
function barrasSismos(mags) {
  const B = [["3–4", 3, 4], ["4–5", 4, 5], ["5–6", 5, 6], ["6+", 6, 99]].map(([l, a, b]) => [l, mags.filter((m) => m >= a && m < b).length]);
  const mx = Math.max(1, ...B.map((x) => x[1]));
  return h("div", { class: "hbars", role: "img", "aria-label": "Sismos por magnitud: " + B.map(([l, n]) => `${l}: ${n}`).join(", ") },
    ...B.map(([l, n]) => h("div", { class: "hbar", title: `Magnitud ${l}: ${n} sismos` }, h("span", { class: "small muted" }, "M" + l), h("div", { class: "hbar-t" }, h("i", { style: `width:${n / mx * 100}%` })), h("span", { class: "small mono" }, n))));
}
function renderSensores() {
  const box = $("sensores"); if (!box) return;
  const S = ST.sens || {}; const out = [];
  if (S.ree) { const r = Math.round(S.ree.ratio * 100); out.push(tile("Red eléctrica (apagón)", r + " %", "de la demanda prevista", r < 75 ? "alert" : r < 90 ? "watch" : "ok", r < 90 ? "La demanda real cae por debajo de lo previsto: posible corte." : "La demanda sigue lo previsto: no hay indicios de apagón.", S.ree.real?.length > 1 ? lineaREE(S.ree) : null, "ree")); }
  if (S.emsc) { const p = S.emsc.prox; out.push(tile("Sismos (EMSC, 48 h)", S.emsc.n, "M3 o más", S.emsc.cerca ? "watch" : "ok", p ? `El más cercano: M${p.M.toFixed(1)} a ${Math.round(p.dist)} km (${p.r || "?"}). ${S.emsc.cerca ? S.emsc.cerca + " cerca de Asturias." : "Ninguno cerca de Asturias."}` : "", barrasSismos(S.emsc.mags), "emsc")); }
  if (S.ioda) out.push(tile("Cortes de internet (24 h)", S.ioda.n, "país(es)", S.ioda.cerca ? "alert" : "ok", S.ioda.cerca ? "Incluye España o países vecinos." : "Ninguno en España ni vecinos.", S.ioda.paises?.length ? h("div", { class: "chips" }, ...S.ioda.paises.map((x) => h("span", { class: "chip" }, x))) : null, "ioda"));
  if (S.incibe) out.push(tile("Ciberseguridad (INCIBE, 48 h)", S.incibe.n, "avisos", S.incibe.crit ? "watch" : "ok", `${S.incibe.crit} crítico(s).`, S.incibe.ult?.length ? h("ul", { class: "mini" }, ...S.incibe.ult.map((x) => h("li", null, safeUrl(x.u) ? h("a", { href: safeUrl(x.u), target: "_blank", rel: "noopener" }, x.t) : x.t))) : null, "incibe"));
  if (S.ucrania) out.push(tile("Ucrania · alertas aéreas", S.ucrania.n, "zona(s) ahora", S.ucrania.n >= 15 ? "alert" : S.ucrania.n >= 8 ? "watch" : "ok", S.ucrania.n >= 15 ? "Alerta casi en todo el país: posible ataque masivo." : "Las alertas son habituales; solo cuentan si son masivas.", null, "ucrania"));
  if (S.sol) { const mx = Math.max(1, ...S.sol.dias.map((d) => d[1]));
    out.push(tile("Llamaradas solares (7 días)", `${S.sol.m} M · ${S.sol.x} X`, "", S.sol.pX >= 25 || S.sol.x ? "watch" : "ok",
      `Mayor: ${S.sol.top || "ninguna M"}. Probabilidad oficial para mañana: M ${S.sol.pM} % · X ${S.sol.pX} %. Una llamarada solo afecta a la radio; lo que cuenta para la red eléctrica es el nivel G.`,
      h("div", { class: "hbars", role: "img", "aria-label": "Llamaradas M o X por día: " + S.sol.dias.map(([d, n]) => `${d}: ${n}`).join(", ") },
        ...S.sol.dias.map(([d, n]) => h("div", { class: "hbar", title: `${d}: ${n} llamaradas M/X` }, h("span", { class: "small muted" }, d), h("div", { class: "hbar-t" }, h("i", { style: `width:${n / mx * 100}%` })), h("span", { class: "small mono" }, n)))), "sol")); }
  if (S.noaa) out.push(tile("Tormenta solar (NOAA)", "G" + S.noaa.g, "escala 0–5", S.noaa.g >= 4 ? "alert" : S.noaa.g >= 3 ? "watch" : "ok", S.noaa.g >= 4 ? "Puede afectar a redes eléctricas y GPS." : "Sin riesgo para la red eléctrica.", null, "noaa"));
  if (S.aemet) out.push(tile("Avisos AEMET", S.aemet.n, "avisos en España", S.aemet.rel ? "watch" : "ok", S.aemet.rel ? `${S.aemet.rel} naranja/rojo relevantes.` : "Ninguno naranja o rojo en Asturias ni rojo en España.", null, "aemet"));
  if (S.gdacs) out.push(tile("Desastres (GDACS)", S.gdacs.rel, "naranja/rojo", S.gdacs.rel ? "watch" : "ok", `${S.gdacs.n} sucesos vigilados en el mundo.`, null, "gdacs"));
  if (S.usgs) out.push(tile("Grandes sismos (USGS)", S.usgs.n, "M4,5+ revisados", S.usgs.max >= 7 ? "watch" : "ok", S.usgs.n ? `El mayor: M${(+S.usgs.max).toFixed(1)}.` : "Ninguno grande en el mundo.", null, "usgs"));
  if (S.aire) { const q = S.aire.aqi; out.push(tile("Aire en Asturias", q, "índice europeo", q >= 100 ? "alert" : q >= 60 ? "watch" : "ok",
    `${q < 20 ? "Bueno" : q < 40 ? "Aceptable" : q < 60 ? "Moderado" : q < 80 ? "Malo" : q < 100 ? "Muy malo" : "Extremadamente malo"} (0–20 bueno, más de 100 extremo). PM2,5 ${S.aire.pm25} · PM10 ${S.aire.pm10} µg/m³.` + (S.aire.racha != null ? ` Racha de viento máxima prevista: ${S.aire.racha} km/h.` : "") + " Es un modelo, no una estación.", null, "aire")); }
  if (S.usstate || S.alemania) out.push(tile("Avisos de viaje", (S.usstate?.n || 0) + (S.alemania?.n || 0), "cambios en 4 días", (S.usstate?.n || 0) ? "watch" : "ok", `EE. UU.: ${S.usstate?.n ?? "–"} subidos a nivel 3–4 · Alemania: ${S.alemania?.n ?? "–"} nuevos o cambiados.`, null, null));
  box.replaceChildren(...(out.length ? out : [h("p", { class: "empty" }, "Pulsa «Escanear ahora» para ver los sensores.")]));
}

async function scan(force) {
  if (ST.scanning) return;
  const cache = store.get("brujula.cache", null);
  if (!force && cache && Date.now() - cache.t < CACHE_MIN * 60000) {
    Object.assign(ST, { auto: cache.auto || [], rumors: cache.rumors || [], markets: cache.markets || [], scanAt: new Date(cache.t), sens: cache.sens || {} });
    renderSensores();
    for (const [k, v] of Object.entries(cache.sources || {})) ST.sources[k] = v;
    guardarVisita(allEvents());
    renderAllNow(); renderSources(); renderMarkets();
    return;
  }
  ST.scanning = true; $("rescan").disabled = true; renderStamp();
  ST.sources = {}; renderSources();
  const prev = store.get("brujula.prev", {});
  setProgress(0.02);
  await Promise.all([scanUSGS(), scanNOAA(), scanPolymarket(), scanWatched(), scanUcrania()]);
  recheckRumors();
  ST.prensa = {};
  await Promise.all([scanGdelt(prev), scanPrensaYOrganismos(), scanEMSC(), scanREE(), scanIODA(), scanINCIBE(), scanSol(), scanCopernicus(), scanOMS(), scanAire()]);
  analizarCruce();
  store.set("brujula.prev", prev);
  ST.scanAt = new Date(); ST.scanning = false; $("rescan").disabled = false; setProgress(1);
  setTimeout(() => setProgress(0), 800);
  store.set("brujula.cache", { t: Date.now(), auto: ST.auto, rumors: ST.rumors, markets: ST.markets, sources: ST.sources, sens: ST.sens });
  guardarHistSensores();
  addLog();
  guardarVisita(allEvents());
  renderAllNow();
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
  if (navigator.onLine === false) parts.push("SIN CONEXIÓN: ves lo último guardado");
  parts.push(ST.scanning ? "Escaneando internet…" : ST.scanAt ? "Escaneo: " + ST.scanAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "Sin escanear");
  st.textContent = parts.join(" · ");
}

// Durante un escaneo llegan decenas de resultados seguidos: se repinta como mucho una vez cada 120 ms (el móvil lo agradece)
let pintarPend = 0;
function renderAll() { if (pintarPend) return; pintarPend = setTimeout(() => { pintarPend = 0; renderAllNow(); }, 120); }
function renderAllNow() {
  const evs = allEvents();
  renderStamp(); renderSemaforo(evs); renderCambios(evs); avisarApp(evs);
  document.querySelectorAll(".gauge-box").forEach((box) => {
    const scope = box.dataset.scope, v = indice(evs, scope), [lvl, col] = nivelDe(v);
    drawGauge(box.querySelector(".gauge"), v);
    const L = box.querySelector(".level"); L.textContent = lvl; L.style.color = css(col);
    const key = scope === "asturias" ? "a" : scope === "espana" ? "e" : "g";
    drawSpark(box.querySelector(".spark"), store.get("brujula.log", []).slice(0, 30).reverse().map((x) => +x[key] || 0));
  });
  renderAlerts(evs); renderAnalysis(evs); renderMap(evs); renderRumors(); renderFilters(); renderEvents(); renderChains(); renderScen(); renderLog(); renderChecks();
}

function renderAlerts(evs) {
  const box = $("alerts"); box.replaceChildren();
  const ast = indice(evs, "asturias"), esp = indice(evs, "espana");
  const crit = evs.filter((e) => e.S >= 8 && !e.desmentido && (NIV[e.nivel]?.[0] ?? 0) >= 0.65 && pScope(e, "espana") >= 0.7);
  for (const e of crit) box.append(h("div", { class: "alert crit" }, h("b", null, "⚠ " + e.titulo), h("span", null, e.resumen)));
  // El semáforo ya cuenta el nivel de Asturias; aquí solo se avisa si España está peor que Asturias
  if (esp >= 6 && nivelDe(esp)[0] !== nivelDe(ast)[0]) box.append(h("div", { class: "alert high" }, h("b", null, `España está en nivel de ${nivelDe(esp)[0].toLowerCase()} (${num(esp)})`), h("span", null, QUE_HACER[nivelDe(esp)[0]])));
  for (const c of ST.auto.filter((x) => x.tema === "cruce" && (x.zona === "espana" || x.zona === "asturias" || x.S >= 7))) box.append(h("div", { class: "alert mid" }, h("b", null, "◎ " + c.titulo), h("span", null, c.resumen)));
  // Algo grave aquí que solo cuenta una fuente: se enseña arriba, pero dejando claro que no está confirmado
  const cerca = [...ST.rumors, ...buzonAsRumors()].filter((x) => !x.desmentido && ((x.S >= 6 && (x.zona === "asturias" || x.zona === "espana")) || x.S >= 8));
  for (const r of cerca.slice(0, 3)) box.append(h("div", { class: "alert mid" }, h("b", null, "Sin confirmar: " + r.titulo), h("span", null, "Solo lo cuenta una fuente, o es un dato atribuido a una parte. No cuenta para el índice y no conviene actuar ni reenviarlo hasta que lo confirme una fuente oficial u otro medio.")));
  for (const e of [...evs, ...ST.rumors].filter((x) => x.desmentido || x.correccion).slice(0, 3)) box.append(h("div", { class: "alert info" }, h("b", null, (e.desmentido ? "Desmentido: " : "Corrección: ") + e.titulo), h("span", null, e.correccion || e.fiabilidad)));
}

/* Semáforo del día: de un vistazo, cómo está hoy y qué conviene hacer. Siempre remite a las fuentes oficiales. */
function renderSemaforo(evs) {
  const box = $("semaforo"); if (!box) return;
  const a = indice(evs, "asturias"), e = indice(evs, "espana"), g = indice(evs, "global");
  const [lvl, col] = nivelDe(a), [lvlE] = nivelDe(e);
  const top = [...evs].filter((x) => !x.desmentido).sort((x, y) => contrib(y) - contrib(x))[0];
  box.style.setProperty("--sev", `var(${col})`);
  box.replaceChildren(
    h("div", { class: "sem-luz", role: "img", "aria-label": `Semáforo: ${lvl}` }, ...["--crit", "--tense", "--ok"].map((c, i) => h("i", { class: (i === 0 && a >= 6) || (i === 1 && a >= 2 && a < 6) || (i === 2 && a < 2) ? "on" : null, style: `--c:var(${i === 0 && a >= 8 ? "--crit" : i === 0 ? "--alert" : i === 1 && a < 4 ? "--watch" : c})` }))),
    h("div", { class: "sem-txt" },
      h("p", { class: "sem-niv" }, "Hoy en Asturias: ", h("b", { style: `color:var(${col})` }, lvl), h("span", { class: "mono" }, " · " + num(a))),
      h("p", null, QUE_HACER[lvl]),
      lvlE !== lvl || Math.abs(e - a) >= 1 ? h("p", { class: "small muted" }, `España: ${lvlE.toLowerCase()} (${num(e)}) · Escalada global: ${nivelDe(g)[0].toLowerCase()} (${num(g)}).`) : h("p", { class: "small muted" }, `España ${num(e)} · Escalada global ${num(g)}.`),
      top && a >= 2 ? h("p", { class: "small muted" }, "Lo que más pesa: " + top.titulo.slice(0, 140)) : null,
      h("p", { class: "small muted" }, "Ante una emergencia manda lo oficial: ES-Alert en el móvil y el ", h("a", { href: "tel:112" }, "112"), ".")));
}

/* Qué ha cambiado desde tu última visita. La referencia es la última vez que abriste la Brújula hace más de 30 min. */
function refVisita() {
  const v = store.get("brujula.visita", null); if (!v) return null;
  return v.base || null;
}
function guardarVisita(evs) {
  const v = store.get("brujula.visita", {}) || {};
  const foto = { t: Date.now(), a: indice(evs, "asturias"), e: indice(evs, "espana"), g: indice(evs, "global"),
    evs: Object.fromEntries(evs.slice(0, 150).map((x) => [x.id, [x.titulo.slice(0, 90), NIV[x.nivel]?.[2] || 0, +x.S || 0]])), rum: ST.rumors.map((x) => x.id).slice(0, 40) };
  // La referencia solo avanza si la foto anterior tiene más de 30 min: recargar la página no borra «lo nuevo»
  if (v.ultima && (!v.base || Date.now() - v.ultima.t > 30 * 60000) && ST.visitaLista !== true) v.base = v.ultima;
  ST.visitaLista = true; v.ultima = foto; store.set("brujula.visita", v);
}
function renderCambios(evs) {
  const box = $("cambios"), panel = $("cambios-panel"); if (!box) return;
  const ref = ST.refVisita; if (!ref || !ST.scanAt) { panel.hidden = true; return; }
  const hrs = (Date.now() - ref.t) / 36e5; if (hrs < 0.5) { panel.hidden = true; return; }
  const out = [];
  const flecha = (n, o) => (Math.abs(n - o) < 0.3 ? "=" : n > o ? "▲" : "▼");
  const I = [["Asturias", indice(evs, "asturias"), ref.a], ["España", indice(evs, "espana"), ref.e], ["Global", indice(evs, "global"), ref.g]];
  out.push(h("p", { class: "cmb-idx" }, ...I.map(([n, v, o]) => h("span", { class: "chip " + (v - o >= 0.3 ? "sube" : o - v >= 0.3 ? "baja" : "") }, `${n} ${num(o)} → ${num(v)} ${flecha(v, o)}`))));
  const nuevos = evs.filter((x) => !ref.evs[x.id] && contrib(x) >= 1 && !x.desmentido).sort((x, y) => contrib(y) - contrib(x)).slice(0, 5);
  const suben = evs.filter((x) => ref.evs[x.id] && ((NIV[x.nivel]?.[2] || 0) > ref.evs[x.id][1] || (+x.S || 0) > ref.evs[x.id][2])).slice(0, 4);
  const idsHoy = new Set(evs.map((x) => x.id));
  const fuera = Object.entries(ref.evs).filter(([id, v]) => !idsHoy.has(id) && v[2] >= 5).slice(0, 4);
  const rumN = ST.rumors.filter((x) => !(ref.rum || []).includes(x.id)).length;
  const ir = (e) => { const b = h("button", { type: "button", class: "enlace" }, e.titulo.slice(0, 110)); b.addEventListener("click", () => { ST.filter = "todos"; ST.open.add(e.id); renderFilters(); renderEvents(); document.getElementById("ev-" + e.id)?.scrollIntoView({ behavior: "smooth", block: "center" }); }); return b; };
  if (nuevos.length) out.push(h("div", null, h("b", null, "Nuevo"), h("ul", null, ...nuevos.map((e) => h("li", null, ir(e))))));
  if (suben.length) out.push(h("div", null, h("b", null, "Va a más o se confirma"), h("ul", null, ...suben.map((e) => h("li", null, ir(e))))));
  if (fuera.length) out.push(h("div", null, h("b", null, "Ya no aparece"), h("ul", null, ...fuera.map(([, v]) => h("li", { class: "muted" }, v[0])))));
  if (rumN) out.push(h("p", { class: "small muted" }, `${rumN} rumor(es) nuevo(s) sin contrastar, más abajo.`));
  const nas = (ST.nas?.alertas || []).filter((a) => a.t > ref.t && !a.previo);
  if (nas.length) out.push(h("div", null, h("b", null, `El vigilante del NAS avisó ${nas.length} vez/veces`), h("ul", null, ...nas.slice(0, 4).map((a) => h("li", null, `${(NIV_NAS[a.nivel] || NIV_NAS[1])[0]} · ${a.titulo}`)))));
  if (out.length === 1 && !I.some(([, v, o]) => Math.abs(v - o) >= 0.3)) out.push(h("p", { class: "muted" }, "Nada relevante ha cambiado."));
  $("cambios-cuando").textContent = hrs < 48 ? `hace ${Math.round(hrs)} h` : `hace ${Math.round(hrs / 24)} días`;
  panel.hidden = false; box.replaceChildren(...out);
}
/* Si la web va dentro de la app Android, le pasa los índices (para el widget de la pantalla de inicio). */
let ultimoApp = "";
function avisarApp(evs) {
  if (!window.BrujulaApp?.indices || !ST.scanAt) return;
  const a = indice(evs, "asturias"), d = JSON.stringify({ asturias: a, espana: indice(evs, "espana"), global: indice(evs, "global"), nivel: nivelDe(a)[0], t: +ST.scanAt });
  if (d !== ultimoApp) { ultimoApp = d; try { window.BrujulaApp.indices(d); } catch {} }
}

function renderAnalysis(evs) {
  const ana = ST.ana?.estado;
  const ast = indice(evs, "asturias"), esp = indice(evs, "espana"), glo = indice(evs, "global");
  // Resumen automático: se rehace en cada escaneo con lo que acaban de traer las fuentes.
  const fresh = [...ST.auto].filter((e) => !e.fecha || Date.now() - new Date(e.fecha) < 36 * 36e5)
    .sort((a, b) => contrib(b) - contrib(a)).slice(0, 3);
  const cerca = ST.auto.filter((e) => (e.zona === "asturias" || e.zona === "espana") && e.S >= 5);
  const partes = [`Ahora: Asturias ${num(ast)} (${nivelDe(ast)[0].toLowerCase()}), España ${num(esp)} (${nivelDe(esp)[0].toLowerCase()}), escalada global ${num(glo)} (${nivelDe(glo)[0].toLowerCase()}).`];
  if (ST.scanAt) {
    partes.push(cerca.length ? `En España o Asturias hay ${cerca.length} aviso(s) relevante(s): ${cerca.slice(0, 2).map((e) => e.titulo).join(" · ")}.` : "Ninguna fuente avisa de nada grave en España o Asturias.");
    if (fresh.length) partes.push("Lo que más pesa hoy: " + fresh.map((e) => e.titulo.replace(/\s+/g, " ").slice(0, 120)).join(" · ") + ".");
    partes.push(`${ST.auto.length} suceso(s) automáticos y ${ST.rumors.length} rumor(es) sin contrastar.`);
  }
  let txt = partes.join(" ");
  if (ana?.resumen) {
    const hrs = ana.actualizado ? Math.round((Date.now() - new Date(ana.actualizado)) / 36e5) : null;
    txt += `\n\nContexto del analista${hrs != null ? ` (de hace ${hrs < 48 ? hrs + " h" : Math.round(hrs / 24) + " días"}; di «actualiza la brújula» para renovarlo)` : ""}: ` + ana.resumen;
  }
  $("takeaway").textContent = txt;
  $("takeaway").style.whiteSpace = "pre-line";
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
  const items = [...evs.map((e) => [e, false]), ...ST.rumors.map((e) => [e, true]), ...buzonAsRumors().map((e) => [e, true])]
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
      h("span", { class: "chip " + (e.origen === "auto" ? "auto" : e.origen === "mio" ? "mine" : "ana") }, e.origen === "auto" ? "Automático" : e.origen === "mio" ? "Aportado por ti" : "Analista"),
      h("span", { class: "chip" }, DOMNAME[e.dominio] || e.dominio),
      e.region ? h("span", { class: "chip" }, e.region) : null,
      h("span", { class: "chip" }, `Gravedad ${num(e.S, e.S % 1 ? 1 : 0)}`),
      h("span", { class: "chip" }, (TEND[e.tendencia]?.[1] || e.tendencia) + (e.acelera ? ` · noticias ×${e.acelera}` : "")),
      e.fecha ? h("span", { class: "chip mono" }, fecha(e.fecha)) : null,
      e.desmentido ? h("span", { class: "chip desm" }, "✖ Desmentido") : e.correccion ? h("span", { class: "chip desm" }, "Con corrección") : null),
    h("div", { class: "ladder" }, steps, h("span", null, `Confirmación: ${nv[1]}`)),
    h("span", { class: "more" }, open ? "Ocultar detalles ▲" : "Ver detalles ▼"));
  const srcs = (e.fuentes || []).map((f) => { const u = safeUrl(f.url); return u ? h("a", { href: u, target: "_blank", rel: "noopener" }, f.n) : h("span", null, f.n); });
  const body = h("div", { class: "ev-body", hidden: open ? null : "" },
    h("p", null, e.resumen),
    e.fiabilidad ? h("p", { class: "rel" }, e.fiabilidad) : null,
    e.correccion ? h("p", { class: "small warn-text" }, "Corrección: " + e.correccion) : null,
    isRumor ? h("p", { class: "small warn-text" }, e.desmentido ? "Desmentido. Se queda aquí como referencia; no cuenta para el índice." : "Sin contrastar: no cuenta para el índice. Pasará a «Sucesos» cuando lo confirme otro medio o una fuente oficial.") : null,
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
  const list = [...buzonAsRumors(), ...[...ST.rumors].sort((a, b) => b.S - a.S)].slice(0, 14);
  if (!list.length) box.append(h("p", { class: "empty" }, ST.scanAt ? "No hay nada alarmante sin confirmar en las últimas 24 h." : "Se mostrarán tras el escaneo."));
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
window.BRUJULA_ESTADO = () => ({ indices: Object.fromEntries(SCOPES.map(([k]) => [k, indice(allEvents(), k)])), auto: ST.auto.length, rumores: ST.rumors.length, escaneo: ST.scanAt });
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
  const base = ["usgs", "emsc", "noaa", "sol", "ree", "ioda", "incibe", "aire", "copernicus", "oms", "poly", "ucrania", "of-aemet", "of-gdacs", "of-usstate", "of-alemania", ...PRENSA.map((g) => "pd-" + g.id), ...GRUPOS.filter((g) => g.tipo !== "medio").map((g) => "grp-" + g.id), "vigiladas", ...THEMES.map((t) => "gdelt-" + t.id)];
  const order = [...base, ...Object.keys(ST.sources).filter((k) => !base.includes(k))];
  for (const k of order) {
    const v = ST.sources[k]; if (!v) continue;
    box.append(h("div", { class: "st " + v.state }, h("i"), h("span", null, v.name), h("span", { class: "small muted" }, v.state === "err" ? "Error: " + v.msg : v.msg)));
  }
  if (!box.children.length) box.append(h("p", { class: "empty" }, "Todavía no se ha consultado ninguna fuente."));
  box.append(h("p", { class: "small muted" }, "Versión de la web: " + VERSION));
  const cat = $("sources");
  if (!cat.children.length && ST.ana?.fuentes) for (const g of ST.ana.fuentes.grupos || []) cat.append(h("div", { class: "src-group" }, h("h3", null, g.nombre),
    h("div", { class: "src-list" }, ...g.items.map((it) => { const u = safeUrl(it.url); return h("div", { class: "src" }, u ? h("a", { href: u, target: "_blank", rel: "noopener" }, h("b", null, it.n)) : h("b", null, it.n), h("span", { class: "small" }, it.uso), h("span", { class: "small muted" }, it.acceso)); }))));
}

/* ===================== Verificación de publicaciones ===================== */
const VERD = { confirmado: "Confirmado", parcial: "Parcialmente cierto", sin_confirmar: "Sin confirmar", descontextualizado: "Antiguo o sacado de contexto", falso: "Falso" };
function renderChecks() {
  const box = $("checks"); box.replaceChildren();
  const list = ST.ana?.verificaciones || [];
  if (!list.length) { box.append(h("p", { class: "empty" }, "Todavía no hay publicaciones revisadas.")); return; }
  for (const c of list) box.append(h("div", { class: "ck " + c.veredicto },
    h("span", { class: "vd " + c.veredicto }, VERD[c.veredicto] || c.veredicto),
    h("span", { class: "who" }, c.cuenta), h("b", null, c.dice), h("span", null, c.explica),
    (c.fuentes || []).length ? h("div", { class: "srcs" }, ...c.fuentes.map((f) => { const u = safeUrl(f.url); return u ? h("a", { href: u, target: "_blank", rel: "noopener" }, f.n) : h("span", null, f.n); })) : null));
}

/* ===================== Buzón: publicaciones aportadas ===================== */
/* Al compartir un post: se lee, se valora la cuenta, se busca confirmación en Google Noticias y GDELT,
   se le da un nivel y una puntuación, y la cuenta (y su web) pasan a vigilarse en cada escaneo. */
// Desmentidos y datos atribuidos: mismas reglas que el vigilante del NAS (nas/lib/clasifica.js)
const DESMIENTE = /desmient|desmentid|\bniega\b|\bniegan\b|no es cierto|es falso|son falsos|falsa alarma|\bbulo\b|rectifica|no ha (muerto|fallecido)|no hay (ning[uú]n )?(muertos|v[ií]ctimas|heridos)|sigue con vida|fake news|\bhoax\b|\bdenies\b|\bdenied\b|debunk|false alarm|not true|no se ha producido|descarta (que|el|la)|descartan (que|el|la)/i;
const ATRIBUIDO = /seg[uú]n (un|el|los|fuentes|medios|testigos|vecinos|redes)|\bsindicato|fuentes (policiales|sindicales|cercanas|no oficiales|sin confirmar)|da por (muerto|fallecid|hecho)|dan por (muerto|fallecid|hecho)|habr[ií]a(n)? (muerto|fallecido|sido)|podr[ií]a(n)? haber|sin confirmar|no confirmad|al parecer|presunt|supuest|reportedly|unconfirmed|allegedly|rumou?rs?\b/i;
const RUIDO = /\b(liga|champions|gol(es)?|partido de (f[uú]tbol|baloncesto)|fichaje|entrenador|pel[ií]cula|estreno|festival|concierto|videojuego|novela|documental|aniversario|hace \d+ a[ñn]os|opini[oó]n|editorial|hor[oó]scopo|receta|bomba de (calor|agua|humo)|bombazo|bomba informativa|ataque (de risa|al coraz[oó]n|de ansiedad|card[ií]aco)|guerra (comercial|de precios|de audiencias|arancelaria))\b/gi;
const DOMKW = [
  ["nuclear", 8, /nuclear|yodo|iodine|radiac|radiation|atómic|atomic/i],
  ["seguridad", 6, /atentado|terroris|tiroteo|tirotead|disparos|shooting|gunman|pistolero|artefacto explosivo|mochila bomba|coche bomba|car bomb|paquete bomba|\bbomba\b|explosivos?\b|rehenes|hostage|(polic[ií]as?|agentes?|guardias? civil(es)?) (muert|herid|fallec|tirotead|abatid)\w*|da(n)? por muert\w+|yihadis|jihadi|amenaza de bomba|bomb threat/i],
  ["banca", 5, /\bbanc|\bbank|corralito|efectivo|cash|cajero|atm\b|pánico bancario|bank run|depósit/i],
  ["ciber", 5, /hack|ciber|cyber|ransomware|ddos|malware|infraestructura crítica|critical infrastructure/i],
  ["belico", 6, /misil|missile|ataque|attack|strike|bombard|guerra|\bwar\b|invasi|tropas|troops|ejército|army|dron|drone|otan|nato|militar|military|evacua/i],
  ["energia", 4, /petróleo|\boil\b|\bgas\b|apagón|blackout|combustible|fuel|electricidad|power outage|gasolina|diésel/i],
  ["social", 3, /huelga|general strike|protesta|protest|disturbios|riots|manifestaci/i],
  ["sanitario", 4, /virus|brote|outbreak|pandemi|epidemi|contagio/i],
  ["natural", 4, /terremoto|sismo|earthquake|tsunami|inundaci|flood|incendio|wildfire|temporal|huracán|hurricane|riada|\bdana\b|erupci[oó]n|explosi[oó]n|explosion|fuga de gas|nube t[oó]xica|derrumbe/i]
];
// Agravantes de un suceso de seguridad o natural (en la web solo suben, nunca bajan)
const SUBE_LOCAL = [
  [/(polic[ií]a|agente|guardia civil|militar)e?s? (muert|fallec|asesinad|abatid)|(muere|mata|matan|asesina) (a )?(un|una|dos|tres|varios) (polic|agente|guardia)|mochila bomba|coche bomba|artefacto explosivo|atentado (terrorista|yihadista)|terrorist attack|autor (sigue )?(huido|a la fuga)|sospechoso (huido|armado)/i, 7],
  [/decenas de muertos|masacre|massacre|mass shooting|atentado m[uú]ltiple|ataque coordinado/i, 8],
  [/evacuaci[oó]n|evacuate|desaloj|confina/i, 5], [/muertos?\b|fallecid|dead\b|killed|\bmuere/i, 5]
];
const HYPE = [
  [/breaking|just in|última hora|ultima hora|urgente|🚨|⚠️|this is not a drill|no es un ejercicio/i, "Lenguaje de alarma"],
  [/tercera guerra mundial|world war (3|iii|three)|wwiii|fin del mundo/i, "Titular apocalíptico"],
  [/reportedly|según fuentes|se informa|rumou?r|unconfirmed|sin confirmar|allegedly|supuestamente/i, "La propia publicación no lo confirma"],
  [/youtu\.?be/i, "Enlaza a un vídeo, no a una fuente"]
];
/* Directorio de cuentas conocidas. tipo: oficial · medio · agregador · video. peso: 0–1 */
const DIRECTORIO = {
  centcom: { nombre: "Mando Central de EE. UU. (CENTCOM)", tipo: "oficial", peso: 0.9, web: "centcom.mil" },
  nato: { nombre: "OTAN", tipo: "oficial", peso: 0.9, web: "nato.int" },
  iaeaorg: { nombre: "OIEA", tipo: "oficial", peso: 0.95, web: "iaea.org" },
  who: { nombre: "OMS", tipo: "oficial", peso: 0.9, web: "who.int" },
  eu_commission: { nombre: "Comisión Europea", tipo: "oficial", peso: 0.9, web: "ec.europa.eu" },
  defensagob: { nombre: "Ministerio de Defensa de España", tipo: "oficial", peso: 0.9, web: "defensa.gob.es" },
  dsngob: { nombre: "Departamento de Seguridad Nacional", tipo: "oficial", peso: 0.9, web: "dsn.gob.es" },
  interiorgob: { nombre: "Ministerio del Interior", tipo: "oficial", peso: 0.9, web: "interior.gob.es" },
  aemet_esp: { nombre: "AEMET", tipo: "oficial", peso: 0.95, web: "aemet.es" },
  ignspain: { nombre: "Instituto Geográfico Nacional", tipo: "oficial", peso: 0.95, web: "ign.es" },
  incibe: { nombre: "INCIBE", tipo: "oficial", peso: 0.9, web: "incibe.es" },
  idf: { nombre: "Ejército de Israel", tipo: "oficial", peso: 0.7, web: "idf.il" },
  whitehouse: { nombre: "Casa Blanca", tipo: "oficial", peso: 0.75, web: "whitehouse.gov" },
  reuters: { nombre: "Reuters", tipo: "medio", peso: 0.85, web: "reuters.com" },
  ap: { nombre: "Associated Press", tipo: "medio", peso: 0.85, web: "apnews.com" },
  afp: { nombre: "AFP", tipo: "medio", peso: 0.85, web: "afp.com" },
  bbcbreaking: { nombre: "BBC", tipo: "medio", peso: 0.8, web: "bbc.com" },
  efenoticias: { nombre: "Agencia EFE", tipo: "medio", peso: 0.8, web: "efe.com" },
  europapress: { nombre: "Europa Press", tipo: "medio", peso: 0.75, web: "europapress.es" },
  rtve: { nombre: "RTVE", tipo: "medio", peso: 0.75, web: "rtve.es" },
  elcomercio_es: { nombre: "El Comercio (Asturias)", tipo: "medio", peso: 0.7, web: "elcomercio.es" },
  uk_rept: { nombre: "UK Report", tipo: "agregador", peso: 0.3, nota: "Agregador de última hora sin fuente propia." },
  coffereport: { nombre: "Coffe Report", tipo: "agregador", peso: 0.3, nota: "Agregador; el 7 nov no se pudo localizar la fuente que citaba." },
  areamilitarof: { nombre: "Área Militar", tipo: "video", peso: 0.2, nota: "Canal de vídeo con titulares sensacionalistas." },
  negocios_tv: { nombre: "Negocios TV", tipo: "video", peso: 0.25, nota: "El 7 nov difundió un «pánico bancario» que ningún medio recogía." },
  nasaspacealerts: { nombre: "NASA Space Alerts", tipo: "oficial", peso: 0.9, web: "science.nasa.gov", nota: "Cuenta oficial de la NASA: sol, asteroides y meteoros." },
  coinbureau: { nombre: "Coin Bureau", tipo: "medio", peso: 0.55, telegram: "CoinBureau", nota: "Medio de criptomonedas y finanzas; útil para crisis de mercados, no para hechos geopolíticos." },
  israelforces_: { nombre: "Israel Force", tipo: "agregador", peso: 0.2, nota: "NO es el ejército israelí (la cuenta oficial es @IDF). Agregador alarmista." },
  grok: { nombre: "Grok (IA de X)", tipo: "ia", peso: 0.15, nota: "Respuesta de una IA: puede equivocarse. Nunca cuenta como confirmación." }
};
const TIPO_TXT = { ia: "Inteligencia artificial", oficial: "Cuenta oficial", medio: "Medio de comunicación", agregador: "Agregador de noticias", video: "Canal de vídeo", desconocida: "Cuenta desconocida" };
const STOP = new Set("about after again against because before being could their there these those which while would should según sobre entre desde hasta donde cuando porque había tiene están puede pueden también ahora todos todas hacia contra durante mientras nuevo nueva nuevos nuevas según other people breaking reportedly según noticia última anuncia announces report reports".split(" "));

function tokens(s) { return new Set((s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{5,}/g) || []); }
function keyTerms(text) {
  const clean = (text || "").replace(/https?:\/\/\S+/g, " ").replace(/[#@]\w+/g, " ");
  const caps = (clean.match(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ-]{3,}/g) || []).filter((w) => !STOP.has(w.toLowerCase()));
  const words = (clean.match(/[\wáéíóúñÁÉÍÓÚÑ]{6,}/g) || []).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w));
  const freq = new Map();
  for (const w of caps) freq.set(w, (freq.get(w) || 0) + 3);
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).filter((w, i, a) => a.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i).slice(0, 5);
}
function classifyPost(text) {
  let dominio = "social", S = 2;
  text = String(text || "");
  const limpio = text.replace(RUIDO, " ");
  for (const [d, base, re] of DOMKW) if (re.test(limpio)) { dominio = d; S = base; break; }
  for (const [re, v] of BOOST) if (re.test(limpio)) S = v >= 6 ? Math.max(S, v) : Math.min(10, S + v);
  if (S > 2) for (const [re, v] of SUBE_LOCAL) if (re.test(limpio)) S = Math.max(S, v);
  if (/simulacro|ejercicio de (emergencia|evacuaci[oó]n)|\bdrill\b/i.test(text)) S = Math.min(S, 2);
  if (/(detenid|arrestad|desarticulad)\w* .*(planeaba|preparaba|pretend[ií]a)|missile test|prueba de misil/i.test(text)) S = Math.min(S, 4);
  const desmiente = DESMIENTE.test(text), atribuido = ATRIBUIDO.test(text) && !desmiente;
  const pl = placeOf(text, "");
  const flags = HYPE.filter(([re]) => re.test(text)).map(([, t]) => t);
  const tk = tokens(text); let best = null, bestScore = 0;
  for (const e of allEvents()) {
    if (e.origen === "mio") continue;
    let sc = 0;
    if (pl.name && e.region && (e.region.includes(pl.name) || pl.name === e.region)) sc += 2;
    if (e.dominio === dominio) sc += 1;
    const et = tokens((e.titulo || "") + " " + (e.resumen || ""));
    for (const t of tk) if (et.has(t)) sc += 0.5;
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  return { dominio, S, pl, flags, desmiente, atribuido, match: bestScore >= 3.5 ? best : null };
}

/* --- red: todo pasa por el intermediario de Cloudflare si está configurado --- */
const PROXY_DEFAULT = "https://brujula.nugguiesoft.workers.dev";   // se rellenará con la dirección del Worker
function proxyUrl() { return store.get("brujula.proxy", "") || PROXY_DEFAULT; }
/* Webs que dejan leerse directamente desde el navegador (cabecera CORS abierta, comprobado el 12 nov 2026).
   Para ellas no hace falta el intermediario: si este cae, siguen funcionando. Si la lectura directa falla, se prueba por el intermediario. */
const DIRECTAS = /^(earthquake\.usgs\.gov|www\.seismicportal\.eu|services\.swpc\.noaa\.gov|apidatos\.ree\.es|api\.ioda\.inetintel\.cc\.gatech\.edu|gamma-api\.polymarket\.com|www\.gov\.uk|feeds\.elpais\.com|www\.eldebate\.com|rss\.dw\.com|www\.lne\.es|www\.ign\.es|api\.fxtwitter\.com|www\.who\.int|air-quality-api\.open-meteo\.com|api\.open-meteo\.com|api\.github\.com)$/;
async function pget(url, asJson = true, timeout = 20000) {
  let host = ""; try { host = new URL(url).hostname; } catch {}
  if (DIRECTAS.test(host)) { try { return await pgetVia(url, url, asJson, timeout); } catch (e) { /* cae al intermediario */ } }
  const p = proxyUrl();
  return pgetVia(url, p ? p.replace(/\/$/, "") + "/?u=" + encodeURIComponent(url) : url, asJson, timeout);
}
async function pgetVia(url, target, asJson, timeout) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(target, { signal: ctl.signal });
    const txt = await r.text();
    if (!r.ok) { const why = /no permitid|no válida/i.test(txt) ? ": " + txt.slice(0, 40) : ""; throw new Error("HTTP " + r.status + why); }
    if (!asJson) return txt;
    try { return JSON.parse(txt); } catch { throw new Error(txt.slice(0, 80) || "Respuesta no válida"); }
  } finally { clearTimeout(t); }
}
// Google Noticias corta (503/429) si recibe muchas consultas seguidas: se hacen de una en una, con pausa.
let GN_COLA = Promise.resolve();
function gnTurno(fn) { const p = GN_COLA.then(fn, fn); GN_COLA = p.then(() => sleep(1500), () => sleep(1500)); return p; }
async function googleNews(q, lang = "es") {
  const ed = lang === "es" ? "hl=es&gl=ES&ceid=ES:es" : "hl=en-US&gl=US&ceid=US:en";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${ed}`;
  const xml = await gnTurno(async () => {
    try { return await pget(url, false, 20000); }
    catch (e) { if (!/50[23]|429/.test(String(e.message))) throw e; await sleep(6000); return pget(url, false, 20000); }
  });
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return [...doc.querySelectorAll("item")].slice(0, 30).map((it) => {
    const src = it.querySelector("source");
    return { title: it.querySelector("title")?.textContent || "", url: it.querySelector("link")?.textContent || "",
      date: it.querySelector("pubDate")?.textContent || "", source: src?.textContent || "", sourceUrl: src?.getAttribute("url") || "" };
  });
}

/* --- leer X (FxTwitter) --- */
function xId(s) { const m = /(?:x|twitter|fxtwitter|vxtwitter|fixupx)\.com\/([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)/i.exec(s || ""); return m ? { user: m[1], id: m[2] } : null; }
async function readX(ref) {
  const d = await pget(`https://api.fxtwitter.com/2/status/${ref.id}?lang=es`, true, 15000);
  const st = d.status || d.tweet || {};
  const a = st.author || {};
  return {
    text: st.translation?.text || st.text || "", original: st.text || "",
    handle: (a.screen_name || ref.user || "").toLowerCase(), author: a.name || ref.user,
    followers: a.followers ?? null, joined: a.joined || a.created_at || null, website: a.website?.url || a.website || null,
    date: st.created_timestamp ? new Date(st.created_timestamp * 1000).toISOString() : (st.created_at || null)
  };
}

/* --- credibilidad de la cuenta --- */
function accountCredibility(x) {
  const k = (x.handle || "").toLowerCase(), dir = DIRECTORIO[k];
  if (dir) return { ...dir, handle: k, motivo: dir.nota || TIPO_TXT[dir.tipo] };
  let peso = 0.35; const motivos = [];
  if (x.followers != null) {
    if (x.followers > 500000) { peso += 0.1; motivos.push("Muchos seguidores (no garantiza fiabilidad)"); }
    if (x.followers < 2000) { peso -= 0.1; motivos.push("Pocos seguidores"); }
  }
  if (x.joined) { const age = (Date.now() - new Date(x.joined)) / 864e5; if (age < 180) { peso -= 0.15; motivos.push("Cuenta creada hace menos de 6 meses"); } }
  const site = x.website ? (safeUrl(x.website) ? new URL(x.website).hostname.replace(/^www\./, "") : null) : null;
  if (site && OFFICIAL.test(site)) { peso = 0.85; motivos.push("Enlaza a una web oficial"); return { nombre: x.author, tipo: "oficial", peso, web: site, handle: k, motivo: motivos.join(" · ") }; }
  return { nombre: x.author, tipo: "desconocida", peso: Math.max(0.1, peso), web: site, handle: k, motivo: motivos.join(" · ") || "Cuenta sin historial en la Brújula" };
}

/* --- comprobación en otras fuentes --- */
async function corroborate(text, original) {
  const terms = keyTerms(text), termsEn = original && original !== text ? keyTerms(original) : [];
  const out = { terms, hits: [], official: false, old: false, error: null };
  if (terms.length < 2) return out;
  const seen = new Set();
  const consider = (arr, tset) => {
    for (const a of arr) {
      const tt = tokens(a.title); let n = 0;
      for (const t of tset) if (tt.has(t)) n++;
      if (n < 2) continue;
      const key = (a.source || a.url).toLowerCase(); if (seen.has(key)) continue; seen.add(key);
      a.isOfficial = OFFICIAL.test(a.sourceUrl || a.url || "");
      if (a.isOfficial) out.official = true;
      out.hits.push(a);
    }
  };
  try {
    const q = terms.slice(0, 3).join(" ") + " when:3d";
    consider(await googleNews(q, "es"), tokens(terms.join(" ")));
    if (termsEn.length >= 2) consider(await googleNews(termsEn.slice(0, 3).join(" ") + " when:3d", "en"), tokens(termsEn.join(" ")));
    if (out.hits.length === 0) {
      const old = await googleNews(terms.slice(0, 3).join(" "), "es");
      const tset = tokens(terms.join(" "));
      const oldHits = old.filter((a) => { const tt = tokens(a.title); let n = 0; for (const t of tset) if (tt.has(t)) n++; return n >= 2; });
      if (oldHits.length && oldHits.every((a) => Date.now() - new Date(a.date) > 7 * 864e5)) out.old = true;
    }
  } catch (e) { out.error = String(e.message || e); }
  return out;
}
function levelFromCheck(cred, chk, match) {
  const n = chk.hits.length;
  let nivel = n >= 6 ? "confirmado" : n >= 3 ? "varios_medios" : n >= 1 ? "medios_locales" : "rumor";
  if (chk.official) nivel = n >= 3 ? "confirmado" : "oficial";
  if (cred.tipo === "oficial" && cred.peso >= 0.85) nivel = n >= 2 ? "confirmado" : "oficial";
  if (nivel === "rumor" && match && (NIV[match.nivel]?.[0] ?? 0) >= 0.65) nivel = "fuente_unica";
  return nivel;
}
function verdictOf(nivel, chk, flags) {
  if (chk.old) return "descontextualizado";
  if (nivel === "confirmado" || nivel === "oficial") return "confirmado";
  if (nivel === "varios_medios" || nivel === "medios_locales") return "parcial";
  return "sin_confirmar";
}

/* --- fuentes aprendidas --- */
function learnSource(cred) {
  if (!cred.handle) return;
  const list = store.get("brujula.vigiladas", []);
  if (list.some((s) => s.handle === cred.handle)) return;
  list.unshift({ handle: cred.handle, nombre: cred.nombre, tipo: cred.tipo, peso: cred.peso, web: cred.web || null, telegram: cred.telegram || null, t: Date.now() });
  store.set("brujula.vigiladas", list.slice(0, 40));
}
function learnWeb(url) {
  let host; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return; }
  if (/(^|\.)(google|x|twitter|t|youtube|youtu|facebook|instagram|tiktok|bit)\.(com|co|me|be|ly)$/.test(host) || host === "t.me") return;
  const known = Object.values(DIRECTORIO).find((d) => d.web && host.endsWith(d.web));
  const tipo = known ? known.tipo : OFFICIAL.test(host) ? "oficial" : "medio";
  learnSource({ handle: "web:" + host, nombre: known ? known.nombre : host, tipo, peso: known ? known.peso : tipo === "oficial" ? 0.85 : 0.55, web: host });
}
const VIGILADAS_BASE = [
  { handle: "tg:air_alert_ua", nombre: "Alertas aéreas de Ucrania (canal oficial «Повітряна тривога»)", tipo: "oficial", peso: 0.9, telegram: "air_alert_ua", especial: "ucrania" },
  { handle: "coinbureau", nombre: "Coin Bureau", tipo: "medio", peso: 0.55, telegram: "CoinBureau" }
];
function seedVigiladas() {
  const list = store.get("brujula.vigiladas", []);
  let changed = false;
  for (const b of VIGILADAS_BASE) if (!list.some((x) => x.handle === b.handle)) { list.push({ ...b, t: Date.now() }); changed = true; }
  if (changed) store.set("brujula.vigiladas", list);
}
/* Ucrania: cuenta regiones en alerta aérea ahora mismo a partir del canal oficial */
async function scanUcrania() {
  setSource("ucrania", "Ucrania · Alertas aéreas (oficial)", "wait", "Consultando…");
  try {
    const ch = await readTelegram("air_alert_ua");
    const activas = new Map();
    for (const m of ch.msgs.slice().reverse()) { // de más antiguo a más reciente
      if (!reciente(m.date, 12)) continue;
      const reg = (m.text.match(/#([\p{L}_]+)/u) || [])[1] || "";
      if (!reg) continue;
      if (/відбій/i.test(m.text)) activas.delete(reg);
      else if (/тривог/i.test(m.text)) activas.set(reg, m.date);
    }
    const n = activas.size;
    const evs = [];
    if (n) {
      const S = n >= 15 ? 6 : n >= 8 ? 5 : 3;
      evs.push({ id: "ucrania-alertas", origen: "auto", tema: "ucrania", titulo: `Ucrania: ${n} zona(s) en alerta aérea ahora`,
        resumen: `Zonas con alerta activa: ${[...activas.keys()].slice(0, 12).join(", ").replace(/_/g, " ")}. ${n >= 15 ? "Indica un ataque masivo." : ""}`,
        dominio: "belico", region: "Ucrania", lat: 49, lon: 32, zona: "europa", S, nivel: "oficial", tendencia: n >= 15 ? "escala" : "estable",
        fecha: [...activas.values()].sort().at(-1), fuentes: [{ n: "Canal oficial «Повітряна тривога»", url: "https://t.me/air_alert_ua" }],
        fiabilidad: "Canal oficial de alertas aéreas de Ucrania (Ajax Systems con datos de la administración ucraniana). Las alertas son habituales: solo suben el índice si son masivas." });
    }
    ST.auto = [...ST.auto.filter((x) => x.tema !== "ucrania"), ...evs];
    sens("ucrania", { n });
    setSource("ucrania", "Ucrania · Alertas aéreas (oficial)", "ok", n ? `${n} zona(s) en alerta ahora` : "Sin alertas activas");
  } catch (e) { setSource("ucrania", "Ucrania · Alertas aéreas (oficial)", "err", String(e.message || e).slice(0, 80)); }
}
async function scanWatched() {
  seedVigiladas();
  const list = store.get("brujula.vigiladas", []).filter((s) => !s.especial).filter((s) => s.telegram || s.tipo === "oficial" || s.tipo === "medio" || s.peso >= 0.5).slice(0, 12);
  if (!list.length) return;
  setSource("vigiladas", "Fuentes que vigilas", "wait", "Consultando…");
  const evs = []; let ok = 0;
  for (const s of list) {
    const q = s.web ? `site:${s.web} when:1d` : `"${s.nombre}" when:1d`;
    try {
      const items = s.telegram
        ? (await readTelegram(s.telegram)).msgs.filter((m) => reciente(m.date, 24)).map((m) => ({ title: m.text.slice(0, 220), url: m.url, date: m.date, source: s.nombre }))
        : await googleNews(q, s.web && /\.(es|gob\.es)$/.test(s.web) ? "es" : "en");
      ok++;
      for (const a of items.slice(0, 6)) {
        const c = classifyPost(a.title);
        if (c.S < 5) continue;
        evs.push({ id: "vig-" + s.handle + "-" + tokens(a.title).size + "-" + a.title.length, origen: "auto", tema: "vigiladas",
          titulo: `${s.nombre}: ${a.title}`, resumen: a.title, dominio: c.dominio, region: c.pl.name, lat: c.pl.lat, lon: c.pl.lon, zona: c.pl.zona,
          S: c.S, nivel: s.tipo === "oficial" ? "oficial" : "fuente_unica", tendencia: "estable", fecha: a.date ? new Date(a.date).toISOString() : null,
          fuentes: [{ n: a.source || s.nombre, url: a.url }], fiabilidad: `Publicado por una fuente que vigilas (${TIPO_TXT[s.tipo] || s.tipo}).` });
      }
    } catch (e) { /* se informa abajo */ }
  }
  ST.auto = [...ST.auto.filter((x) => x.tema !== "vigiladas"), ...evs.slice(0, 15)];
  setSource("vigiladas", "Fuentes que vigilas", ok ? "ok" : "err", ok ? `${list.length} fuentes, ${evs.length} titulares de alerta` : "No se pudo consultar Google Noticias (falta el intermediario)");
}
async function recheckRumors() {
  const list = store.get("brujula.buzon", []); let changed = false;
  for (const b of list.filter((x) => x.nivel === "rumor" && Date.now() - x.t < 72 * 36e5).slice(0, 4)) {
    const chk = await corroborate(b.text, b.original);
    if (chk.error || chk.terms.length < 2 || b.unread) continue;
    const nivel = levelFromCheck(b.cred || {}, chk, null);
    if (nivel !== b.nivel) { Object.assign(b, { nivel, hits: chk.hits.slice(0, 6), veredicto: verdictOf(nivel, chk, b.flags), checkedAt: Date.now() }); changed = true; }
  }
  if (changed) { store.set("brujula.buzon", list); renderBuzon(); renderAll(); }
}

/* --- análisis completo de una aportación --- */
async function analyzeInput(raw, sharedTitle) {
  raw = (raw || "").trim(); if (!raw) return;
  const status = $("post-status"); const say = (t) => { if (status) status.textContent = t; };
  const ref = xId(raw);
  const item = { id: "mio-" + Date.now(), t: Date.now(), raw, url: (/(https?:\/\/\S+)/.exec(raw) || [])[1] || null, text: raw, read: null };
  let x = { handle: ref?.user?.toLowerCase() || null, author: ref?.user || null };
  if (ref) {
    say("Leyendo la publicación…");
    try { x = await readX(ref); Object.assign(item, { text: x.text || raw, original: x.original, author: x.author, handle: x.handle, date: x.date, read: "ok" }); }
    catch (e) { item.read = "err"; item.handle = x.handle; item.author = x.author; }
  } else if (sharedTitle) item.text = sharedTitle + " " + raw;
  const tg = /t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})(?:\/(\d+))?/i.exec(raw);
  if (tg && !ref) {
    say("Leyendo el canal de Telegram…");
    try {
      const ch = await readTelegram(tg[1]);
      const m = (tg[2] && ch.msgs.find((x) => x.url.endsWith("/" + tg[2]))) || ch.msgs[0];
      if (m) Object.assign(item, { text: m.text, date: m.date, read: "ok" });
      Object.assign(item, { author: ch.title, handle: "tg:" + tg[1].toLowerCase() });
      x = { handle: "tg:" + tg[1].toLowerCase(), author: ch.title };
    } catch (e) { item.read = "err"; x = { handle: "tg:" + tg[1].toLowerCase(), author: tg[1] }; }
  }
  const c = classifyPost(item.text);
  say("Valorando la cuenta…");
  const cred = accountCredibility(x);
  say("Buscando confirmación en otros medios…");
  const chk = await corroborate(item.text, item.original);
  const unread = item.read === "err" && item.text.replace(/https?:\/\/\S+/g, "").trim().length < 25;
  const nivel = unread ? "rumor" : levelFromCheck(cred, chk, c.match);
  const flags = [...c.flags];
  if (unread) flags.push("No se pudo leer el post: no se puede valorar");
  if (item.date && Date.now() - new Date(item.date) > 7 * 864e5) flags.push("Publicación antigua: " + fecha(item.date));
  if (chk.old) flags.push("Lo que cuenta ya se publicó hace más de una semana");
  Object.assign(item, { unread, dominio: c.dominio, S: c.S, region: c.pl.name, lat: c.pl.lat, lon: c.pl.lon, zona: c.pl.zona, flags, nivel,
    cred, hits: chk.hits.slice(0, 6), terms: chk.terms, checkError: chk.error, matchTitle: c.match?.titulo || null,
    veredicto: verdictOf(nivel, chk, flags), checkedAt: Date.now() });
  if (tg && !ref) cred.telegram = tg[1];
  learnSource(cred);
  if (!ref && !tg && item.url) learnWeb(item.url);
  const list = store.get("brujula.buzon", []); list.unshift(item); store.set("brujula.buzon", list.slice(0, 60));
  say("");
  renderBuzon(); renderWatched(); renderAll();
}
function buzonItems() {
  return store.get("brujula.buzon", []).map((b) => {
    const hits = b.hits || [];
    const fiab = [
      b.cred ? `Cuenta: ${TIPO_TXT[b.cred.tipo] || b.cred.tipo}${b.cred.motivo ? " (" + b.cred.motivo + ")" : ""}.` : "",
      hits.length ? `La recogen ${hits.length} medio(s) en los últimos 3 días${hits.some((h) => h.isOfficial) ? ", incluida una web oficial" : ""}.` : (b.checkError ? "No se pudo buscar confirmación (falta el intermediario de Cloudflare)." : "Ningún medio la recoge todavía."),
      b.matchTitle ? `Relacionada con: «${b.matchTitle}».` : "",
      b.read === "err" ? "No se pudo leer el texto del post; pega también el texto." : ""
    ].filter(Boolean).join(" ");
    return {
      id: b.id, origen: "mio", titulo: (b.author ? b.author + ": " : "") + (b.text || "").slice(0, 110) + ((b.text || "").length > 110 ? "…" : ""),
      resumen: b.text, dominio: b.dominio, region: b.region, lat: b.lat, lon: b.lon, zona: b.zona, S: b.S, nivel: b.nivel, tendencia: "estable",
      fecha: b.date || new Date(b.t).toISOString(), veredicto: b.veredicto,
      fuentes: [...(b.url ? [{ n: "Publicación original", url: b.url }] : []), ...hits.map((a) => ({ n: `${a.source} · ${a.title}`, url: a.url }))],
      fiabilidad: fiab, flags: b.flags || []
    };
  });
}
const buzonAsRumors = () => buzonItems().filter((e) => e.nivel === "rumor" || e.nivel === "fuente_unica");
const buzonAsEvents = () => buzonItems().filter((e) => !(e.nivel === "rumor" || e.nivel === "fuente_unica"));
function renderBuzon() {
  const box = $("post-out"); box.replaceChildren();
  for (const e of buzonItems().slice(0, 10)) {
    const card = eventCard(e, e.nivel === "rumor" || e.nivel === "fuente_unica");
    const q = encodeURIComponent((e.resumen || "").replace(/https?:\/\/\S+/g, "").slice(0, 120));
    card.querySelector(".ev-head").prepend(h("span", { class: "vd " + e.veredicto }, VERD[e.veredicto] || ""));
    const extra = h("div", { class: "row", style: "padding:0 14px 12px" },
      e.flags.length ? h("div", { class: "flags" }, ...e.flags.map((f) => h("span", { class: "flag" }, f))) : null,
      h("a", { href: `https://news.google.com/search?q=${q}&hl=es&gl=ES&ceid=ES:es`, target: "_blank", rel: "noopener", class: "small" }, "Buscar en Google Noticias"),
      h("button", { type: "button", class: "btn-ghost" }, "Quitar"));
    extra.querySelector("button").addEventListener("click", () => { store.set("brujula.buzon", store.get("brujula.buzon", []).filter((b) => b.id !== e.id)); renderBuzon(); renderAll(); });
    card.append(extra); box.append(card);
  }
}
function renderWatched() {
  const box = $("watched"); if (!box) return; box.replaceChildren();
  const list = store.get("brujula.vigiladas", []);
  if (!list.length) { box.append(h("p", { class: "empty" }, "Cada cuenta que compartas se añadirá aquí y se vigilará en cada escaneo.")); return; }
  for (const s of list) {
    const row = h("div", { class: "st ok" }, h("i"), h("span", null, `${s.nombre} (@${s.handle})`, h("br"), h("span", { class: "small muted" }, `${TIPO_TXT[s.tipo] || s.tipo}${s.web ? " · " + s.web : ""}`)),
      h("button", { type: "button", class: "btn-ghost" }, "Dejar de vigilar"));
    row.querySelector("button").addEventListener("click", () => { store.set("brujula.vigiladas", store.get("brujula.vigiladas", []).filter((x) => x.handle !== s.handle)); renderWatched(); });
    box.append(row);
  }
}
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); installPrompt = ev; const b = $("install"); if (b) b.hidden = false; });

/* ===================== Arranque ===================== */
// ---------- Vigilante del NAS: lee el estado que el NAS publica en un Gist ----------
const NIV_NAS = { 4: ["EMERGENCIA", "var(--crit)"], 3: ["ALERTA", "var(--alert)"], 2: ["AVISO", "var(--watch)"], 1.5: ["SEÑAL TEMPRANA", "var(--muted)"], 1: ["INFO", "var(--muted)"] };
// Ajustes que solo viven en este móvil (nunca en el repositorio). Dentro de la app Android se toman de sus ajustes.
function cfgApp() { try { return JSON.parse(window.BrujulaApp?.config?.() || "{}"); } catch { return {}; } }
function cfgNtfy() { const a = cfgApp(); return { tema: (store.get("brujula.ntfy", "") || a.tema || "").trim(), servidor: (store.get("brujula.ntfysrv", "") || a.servidor || "https://ntfy.sh").trim().replace(/\/$/, "") }; }
async function mandar(orden, boton) {
  const { tema, servidor } = cfgNtfy(), msg = $("mando-msg"); if (!tema) return;
  boton.disabled = true; msg.textContent = "Enviando «" + orden + "»…";
  try {
    const r = await fetch(`${servidor}/${encodeURIComponent(tema)}-control`, { method: "POST", body: orden });
    if (!r.ok) throw new Error("HTTP " + r.status);
    msg.textContent = `Orden «${orden}» enviada. El vigilante te lo confirma con un aviso en unos segundos.`;
    setTimeout(cargarNAS, 20000);
  } catch (e) { msg.textContent = "No se pudo enviar: " + e.message; }
  boton.disabled = false;
}
function lineaIndices(hist) {
  const W = 300, H = 70, P = 6, series = [["asturias", "--accent", "Asturias"], ["espana", "--ink", "España"], ["global", "--muted", "Global"]].filter(([k]) => (hist?.[k] || []).length > 1);
  if (!series.length) return null;
  const ts = series.flatMap(([k]) => hist[k].map((p) => p[0])), t0 = Math.min(...ts), t1 = Math.max(...ts);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Evolución de los índices del NAS: " + series.map(([k, , n]) => `${n} de ${hist[k][0][1]} a ${hist[k].at(-1)[1]}`).join("; ") });
  for (const v of [0, 5, 10]) svg.append(s("line", { x1: P, x2: W - P, y1: H - P - v / 10 * (H - 2 * P), y2: H - P - v / 10 * (H - 2 * P), stroke: css("--line"), "stroke-width": 1 }));
  for (const [k, c] of series) svg.append(s("polyline", { points: hist[k].map(([t, v]) => `${P + (t - t0) / (t1 - t0 || 1) * (W - 2 * P)},${H - P - v / 10 * (H - 2 * P)}`).join(" "), fill: "none", stroke: css(c), "stroke-width": k === "asturias" ? 2.5 : 1.5, "stroke-linejoin": "round" }));
  const hrs = Math.round((t1 - t0) / 36e5);
  return h("div", null, svg, h("div", { class: "legend small muted" }, ...series.map(([k, c, n]) => h("span", null, h("i", { style: `background:${css(c)}` }), `${n} ${num(hist[k].at(-1)[1])}`)), h("span", null, `últimas ${hrs} h`)));
}
async function cargarNAS() {
  const id = (store.get("brujula.nas", "") || cfgApp().gist || "").trim(); const panel = $("nas-panel"); const { tema } = cfgNtfy();
  if (!id && !tema) { panel.hidden = true; return; }
  panel.hidden = false; const box = $("nas");
  const mando = tema ? h("div", { class: "mando" }, h("div", { class: "row" },
      ...[["⏸ Apagar 2 h", "apaga 2h"], ["🔕 Silenciar 8 h", "silencio 8h"], ["▶ Encender", "enciende"], ["🔔 Sonido normal", "normal"], ["Estado", "estado"]].map(([t, o]) => { const b = h("button", { type: "button", class: "btn-ghost" }, t); b.addEventListener("click", () => mandar(o, b)); return b; })),
    h("p", { id: "mando-msg", class: "small muted", "aria-live": "polite" }, "Mando a distancia del vigilante. «Apagar» lo deja sin vigilar: tampoco avisará de emergencias.")) : null;
  if (!id) { box.replaceChildren(h("p", { class: "small muted" }, "Para ver aquí lo que detecta el NAS, pon el ID del Gist en Ajustes."), mando); return; }
  if (!box.children.length) box.replaceChildren(h("p", { class: "empty" }, "Leyendo el NAS…"));
  try {
    const r = await fetch("https://api.github.com/gists/" + encodeURIComponent(id), { cache: "no-store" }); if (!r.ok) throw new Error(r.status === 403 ? "GitHub limita las consultas; prueba en unos minutos" : "HTTP " + r.status);
    const g = await r.json(); const f = g.files?.["brujula-nas.json"]; if (!f) throw new Error("el Gist no tiene brujula-nas.json");
    const e = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
    if (!e.generado) throw new Error("el NAS todavía no ha publicado nada");
    ST.nas = e;
    const min = Math.round((Date.now() - Date.parse(e.generado)) / 60000); const vivo = min < 25;
    const fuentes = e.fuentes || [], ok = fuentes.filter((x) => x.ok).length, I = e.indices || {};
    const estado = e.apagado ? ["⏸ Apagado desde el mando", "var(--watch)"] : !vivo ? ["● Sin noticias del NAS", "var(--crit)"] : e.silencio ? ["🔕 Vigilando en silencio", "var(--watch)"] : ["● Vigilando", "var(--ok)"];
    const temas = (e.temas || []).filter((t) => t.nivel >= 1.5 || t.desmentido).slice(0, 8);
    box.replaceChildren(
      h("p", { class: "small" }, h("strong", { style: `color:${estado[1]}` }, estado[0]), ` · actualizado hace ${min < 120 ? min + " min" : Math.round(min / 60) + " h"} · v${e.version} · ${ok}/${fuentes.length} fuentes · ${e.memoriaMB} MB`),
      !vivo && !e.apagado ? h("p", { class: "small warn-text" }, "El NAS lleva más de 25 min sin dar señales. Puede estar apagado, sin internet o sin luz: ahora mismo no te avisaría de nada.") : null,
      h("p", { class: "small" }, `Índices según el NAS: Asturias ${num(I.asturias ?? 0)} · España ${num(I.espana ?? 0)} · Global ${num(I.global ?? 0)}`),
      lineaIndices(e.historial),
      temas.length ? h("div", { class: "nas-temas" }, h("b", { class: "small" }, "Sucesos que sigue el NAS"), ...temas.map((t) => { const n = NIV_NAS[t.nivel] || NIV_NAS[1]; const u = safeUrl(t.url);
        return h("details", { class: "nas-tema" }, h("summary", null, h("strong", { style: `color:${n[1]}` }, t.retirado ? "RETIRADO" : n[0]), " · ", t.titulo, t.desmentido ? h("span", { class: "chip desm" }, t.retirado ? "✖ Desmentido" : "Con corrección") : !t.confirmado && t.confirmado !== undefined ? h("span", { class: "chip" }, "Sin confirmar") : null),
          h("p", { class: "small muted" }, `${t.lugar || ""} · gravedad ${t.S}/10 · ${t.fuentes} fuente(s) · confianza ${Math.round((t.conf || 0) * 100)} %`, u ? h("span", null, " · ", h("a", { href: u, target: "_blank", rel: "noopener" }, "fuente")) : null),
          (t.pasos || []).length ? h("ol", { class: "timeline" }, ...t.pasos.map((p) => h("li", null, h("span", { class: "mono small muted" }, new Date(p.t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })), h("span", { class: "dot" }), h("span", { class: "t" }, h("b", null, p.fuente + (p.desmiente ? " (desmiente)" : p.atribuido ? " (dato atribuido)" : "") + ": "), p.titulo)))) : null); })) : null,
      (e.alertas || []).length ? h("details", null, h("summary", { class: "small" }, `Avisos enviados al móvil (${e.alertas.length})`), h("ul", { class: "small", style: "margin:6px 0 0;padding-left:18px;display:grid;gap:6px" }, e.alertas.slice(0, 12).map((a) => { const n = a.correccion ? ["CORRECCIÓN", "var(--muted)"] : NIV_NAS[a.nivel] || NIV_NAS[1]; const u = safeUrl(a.url);
        return h("li", null, h("strong", { style: `color:${n[1]}` }, n[0]), " · ", new Date(a.t).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), " · ", u ? h("a", { href: u, target: "_blank", rel: "noopener" }, a.titulo) : a.titulo, a.previo ? h("span", { class: "muted" }, " (ya estaba en curso al arrancar)") : null); })))
        : h("p", { class: "small muted" }, "Sin avisos recientes."),
      h("details", null, h("summary", { class: "small" }, "Estado de cada fuente del NAS"), h("ul", { class: "small", style: "margin:6px 0 0;padding-left:18px" }, fuentes.map((x) => h("li", null, x.ok ? "✓ " : "✗ ", h("strong", null, x.nombre), " — ", x.msg || "")))),
      mando);
    renderAll();
  } catch (err) { box.replaceChildren(h("p", { class: "small" }, "No se pudo leer el NAS: " + err.message), mando); }
}
async function init() {
  $("rescan").addEventListener("click", () => scan(true));
  $("post-go").addEventListener("click", async () => { const b = $("post-go"); b.disabled = true; b.textContent = "Analizando…"; await analyzeInput($("post-in").value); $("post-in").value = ""; b.disabled = false; b.textContent = "Analizar"; });
  $("proxy-in").value = store.get("brujula.proxy", "");
  $("proxy-save").addEventListener("click", () => { const v = $("proxy-in").value.trim(); store.set("brujula.proxy", v); $("proxy-msg").textContent = v ? "Guardado. Pulsa «Escanear ahora»." : "Borrado."; });
  $("nas-in").value = store.get("brujula.nas", "");
  $("nas-save").addEventListener("click", () => { store.set("brujula.nas", $("nas-in").value.trim()); $("nas").replaceChildren(); cargarNAS(); });
  $("ntfy-in").value = store.get("brujula.ntfy", "");
  $("ntfy-save").addEventListener("click", () => { store.set("brujula.ntfy", $("ntfy-in").value.trim()); $("ntfy-msg").textContent = $("ntfy-in").value.trim() ? "Guardado solo en este móvil. Arriba, en «Vigilante del NAS», tienes el mando." : "Borrado."; cargarNAS(); });
  ST.refVisita = (() => { const v = store.get("brujula.visita", null); if (!v?.ultima) return null; return Date.now() - v.ultima.t > 30 * 60000 ? v.ultima : v.base || null; })();
  if (window.BrujulaApp) document.documentElement.classList.add("en-app");
  cargarNAS(); setInterval(() => { if (!document.hidden) cargarNAS(); }, 5 * 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ST.scanAt && Date.now() - ST.scanAt > CACHE_MIN * 60000) scan(false); });
  $("install").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); installPrompt = null; $("install").hidden = true; });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try { ST.ana = await getJSON("datos/analisis.json?v=" + Math.floor(Date.now() / 600000)); }
  catch (e) { ST.ana = { eventos: [], estado: { resumen: "No se pudo cargar el análisis del analista." } }; }
  renderAllNow(); renderSources(); renderMarkets(); renderBuzon(); renderWatched();
  const qs = new URLSearchParams(location.search);
  const shared = [qs.get("url"), qs.get("text")].filter(Boolean).join(" ");
  if (shared) {
    history.replaceState(null, "", location.pathname);
    $("buzon").scrollIntoView({ block: "start" });
    await analyzeInput(shared, qs.get("title"));
  }
  scan(false);
}
init();
})();
