// Ensayo completo sin internet: genera respuestas simuladas, arranca el agente dos veces
// (1ª: "situación normal" = arranque en frío; 2ª: "suceso grave") y muestra qué avisos enviaría y cuánta memoria usa.
// Uso: node prueba/ensayo.mjs
import fs from "node:fs"; import http from "node:http"; import { spawnSync, spawn } from "node:child_process";
const MOCK = "/tmp/brujula-mock", DATA = "/tmp/brujula-data";
fs.rmSync(MOCK, { recursive: true, force: true }); fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(MOCK, { recursive: true });
const nom = (url) => { const u = new URL(url); return (u.hostname + u.pathname).replace(/[^a-z0-9.]+/gi, "_").slice(0, 120); };
const put = (url, body) => fs.writeFileSync(`${MOCK}/${nom(url)}`, typeof body === "string" ? body : JSON.stringify(body));
const now = Date.now(), iso = (m = 0) => new Date(now - m * 60000).toISOString(), rfc = (m = 0) => new Date(now - m * 60000).toUTCString();
const item = (t, d = "", m = 5, extra = "") => `<item><title><![CDATA[${t}]]></title><link>https://ej.es/${encodeURIComponent(t).slice(0, 40)}</link><description><![CDATA[${d}]]></description><pubDate>${rfc(m)}</pubDate><guid>${encodeURIComponent(t).slice(0, 60)}</guid>${extra}</item>`;
const canal = (...its) => `<?xml version="1.0"?><rss version="2.0" xmlns:georss="http://www.georss.org/georss"><channel><title>x</title>${its.join("")}</channel></rss>`;
const madridTxt = (m) => { const p = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(now - m * 60000)); const g = (t) => p.find((x) => x.type === t).value; return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}:${g("second")}`; };

const ree = (reales) => ({ included: [{ attributes: { title: "Prevista", values: reales.map((_, i) => ({ value: 29500, datetime: iso((reales.length - 1 - i) * 10 + 5) })) } }, { attributes: { title: "Real", values: reales.map((v, i) => ({ value: v, datetime: iso((reales.length - 1 - i) * 10 + 5) })) } }] });
function normal() {
  put("https://www.ign.es/ign/RssTools/sismologia.xml", canal(item("-Info.terremoto: 2.1 GOLFO DE CÁDIZ", `Se ha producido un terremoto de magnitud 2.1 en GOLFO DE CÁDIZ en la fecha ${madridTxt(30)} en la siguiente localización: 36.1N, 7.9W`, 30, "<geo:lat>36.1</geo:lat><geo:long>-7.9</geo:long>")));
  put("https://www.seismicportal.eu/fdsnws/event/1/query", { features: [{ properties: { mag: 2.8, lat: 38, lon: 20, flynn_region: "GREECE", time: iso(50), unid: "a1" } }] });
  put("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson", { features: [{ geometry: { coordinates: [140, 36, 10] }, properties: { mag: 4.9, place: "Japan", time: now - 3e6, url: "https://usgs" } }] });
  put("https://www.tsunami.gov/events/xml/PHEBAtom.xml", `<feed xmlns="http://www.w3.org/2005/Atom"></feed>`); put("https://www.tsunami.gov/events/xml/PAAQAtom.xml", `<feed xmlns="http://www.w3.org/2005/Atom"></feed>`);
  put("https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real", ree([29100, 29050, 29000]));
  put("https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events", { data: [{ location: "country/SY", start: now / 1000 - 3600, duration: 3600 }] });
  put("https://services.swpc.noaa.gov/products/noaa-scales.json", { 0: { G: { Scale: "1" }, R: { Scale: "0" } }, 1: { G: { Scale: "2" } }, 2: { G: { Scale: "1" } }, 3: { G: { Scale: "0" } } });
  put("https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json", []);
  put("https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml", canal(item("Aviso amarillo por viento. Litoral cántabro", "amarillo", 60)));
  put("https://www.gdacs.org/xml/rss.xml", canal(item("Green earthquake alert in Chile", "green", 90)));
  put("https://www.incibe.es/incibe-cert/alerta-temprana/avisos/feed", canal(item("Vulnerabilidad media en un plugin de WordPress", "Importancia: 3 - Media", 120)));
  put("https://www.incibe.es/incibe-cert/alerta-temprana/avisos-sci/feed", canal());
  put("https://t.me/s/air_alert_ua", `<div class="tgme_widget_message " data-post="air_alert_ua/1"><div class="tgme_widget_message_text js-message_text">🔴 Повітряна тривога в #Харківська_область</div><time datetime="${iso(20)}"></time></div>`);
  put("https://opensky-network.org/api/states/all", { states: Array.from({ length: 420 }, (_, i) => ["a" + i, "IBE" + i, "ES", 0, 0, -3, 40, 10000, false, 230, 0, 0, null, 10000, i === 7 ? "7000" : "1000"]) });
  put("https://api.adsb.lol/v2/mil", { ac: [{ hex: "ae1", flight: "RCH123", t: "C17", lat: 40.5, lon: -3.4 }, { hex: "ae2", flight: "QID45", t: "K35R", lat: 36.6, lon: -6.3 }] });
  put("https://gamma-api.polymarket.com/events", [{ slug: "iran", title: "Iran", markets: [{ id: "m1", question: "US military strike on Iran by December?", outcomePrices: '["0.30","0.70"]', outcomes: '["Yes","No"]' }] }]);
  put("https://www.europapress.es/rss/rss.aspx", canal(item("El Gobierno aprueba el techo de gasto", "", 30), item("La Liga: resultados de la jornada", "", 40)));
  put("https://www.abc.es/rss/feeds/abc_ultima.xml", canal(item("La bolsa abre al alza", "", 20)));
  put("https://www.elcomercio.es/rss/2.0/", canal(item("Gijón estrena nuevo carril bici", "", 25)));
  put("https://www.lne.es/rss/", canal(item("Oviedo celebra San Mateo", "", 35)));
  put("https://www.rtpa.es/rss", canal(item("El Principado presenta los presupuestos", "", 45)));
  put("https://mapping.emergency.copernicus.eu/activations/api/activations/", { results: [{ code: "EMSR900", countries: [{ short_name: "Greece" }], category: { name: "Flood" }, name: "Flood in Crete, Greece", centroid: "POINT (24.9 35.2)", activationTime: iso(600).slice(0, 19), closed: false }] });
  put("https://www.who.int/api/news/diseaseoutbreaknews", { value: [{ Id: "1", Title: "Cholera - Sudan", PublicationDate: iso(3000), UrlName: "x" }] });
  put("https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed", canal(item("Epidemiological update: West Nile virus", "", 9000)));
  put("https://www.dsn.gob.es/es/rss.xml", canal(item("XX Jornadas STIC", "jornadas", 9000)));
  put("https://feeds.bbci.co.uk/news/world/rss.xml", canal(item("Drone strike kills 3 in Kharkiv", "Ukraine", 40)));
  put("https://travel.state.gov/_res/rss/TAsTWs.xml", canal(item("France - Level 2: Exercise Increased Caution", "", 600)));
  put("https://www.gov.uk/foreign-travel-advice.atom", `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Spain travel advice</title><updated>${iso(300)}</updated><link href="https://gov.uk/x"/><id>1</id><summary>Latest update: information on strikes</summary></entry></feed>`);
  put("https://news.google.com/rss/search", canal(item("Interior refuerza la seguridad en Navidad - interior.gob.es", "", 30)));
  put("https://api.gdeltproject.org/api/v2/doc/doc", { articles: Array.from({ length: 4 }, (_, i) => ({ title: "Noticia normal " + i, url: "https://g/" + i })) });
}
function suceso() {
  // Terremoto fuerte cerca de Asturias visto por IGN y EMSC + varios medios + apagón parcial
  put("https://www.ign.es/ign/RssTools/sismologia.xml", canal(item("-Info.terremoto: 5.9 CANTÁBRICO", `Se ha producido un terremoto de magnitud 5.9 en GOLFO DE VIZCAYA en la fecha ${madridTxt(3)} en la siguiente localización: 44.1N, 5.6W`, 3, "<geo:lat>44.1</geo:lat><geo:long>-5.6</geo:long>")));
  put("https://www.seismicportal.eu/fdsnws/event/1/query", { features: [{ properties: { mag: 5.8, lat: 44.12, lon: -5.62, flynn_region: "BAY OF BISCAY", time: iso(3), unid: "b2" } }] });
  put("https://www.elcomercio.es/rss/2.0/", canal(item("Última hora: fuerte terremoto sacude Asturias, se siente en Gijón y Oviedo", "Vecinos desalojan edificios", 2)));
  put("https://www.lne.es/rss/", canal(item("Un terremoto de gran intensidad se siente en toda Asturias", "", 1)));
  put("https://www.europapress.es/rss/rss.aspx", canal(item("Explosión en una planta química de Tarragona obliga a confinar a la población", "Protección Civil activa el plan de emergencia", 4)));
  put("https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real", ree([29100, 29050, 22500]));
  put("https://www.abc.es/rss/feeds/abc_ultima.xml", canal(item("Explosión en una planta química de Tarragona: confinada la población cercana", "", 3)));
  put("https://gamma-api.polymarket.com/events", [{ slug: "iran", title: "Iran", markets: [{ id: "m1", question: "US military strike on Iran by December?", outcomePrices: '["0.55","0.45"]', outcomes: '["Yes","No"]' }] }]);
}

