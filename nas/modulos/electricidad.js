// Detector de apagón: demanda eléctrica peninsular (Red Eléctrica). Una caída brusca = corte masivo.
// La API oficial da un valor cada 10 min con la demanda real, la prevista y la programada.
// (v1.3) Las fechas se piden en hora de Madrid: antes se pedían en UTC y el dato llegaba con 1–2 h de retraso.
// El antiguo «visor de demanda» dejó de servir datos en este formato (comprobado el 12 nov 2026) y se ha quitado.
import { isoMadrid } from "../lib/util.js";
export default {
  id: "electricidad", nombre: "Red eléctrica (detector de apagón)", cada: 5,
  async run({ pedir }) {
    const d = await pedir(`https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real?start_date=${isoMadrid(Date.now() - 3 * 36e5)}&end_date=${isoMadrid(Date.now() + 10 * 60000)}&time_trunc=hour`, { json: true, condicional: false });
    const s = (d.included || []).map((x) => ({ t: (x.attributes?.title || x.type || "").toLowerCase(), v: (x.attributes?.values || []).filter((y) => y.value != null) }));
    const real = s.find((x) => /^real|demanda real/.test(x.t)), prev = s.find((x) => /prevista/.test(x.t)) || s.find((x) => /^programada$|demanda programada/.test(x.t));
    if (!real?.v.length) throw new Error("formato no reconocido (sin serie «Real»)");
    const u = real.v.at(-1), edad = (Date.now() - Date.parse(u.datetime)) / 60000;
    const p = prev?.v.find((x) => x.datetime === u.datetime) || prev?.v.at(-1);
    const datos = { real: u.value, prevista: p?.value, hora: u.datetime, edadMin: Math.round(edad) };
    datos.ratio = p?.value ? u.value / p.value : 1;
    // Caída respecto a la demanda real de hace 20–30 min (la demanda normal nunca cambia más de un 5–8 % en ese tiempo)
    const antes = real.v.at(-3) || real.v.at(-2); datos.caida = antes?.value ? u.value / antes.value : 1;
    // Si REE deja de publicar (dato viejo), no se puede saber nada: se dice, no se inventa
    if (!(edad < 90)) return { senales: [], msg: `Sin dato reciente de REE (último de hace ${Math.round(edad)} min)`, datos };
    const r = Math.min(datos.ratio, datos.caida), out = [];
    if (r < 0.85) {
      const S = r < 0.6 ? 9 : r < 0.75 ? 7 : 5;
      out.push({ clave: "ree:" + Math.floor(Date.now() / 18e5), grupo: "apagon|España", fuente: "ree", fuenteNombre: "Red Eléctrica", tipo: "sensor", tema: "energia", S,
        palabras: "apag[oó]n|blackout|sin luz|corte (de luz|el[eé]ctrico)|cero energ[eé]tico|red el[eé]ctrica",
        lugar: { nombre: "Península (incluida Asturias)", lat: 40.4, lon: -3.7, zona: "asturias" }, forzar: r < 0.6 ? 4 : undefined,
        titulo: `Posible apagón: la demanda eléctrica cae al ${Math.round(r * 100)} %`, url: "https://demanda.ree.es/visiona/peninsula/demandaqh/total",
        detalle: `Demanda ${Math.round(u.value)} MW${p?.value ? ` (prevista ${Math.round(p.value)} MW)` : ""}${antes ? `; hace 20 min eran ${Math.round(antes.value)} MW` : ""}. Una caída así suele indicar un corte masivo. Ten a mano linterna, radio a pilas y el móvil cargado.` });
    }
    return { senales: out, msg: `Demanda ${Math.round(u.value)} MW · ${Math.round(datos.ratio * 100)} % de lo previsto (dato de hace ${Math.round(edad)} min)`, datos };
  }
};
