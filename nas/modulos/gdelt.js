// GDELT: noticias de todo el mundo (incluida prensa local) cada 15 min. Desde casa suele dejar consultar sin bloqueos.
// Detecta picos: muchas más noticias de lo normal sobre un lugar y un tipo de suceso.
const Q = [
  ["espana", '(Spain OR España OR Asturias) (attack OR explosion OR blackout OR evacuation OR missile OR "state of emergency" OR earthquake OR ataque OR explosión OR apagón OR evacuación)', "España"],
  ["europa", '(missile OR drone OR airstrike OR "air raid" OR "nuclear") (Poland OR Romania OR Lithuania OR Latvia OR Estonia OR Finland OR Germany OR NATO)', "OTAN / Europa"],
  ["nuclear", '("nuclear strike" OR "nuclear attack" OR "radiation leak" OR "iodine tablets" OR "nuclear alert" OR "dirty bomb")', "Mundo"]
];
export default {
  id: "gdelt", nombre: "GDELT (noticias mundiales)", cada: 15,
  async run({ pedir, clasifica, base, mem }) {
    const out = [], msg = [];
    for (const [id, q, nombre] of Q) {
      try {
        const d = await pedir(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=75&format=json&timespan=60min&sort=datedesc`, { json: true, timeout: 30000, condicional: false });
        const arts = d.articles || []; const n = arts.length; const b = base("gdelt:" + id, n, 0.1); const muestras = (mem.base["gdelt:" + id + ":n"] = (mem.base["gdelt:" + id + ":n"] || 0) + 1);
        msg.push(`${nombre}: ${n}${b != null ? ` (normal ~${Math.round(b)})` : ""}`);
        if (muestras > 8 && b != null && n >= 15 && n > 3 * Math.max(b, 3)) {
          const top = arts.slice(0, 3).map((a) => a.title); const k = clasifica(top.join(" "));
          out.push({ clave: `gdelt:${id}:${Math.floor(Date.now() / 36e5)}`, grupo: `${k.tema}|${k.lugar.nombre || nombre}`, fuente: "gdelt", fuenteNombre: "GDELT", tipo: "prensa", conf: 0.5, tema: k.tema, S: Math.max(k.S, 5),
            lugar: k.lugar.nombre ? k.lugar : { nombre, zona: id === "espana" ? "espana" : id === "europa" ? "ue" : "mundo" }, titulo: `Pico de noticias (${n} en 1 h, normal ~${Math.round(b)}): ${top[0] || nombre}`,
            url: arts[0]?.url, detalle: "Titulares: " + top.join(" · ") });
        }
      } catch (e) { msg.push(`${nombre}: ${e.message}`); }
    }
    return { senales: out, msg: msg.join(" · ") };
  }
};
