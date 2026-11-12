// Asturias, lo primero: los tres medios asturianos y lo que publique el 112 Asturias.
// Va en el grupo de sensores rápidos (cada 5 min): un suceso grave aquí es justo lo que más te importa y son tres consultas pequeñas.
// Si prefieres que vaya lento como el resto, quita «local» de RAPIDOS.
// Direcciones comprobadas el 12 nov 2026. El 112 Asturias no tiene canal RSS (solo web y X): se consulta vía Google Noticias, SIN VERIFICAR desde tu red.
import { senalesDe } from "../lib/titulares.js";
const MEDIOS = [
  ["El Comercio", "https://www.elcomercio.es/rss/2.0/?section=asturias"], ["La Nueva España", "https://www.lne.es/rss/"], ["RTPA", "https://www.rtpa.es/rss"]
];
export default {
  id: "local", nombre: "Asturias: prensa local y 112", cada: 5,
  async run(ctx) {
    const { pedir, rss, mem, clasifica } = ctx; const out = [], fallan = [];
    const res = await Promise.allSettled(MEDIOS.map(async ([n, u]) => ({ n, its: rss(await pedir(u, { timeout: 25000 })) })));
    res.forEach((r, i) => { if (r.status === "rejected" || !r.value.its.length) fallan.push(MEDIOS[i][0]); });
    for (const r of res) if (r.status === "fulfilled") out.push(...senalesDe(r.value.its, r.value.n, "prensa", ctx, { local: true })[0]);
    // 112 Asturias (web oficial) vía Google Noticias, como mucho cada 30 min
    let msg112 = "";
    if (Date.now() - (mem.base.local112 || 0) > 29 * 60000) {
      mem.base.local112 = Date.now();
      try {
        const it = rss(await pedir("https://news.google.com/rss/search?q=" + encodeURIComponent("site:112asturias.es when:1d") + "&hl=es&gl=ES&ceid=ES:es", { condicional: false }));
        for (const i of it) { if (Date.now() - Date.parse(i.date) > 12 * 36e5) continue; const k = clasifica(i.title); if (k.S < 3) continue;
          out.push({ clave: "112:" + (i.id || i.title), fuente: "112asturias", fuenteNombre: "112 Asturias", tipo: "oficial", tema: k.tema, S: k.S, lugar: k.lugar.nombre ? k.lugar : { nombre: "Asturias", zona: "asturias" }, titulo: i.title.replace(/\s+-\s+[^-]+$/, ""), url: i.url, desmiente: k.desmiente }); }
        msg112 = ` · 112 Asturias: ${it.length} notas`;
      } catch (e) { msg112 = " · 112 Asturias: " + e.message; }
    }
    const primera = !mem.base.localLista; mem.base.localLista = 1;
    if (fallan.length === MEDIOS.length) throw new Error("no responde ningún medio asturiano");
    return { senales: out, msg: `${MEDIOS.length - fallan.length}/${MEDIOS.length} medios asturianos · ${out.length} titulares graves${fallan.length ? " · fallan: " + fallan.join(", ") : ""}${msg112}`, silencioso: primera };
  }
};
