// Brújula · agente del NAS. Vigila fuentes primarias sin parar y avisa al móvil antes que los medios.
// Pensado para 1 GB de RAM: un solo proceso, sin dependencias, memoria limitada.
import fs from "node:fs";
import { CFG, DATA } from "./lib/config.js";
import { pedir } from "./lib/http.js";
import { rss } from "./lib/xml.js";
import { km, sleep, log, hora, horaLocal, madrid } from "./lib/util.js";
import { clasifica, lugar, zonaDe, ALARMA } from "./lib/clasifica.js";
import { mem, base, historial, guardar } from "./lib/store.js";
import { avisar, retenidos, NIVEL, enSilencio } from "./lib/avisar.js";
import { procesar, indices, vigilarIndices, top, confirmado, QUE_HACER } from "./lib/motor.js";
import { escuchar, apagado, silenciado, temaControl } from "./lib/control.js";

const INICIO = Date.now();
const ESTADO = {};                      // estado por módulo: ok/err, mensaje, última vez
const ctxBase = { pedir, rss, km, zonaDe, lugar, clasifica, ALARMA, CFG, madrid, mem, base, historial, log, sleep, procesar };

// Carga de módulos: cada fichero de ./modulos es una fuente. Añadir una fuente = añadir un fichero.
const MODS = [];
for (const f of fs.readdirSync(new URL("./modulos/", import.meta.url)).filter((x) => x.endsWith(".js")).sort()) {
  try { const m = (await import("./modulos/" + f)).default; if (!CFG.desactivar.includes(m.id)) MODS.push({ ...m, prox: 0, fallos: 0 }); }
  catch (e) { log("No carga", f, e.message); }
}
log(`Brújula NAS ${CFG.version} · ${MODS.length} módulos · avisos: ${CFG.ntfyTopic ? "ntfy" : ""}${CFG.telegramToken ? " telegram" : ""}${CFG.ntfyTopic || CFG.telegramToken ? "" : "NINGUNO (configura NTFY_TOPIC)"}`);

async function ejecutar(m) {
  const E = (ESTADO[m.id] ||= { nombre: m.nombre, ok: null, msg: "", ultima: 0, desde: Date.now(), avisadoCaida: false, ejecuciones: 0 });
  const primera = !mem.base["arrancado:" + m.id];
  try {
    const r = await Promise.race([m.run({ ...ctxBase }), sleep(90000).then(() => { throw new Error("tarda demasiado (90 s)"); })]);
    const sen = (r?.senales || []).map((s) => ({ ...s, modulo: m.id }));
    await procesar(sen, { calentar: primera || r?.silencioso });
    if (!E.ok) E.desde = Date.now();
    Object.assign(E, { ok: true, msg: r?.msg || "", ultima: Date.now(), avisadoCaida: false, datos: r?.datos }); E.ejecuciones++; m.fallos = 0;
    mem.base["arrancado:" + m.id] = 1;
  } catch (e) {
    if (E.ok !== false) E.desde = Date.now();
    Object.assign(E, { ok: false, msg: e.message, ultima: Date.now() }); m.fallos++;
    log(`✗ ${m.id}: ${e.message}`);
    if (!E.avisadoCaida && Date.now() - E.desde > 2 * 36e5 && Date.now() - INICIO > 2 * 36e5) {
      E.avisadoCaida = true;
      await avisar({ nivel: 1, forzar: false, sistema: true, titulo: `Fuente caída: ${m.nombre}`, texto: `Lleva más de 2 h fallando: ${e.message}. Sigo con las demás.` });
    }
  }
  // Si falla, espera más antes de reintentar (máx. ×6)
  // Sensores rápidos (terremotos, tsunamis, apagón) a su ritmo; el resto cada 30 min de día y cada hora de noche
  const cada = CFG.rapidos.includes(m.id) ? m.cada : Math.max(m.cada, enSilencio() ? CFG.intervaloNoche : CFG.intervaloDia);
  m.prox = Date.now() + cada * 60000 * CFG.ritmo * Math.min(6, 1 + m.fallos);
}

// Módulos continuos (Wikipedia en directo): conexión permanente aparte
for (const m of MODS.filter((x) => x.continuo)) {
  const E = (ESTADO[m.id] = { nombre: m.nombre, ok: null, msg: "conectando", ultima: Date.now(), desde: Date.now() });
  m.run({ ...ctxBase, estado: (ok, msg) => Object.assign(E, { ok: ok === "ok", msg, ultima: Date.now() }), procesar: (s) => (apagado() ? 0 : procesar(s.map((x) => ({ ...x, modulo: m.id })))) })
    .catch((e) => Object.assign(E, { ok: false, msg: e.message }));
}

