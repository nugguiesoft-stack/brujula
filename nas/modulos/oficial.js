// Organismos oficiales: avisos de viaje (EE. UU., Reino Unido, Alemania) y webs oficiales vía Google Noticias.
const SITIOS_ES = ["interior.gob.es", "proteccioncivil.es", "lamoncloa.gob.es", "defensa.gob.es", "exteriores.gob.es", "policia.es", "guardiacivil.es", "csn.es", "asturias.es"];
const SITIOS_INT = ["nato.int", "iaea.org", "who.int", "consilium.europa.eu", "whitehouse.gov", "defense.gov", "war.gov", "centcom.mil", "gov.uk", "auswaertiges-amt.de"];
export default {
  id: "oficial", nombre: "Organismos oficiales y avisos de viaje", cada: 20,
  async run({ pedir, rss, clasifica, lugar }) {
    const out = [], msg = [];
    try { // EE. UU.: países que suben a nivel 4 («no viajar»)
      const it = rss(await pedir("https://travel.state.gov/_res/rss/TAsTWs.xml"));
      for (const i of it) if (/level 4/i.test(i.title) && Date.now() - Date.parse(i.date) < 48 * 36e5) { const l = lugar(i.title);
        out.push({ clave: "us:" + i.id, fuente: "usstate", fuenteNombre: "Departamento de Estado EE. UU.", tipo: "oficial", tema: "belico", S: 5, lugar: l, titulo: "EE. UU. pide no viajar: " + i.title, url: i.url, detalle: i.desc.slice(0, 200) }); }
      msg.push(`EE. UU. ${it.length}`);
    } catch (e) { msg.push("EE. UU.: " + e.message); }
    try { // Reino Unido: cambios en consejos de viaje
      const it = rss(await pedir("https://www.gov.uk/foreign-travel-advice.atom"));
      for (const i of it) if (Date.now() - Date.parse(i.date) < 24 * 36e5 && /against all|all but essential|leave|evacuat/i.test(i.title + i.desc)) { const l = lugar(i.title);
        out.push({ clave: "uk:" + i.id + i.date, fuente: "fcdo", fuenteNombre: "Gobierno británico (FCDO)", tipo: "oficial", tema: "belico", S: 5, lugar: l, titulo: "Reino Unido endurece su aviso: " + i.title, url: i.url, detalle: i.desc.slice(0, 200) }); }
      msg.push(`R. Unido ${it.length}`);
    } catch (e) { msg.push("R. Unido: " + e.message); }
    try { // Departamento de Seguridad Nacional (canal RSS propio, comprobado el 12 nov 2026; publica poco)
      const it = rss(await pedir("https://www.dsn.gob.es/es/rss.xml"));
      for (const i of it) { const f = Date.parse((i.desc.match(/datetime="([^"]+)"/) || [])[1] || i.date); if (!f || Date.now() - f > 48 * 36e5) continue; const k = clasifica(i.title); if (k.S < 4) continue;
        out.push({ clave: "dsn:" + i.id, fuente: "dsn", fuenteNombre: "Seguridad Nacional (DSN)", tipo: "oficial", tema: k.tema, S: k.S, lugar: k.lugar.nombre ? k.lugar : { nombre: "España", zona: "espana" }, titulo: "DSN: " + i.title, url: i.url, desmiente: k.desmiente }); }
      msg.push(`DSN ${it.length}`);
    } catch (e) { msg.push("DSN: " + e.message); }
    // Webs oficiales (Google Noticias, última hora). Desde una conexión de casa Google no suele bloquear.
    for (const [nombre, sitios, lang] of [["España", SITIOS_ES, "es"], ["Internacional", SITIOS_INT, "en"]]) {
      try {
        const q = "(" + sitios.map((s) => "site:" + s).join(" OR ") + ") when:1h";
        const ed = lang === "es" ? "hl=es&gl=ES&ceid=ES:es" : "hl=en-US&gl=US&ceid=US:en";
        const it = rss(await pedir(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${ed}`, { condicional: false }));
        for (const i of it) { const k = clasifica(i.title); if (k.S < 4 && !k.desmiente) continue;
          const medio = (i.title.match(/\s-\s([^-]+)$/) || [])[1] || "Web oficial";
          out.push({ clave: "gof:" + i.id, fuente: "of:" + medio.trim().toLowerCase(), fuenteNombre: medio.trim(), tipo: "oficial", conf: 0.75, tema: k.tema, S: k.S, lugar: k.lugar, titulo: i.title.replace(/\s+-\s+[^-]+$/, ""), url: i.url, desmiente: k.desmiente }); }
        msg.push(`Oficiales ${nombre} ${it.length}`);
      } catch (e) { msg.push(`Oficiales ${nombre}: ${e.message}`); }
    }
    return { senales: out, msg: msg.join(" · ") };
  }
};
