// Avisos de AEMET (formato oficial CAP): naranja y rojo en Asturias, rojo en el resto de España.
export default {
  id: "meteo", nombre: "Avisos meteorológicos (AEMET)", cada: 15,
  async run({ pedir, rss }) {
    const it = rss(await pedir("https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml"));
    const out = [];
    for (const i of it) {
      const t = i.title + " " + i.desc; const rojo = /rojo|red/i.test(t), nar = /naranja|orange/i.test(t), ast = /asturias/i.test(t);
      if (!(rojo || (nar && ast))) continue;
      out.push({ clave: "aemet:" + (i.id || i.title), grupo: `natural|${ast ? "Asturias" : "España"}|aemet`, fuente: "aemet", fuenteNombre: "AEMET", tipo: "oficial", tema: "natural",
        S: rojo ? (ast ? 8 : 5) : 5, lugar: { nombre: ast ? "Asturias" : "España", zona: ast ? "asturias" : "espana" }, titulo: i.title, url: i.url || "https://www.aemet.es/es/eltiempo/prediccion/avisos",
        detalle: i.desc.slice(0, 300) });
    }
    return { senales: out, msg: `${it.length} avisos; ${out.length} relevantes` };
  }
};