// --- Estado para la web y para el diagnóstico ---
function estadoJSON() {
  const mu = process.memoryUsage();
  return {
    version: CFG.version, apagado: apagado(), silencio: silenciado(), generado: new Date().toISOString(), arranque: new Date(INICIO).toISOString(),
    memoriaMB: Math.round(mu.rss / 1048576), indices: indices(), top: top(6), queHacer: QUE_HACER,
    alertas: mem.alertas.filter((a) => !a.sistema).slice(-25).reverse(),
    temas: Object.values(mem.temas).filter((t) => Date.now() - t.ultimo < 24 * 36e5 && (t.nivel >= 1.5 || t.desmentido)).sort((a, b) => b.ultimo - a.ultimo).slice(0, 20)
      .map((t) => ({ titulo: t.titulo, url: t.url, nivel: t.nivel, conf: Math.round(t.conf * 100) / 100, S: t.maxS, lugar: t.lugar, zona: t.zona, tema: t.tema, fuentes: Object.keys(t.fuentes).length, primero: t.primero, ultimo: t.ultimo,
        confirmado: confirmado(t), ...(t.desmentido ? { desmentido: t.desmentido } : {}), ...(t.retirado ? { retirado: true } : {}),
        // línea temporal del suceso: quién dijo qué y cuándo (lo usa la web)
        pasos: (t.senales || []).slice(-8).map((x) => ({ t: x.t, fuente: x.fuente, titulo: (x.titulo || "").slice(0, 160), url: x.url, ...(x.desmiente ? { desmiente: true } : {}), ...(x.atribuido ? { atribuido: true } : {}) })) })),
    fuentes: Object.entries(ESTADO).map(([id, e]) => ({ id, nombre: e.nombre, ok: e.ok, msg: (e.msg || "").slice(0, 200), ultima: e.ultima, datos: e.datos })),
    historial: { asturias: mem.hist["idx:asturias"]?.slice(-48), espana: mem.hist["idx:espana"]?.slice(-48), global: mem.hist["idx:global"]?.slice(-48) }
  };
}
let ultimoGist = 0;
async function publicar() {
  const est = estadoJSON(); const txt = JSON.stringify(est);
  try { fs.writeFileSync(DATA + "/estado.json.tmp", txt); fs.renameSync(DATA + "/estado.json.tmp", DATA + "/estado.json"); } catch (e) { log("estado.json:", e.message); }
  // Gist: la web lo lee para mostrar lo que ve el NAS (opcional)
  if (CFG.gistId && CFG.githubToken && Date.now() - ultimoGist > 5 * 60000 && !CFG.mock) {
    ultimoGist = Date.now();
    try {
      const r = await fetch("https://api.github.com/gists/" + CFG.gistId, { method: "PATCH", headers: { Authorization: "Bearer " + CFG.githubToken, Accept: "application/vnd.github+json", "User-Agent": "brujula-nas" }, body: JSON.stringify({ files: { "brujula-nas.json": { content: txt } } }) });
      if (!r.ok) log("Gist HTTP", r.status);
    } catch (e) { log("Gist:", e.message); }
  }
  if (CFG.healthcheck && !CFG.mock) fetch(CFG.healthcheck).catch(() => {});
}

// --- Autodiagnóstico al arrancar: te llega un aviso con qué funciona y qué no ---
async function autodiagnostico() {
  const frio = MODS.some((m) => !m.continuo && !mem.base["arrancado:" + m.id]);
  const per = MODS.filter((m) => !m.continuo);
  await Promise.allSettled(per.map((m) => ejecutar(m)));
  const ok = per.filter((m) => ESTADO[m.id]?.ok), mal = per.filter((m) => !ESTADO[m.id]?.ok);
  const I = indices();
  const texto = [`Fuentes funcionando: ${ok.length}/${per.length}.`, mal.length ? "Fallan: " + mal.map((m) => `${m.nombre} (${ESTADO[m.id].msg.slice(0, 60)})`).join("; ") + "." : "Todas responden.",
    `Índices ahora: Asturias ${I.asturias} · España ${I.espana} · Global ${I.global}.`, `Memoria usada: ${Math.round(process.memoryUsage().rss / 1048576)} MB.`,
    temaControl() ? "Mando a distancia: usa los botones de este aviso o escribe «apaga», «enciende», «silencio» o «estado» en el tema " + temaControl() + "." : "",
    frio ? "Primer arranque: lo que ya estaba pasando no te lo aviso (salvo emergencias); solo lo nuevo a partir de ahora." : ""].filter(Boolean).join("\n");
  log(texto.replace(/\n/g, " | "));
  await avisar({ nivel: 1, forzar: true, sistema: true, titulo: `Brújula NAS ${CFG.version} en marcha`, texto });
}