// Servidor ntfy de mentira: recoge lo que el agente enviaría al móvil
const recibidos = [];
const srv = http.createServer((q, r) => { let b = ""; q.on("data", (c) => (b += c)); q.on("end", () => { try { recibidos.push(JSON.parse(b)); } catch {} r.end("{}"); }); }).listen(0);
const puerto = srv.address().port;
const env = { ...process.env, BRUJULA_MOCK: MOCK, BRUJULA_DATA: DATA, NTFY_TOPIC: "prueba", NTFY_SERVER: `http://127.0.0.1:${puerto}`, SILENCIO: "-", RESUMEN_DIARIO: "" };
const correr = (titulo) => new Promise((ok) => {
  const p = spawn(process.execPath, ["--max-old-space-size=64", new URL("../index.js", import.meta.url).pathname, "--una-vez"], { env });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", (code) => { console.log(`\n===== ${titulo} (salida ${code}) =====`); console.log(out.split("\n").filter((l) => /^\d\d:\d\d|Error|✗/.test(l)).join("\n")); ok(out); });
});
normal(); const n0 = recibidos.length; const o1 = await correr("1) Arranque en frío, situación normal");
const avisos1 = recibidos.slice(n0);
suceso(); const n1 = recibidos.length; const o2 = await correr("2) Suceso grave (terremoto + apagón + explosión)");
const avisos2 = recibidos.slice(n1);
for (const [t, a] of [["Avisos del arranque", avisos1], ["Avisos del suceso", avisos2]]) { console.log(`\n--- ${t}: ${a.length} ---`); for (const x of a) console.log(`[p${x.priority}] ${x.title}\n    ${x.message.split("\n").join("\n    ")}`); }
const est = JSON.parse(fs.readFileSync(DATA + "/estado.json", "utf8"));
console.log("\nMemoria (RSS):", est.memoriaMB, "MB · índices:", JSON.stringify(est.indices), "· memoria.json:", Math.round(fs.statSync(DATA + "/memoria.json").size / 1024), "KB");
console.log("Fuentes:", est.fuentes.map((f) => `${f.ok ? "✓" : "✗"} ${f.id}`).join("  "));
srv.close();
