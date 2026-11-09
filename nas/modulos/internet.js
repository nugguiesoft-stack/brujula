// Cortes de internet a escala de país (IODA, Georgia Tech): suelen acompañar a guerras, ciberataques y apagones.
const PAIS = { ES: ["España", 9, "espana", 7], PT: ["Portugal", 7, "ue", 7], FR: ["Francia", 7, "ue", 6], MA: ["Marruecos", 5, "mediterraneo", 5], IR: ["Irán", 5, "oriente", 5], IL: ["Israel", 5, "oriente", 5], UA: ["Ucrania", 4, "europa", 4], RU: ["Rusia", 4, "europa", 5], PL: ["Polonia", 6, "ue", 6], LT: ["Lituania", 6, "ue", 6], LV: ["Letonia", 6, "ue", 6], EE: ["Estonia", 6, "ue", 6], FI: ["Finlandia", 6, "ue", 6], DE: ["Alemania", 6, "ue", 6], IT: ["Italia", 6, "ue", 6], GB: ["Reino Unido", 6, "europa", 6], TW: ["Taiwán", 4, "mundo", 5], LB: ["Líbano", 4, "oriente", 4], SY: ["Siria", 3, "oriente", 3], IQ: ["Irak", 3, "oriente", 3] };
export default {
  id: "internet", nombre: "Cortes de internet (IODA)", cada: 10,
  async run({ pedir }) {
    const until = Math.floor(Date.now() / 1000), from = until - 3 * 3600;
    const d = await pedir(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?from=${from}&until=${until}&entityType=country&limit=200`, { json: true, timeout: 30000 });
    const ev = Array.isArray(d.data) ? d.data : d.data?.events || [];
    const out = [], paises = new Set();
    for (const e of ev) {
      const c = String(e.location || e.entity?.code || "").split("/").pop().toUpperCase().slice(0, 2); if (!c) continue; paises.add(c);
      const p = PAIS[c]; if (!p) continue;
      out.push({ clave: `ioda:${c}:${e.start}`, grupo: `ciber|${p[0]}|internet`, fuente: "ioda", fuenteNombre: "IODA (cortes de internet)", tipo: "sensor", tema: "ciber", S: p[3],
        lugar: { nombre: p[0], zona: p[2] }, titulo: `Corte de internet a escala nacional en ${p[0]}`, url: `https://ioda.inetintel.cc.gatech.edu/country/${c}`,
        detalle: `Caída de conectividad detectada por medición técnica independiente${e.duration ? ` (unos ${Math.round(e.duration / 60)} min)` : ""}. No indica la causa: puede ser un apagón, un ciberataque o un corte ordenado.` });
    }
    return { senales: out, msg: `${paises.size} país(es) con cortes en 3 h`, datos: { paises: [...paises] } };
  }
};
