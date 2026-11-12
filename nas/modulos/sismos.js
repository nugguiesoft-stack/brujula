// Terremotos: IGN (España, el más rápido para la península), EMSC (Europa-Mediterráneo) y USGS (mundo).
// Las tres fuentes se cruzan: si dos ven el mismo sismo (cerca en el mapa y en el tiempo), sube la confianza.
// Formato del IGN comprobado el 12 nov 2026: «…magnitud 3.1 en E PLIEGO.MU en la fecha 11/11/2026 6:50:45 en la siguiente localización: 38.0006,-1.4661».
// SIN VERIFICAR: si esa hora es local o UTC. Por eso el cruce entre fuentes tolera ±2 h de diferencia.
const vistos = [];   // sismos recientes para cruzar fuentes: {lat, lon, t, M, grupo}
export default {
  id: "sismos", nombre: "Terremotos (IGN · EMSC · USGS)", cada: 2,
  async run({ pedir, rss, km, zonaDe, CFG, madrid }) {
    const out = [], estado = {}; const [hl, hn] = CFG.casa;
    const regla = (M, d) => M >= 6.5 && d < 1200 ? 9 : M >= 5.5 && d < 500 ? 8 : M >= 4.5 && d < 200 ? 7 : M >= 3.8 && d < 100 ? 5 : M >= 3 && d < 40 ? 4 : M >= 7.5 ? 6 : M >= 6.5 ? 4 : 0;
    const add = (fuente, nombre, M, lat, lon, lugarTxt, t, url) => {
      if (!isFinite(M) || !isFinite(lat) || !isFinite(lon) || !isFinite(t) || Date.now() - t > 6 * 36e5) return;
      const d = km(hl, hn, lat, lon), S = regla(M, d); if (!S) return;
      const zona = zonaDe(lat, lon);
      // ¿Es el mismo sismo que ya trajo otra fuente? (a menos de 80 km, menos de 2 h y magnitud parecida)
      let ya = vistos.find((v) => km(v.lat, v.lon, lat, lon) < 80 && Math.abs(v.t - t) < 2.1 * 36e5 && Math.abs(v.M - M) < 1);
      if (!ya) { ya = { lat, lon, t, M, grupo: `sismo|${lat.toFixed(1)}|${lon.toFixed(1)}|${Math.floor(t / 6e4)}` }; vistos.push(ya); if (vistos.length > 60) vistos.shift(); }
      out.push({ clave: `${fuente}:${ya.grupo}`, grupo: ya.grupo, palabras: "terremoto|sismo|se[ií]smo|temblor|earthquake|quake",
        fuente, fuenteNombre: nombre, tipo: "sensor", tema: "natural", S, lugar: { nombre: lugarTxt || "Sismo", lat, lon, zona },
        titulo: `Terremoto M${M.toFixed(1)} · ${lugarTxt} (a ${Math.round(d)} km)`, url,
        detalle: `Magnitud ${M.toFixed(1)} a ${Math.round(d)} km de casa.` + (M >= 6.5 && zona !== "mundo" ? " Posible riesgo de tsunami en costas cercanas: sigue al 112." : ""),
        forzar: M >= 5.5 && d < 250 ? 4 : M >= 6.5 && d < 1200 && /c[aá]diz|cabo de s|atl[aá]ntico|golfo|portugal|marruecos|azores|gorringe/i.test(lugarTxt) ? 4 : undefined });
    };
    const r = await Promise.allSettled([
      pedir("https://www.ign.es/ign/RssTools/sismologia.xml").then((x) => {
        const it = rss(x); estado.ign = it.length;
        for (const i of it) { const txt = i.desc + " " + i.title; const M = +((txt.match(/magnitud\s+([\d.,]+)/i) || [])[1] || "").replace(",", ".");
          const zona = (i.desc.match(/magnitud\s+[\d.,]+\s+en\s+(.+?)\s+en la fecha/i) || [])[1] || i.title;
          const f = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/); const t = f ? madrid(+f[3], +f[2], +f[1], +f[4], +f[5], +f[6]) : Date.parse(i.date);
          let { lat, lon } = i; if (lat == null) { const c = i.desc.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/); if (c) { lat = +c[1]; lon = +c[2]; } }
          add("ign", "IGN", M, lat, lon, zona, t, i.url); } }),
      pedir(`https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=2.5&limit=200&start=${new Date(Date.now() - 6 * 36e5).toISOString().slice(0, 19)}`, { json: true, condicional: false }).then((d) => {
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
