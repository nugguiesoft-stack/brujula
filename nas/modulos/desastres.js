// GDACS (ONU y Comisión Europea): terremotos, ciclones, inundaciones, volcanes con nivel naranja o rojo.
export default {
  id: "desastres", nombre: "Desastres mundiales (GDACS)", cada: 15,
  async run({ pedir, rss, zonaDe }) {
    const it = rss(await pedir("https://www.gdacs.org/xml/rss.xml"));
    if (!it.length) throw new Error("respuesta sin sucesos");
    const out = [];
    for (const i of it) {
      const rojo = /^red/i.test(i.title), nar = /^orange/i.test(i.title);
      if (!(rojo || nar) || Date.now() - Date.parse(i.date) > 48 * 36e5) continue;
      const zona = zonaDe(i.lat, i.lon);
      out.push({ clave: "gdacs:" + i.id, fuente: "gdacs", fuenteNombre: "GDACS (ONU/UE)", tipo: "oficial", tema: "natural", S: rojo ? 7 : 5,
        lugar: { nombre: i.title.replace(/^(red|orange)\s+\w+\s+alert\s*(\(.*?\))?\s*(in)?/i, "").trim() || "Desastre", lat: i.lat, lon: i.lon, zona }, titulo: i.title, url: i.url, detalle: i.desc.slice(0, 250) });
    }
    return { senales: out, msg: `${it.length} sucesos; ${out.length} naranja/rojo` };
  }
};
