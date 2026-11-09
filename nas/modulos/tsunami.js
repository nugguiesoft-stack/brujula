// Avisos de tsunami de los centros de alerta de EE. UU. (Pacífico, Atlántico y Caribe).
export default {
  id: "tsunami", nombre: "Tsunamis (NOAA)", cada: 5,
  async run({ pedir, rss, zonaDe }) {
    const out = []; let n = 0;
    for (const u of ["https://www.tsunami.gov/events/xml/PHEBAtom.xml", "https://www.tsunami.gov/events/xml/PAAQAtom.xml"]) {
      for (const i of rss(await pedir(u))) {
        n++; if (Date.now() - Date.parse(i.date) > 12 * 36e5) continue;
        const txt = i.title + " " + i.desc; const aviso = /warning/i.test(txt) ? 3 : /advisory|watch/i.test(txt) ? 2 : 1;
        if (aviso < 2) continue;
        const zona = zonaDe(i.lat, i.lon); const atl = /atlantic|portugal|spain|azores|morocco|caribbean/i.test(txt);
        out.push({ clave: "tsu:" + i.id, fuente: "tsunami", fuenteNombre: "Centro de alertas de tsunami (NOAA)", tipo: "oficial", tema: "natural",
          S: atl ? 8 : aviso === 3 ? 6 : 4, lugar: { nombre: i.title, lat: i.lat, lon: i.lon, zona: atl ? "ue" : zona },
          titulo: `${aviso === 3 ? "Alerta" : "Aviso"} de tsunami: ${i.title}`, detalle: i.desc.slice(0, 300), url: i.url });
      }
    }
    return { senales: out, msg: `${n} boletines; ${out.length} avisos activos` };
  }
};
