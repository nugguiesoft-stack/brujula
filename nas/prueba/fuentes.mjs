// Comprobación REAL de las fuentes (con internet): pide cada dirección, mira si responde y si el formato es el esperado.
// Uso: node nas/prueba/fuentes.mjs   (o el workflow manual «Comprobar fuentes» en GitHub → Actions)
// No forma parte del vigilante: es una herramienta de diagnóstico que se lanza a mano.
import fs from "node:fs";
import { rss } from "../lib/xml.js";
const UA_NAS = "BrujulaEmergencia/1.0 (+https://github.com/nugguiesoft-stack/brujula; uso personal, sin fines comerciales)";
const UA_NAV = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const now = Date.now(), iso = (h) => new Date(now - h * 36e5).toISOString();
const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const s = Math.floor(now / 1000);
const corta = (x, n = 110) => String(x ?? "").replace(/\s+/g, " ").slice(0, n);
const R = (j) => { const it = rss(j); if (!it.length) throw new Error("0 entradas"); const f = it.map((i) => Date.parse(i.date)).filter(Boolean).sort().at(-1); return `${it.length} entradas · última ${f ? new Date(f).toISOString().slice(0, 16) : "sin fecha"} · «${corta(it[0].title, 70)}»${it[0].lat != null ? ` · geo ${it[0].lat},${it[0].lon}` : ""}`; };
const J = (fn) => (t) => fn(JSON.parse(t));
const F = [
  // --- sensores ---
  ["ign", "https://www.ign.es/ign/RssTools/sismologia.xml", (t) => R(t) + " · desc: " + corta(rss(t)[0].desc, 130)],
  ["emsc", `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=4&limit=5&start=${iso(48).slice(0, 19)}`, J((d) => `${d.features.length} sismos · claves ${Object.keys(d.features[0].properties).join(",")}`)],
  ["usgs-hora", "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson", J((d) => `${d.features.length} sismos`)],
  ["usgs-dia", "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson", J((d) => `${d.features.length} sismos · ${corta(d.features[0]?.properties?.place, 50)}`)],
  ["usgs-sig", "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson", J((d) => `${d.features.length} sismos`)],
  ["tsunami-pac", "https://www.tsunami.gov/events/xml/PHEBAtom.xml", (t) => `${rss(t).length} entradas · «${corta(rss(t)[0]?.title, 60)}» ${corta(rss(t)[0]?.date, 25)}`],
  ["tsunami-atl", "https://www.tsunami.gov/events/xml/PAAQAtom.xml", (t) => `${rss(t).length} entradas · «${corta(rss(t)[0]?.title, 60)}» ${corta(rss(t)[0]?.date, 25)} geo ${rss(t)[0]?.lat}`],
  ["ree-api", `https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real?start_date=${iso(6).slice(0, 16)}&end_date=${iso(0).slice(0, 16)}&time_trunc=hour`, J((d) => d.included.map((x) => `${x.attributes.title}[${x.attributes.values.length}] último ${x.attributes.values.at(-1)?.value}@${x.attributes.values.at(-1)?.datetime}`).join(" | "))],
  ["ree-visor", `https://demanda.ree.es/WSvisionaMovilesPeninsulaRest/resources/demandaGeneracionPeninsula?callback=cb&curva=DEMANDA&fecha=${hoy}`, (t) => { const j = JSON.parse(t.slice(t.indexOf("(") + 1, t.lastIndexOf(")"))); const v = j.valoresHorariosGeneracion; return `${v.length} valores · claves ${Object.keys(v[0]).slice(0, 8).join(",")} · último ${JSON.stringify(v.filter((x) => x.dem > 0).at(-1)).slice(0, 90)}`; }],
  ["ioda", `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?from=${s - 86400}&until=${s}&entityType=country&limit=50`, J((d) => { const a = Array.isArray(d.data) ? d.data : d.data?.events || []; return `claves raíz ${Object.keys(d).join(",")} · ${a.length} sucesos · primero ${corta(JSON.stringify(a[0]), 260)}`; })],
  ["noaa-escalas", "https://services.swpc.noaa.gov/products/noaa-scales.json", J((d) => `claves ${Object.keys(d).join(",")} · G ahora ${d["0"]?.G?.Scale} · R ${d["0"]?.R?.Scale}`)],
  ["noaa-llamaradas", "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json", J((d) => `${d.length} llamaradas · claves ${Object.keys(d[0] || {}).join(",")}`)],
  ["noaa-prob", "https://services.swpc.noaa.gov/json/solar_probabilities.json", J((d) => `${d.length} · claves ${Object.keys(d[0] || {}).join(",")}`)],
  ["opensky", "https://opensky-network.org/api/states/all?lamin=35.5&lamax=44.5&lomin=-10&lomax=4.5", J((d) => `${(d.states || []).length} aviones`)],
  ["adsb-mil", "https://api.adsb.lol/v2/mil", J((d) => `${(d.ac || []).length} militares · claves ${Object.keys(d.ac?.[0] || {}).slice(0, 8).join(",")}`)],
  // --- oficiales ---
  ["aemet-cap", "https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml", (t) => { const it = rss(t); const ast = it.filter((i) => /asturias/i.test(i.title + i.desc)); return R(t) + ` · desc «${corta(it[0].desc, 120)}» · ${ast.length} mencionan Asturias: «${corta(ast[0]?.title, 90)}» · niveles: ${["amarillo", "naranja", "rojo", "yellow", "orange", "red", "moderate", "severe", "extreme"].filter((w) => new RegExp(w, "i").test(t)).join(",")}`; }],
  ["aemet-cap-ast-a", "https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAC63_RSS.xml", R],
  ["aemet-cap-ast-b", "https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAZ63_RSS.xml", R],
  ["meteoalarm-es", "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain", (t) => { const it = rss(t); const ast = it.filter((i) => /asturias/i.test(i.title + i.desc + t.slice(0, 0))); return R(t) + ` · Asturias en ${(t.match(/asturias/gi) || []).length} sitios · etiquetas cap: ${[...new Set(t.match(/<cap:[a-zA-Z]+/g) || [])].join(",")}`; }],
  ["gdacs", "https://www.gdacs.org/xml/rss.xml", R],
  ["incibe", "https://www.incibe.es/incibe-cert/alerta-temprana/avisos/feed", (t) => R(t) + " · desc: " + corta(rss(t)[0].desc, 140)],
  ["incibe-sci", "https://www.incibe.es/incibe-cert/alerta-temprana/avisos-sci/feed", R],
  ["us-viaje", "https://travel.state.gov/_res/rss/TAsTWs.xml", R],
  ["uk-viaje", "https://www.gov.uk/foreign-travel-advice.atom", R],
  ["de-viaje", "https://www.auswaertiges-amt.de/opendata/travelwarning", J((d) => { const r = Object.values(d.response || {}).filter((x) => x && x.title); return `${r.length} países · claves ${Object.keys(r[0] || {}).join(",")}`; })],
  ["ua-alertas", "https://t.me/s/air_alert_ua", (t) => `${t.split('class="tgme_widget_message ').length - 1} mensajes · ${/тривог|відбій/i.test(t) ? "con palabras de alerta" : "SIN palabras de alerta"}`],
  ["polymarket", "https://gamma-api.polymarket.com/events?active=true&closed=false&tag_slug=geopolitics&order=volume24hr&ascending=false&limit=5", J((d) => `${d.length} sucesos · mercado: claves ${Object.keys(d[0]?.markets?.[0] || {}).filter((k) => /outcome|question|active|closed/.test(k)).join(",")} · ${corta(d[0]?.markets?.[0]?.outcomePrices, 40)}`)],
  ["wikimedia", "https://stream.wikimedia.org/v2/stream/page-create", null, { flujo: true }],
  ["fxtwitter", "https://api.fxtwitter.com/2/status/20", J((d) => `claves ${Object.keys(d).join(",")} · ${corta((d.status || d.tweet)?.text, 40)}`)],
  ["gdelt", "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent('(Spain OR Asturias) (explosion OR blackout)') + "&mode=artlist&maxrecords=5&format=json&timespan=24h&sort=datedesc", J((d) => `${(d.articles || []).length} artículos · claves ${Object.keys(d.articles?.[0] || {}).join(",")}`)],
  ["gnews", "https://news.google.com/rss/search?q=" + encodeURIComponent("(site:interior.gob.es OR site:112asturias.es) when:7d") + "&hl=es&gl=ES&ceid=ES:es", R],
  // --- prensa ---
  ["abc", "https://www.abc.es/rss/feeds/abc_ultima.xml", R], ["europapress", "https://www.europapress.es/rss/rss.aspx?ch=94", R],
  ["europapress-portada", "https://www.europapress.es/rss/rss.aspx", R], ["europapress-asturias", "https://www.europapress.es/rss/rss.aspx?ch=00279", R],
  ["elpais", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", R], ["elmundo", "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", R],
  ["eldebate", "https://www.eldebate.com/rss/home.xml", R], ["20minutos", "https://www.20minutos.es/rss/", R],
  ["elcomercio", "https://www.elcomercio.es/rss/2.0/portada", R], ["elcomercio-asturias", "https://www.elcomercio.es/rss/2.0/?section=asturias", R],
  ["lne-a", "https://www.lne.es/rss/", R], ["lne-b", "https://www.lne.es/rss/section/1", R], ["lne-c", "https://www.lne.es/elementosInt/rss/1", R], ["lne-d", "https://www.lne.es/rss/section/6800", R], ["lne-e", "https://www.lne.es/rss/ultima-hora/", R],
  ["lne-portada-html", "https://www.lne.es/", (t) => "enlaces rss en portada: " + ([...t.matchAll(/<link[^>]+(rss|atom)[^>]*>/gi)].map((m) => corta(m[0], 160)).join(" || ") || "ninguno")],
  ["rtpa-a", "https://www.rtpa.es/rss/noticias.xml", R], ["rtpa-b", "https://www.rtpa.es/rss", R], ["rtpa-html", "https://www.rtpa.es/", (t) => "rss: " + ([...t.matchAll(/href="([^"]*rss[^"]*)"/gi)].map((m) => m[1]).slice(0, 6).join(" , ") || "ninguno")],
  ["rtve", "https://api.rtve.es/api/noticias.rss", R], ["rtve-b", "https://www.rtve.es/api/noticias.rss", R], ["efe", "https://efe.com/feed/", R], ["efe-es", "https://efe.com/espana/feed/", R],
  ["bbc", "https://feeds.bbci.co.uk/news/world/rss.xml", R], ["aljazeera", "https://www.aljazeera.com/xml/rss/all.xml", R], ["dw", "https://rss.dw.com/rdf/rss-sp-all", R],
  ["france24", "https://www.france24.com/es/rss", R], ["guardian", "https://www.theguardian.com/world/rss", R], ["onu", "https://news.un.org/feed/subscribe/es/news/all/rss.xml", R],
  // --- candidatas nuevas ---
  ["112asturias-a", "https://www.112asturias.es/feed/", R], ["112asturias-b", "https://www.112asturias.es/rss", R],
  ["112asturias-html", "https://www.112asturias.es/", (t) => `título «${corta((t.match(/<title>([^<]*)/i) || [])[1], 60)}» · rss: ` + ([...t.matchAll(/href="([^"]*(rss|feed|atom)[^"]*)"/gi)].map((m) => m[1]).slice(0, 6).join(" , ") || "ninguno") + " · x/telegram: " + ([...new Set([...t.matchAll(/https?:\/\/(?:twitter|x|t)\.(?:com|me)\/[A-Za-z0-9_]+/g)].map((m) => m[0]))].slice(0, 5).join(" , ") || "ninguno")],
  ["sepa-html", "https://www.sepa.es/", (t) => `título «${corta((t.match(/<title>([^<]*)/i) || [])[1], 60)}» · rss: ` + ([...t.matchAll(/href="([^"]*(rss|feed|atom)[^"]*)"/gi)].map((m) => m[1]).slice(0, 6).join(" , ") || "ninguno") + " · x/telegram: " + ([...new Set([...t.matchAll(/https?:\/\/(?:twitter|x|t)\.(?:com|me)\/[A-Za-z0-9_]+/g)].map((m) => m[0]))].slice(0, 5).join(" , ") || "ninguno")],
  ["sepa-feed", "https://www.sepa.es/feed/", R],
  ["tg-112asturias", "https://t.me/s/112Asturias", (t) => `${t.split('class="tgme_widget_message ').length - 1} mensajes · «${corta((t.match(/tgme_channel_info_header_title[^>]*>(?:<span[^>]*>)?([^<]*)/) || [])[1], 60)}»`],
  ["tg-sepa", "https://t.me/s/SEPA_Asturias", (t) => `${t.split('class="tgme_widget_message ').length - 1} mensajes · «${corta((t.match(/tgme_channel_info_header_title[^>]*>(?:<span[^>]*>)?([^<]*)/) || [])[1], 60)}»`],
  ["tg-aemet-ast", "https://t.me/s/AEMET_Asturias", (t) => `${t.split('class="tgme_widget_message ').length - 1} mensajes`],
  ["tg-proteccioncivil", "https://t.me/s/proteccioncivil", (t) => `${t.split('class="tgme_widget_message ').length - 1} mensajes · «${corta((t.match(/tgme_channel_info_header_title[^>]*>(?:<span[^>]*>)?([^<]*)/) || [])[1], 60)}»`],
  ["tg-dsn", "https://t.me/s/DSNGob", (t) => `${t.split('class="tgme_widget_message ').length - 1} mensajes`],
  ["dsn-rss", "https://www.dsn.gob.es/es/rss.xml", R], ["dsn-rss-b", "https://www.dsn.gob.es/rss.xml", R],
  ["moncloa-rss", "https://www.lamoncloa.gob.es/Paginas/rss.aspx?tipo=16", R],
  ["interior-rss", "https://www.interior.gob.es/opencms/es/prensa/rss/", R],
  ["policia-rss", "https://www.policia.es/_es/comunicacion_prensa_rss.php", R],
  ["csn-rss", "https://www.csn.es/rss", R], ["csn-rss-b", "https://www.csn.es/noticias-csn/-/asset_publisher/rss", R],
  ["csn-html", "https://www.csn.es/", (t) => "rss: " + ([...t.matchAll(/href="([^"]*(rss|feed)[^"]*)"/gi)].map((m) => m[1]).slice(0, 6).join(" , ") || "ninguno")],
  ["iaea-rss", "https://www.iaea.org/feeds/topnews", R], ["iaea-press", "https://www.iaea.org/feeds/pressalerts", R],
  ["who-don", "https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDate%20desc&$top=3", J((d) => `${d.value.length} · claves ${Object.keys(d.value[0]).slice(0, 10).join(",")} · «${corta(d.value[0].Title, 70)}» ${d.value[0].PublicationDate}`)],
  ["who-rss", "https://www.who.int/rss-feeds/news-english.xml", R],
  ["ecdc-rss", "https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed", R], ["ecdc-news", "https://www.ecdc.europa.eu/en/taxonomy/term/1244/feed", R], ["ecdc-cdtr", "https://www.ecdc.europa.eu/en/taxonomy/term/2942/feed", R],
  ["copernicus-ems", "https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=5", J((d) => `claves ${Object.keys(d).join(",")} · ${corta(JSON.stringify((d.results || d)[0]), 300)}`)],
  ["copernicus-rss", "https://emergency.copernicus.eu/mapping/activations-rapid/feed", R], ["copernicus-rss-b", "https://mapping.emergency.copernicus.eu/activations/rapid/rss/", R],
  ["openmeteo-aire", "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=43.36&longitude=-5.85&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=Europe%2FMadrid", J((d) => corta(JSON.stringify(d.current), 200))],
  ["openmeteo-rios", "https://flood-api.open-meteo.com/v1/flood?latitude=43.36&longitude=-5.85&daily=river_discharge,river_discharge_max,river_discharge_median&forecast_days=5&past_days=2", J((d) => corta(JSON.stringify(d.daily), 260))],
  ["openmeteo-tiempo", "https://api.open-meteo.com/v1/forecast?latitude=43.36&longitude=-5.85&current=wind_gusts_10m,precipitation,temperature_2m&daily=wind_gusts_10m_max,precipitation_sum&forecast_days=2&timezone=Europe%2FMadrid", J((d) => corta(JSON.stringify(d.current), 160))],
  ["chc-saih", "https://saih.chcantabrico.es/", (t) => `título «${corta((t.match(/<title>([^<]*)/i) || [])[1], 60)}» · ${t.length} bytes`],
  ["eurdep", "https://remap.jrc.ec.europa.eu/api/maps/simple", (t) => corta(t, 160)],
  ["bfs-odl", "https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=opendata:odlinfo_odl_1h_latest&outputFormat=application/json&maxFeatures=2", J((d) => corta(JSON.stringify(d.features?.[0]?.properties), 220))],
  ["radmon", "https://radmon.org/radmon.php?function=lastreading&user=x", (t) => corta(t, 80)],
  ["emsc-ws-info", "https://www.seismicportal.eu/realtime.html", (t) => `${t.length} bytes · ws: ${corta((t.match(/wss?:\/\/[^"' ]+/) || [])[0], 80)}`],
  ["ioda-señales", `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${s - 86400}&until=${s}&entityType=country&entityCode=ES&limit=5`, J((d) => `claves ${Object.keys(d).join(",")} · ${corta(JSON.stringify(d.data), 200)}`)],
  ["cf-radar", "https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=3&format=json", (t) => corta(t, 160)],
  ["ntfy", "https://ntfy.sh/v1/health", (t) => corta(t, 60)],
  ["codeload", "https://raw.githubusercontent.com/nugguiesoft-stack/brujula/main/nas/VERSION", (t) => corta(t, 20)],
  ["proxy-worker", "https://brujula.nugguiesoft.workers.dev/", (t) => corta(t, 60)]
];
const soloIds = process.argv.slice(2);
const out = [];
async function una([id, url, sonda, opt = {}]) {
  const res = { id, url };
  for (const [quien, ua] of [["nas", UA_NAS], ["nav", UA_NAV]]) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), opt.flujo ? 8000 : 25000);
    try {
      const r = await fetch(url, { headers: { "User-Agent": ua, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8", Origin: "https://nugguiesoft-stack.github.io", ...(opt.flujo ? { Accept: "text/event-stream" } : {}) }, signal: ctl.signal, redirect: "follow" });
      res.http = r.status; res.tipo = (r.headers.get("content-type") || "").split(";")[0]; res.cors = r.headers.get("access-control-allow-origin") || "";
      if (r.url !== url) res.redir = r.url;
      if (opt.flujo) { const rd = r.body.getReader(); const { value } = await rd.read(); res.ok = r.ok; res.info = "flujo: " + corta(new TextDecoder().decode(value), 90); ctl.abort(); }
      else { const t = await r.text(); res.bytes = t.length; if (!r.ok) throw new Error("HTTP " + r.status + " · " + corta(t, 80)); res.info = sonda ? sonda(t) : corta(t, 80); res.ok = true; }
      res.ua = quien; break;
    } catch (e) { res.ok = false; res["err_" + quien] = corta(e.name === "AbortError" ? "tiempo agotado" : e.message, 140); }
    finally { clearTimeout(tm); }
  }
  return res;
}
const lista = F.filter((f) => !soloIds.length || soloIds.includes(f[0]));
for (let i = 0; i < lista.length; i += 6) out.push(...await Promise.all(lista.slice(i, i + 6).map(una)));
for (const r of out) console.log(`${r.ok ? "OK " : "MAL"} ${r.id.padEnd(22)} ${String(r.http ?? "-").padEnd(4)} ua=${r.ua || "-"} cors=${r.cors || "no"} ${r.tipo || ""} ${r.bytes ?? ""}b${r.redir ? " → " + r.redir : ""}\n      ${r.ok ? r.info : [r.err_nas && "nas: " + r.err_nas, r.err_nav && "nav: " + r.err_nav].filter(Boolean).join(" | ")}${r.ok && r.err_nas ? `\n      (con el identificador del NAS falla: ${r.err_nas})` : ""}`);
console.log(`\n${out.filter((r) => r.ok).length}/${out.length} responden.`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "| Fuente | ¿Responde? | CORS | Detalle |\n|---|---|---|---|\n" + out.map((r) => `| ${r.id} | ${r.ok ? "✅" : "❌ " + (r.http || "")} | ${r.cors || "—"} | ${(r.ok ? r.info : r.err_nas || r.err_nav || "").replace(/\|/g, "/").slice(0, 200)} |`).join("\n") + "\n");
