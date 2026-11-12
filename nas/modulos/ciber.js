// INCIBE-CERT: avisos de ciberseguridad críticos, incluidos los de sistemas industriales (luz, agua, gas).
export default {
  id: "ciber", nombre: "Ciberseguridad (INCIBE-CERT)", cada: 30,
  async run({ pedir, rss }) {
    const out = []; let n = 0, ok = 0, err = "";
    for (const [u, sci] of [["https://www.incibe.es/incibe-cert/alerta-temprana/avisos/feed", false], ["https://www.incibe.es/incibe-cert/alerta-temprana/avisos-sci/feed", true]]) {
      let its = []; try { its = rss(await pedir(u, { timeout: 30000 })); ok++; } catch (e) { err = e.message; }
      for (const i of its) {
        n++; if (Date.now() - Date.parse(i.date) > 48 * 36e5) continue;
        if (!/cr[ií]tica|5 - /i.test(i.title + i.desc)) continue;
        out.push({ clave: "incibe:" + i.id, fuente: "incibe", fuenteNombre: "INCIBE-CERT", tipo: "oficial", tema: "ciber", S: sci ? 5 : 3,
          lugar: { nombre: "España", zona: "espana" }, titulo: `INCIBE${sci ? " (infraestructuras)" : ""}: ${i.title}`, url: i.url, detalle: "Fallo de seguridad grave publicado; no implica un ataque en curso." });
      }
    }
    if (!ok) throw new Error(err || "sin respuesta");
    return { senales: out, msg: `${n} avisos; ${out.length} críticos en 48 h` };
  }
};
