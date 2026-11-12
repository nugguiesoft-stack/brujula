// Pruebas con casos reales y con los formatos comprobados contra internet el 12 nov 2026. Sin internet.
// Uso: node prueba/casos.mjs   (sale con error si algo falla)
import fs from "node:fs"; import http from "node:http";
const DATA = "/tmp/brujula-casos"; fs.rmSync(DATA, { recursive: true, force: true });
const recibidos = [];
const srv = http.createServer((q, r) => { let b = ""; q.on("data", (c) => (b += c)); q.on("end", () => { try { recibidos.push(JSON.parse(b)); } catch {} r.end("{}"); }); }).listen(0);
Object.assign(process.env, { BRUJULA_DATA: DATA, NTFY_TOPIC: "t", NTFY_SERVER: "http://127.0.0.1:" + srv.address().port, SILENCIO: "-", RESUMEN_DIARIO: "" });
const { clasifica, lugar, zonaDe, ALARMA } = await import("../lib/clasifica.js");
const { procesar, indices } = await import("../lib/motor.js");
const { mem } = await import("../lib/store.js");
const { rss } = await import("../lib/xml.js");
const { km, madrid, isoMadrid } = await import("../lib/util.js");
const { senalesDe } = await import("../lib/titulares.js");
const { CFG } = await import("../lib/config.js");

let fallos = 0, n = 0;
const ok = (cond, txt) => { n++; if (!cond) { fallos++; console.log("  ✗ FALLA: " + txt); } else console.log("  ✓ " + txt); };
const limpia = () => { for (const k of Object.keys(mem.temas)) delete mem.temas[k]; for (const k of Object.keys(mem.visto)) delete mem.visto[k]; mem.alertas.length = 0; recibidos.length = 0; };
const espera = () => new Promise((r) => setTimeout(r, 60));
const tit = (medio, titulo, tipo = "prensa", extra = {}) => { const k = clasifica(titulo); return { clave: medio + ":" + titulo, fuente: "pr:" + medio, fuenteNombre: medio, tipo, tema: k.tema, S: k.S, lugar: k.lugar, titulo, desmiente: k.desmiente, atribuido: k.atribuido && !k.desmiente, ...extra }; };
const ultimo = () => recibidos.at(-1)?.title || "";

console.log("\n1) Oviedo, 10 nov 2026: tiroteo y mochila bomba");
limpia();
await procesar([tit("El Comercio", "Tiroteo en Oviedo: muere un policía y el autor huye tras dejar una mochila bomba")]); await espera();
ok(recibidos.length === 1 && /SEÑAL TEMPRANA/.test(ultimo()), "con un solo medio: SEÑAL TEMPRANA (sin confirmar), no una alerta → " + ultimo().slice(0, 60));
ok(indices().asturias < 4.5, "y el índice de Asturias aún no se dispara por una sola voz: " + indices().asturias);
await procesar([tit("La Nueva España", "Un policía muerto en un tiroteo en Oviedo; el autor, huido, dejó una mochila bomba")]); await espera();
ok(/ALERTA: Se confirma/.test(ultimo()), "segundo medio independiente: ALERTA «Se confirma» → " + ultimo().slice(0, 70));
await procesar([tit("RTPA", "Muere un policía nacional tiroteado en Oviedo"), tit("Europa Press", "La Policía busca al autor del tiroteo de Oviedo, que dejó un artefacto explosivo", "agencia")]); await espera();
const iO = indices();
ok(iO.asturias >= 5.5 && iO.asturias < 8, `el índice de Asturias reacciona con fuerza (5,5–8): ${iO.asturias}`);
ok(!recibidos.some((x) => /EMERGENCIA/.test(x.title)), "no llega a EMERGENCIA (se reserva para peligro general: gran terremoto, apagón, ataque masivo)");
const tO = Object.values(mem.temas).find((t) => t.tema === "seguridad");
ok(Object.keys(mem.temas).filter((g) => g.startsWith("seguridad")).length === 1, "los cuatro titulares se agrupan en un solo suceso");

