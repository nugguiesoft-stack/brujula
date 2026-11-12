// Avisos de tsunami de los centros de alerta de EE. UU. (Pacífico, Caribe y costa atlántica americana).
// OJO: estos centros NO cubren el Atlántico nordeste. Para España el proveedor oficial es el IGN (sin canal público
// conocido); en la práctica un tsunami aquí llegaría por ES-Alert y lo delataría antes el módulo de terremotos.
// (v1.3) Se lee la «Category» del boletín. Antes cualquier boletín informativo contaba como alerta, porque el texto
// de la definición contiene las palabras «warning, advisory, or watch».
export default {
  id: "tsunami", nombre: "Tsunamis (NOAA)", cada: 5,
  async run({ pedir, rss, zonaDe }) {
    const out = []; let n = 0;
    for (const u of ["https://www.tsunami.gov/events/xml/PHEBAtom.xml", "https://www.tsunami.gov/events/xml/PAAQAtom.xml"]) {
      for (const i of rss(await pedir(u))) {
        n++; if (Date.now() - Date.parse(i.date) > 12 * 36e5) continue;
        const cat = (i.desc.match(/Category:\s*([A-Za-z ]+?)\s*(Bulletin|$)/i) || [])[1] || "";
        const aviso = /warning/i.test(cat) ? 3 : /advisory|watch/i.test(cat) ? 2 : /threat/i.test(cat) && !/no tsunami threat|no threat/i.test(i.desc) ? 2 : 1;
        if (aviso < 2) continue;
        const zona = zonaDe(i.lat, i.lon); const atl = /portugal|spain|azores|madeira|canary|morocco|gibraltar|bay of biscay|northeast atlantic/i.test(i.title + " " + i.desc);
        out.push({ clave: "tsu:" + i.id + ":" + aviso, fuente: "tsunami", fuenteNombre: "Centro de alertas de tsunami (NOAA)", tipo: "oficial", tema: "natural",
          S: atl ? 8 : aviso === 3 ? 6 : 4, lugar: { nombre: i.title, lat: i.lat, lon: i.lon, zona: atl ? "espana" : zona },
          titulo: `${aviso === 3 ? "Alerta" : "Aviso"} de tsunami: ${i.title}`, detalle: i.desc.slice(0, 300), url: i.url });
      }
    }
    return { senales: out, msg: `${n} boletines; ${out.length} avisos activos` };
  }
};
