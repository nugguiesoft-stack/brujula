// INCIBE-CERT: avisos de ciberseguridad críticos, incluidos los de sistemas industriales (luz, agua, gas).
export default {
  id: "ciber", nombre: "Ciberseguridad (INCIBE-CERT)", cada: 30,
  async run({ pedir, rss }) {
    const out = []; let n = 0;
    for (const [u, sci] of [["https://www.incibe.es/incibe-cert/alerta-temprana/avisos/feed", false], ["https://www.incibe.es/incibe-cert/alerta-temprana/avisos-sci/feed", true]]) {
      for (const i of rss(await pedir(u))) {
        n++; if (Date.now() - Date.parse(i.date) > 48 * 36e5) continue;
        if (!/cr[ií]tica|5 - /i.test(i.title + i.desc)) continue;
        out.push({ clave: "incibe:" + i.id, fuente: "incibe", fuenteNombre: "INCIBE-CERT", tipo: "oficial", tema: "ciber", S: sci ? 5 : 3,
          lugar: { nombre: "España", zona: "espana" }, titulo: `INCIBE${sci ? " (infraestructuras)" : ""}: ${i.title}`, url: i.url, detalle: "Fallo de seguridad grave publicado; no implica un ataque en curso." });
      }
    }
    return { senales: out, msg: `${n} avisos; ${out.length} críticos en 48 h` };
  }
};