// --- Resumen diario ---
let ultimoResumen = mem.base.ultimoResumen || "";
async function resumen() {
  if (!CFG.resumen) return; const [h, mi] = CFG.resumen.split(":").map(Number); const [ah, am] = horaLocal();
  const hoy = new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  if (ultimoResumen === hoy || ah * 60 + am < h * 60 + (mi || 0)) return;
  ultimoResumen = mem.base.ultimoResumen = hoy; guardar();
  const I = indices(), ret = retenidos(), dia = mem.alertas.filter((a) => !a.sistema && !a.previo && Date.now() - a.t < 864e5);
  const caidas = Object.values(ESTADO).filter((e) => e.ok === false).map((e) => e.nombre);
  const texto = [`Asturias ${I.asturias} · España ${I.espana} · Global ${I.global}`,
    dia.length ? `Últimas 24 h: ${dia.length} aviso(s). ` + dia.slice(-5).map((a) => `${NIVEL[a.nivel]?.ico || ""} ${a.titulo}`).join(" · ") : "Últimas 24 h: sin avisos.",
    ret.length ? `Retenidos por la noche o por exceso (${ret.length}): ` + ret.slice(-6).map((a) => a.titulo).join(" · ") : "",
    "Lo más relevante: " + (top(3).join(" · ") || "nada destacable"), caidas.length ? "Fuentes con problemas: " + caidas.join(", ") : ""].filter(Boolean).join("\n");
  await avisar({ nivel: 1, forzar: true, sistema: true, titulo: "Resumen del día", texto });
}

// --- Autoactualización: si hay versión nueva en GitHub, se reinicia y Docker descarga el código nuevo ---
async function actualizar() {
  if (CFG.mock) return;
  try {
    const v = (await pedir(`https://raw.githubusercontent.com/${CFG.repo}/main/nas/VERSION`, { condicional: false })).trim();
    if (v && v !== CFG.version && /^\d+\.\d+\.\d+$/.test(v)) {
      log("Nueva versión", v, "→ reinicio para actualizar"); guardar(true);
      await avisar({ nivel: 1, forzar: true, sistema: true, titulo: `Actualizando la Brújula NAS a ${v}`, texto: `Versión actual ${CFG.version}. Vuelvo en un minuto.` });
      await sleep(3000); process.exit(0);
    }
  } catch (e) { log("Comprobar versión:", e.message); }
}

// --- Mando a distancia (tema de control de ntfy) ---
function lineaEstado() {
  const ok = Object.values(ESTADO).filter((e) => e.ok).length, I = indices();
  return [apagado() ? "Estado: ⏸ APAGADO" : silenciado() ? "Estado: 🔕 vigilando en silencio (solo emergencias)" : "Estado: ▶ vigilando",
    `Fuentes OK: ${ok}/${Object.keys(ESTADO).length} · Memoria ${Math.round(process.memoryUsage().rss / 1048576)} MB`,
    `Índices: Asturias ${I.asturias} · España ${I.espana} · Global ${I.global}`].join("\n");
}
escuchar(async (r) => avisar({ nivel: 1, forzar: true, sistema: true, titulo: "Brújula NAS", texto: (r ? r + "\n\n" : "") + lineaEstado() }));
if (temaControl()) log("Mando a distancia: escribe en el tema «" + temaControl() + "»");

// --- Bucle principal ---
process.on("unhandledRejection", (e) => log("Error no controlado:", e?.message || e));
process.on("SIGTERM", () => { guardar(true); setTimeout(() => process.exit(0), 2500); });
await autodiagnostico(); await vigilarIndices(); await publicar();
if (process.argv.includes("--una-vez")) { await sleep(2500); console.log(JSON.stringify(estadoJSON(), null, 1).slice(0, 4000)); process.exit(0); }
let ultimaAct = Date.now(), ultimaPub = Date.now(), estabaApagado = apagado();
for (;;) {
  await sleep(30000);
  if (estabaApagado && !apagado()) await avisar({ nivel: 1, forzar: true, sistema: true, titulo: "Brújula NAS: vuelvo a vigilar", texto: lineaEstado() });
  estabaApagado = apagado();
  if (apagado()) { if (Date.now() - ultimaPub > 10 * 60000) { ultimaPub = Date.now(); await publicar(); } continue; }
  const toca = MODS.filter((m) => !m.continuo && Date.now() >= m.prox);
  for (const m of toca) await ejecutar(m);   // de uno en uno: menos memoria y menos ráfagas de red
  if (toca.length) await vigilarIndices();
  if (Date.now() - ultimaPub > 10 * 60000) { ultimaPub = Date.now(); await publicar(); }
  await resumen();
  if (Date.now() - ultimaAct > 6 * 36e5) { ultimaAct = Date.now(); await actualizar(); }
}
