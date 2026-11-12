// Alertas sanitarias: brotes que publica la OMS (Disease Outbreak News) y actualizaciones epidemiológicas del ECDC (UE).
// Formatos comprobados el 12 nov 2026. Publican poco: se consulta cada 2 h.
export default {
  id: "salud", nombre: "Brotes (OMS y ECDC)", cada: 120,
  async run({ pedir, rss, clasifica, lugar }) {
    const out = [], msg = [];
    try {
      const d = await pedir("https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDate%20desc&$top=8", { json: true, condicional: false, timeout: 30000 });
      for (const x of d.value || []) { if (Date.now() - Date.parse(x.PublicationDate) > 72 * 36e5) continue; const l = lugar(x.Title || "");
        const cerca = ["asturias", "espana", "ue"].includes(l.zona);
        out.push({ clave: "who:" + (x.Id || x.UrlName), fuente: "oms", fuenteNombre: "OMS (brotes)", tipo: "oficial", tema: "sanitario", S: cerca ? 5 : 3, lugar: l, titulo: "OMS: " + x.Title, url: "https://www.who.int/emergencies/disease-outbreak-news/item/" + (x.UrlName || "") }); }
      msg.push(`OMS ${(d.value || []).length}`);
    } catch (e) { msg.push("OMS: " + e.message); }
    try {
      const it = rss(await pedir("https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed"));
      for (const i of it) { if (Date.now() - Date.parse(i.date) > 72 * 36e5) continue; const l = lugar(i.title + " " + i.desc.slice(0, 200));
        out.push({ clave: "ecdc:" + (i.id || i.title), fuente: "ecdc", fuenteNombre: "ECDC (UE)", tipo: "oficial", tema: "sanitario", S: /spain|españa/i.test(i.title + i.desc) ? 5 : 4, lugar: l.nombre ? l : { nombre: "Europa", zona: "ue" }, titulo: "ECDC: " + i.title, url: i.url }); }
      msg.push(`ECDC ${it.length}`);
    } catch (e) { msg.push("ECDC: " + e.message); }
    if (msg.every((m) => /: /.test(m))) throw new Error(msg.join(" · "));
    return { senales: out, msg: msg.join(" · ") + ` · ${out.length} en 72 h` };
  }
};
