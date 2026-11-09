// Actividad aérea militar visible (adsb.lol): cisternas, AWACS, bombarderos y transporte sobre Europa y el Mediterráneo,
// y movimiento cerca de las bases de Rota, Morón, Torrejón y Zaragoza. Un aumento brusco suele preceder a operaciones.
import { km } from "../lib/util.js";
const ESTRATEGICO = /^(K35R|KC46|KC10|A332|MRTT|E3TF|E3CF|E6|E8|RC135|R135|P8|B52|B1|B2|C17|C5|C5M|A400|GLF5|U2|RQ4|Q4|MQ9)$/i;
const BASES = [["Rota", 36.64, -6.35], ["Morón", 37.17, -5.62], ["Torrejón", 40.49, -3.45], ["Zaragoza", 41.67, -1.04]];
export default {
  id: "militar", nombre: "Aviones militares visibles (adsb.lol)", cada: 10,
  async run({ pedir, base, mem }) {
    const d = await pedir("https://api.adsb.lol/v2/mil", { json: true, timeout: 30000, condicional: false });
    const ac = (d.ac || []).filter((a) => a.lat != null && a.lat > 27 && a.lat < 72 && a.lon > -30 && a.lon < 45);
    const estr = ac.filter((a) => ESTRATEGICO.test(a.t || ""));
    const bomb = estr.filter((a) => /^B(52|1|2)$/i.test(a.t || ""));
    const cerca = ac.filter((a) => BASES.some(([, la, lo]) => km(la, lo, a.lat, a.lon) < 150));
    const h = new Date().getUTCHours();
    const bE = base("mil:estr:" + h, estr.length, 0.1), bC = base("mil:bases:" + h, cerca.length, 0.1);
    const n = (mem.base["mil:n"] = (mem.base["mil:n"] || 0) + 1); const listo = n > 6 * 24 * 3; // ~3 días aprendiendo antes de avisar por picos
    const out = [];
    if (listo && bE != null && estr.length >= 8 && estr.length > 2.2 * Math.max(bE, 3)) out.push({ clave: "mil:pico:" + Math.floor(Date.now() / 108e5), grupo: "belico|Europa|aviacion militar",
      fuente: "adsb", fuenteNombre: "adsb.lol (aviones militares)", tipo: "sensor", conf: 0.35, tema: "belico", S: 5, lugar: { nombre: "Europa y Mediterráneo", zona: "europa" },
      titulo: `Pico de aviación militar estratégica: ${estr.length} aparatos (normal ~${Math.round(bE)})`, url: "https://adsb.lol/?mil",
      detalle: `Cisternas, AWACS, bombarderos o transporte pesado: ${[...new Set(estr.map((a) => a.t))].join(", ")}. Puede preceder a una operación o ser un ejercicio.` });
    if (listo && bC != null && cerca.length >= 6 && cerca.length > 2.5 * Math.max(bC, 2)) out.push({ clave: "mil:bases:" + Math.floor(Date.now() / 108e5), grupo: "belico|España|bases",
      fuente: "adsb", fuenteNombre: "adsb.lol (aviones militares)", tipo: "sensor", conf: 0.35, tema: "belico", S: 6, lugar: { nombre: "Bases de España", zona: "espana" },
      titulo: `Actividad militar inusual cerca de bases españolas: ${cerca.length} aparatos`, url: "https://adsb.lol/?mil",
      detalle: "Más movimiento del habitual cerca de Rota, Morón, Torrejón o Zaragoza. Señal temprana; suele ser logística o ejercicios." });
    for (const a of bomb) out.push({ clave: "bomb:" + a.hex + ":" + new Date().toISOString().slice(0, 10), grupo: "belico|Europa|bombarderos", fuente: "adsb", fuenteNombre: "adsb.lol", tipo: "sensor", conf: 0.3, tema: "belico", S: 4,
      lugar: { nombre: "Europa y Mediterráneo", zona: "europa" }, titulo: `Bombardero ${a.t} visible (${String(a.flight || a.hex).trim()})`, url: `https://adsb.lol/?icao=${a.hex}`, detalle: "Los bombarderos estratégicos visibles en Europa suelen ser misiones de disuasión o despliegues." });
    return { senales: out, msg: `${ac.length} militares visibles en Europa/Med · ${estr.length} estratégicos · ${cerca.length} cerca de bases españolas${listo ? "" : " (aprendiendo lo normal)"}`, datos: { total: ac.length, estr: estr.length, cerca: cerca.length } };
  }
};
