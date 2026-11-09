// Prensa y agencias leídas directamente (sin Google): solo titulares nuevos que hablen de algo grave.
// Varios medios distintos sobre lo mismo = confirmación.
const MEDIOS = [
  ["Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=94", "agencia"], ["ABC · Última hora", "https://www.abc.es/rss/feeds/abc_ultima.xml", "prensa"],
  ["El País", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "prensa"], ["El Mundo", "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", "prensa"],
  ["20minutos", "https://www.20minutos.es/rss/", "prensa"], ["El Debate", "https://www.eldebate.com/rss/home.xml", "prensa"],
  ["El Comercio", "https://www.elcomercio.es/rss/2.0/portada", "prensa"], ["La Nueva España", "https://www.lne.es/rss/", "prensa"],
  ["BBC", "https://feeds.bbci.co.uk/news/world/rss.xml", "prensa"], ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "prensa"],
  ["The Guardian", "https://www.theguardian.com/world/rss", "prensa"], ["DW", "https://rss.dw.com/rdf/rss-sp-all", "prensa"],
  ["France 24", "https://www.france24.com/es/rss", "prensa"], ["ONU Noticias", "https://news.un.org/feed/subscribe/es/news/all/rss.xml", "oficial"]
];
export default {
  id: "prensa", nombre: "Prensa y agencias (directo)", cada: 5,
  async run({ pedir, rss, clasifica, ALARMA, mem }) {
    const out = [], fallan = []; let leidos = 0, nuevos = 0;
    const res = await Promise.allSettled(MEDIOS.map(async ([n, u, tipo]) => ({ n, tipo, its: rss(await pedir(u, { timeout: 25000 })) })));
    res.forEach((r, i) => { if (r.status === "rejected" || !r.value.its.length) fallan.push(MEDIOS[i][0]); });
    const primera = !mem.base.prensaLista;
    for (const r of res) {
      if (r.status !== "fulfilled") continue;
      for (const it of r.value.its) {
        leidos++; const t = Date.parse(it.date); if (t && Date.now() - t > 6 * 36e5) continue;
        const txt = it.title + ". " + (it.desc || "").slice(0, 200); const k = clasifica(txt);
        const umbral = k.lugar.zona === "asturias" ? 3 : k.lugar.zona === "espana" ? 4 : 5; if (k.S < umbral) continue;
        nuevos++;
        out.push({ clave: "pr:" + (it.id || it.url || it.title), fuente: "pr:" + r.value.n, fuenteNombre: r.value.n, tipo: r.value.tipo, tema: k.tema,
          S: Math.min(10, k.S + (ALARMA.test(it.title) ? 1 : 0)), lugar: k.lugar, titulo: it.title, url: it.url, detalle: (it.desc || "").slice(0, 280) });
      }
    }
    mem.base.prensaLista = 1;
    return { senales: out, msg: `${MEDIOS.length - fallan.length}/${MEDIOS.length} medios · ${nuevos} titulares graves${fallan.length ? " · fallan: " + fallan.join(", ") : ""}`, silencioso: primera };
  }
};
