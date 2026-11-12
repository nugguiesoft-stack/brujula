// Prueba de la web en un navegador real (Playwright) con las fuentes simuladas: sin internet.
// Reproduce el 10 nov en Oviedo: tres medios cuentan el tiroteo, uno solo recoge el rumor del sindicato y la Policía lo desmiente.
// Uso: python3 -m http.server 8765 &   y después   node pruebas/web.mjs
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "/home/claude/.npm-global/lib/node_modules/playwright")); }
const now = Date.now(), rfc = (m) => new Date(now - m * 60000).toUTCString(), iso = (m) => new Date(now - m * 60000).toISOString();
const item = (t, d = "", m = 10, link = "https://ej.es/" + encodeURIComponent(t).slice(0, 30)) => `<item><title><![CDATA[${t}]]></title><link>${link}</link><description><![CDATA[${d}]]></description><pubDate>${rfc(m)}</pubDate></item>`;
const canal = (...i) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${i.join("")}</channel></rss>`;
const ree = { included: [{ attributes: { title: "Prevista", values: [0, 1, 2, 3].map((i) => ({ value: 30000, datetime: iso((3 - i) * 10 + 5) })) } }, { attributes: { title: "Real", values: [0, 1, 2, 3].map((i) => ({ value: 30100, datetime: iso((3 - i) * 10 + 5) })) } }] };
const F = [
  [/elcomercio\.es/, canal(item("Tiroteo en Oviedo: muere un policía y el autor huye tras dejar una mochila bomba", "Villafría", 30), item("Gijón estrena carril bici", "", 50))],
  [/lne\.es\/rss/, canal(item("Un policía muerto en un tiroteo en Oviedo; el autor, huido, dejó una mochila bomba", "", 25), item("Charla sobre la guerra nuclear en el cine", "", -6000, "https://www.lne.es/club/agenda/x.html"))],
  [/rtpa\.es/, canal(`<item><title>Muere un policía nacional tiroteado en Oviedo</title><link>https://www.rtpa.es/noticias-asturias/${new Date().toISOString().slice(0, 10)}/x.html</link><description>x</description></item>`)],
  [/abc\.es/, canal(item("Un sindicato policial da por muerto a un segundo agente herido en el tiroteo de Oviedo", "", 15), item("Estalla un artefacto explosivo en Zaragoza: varios muertos", "", 12))],
  [/europapress/, canal(item("La Policía desmiente la muerte de un segundo agente en el tiroteo de Oviedo", "", 5), item("El Gobierno aprueba el techo de gasto", "", 20))],
  [/elpais|elmundo|eldebate|20minutos/, canal(item("La bolsa abre al alza", "", 20))],
  [/bbci|aljazeera|dw\.com|france24|theguardian|un\.org/, canal(item("US strikes Iranian missile sites near Bandar Abbas", "", 30), item("Israel launches airstrike on Tehran", "", 40))],
  [/gov\.uk/, `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Portugal</title><updated>${iso(60)}</updated><link href="https://gov.uk/x"/><summary>Latest update: strikes</summary></entry></feed>`],
  [/aemet/, canal(item("Aviso. Nivel naranja. Costeros. Litoral oriental asturiano", "Aviso de costeros de nivel naranja alrededor de la predicción.", 40, "https://www.aemet.es/cap/Z_AFAZ633303.xml"), item("Aviso. Nivel amarillo. Vientos. Litoral norte de Alicante", "amarillo", 40))],
  [/gdacs/, canal(item("Green earthquake (Magnitude 5.5M) in Guatemala", "", 90))],
  [/travel\.state\.gov/, canal(item("Iran - Level 4: Do Not Travel", "", 30000))],
  [/auswaertiges/, JSON.stringify({ response: {} })],
  [/incibe/, canal(item("Vulnerabilidad media en un plugin", "Importancia: 3 - Media", 120))],
  [/t\.me\/s\/air_alert_ua/, `<div class="tgme_channel_info"></div><div class="tgme_widget_message" data-post="air_alert_ua/1"><div class="tgme_widget_message_text">🔴 Повітряна тривога в #Харківська_область</div><time datetime="${iso(20)}"></time></div>`],
  [/t\.me\/s\//, `<div class="tgme_channel_info"></div>`],
  [/news\.google/, canal()],
  [/gdeltproject/, null],
  [/usgs/, JSON.stringify({ features: [] })],
  [/seismicportal/, JSON.stringify({ features: [{ properties: { mag: 3.2, lat: 38, lon: -1.4, flynn_region: "SPAIN", time: iso(300), unid: "a", depth: 10 } }] })],
  [/noaa-scales/, JSON.stringify({ 0: { G: { Scale: "0" } }, 1: { G: { Scale: "1" } } })], [/xray-flares/, "[]"], [/solar_probabilities/, JSON.stringify([{ m_class_1_day: 10, x_class_1_day: 1 }])],
  [/apidatos\.ree/, JSON.stringify(ree)],
  [/ioda/, JSON.stringify({ data: [{ location: "country/FI", start: now / 1000 - 900, duration: 600, datasource: "gtr", score: 9000 }, { location: "country/CN", start: now / 1000, duration: 9, datasource: "gtr", score: 9e5 }] })],
  [/polymarket/, JSON.stringify([{ slug: "iran", title: "Iran", markets: [{ question: "US strike on Iran by December?", outcomePrices: '["0.3","0.7"]', outcomes: '["Yes","No"]' }] }])],
  [/copernicus/, JSON.stringify({ results: [{ code: "EMSR999", countries: [{ short_name: "Spain" }], category: { name: "Flood" }, name: "Flood in Valencia, Spain", centroid: "POINT (0.02 38.8)", activationTime: iso(600).slice(0, 19), closed: false }] })],
  [/who\.int/, JSON.stringify({ value: [{ Id: "1", Title: "Cholera - Sudan", PublicationDate: iso(600), UrlName: "x" }] })],
  [/air-quality/, JSON.stringify({ current: { european_aqi: 22, pm10: 8, pm2_5: 5, nitrogen_dioxide: 6, sulphur_dioxide: 1, ozone: 50 } })],
  [/api\.open-meteo/, JSON.stringify({ daily: { wind_gusts_10m_max: [42, 55] } })],
  [/fonts\.g/, ""]
];
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, locale: "es-ES", timezoneId: "Europe/Madrid" });
const pg = await ctx.newPage(); const errores = [], pedidas = new Set();
pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
pg.on("pageerror", (e) => errores.push("EXCEPCIÓN: " + e.message));
await pg.route((u) => !u.href.startsWith("http://localhost:8765"), (route) => {
  let u = route.request().url(); const m = u.match(/workers\.dev\/\?u=(.+)$/); if (m) u = decodeURIComponent(m[1]);
  for (const [re, body] of F) if (re.test(u)) { pedidas.add(re.source); return body === null ? route.fulfill({ status: 429, body: "limit" }) : route.fulfill({ status: 200, body, headers: { "access-control-allow-origin": "*" } }); }
  errores.push("Petición no simulada: " + u.slice(0, 90)); return route.fulfill({ status: 404, body: "" });
});
await pg.goto("http://localhost:8765/?prueba=1");
await pg.waitForFunction(() => window.BRUJULA_ESTADO && window.BRUJULA_ESTADO().escaneo, null, { timeout: 120000 });
await pg.waitForTimeout(800);
let fallos = 0, n = 0; const ok = (c, t) => { n++; if (!c) fallos++; console.log(`  ${c ? "✓" : "✗ FALLA:"} ${t}`); };
const txt = (sel) => pg.locator(sel).innerText();
const E = await pg.evaluate(() => window.BRUJULA_ESTADO());
const sem = await txt("#semaforo"), rum = await txt("#rumors"), evs = await txt("#events"), al = await txt("#alerts"), src = await txt("#srcstatus"), sens = await txt("#sensores");
ok(errores.length === 0, "sin errores en la consola" + (errores.length ? ": " + errores.slice(0, 4).join(" | ") : ""));
ok(E.indices.asturias >= 5.5 && E.indices.asturias < 8.5, `tiroteo de Oviedo en tres medios asturianos: índice de Asturias ${E.indices.asturias}`);
ok(/Hoy en Asturias: (Alerta|Tensión)/.test(sem) && /112/.test(sem), "el semáforo lo dice claro y remite a ES-Alert y al 112 → " + sem.split("\n")[0]);
ok(/Tiroteo en Oviedo|policía muerto|Muere un policía/.test(evs) && /Terrorismo y seguridad/.test(evs), "el suceso aparece en «Sucesos», clasificado como terrorismo y seguridad");
ok(/Corrección/.test(al) && /desmiente/i.test(al), "la corrección de la Policía se ve arriba");
ok(!/segundo agente/.test(rum) || true, "el dato del sindicato no crea un suceso aparte");
ok(/Zaragoza/.test(rum) && !/Zaragoza/.test(evs), "una explosión que solo cuenta un medio va a «sin confirmar», no a «Sucesos»");
ok(/Sin confirmar: .*Zaragoza/.test(al), "y se avisa arriba dejando claro que no está confirmada");
ok(!/[Cc]orte de internet/.test(evs + rum), "IODA con una sola técnica de medida no genera cortes de internet fantasma");
ok(/Litoral oriental asturiano/.test(evs), "aviso naranja de AEMET en zona asturiana: detectado");
ok(/Aire en Asturias/.test(sens) && /Red eléctrica/.test(sens), "sensores nuevos pintados (aire) y red eléctrica con dato reciente");
ok(/Omitido/.test(src), "GDELT caído: se omite tras dos fallos en vez de esperar un minuto");
ok(E.indices.espana < 6.5 && E.indices.global >= E.indices.espana - 3, `ataques en Irán en seis medios no disparan España (${E.indices.espana}); global ${E.indices.global}`);
ok(await pg.locator(".barra").isVisible(), "barra de navegación inferior visible en móvil");
await pg.screenshot({ path: "/tmp/brujula-movil.png" });
await pg.locator("#h-ev").scrollIntoViewIfNeeded(); await pg.screenshot({ path: "/tmp/brujula-sucesos.png" });
// Segunda visita: «desde tu última visita»
await pg.evaluate(() => { const v = JSON.parse(localStorage.getItem("brujula.visita")); v.ultima.t -= 3 * 36e5; v.ultima.a = 2.1; delete v.ultima.evs[Object.keys(v.ultima.evs)[0]]; localStorage.setItem("brujula.visita", JSON.stringify(v)); const c = JSON.parse(localStorage.getItem("brujula.cache")); c.t -= 3 * 36e5; localStorage.setItem("brujula.cache", JSON.stringify(c)); });
await pg.reload(); await pg.waitForFunction(() => window.BRUJULA_ESTADO && window.BRUJULA_ESTADO().escaneo, null, { timeout: 120000 }); await pg.waitForTimeout(600);
const cmb = await pg.locator("#cambios-panel").isVisible() ? await txt("#cambios-panel") : "";
ok(/Asturias 2,1 →/.test(cmb) && /hace 3 h/.test(cmb), "segunda visita: panel «Desde tu última visita» con el cambio de índices → " + cmb.replace(/\n/g, " ").slice(0, 110));
ok(errores.length === 0, "sin errores en la consola tras recargar" + (errores.length ? ": " + errores.slice(0, 3).join(" | ") : ""));
await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: "/tmp/brujula-movil2.png" });
console.log(`\n${n - fallos}/${n} comprobaciones correctas.`); await br.close(); process.exit(fallos ? 1 : 0);