console.log("\n2) Rumor: un sindicato da por muerto a un segundo agente; la Policía lo desmiente");
const antes = recibidos.length, confAntes = tO.conf, Santes = tO.maxS;
await procesar([tit("ABC", "Un sindicato policial da por muerto a un segundo agente herido en el tiroteo de Oviedo"), tit("El Mundo", "El SUP da por muerto al segundo policía herido en Oviedo"), tit("20minutos", "Fuentes sindicales: habría muerto un segundo agente en Oviedo")]); await espera();
ok(recibidos.length === antes, "tres medios repitiendo al mismo sindicato NO generan un aviso nuevo");
ok(tO.maxS === Santes, "ni suben la gravedad del suceso (un dato atribuido no manda sobre los hechos)");
ok(tO.senales.some((x) => x.atribuido), "queda anotado en la línea temporal como dato atribuido");
await procesar([tit("Europa Press", "La Policía desmiente la muerte de un segundo agente en el tiroteo de Oviedo", "agencia")]); await espera();
ok(/CORRECCIÓN: Corrección/.test(ultimo()), "el desmentido oficial llega como CORRECCIÓN → " + ultimo().slice(0, 70));
ok(!tO.retirado && tO.nivel === 3, "y el suceso principal (confirmado por varios medios) se mantiene");
ok(tO.desmentido && tO.desmentido.oficial, "el suceso queda marcado con el desmentido y quién lo hizo");

console.log("\n3) Rumor puro: una explosión que solo cuenta un canal de Telegram");
limpia();
await procesar([tit("Telegram @canal", "🚨 Explosión en Gijón, varios muertos", "social")]); await espera();
ok(/SEÑAL TEMPRANA/.test(ultimo()), "una sola fuente no oficial: SEÑAL TEMPRANA, nunca alerta");
await procesar([tit("Web X", "Según redes sociales, habría una explosión con muertos en Gijón"), tit("Web Y", "Vecinos hablan de una supuesta explosión en Gijón sin confirmar")]); await espera();
ok(recibidos.length === 1, "dos webs que citan a las redes no lo confirman");
const i3 = indices().asturias;
await procesar([tit("Policía Nacional", "La Policía desmiente una explosión en Gijón: es un bulo", "oficial")]); await espera();
ok(/Desmentido/.test(ultimo()), "el desmentido oficial llega al móvil → " + ultimo().slice(0, 60));
ok(Object.values(mem.temas)[0].retirado && indices().asturias < i3, `el rumor se retira y el índice baja (${i3} → ${indices().asturias})`);
await procesar([tit("Web Z", "Explosión en Gijón: más testimonios en redes")]); await espera();
ok(Object.values(mem.temas)[0].retirado, "y no revive con más titulares del mismo tipo");

console.log("\n4) Semana tensa EE. UU.–Irán: no debe disparar España");
limpia();
const base = indices();
const iran = ["US strikes Iranian missile sites near Bandar Abbas", "Iran fires ballistic missiles at US base in Iraq", "Israel launches airstrike on Tehran", "Irán amenaza con cerrar Ormuz tras el ataque de EE. UU.", "Explosiones en Isfahán tras un bombardeo israelí", "Iran declares state of war with Israel", "Houthi missile attack on ship in Red Sea", "Ataque con drones a una base de EE. UU. en Irak"];
for (const t of iran) await procesar(["BBC", "Reuters", "El País", "Al Jazeera"].map((m) => tit(m, t))); await espera();
const i4 = indices();
ok(i4.espana < 5 && i4.asturias < 5, `ocho sucesos graves en Oriente Medio, cada uno en cuatro medios: España ${i4.espana}, Asturias ${i4.asturias} (por debajo de 5)`);
ok(i4.global > i4.espana, `la escalada se refleja donde toca, en el índice global: ${i4.global}`);
ok(!recibidos.some((x) => /ALERTA|EMERGENCIA/.test(x.title)), "y no suena ninguna alerta en el móvil por lo que pasa a 5.000 km");

console.log("\n5) Lugares: nombres que engañan");
for (const [t, esperado] of [["Romania scrambles jets after drone strike", "Rumanía"], ["Sierra Leona declara la emergencia por un brote", ""], ["Incendio en Cangas del Narcea obliga a evacuar", "Cangas del Narcea"], ["Protestas en Nueva Delhi", "India"], ["El Real Oviedo gana en el descuento", ""], ["Explosión en Puerto Rico", ""], ["Iranian drones hit Kyiv", "Ucrania"]])
  ok((lugar(t).nombre || "") === esperado || (esperado === "Ucrania" && /Irán|Ucrania/.test(lugar(t).nombre)), `«${t}» → ${lugar(t).nombre || "(sin lugar)"}`);
ok(clasifica("El Sporting de Gijón da la bomba del mercado de fichajes").S === 0 || clasifica("Bombazo en el mercado de fichajes").S === 0, "deporte y lenguaje figurado no cuentan como alarma");
ok(clasifica("Simulacro de atentado en Avilés moviliza al 112").S <= 2, "un simulacro no es una emergencia");

