// Cortes de internet a escala de país (IODA, Georgia Tech): suelen acompañar a guerras, ciberataques y apagones.
// Formato comprobado el 12 nov 2026: data[] con location «country/ES», start, duration, datasource (bgp, gtr, ping-slash24…) y score.
// (v1.3) IODA marca decenas de países al día con una sola técnica de medida (casi siempre «gtr», muy ruidosa).
// Solo se da por bueno un corte cuando lo ven DOS técnicas distintas; con una sola, y solo si es España o un vecino,
// se trata como señal temprana sin confirmar.
const PAIS = { ES: ["España", 9, "espana", 7], PT: ["Portugal", 7, "ue", 7], FR: ["Francia", 7, "ue", 6], MA: ["Marruecos", 5, "mediterraneo", 5], IR: ["Irán", 5, "oriente", 5], IL: ["Israel", 5, "oriente", 5], UA: ["Ucrania", 4, "europa", 4], RU: ["Rusia", 4, "europa", 5], PL: ["Polonia", 6, "ue", 6], LT: ["Lituania", 6, "ue", 6], LV: ["Letonia", 6, "ue", 6], EE: ["Estonia", 6, "ue", 6], FI: ["Finlandia", 6, "ue", 6], DE: ["Alemania", 6, "ue", 6], IT: ["Italia", 6, "ue", 6], GB: ["Reino Unido", 6, "europa", 6], TW: ["Taiwán", 4, "mundo", 5], LB: ["Líbano", 4, "oriente", 4], SY: ["Siria", 3, "oriente", 3], IQ: ["Irak", 3, "oriente", 3] };
const CERCA = ["ES", "PT", "FR"];
export function cortes(ev) {   // agrupa por país: técnicas distintas que lo ven y el inicio más reciente
  const por = new Map();
  for (const e of ev || []) {
    const c = String(e.location || e.entity?.code || "").split("/").pop().toUpperCase().slice(0, 2); if (!c) continue;
    const x = por.get(c) || { c, tecnicas: new Set(), inicio: 0, dur: 0, nombre: e.location_name };
    x.tecnicas.add(e.datasource || "?"); x.inicio = Math.max(x.inicio, +e.start || 0); x.dur = Math.max(x.dur, +e.duration || 0); por.set(c, x);
  }
  return [...por.values()];
}
export default {
  id: "internet", nombre: "Cortes de internet (IODA)", cada: 10,
  async run({ pedir }) {
    const until = Math.floor(Date.now() / 1000), from = until - 3 * 3600;
    const d = await pedir(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?from=${from}&until=${until}&entityType=country&limit=200`, { json: true, timeout: 30000, condicional: false });
    const lista = cortes(Array.isArray(d.data) ? d.data : d.data?.events || []);
    const out = [];
    for (const x of lista) {
      const p = PAIS[x.c]; if (!p) continue;
      const firme = x.tecnicas.size >= 2;
      if (!firme && !CERCA.includes(x.c)) continue;
      out.push({ clave: `ioda:${x.c}:${x.inicio}:${firme ? 2 : 1}`, grupo: `ciber|${p[0]}|internet`, palabras: "internet|conexi[oó]n|ca[ií]da (de|del) (la )?red|sin cobertura|telecomunicaciones|ciberataque", fuente: "ioda", fuenteNombre: "IODA (cortes de internet)",
        tipo: firme ? "sensor" : "social", conf: firme ? 0.9 : 0.35, tema: "ciber", S: p[3],
        lugar: { nombre: p[0], zona: p[2] }, titulo: `${firme ? "Corte" : "Posible corte"} de internet a escala nacional en ${p[0]}`, url: `https://ioda.inetintel.cc.gatech.edu/country/${x.c}`,
        detalle: `Caída de conectividad vista por ${x.tecnicas.size} técnica(s) de medida independientes (${[...x.tecnicas].join(", ")})${x.dur ? `, unos ${Math.round(x.dur / 60)} min` : ""}. No indica la causa: puede ser un apagón, un ciberataque o un corte ordenado.` });
    }
    return { senales: out, msg: `${lista.length} país(es) con anomalías en 3 h; ${lista.filter((x) => x.tecnicas.size >= 2).length} confirmadas por dos técnicas`, datos: { paises: lista.map((x) => x.c) } };
  }
};
