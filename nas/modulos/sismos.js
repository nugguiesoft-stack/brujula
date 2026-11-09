// Terremotos: IGN (España, el más rápido para la península), EMSC (Europa-Mediterráneo) y USGS (mundo).
// Las tres fuentes se cruzan: si dos ven el mismo sismo, sube la confianza.
export default {
  id: "sismos", nombre: "Terremotos (IGN · EMSC · USGS)", cada: 2,
  async run({ pedir, rss, km, zonaDe, CFG, madrid }) {
    const out = [], estado = {}; const [hl, hn] = CFG.casa;
    const regla = (M, d) => M >= 6.5 && d < 1200 ? 9 : M >= 5.5 && d < 500 ? 8 : M >= 4.5 && d < 200 ? 7 : M >= 3.8 && d < 100 ? 5 : M >= 3 && d < 40 ? 4 : M >= 7.5 ? 6 : M >= 6.5 ? 4 : 0;
    const add = (fuente, nombre, M, lat, lon, lugarTxt, t, url) => {
      if (!isFinite(M) || lat == null || Date.now() - t > 6 * 36e5) return;
      const d = km(hl, hn, lat, lon), S = regla(M, d); if (!S) return;
      const zona = zonaDe(lat, lon), cubo = Math.floor(t / 9e5);
      out.push({ clave: `${fuente}:${Math.round(lat * 10)}:${Math.round(lon * 10)}:${cubo}`, grupo: `sismo|${Math.round(lat)}|${Math.round(lon)}|${cubo}`,
        fuente, fuenteNombre: nombre, tipo: "sensor", tema: "natural", S, lugar: { nombre: lugarTxt || "Sismo", lat, lon, zona },
        titulo: `Terremoto M${M.toFixed(1)} · ${lugarTxt} (a ${Math.round(d)} km)`, url,
        detalle: `Magnitud ${M.toFixed(1)} a ${Math.round(d)} km de casa.` + (M >= 6.5 && zona !== "mundo" ? " Posible riesgo de tsunami en costas cercanas: sigue al 112." : ""),
        forzar: M >= 5.5 && d < 250 ? 4 : M >= 6.5 && d < 1200 && /c[aá]diz|cabo de s|atl[aá]ntico|golfo|portugal|marruecos|azores|gorringe/i.test(lugarTxt) ? 4 : undefined });
    };
    const r = await Promise.allSettled([
      pedir("https://www.ign.es/ign/RssTools/sismologia.xml").then((x) => {
        const it = rss(x); estado.ign = it.length;
        for (const i of it) { const M = +((i.desc.match(/magnitud\s+([\d.]+)/i) || [])[1]); const zona = (i.desc.match(/magnitud\s+[\d.]+\s+en\s+(.+?)\s+en la fecha/i) || [])[1] || i.title;
          const f = (i.desc.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/) || []); const t = f.length ? madrid(+f[3], +f[2], +f[1], +f[4], +f[5], +f[6]) : Date.parse(i.date);
          add("ign", "IGN", M, i.lat, i.lon, zona, t, i.url); } }),
      pedir(`https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=2.5&limit=200&start=${new Date(Date.now() - 6 * 36e5).toISOString().slice(0, 19)}`, { json: true }).then((d) => {
        estado.emsc = (d.features || []).length;
        for (const f of d.features || []) { const p = f.properties; add("emsc", "EMSC", +p.mag, +p.lat, +p.lon, p.flynn_region, Date.parse(p.time), `https://www.seismicportal.eu/eventdetails.html?unid=${p.unid}`); } }),
      pedir("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson", { json: true }).then((d) => {
        estado.usgs = (d.features || []).length;
        for (const f of d.features || []) { const [lon, lat] = f.geometry.coordinates; add("usgs", "USGS", +f.properties.mag, lat, lon, f.properties.place, f.properties.time, f.properties.url); } })
    ]);
    const fallos = r.filter((x) => x.status === "rejected");
    if (fallos.length === 3) throw fallos[0].reason;
    return { senales: out, msg: `IGN ${estado.ign ?? "✗"} · EMSC ${estado.emsc ?? "✗"} · USGS ${estado.usgs ?? "✗"} en 6 h; ${out.length} relevantes`, datos: estado };
  }
};