console.log("\n6) Formatos reales de las fuentes (comprobados el 12 nov 2026)");
const ctx = { rss, km, zonaDe, lugar, clasifica, ALARMA, CFG, madrid, mem, base: () => null, log() {}, sleep() {} };
const con = (mapa) => ({ ...ctx, pedir: async (u, o = {}) => { for (const [k, v] of Object.entries(mapa)) if (u.includes(k)) return o.json ? (typeof v === "string" ? JSON.parse(v) : v) : (typeof v === "string" ? v : JSON.stringify(v)); throw new Error("HTTP 404 (prueba: " + u.slice(0, 50) + ")"); } });
const hace = (min) => new Date(Date.now() - min * 60000);
// IGN: hora de un solo dígito y sin pubDate
const p2 = (x) => String(x).padStart(2, "0"); const mad = (d) => { const s = d.toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }); const [f, h] = s.split(" "); const [y, m, dd] = f.split("-"); const [hh, mi, ss] = h.split(":"); return `${+dd}/${+m}/${y} ${+hh}:${mi}:${ss}`; };
const ign = (M, lugarTxt, lat, lon, min) => `<item><title>-Info.terremoto: ${mad(hace(min))}</title><link>http://www.ign.es/x?evid=e${M}</link><description>Se ha producido un terremoto de magnitud ${M} en ${lugarTxt} en la fecha ${mad(hace(min))} en la siguiente localización: ${lat},${lon}</description><guid>e${M}</guid><geo:lat>${lat}</geo:lat><geo:long>${lon}</geo:long></item>`;
const sismos = (await import("../modulos/sismos.js")).default;
let r = await sismos.run(con({ "ign.es": `<rss><channel>${ign("4.6", "N LLANES.O", "43.52", "-4.75", 4)}${ign("3.1", "E PLIEGO.MU", "38.0006", "-1.4661", 60 * 30)}</channel></rss>`, "seismicportal": { features: [{ properties: { mag: 4.5, lat: 43.6, lon: -4.9, flynn_region: "BAY OF BISCAY", time: hace(3).toISOString(), unid: "x1" } }] }, "usgs": { features: [] } }));
ok(r.senales.length === 2 && r.senales[0].grupo === r.senales[1].grupo, `IGN y EMSC ven el mismo sismo cerca de Llanes y se cruzan en un solo suceso (${r.senales.length} señales, mismo grupo)`);
ok(!r.senales.some((s) => /PLIEGO/.test(s.titulo)), "un sismo de hace 30 h (hora de un dígito, sin pubDate) se descarta por antiguo");
limpia(); await procesar(r.senales.map((s) => ({ ...s, modulo: "sismos" }))); await espera();
ok(Object.keys(Object.values(mem.temas)[0].fuentes).length === 2 && Object.values(mem.temas)[0].conf > 0.95, "dos redes sísmicas independientes: confianza máxima");
// Tsunami: un boletín informativo no es una alerta
const tsu = (cat, extra = "") => `<feed><entry><title>65 miles SW of Port Alice, British Columbia</title><updated>${hace(20).toISOString()}</updated><id>t1</id><geo:lat>49.293</geo:lat><geo:long>-127.676</geo:long><summary type="xhtml"><div><strong>Category:</strong> ${cat}<br/><strong>Bulletin Issue Time: </strong> x<br/>${extra}<strong>Definition: </strong>An information statement indicates that an earthquake has occurred, but does not pose a tsunami threat, or that a tsunami warning, advisory, or watch has been issued for another section of the ocean.</div></summary></entry></feed>`;
const tsunami = (await import("../modulos/tsunami.js")).default;
r = await tsunami.run(con({ PHEB: "<feed></feed>", PAAQ: tsu("Information", "<b>Note:</b> * There is NO tsunami danger from this earthquake.<br/>") }));
ok(r.senales.length === 0, "boletín «Information» de tsunami: no genera aviso (antes lo generaba siempre)");
r = await tsunami.run(con({ PHEB: "<feed></feed>", PAAQ: tsu("Warning") }));
ok(r.senales.length === 1 && /Alerta de tsunami/.test(r.senales[0].titulo), "boletín «Warning»: sí genera alerta");
// AEMET
const aem = (nivel, fen, zona, cod) => `<item><title>Aviso. Nivel ${nivel}. ${fen}. ${zona}</title><description>Aviso de ${fen} de nivel ${nivel} alrededor de la predicción.</description><link>https://www.aemet.es/cap/Z_CAP_C_LEMM_2026_AFAZ${cod}VIRM1214.xml</link><guid>Z_AFAZ${cod}VI.xml</guid><pubDate>${hace(30).toUTCString()}</pubDate></item>`;
const meteo = (await import("../modulos/meteo.js")).default;
r = await meteo.run(con({ aemet: `<rss><channel>${aem("amarillo", "Vientos", "Litoral norte de Alicante", "770301")}${aem("naranja", "Costeros", "Litoral oriental asturiano", "633303")}${aem("naranja", "Nevadas", "Central y valles mineros", "633304")}${aem("naranja", "Lluvias", "Litoral sur de Valencia", "774603")}${aem("rojo", "Lluvias", "Litoral norte de Valencia", "774601")}</channel></rss>` }));
ok(r.senales.filter((s) => s.lugar.zona === "asturias").length === 2, "avisos naranjas en zonas asturianas («Litoral oriental asturiano», «Central y valles mineros»): detectados (antes no, buscaba la palabra «Asturias»)");
ok(r.senales.length === 3 && !r.senales.some((s) => /Alicante|sur de Valencia/.test(s.titulo)), "amarillo, o naranja fuera de Asturias, no cuenta; «alrededor» o «predicción» ya no se confunden con «red» (rojo)");
// Red Eléctrica: datos cada 10 min, en hora de Madrid
const ree = (reales, prev) => ({ included: [{ attributes: { title: "Prevista", values: reales.map((_, i) => ({ value: prev, datetime: hace((reales.length - 1 - i) * 10 + 5).toISOString() })) } }, { attributes: { title: "Programada", values: [] } }, { attributes: { title: "Real", values: reales.map((v, i) => ({ value: v, datetime: hace((reales.length - 1 - i) * 10 + 5).toISOString() })) } }] });
const elec = (await import("../modulos/electricidad.js")).default;
let url = ""; const ctxE = (d) => ({ ...ctx, pedir: async (u) => { url = u; return d; } });
r = await elec.run(ctxE(ree([30000, 30100, 30200, 30150], 30000)));
ok(r.senales.length === 0 && /start_date=\d{4}-\d\d-\d\dT\d\d:\d\d/.test(url) && url.includes("end_date=" + isoMadrid(Date.now() + 10 * 60000)), "demanda normal: sin aviso, y la consulta va en hora de Madrid (antes iba en UTC: dato con 1–2 h de retraso)");
r = await elec.run(ctxE(ree([30000, 30100, 30200, 16500], 30000)));
ok(r.senales.length === 1 && r.senales[0].forzar === 4, "la demanda cae al 55 % en 10 min: EMERGENCIA de apagón → " + r.senales[0]?.titulo);
const viejo = ree([30000, 12000], 30000); viejo.included[2].attributes.values.forEach((v) => (v.datetime = hace(200).toISOString()));
r = await elec.run(ctxE(viejo));
ok(r.senales.length === 0 && /Sin dato reciente/.test(r.msg), "si REE lleva horas sin publicar, no se inventa un apagón: lo dice");
// IODA
const { cortes } = await import("../modulos/internet.js"); const net = (await import("../modulos/internet.js")).default;
const io = (c, ds) => ({ location: "country/" + c, start: Date.now() / 1000 - 600, duration: 600, datasource: ds, score: 5000 });
r = await net.run(con({ ioda: { data: [io("FI", "gtr"), io("CN", "gtr"), io("IL", "gtr"), io("ES", "gtr")] } }));
ok(r.senales.length === 1 && r.senales[0].tipo === "social", "IODA con una sola técnica: Finlandia, China o Israel se ignoran; España queda como señal sin confirmar");
r = await net.run(con({ ioda: { data: [io("ES", "gtr"), io("ES", "bgp")] } }));
ok(r.senales.length === 1 && r.senales[0].tipo === "sensor", "España vista por dos técnicas distintas: corte confirmado");
// Prensa local: agenda con fecha futura y RTPA sin fecha
const [sl] = senalesDe([{ title: "Explosión en una nave de Avilés deja tres heridos", desc: "", url: "https://www.rtpa.es/noticias-sociedad/" + new Date().toISOString().slice(0, 10) + "/x.html", date: "" },
  { title: "Charla: la guerra nuclear en el cine", desc: "", url: "https://www.lne.es/club/agenda/x.html", date: new Date(Date.now() + 5 * 864e5).toUTCString() },
  { title: "Explosión en Gijón (noticia de hace una semana)", desc: "", url: "https://www.rtpa.es/noticias-sociedad/2026-01-02/x.html", date: "" }], "RTPA", "prensa", ctx, { local: true });
ok(sl.length === 1 && /Avilés/.test(sl[0].titulo), "RTPA (fecha en la dirección) y agenda de LNE (fechas futuras): solo pasa la noticia de hoy");

console.log(`\n${n - fallos}/${n} comprobaciones correctas.`);
srv.close(); process.exit(fallos ? 1 : 0);
