// GDACS (ONU y Comisión Europea): terremotos, ciclones, inundaciones, volcanes con nivel naranja o rojo.
// Formato comprobado el 12 nov 2026: «Green earthquake (Magnitude 5.5M, Depth:59km) in Guatemala 10/11/2026…» con georss:point.
// GDACS rechaza las peticiones que dicen ser un navegador: hay que ir con el identificador propio (así va el NAS).
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
        lugar: { nombre: ((i.title.match(/\bin\s+([^0-9(]+?)(\s+\d|\s*$)/i) || [])[1] || "Desastre").trim(), lat: i.lat, lon: i.lon, zona }, titulo: i.title, url: i.url, detalle: i.desc.slice(0, 250) });
    }
    return { senales: out, msg: `${it.length} sucesos; ${out.length} naranja/rojo` };
  }
};
