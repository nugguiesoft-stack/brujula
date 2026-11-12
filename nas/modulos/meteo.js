// Avisos de AEMET (canal oficial CAP): naranja y rojo en Asturias, rojo en el resto de España.
// Formato comprobado el 12 nov 2026: título «Aviso. Nivel naranja. Vientos. Litoral oriental asturiano»
// y enlace «…AFAZ770301VIRM1214.xml», donde los dos primeros dígitos son la comunidad.
// SIN VERIFICAR: que el código de Asturias sea 63 (no había avisos de Asturias con código visible al comprobarlo);
// por eso también se reconocen las zonas por su nombre.
const ASTURIAS = /asturian|asturias|valles mineros|cordillera y picos de europa/i;
const ES_ASTURIAS = (i) => ASTURIAS.test(i.title) || /AFAZ63\d{4}/.test(i.id + " " + i.url);
export default {
  id: "meteo", nombre: "Avisos meteorológicos (AEMET)", cada: 15,
  async run({ pedir, rss }) {
    const it = rss(await pedir("https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml"));
    const out = []; let nAst = 0;
    for (const i of it) {
      const nivel = ((i.title.match(/nivel\s+(amarillo|naranja|rojo)/i) || [])[1] || "").toLowerCase(), ast = ES_ASTURIAS(i);
      if (ast) nAst++;
      const rojo = nivel === "rojo", nar = nivel === "naranja";
      if (!(rojo || (nar && ast))) continue;
      const partes = i.title.split(". "), fen = partes[2] || "", zonaTxt = partes.slice(3).join(". ") || (ast ? "Asturias" : "España");
      // Una clave por zona, fenómeno y nivel: AEMET reemite el mismo aviso varias veces al día con otro identificador
      out.push({ clave: `aemet:${zonaTxt}:${fen}:${nivel}:${new Date().toISOString().slice(0, 10)}`, grupo: `natural|${ast ? "Asturias" : "España"}|aemet|${fen}`, fuente: "aemet", fuenteNombre: "AEMET", tipo: "oficial", tema: "natural",
        S: rojo ? (ast ? 8 : 5) : 5, lugar: { nombre: ast ? "Asturias" : zonaTxt, zona: ast ? "asturias" : "espana" }, titulo: `AEMET: aviso ${nivel} por ${fen.toLowerCase() || "fenómeno adverso"} en ${zonaTxt}`, url: "https://www.aemet.es/es/eltiempo/prediccion/avisos",
        detalle: i.desc.slice(0, 300) });
    }
    return { senales: out, msg: `${it.length} avisos en España (${nAst} en Asturias); ${out.length} relevantes`, datos: { n: it.length, asturias: nAst } };
  }
};
