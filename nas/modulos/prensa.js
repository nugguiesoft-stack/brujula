// Prensa y agencias leídas directamente (sin Google): solo titulares nuevos que hablen de algo grave.
// Varios medios distintos sobre lo mismo = confirmación (salvo que todos citen a la misma parte: ver motor).
// Direcciones comprobadas el 12 nov 2026. La prensa asturiana va aparte, en el módulo «local», que es más rápido.
import { senalesDe } from "../lib/titulares.js";
const MEDIOS = [
  ["Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=94", "agencia"], ["ABC · Última hora", "https://www.abc.es/rss/feeds/abc_ultima.xml", "prensa"],
  ["El País", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "prensa"], ["El Mundo", "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", "prensa"],
  ["20minutos", "https://www.20minutos.es/rss", "prensa"], ["El Debate", "https://www.eldebate.com/rss/home.xml", "prensa"],
  ["BBC", "https://feeds.bbci.co.uk/news/world/rss.xml", "prensa"], ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "prensa"],
  ["The Guardian", "https://www.theguardian.com/world/rss", "prensa"], ["DW", "https://rss.dw.com/rdf/rss-sp-all", "prensa"],
  ["France 24", "https://www.france24.com/es/rss", "prensa"], ["ONU Noticias", "https://news.un.org/feed/subscribe/es/news/all/rss.xml", "oficial"]
];
export default {
  id: "prensa", nombre: "Prensa y agencias (directo)", cada: 5,
  async run(ctx) {
    const { pedir, rss, mem } = ctx; const out = [], fallan = []; let leidos = 0;
    const res = await Promise.allSettled(MEDIOS.map(async ([n, u, tipo]) => ({ n, tipo, its: rss(await pedir(u, { timeout: 25000 })) })));
    res.forEach((r, i) => { if (r.status === "rejected" || !r.value.its.length) fallan.push(MEDIOS[i][0]); });
    const primera = !mem.base.prensaLista;
    for (const r of res) { if (r.status !== "fulfilled") continue; const [s, l] = senalesDe(r.value.its, r.value.n, r.value.tipo, ctx); out.push(...s); leidos += l; }
    mem.base.prensaLista = 1;
    return { senales: out, msg: `${MEDIOS.length - fallan.length}/${MEDIOS.length} medios · ${out.length} titulares graves${fallan.length ? " · fallan: " + fallan.join(", ") : ""}`, silencioso: primera };
  }
};
