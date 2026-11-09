// Detector de apagón: demanda eléctrica peninsular (Red Eléctrica). Una caída brusca = corte masivo.
// Dos vías: la API oficial (horaria, compara real con prevista) y el visor de demanda (cada 10 min, detecta desplomes).
export default {
  id: "electricidad", nombre: "Red eléctrica (detector de apagón)", cada: 5,
  async run({ pedir }) {
    const out = [], datos = {};
    const f = (d) => d.toISOString().slice(0, 16);
    try {
      const d = await pedir(`https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real?start_date=${f(new Date(Date.now() - 4 * 36e5))}&end_date=${f(new Date())}&time_trunc=hour`, { json: true });
      const s = (d.included || []).map((x) => ({ t: (x.attributes?.title || x.type || "").toLowerCase(), v: x.attributes?.values || [] }));
      const real = s.find((x) => /real/.test(x.t)), prev = s.find((x) => /prevista/.test(x.t)) || s.find((x) => /programada/.test(x.t));
      if (real?.v.length && prev) { const u = real.v.at(-1), p = prev.v.find((x) => x.datetime === u.datetime) || prev.v.at(-1); datos.real = u.value; datos.prevista = p?.value; datos.ratio = p?.value ? u.value / p.value : 1; }
    } catch (e) { datos.errApi = e.message; }
    try { // visor de demanda (formato JSONP); si cambia de formato se ignora sin romper nada
      const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      const txt = await pedir(`https://demanda.ree.es/WSvisionaMovilesPeninsulaRest/resources/demandaGeneracionPeninsula?callback=cb&curva=DEMANDA&fecha=${hoy}`, { condicional: false });
      const j = JSON.parse(txt.slice(txt.indexOf("(") + 1, txt.lastIndexOf(")")));
      const v = (j.valoresHorariosGeneracion || []).filter((x) => x.dem > 0);
      if (v.length >= 3) { const a = v.at(-1).dem, b = v.at(-3).dem; datos.dem10 = a; datos.caida10 = b ? a / b : 1; datos.ts10 = v.at(-1).ts; }
    } catch (e) { datos.errVisor = e.message; }
    if (datos.ratio == null && datos.caida10 == null) throw new Error(datos.errApi || datos.errVisor || "sin datos");
    const r = Math.min(datos.ratio ?? 1, datos.caida10 ?? 1);
    if (r < 0.85) {
      const S = r < 0.6 ? 9 : r < 0.75 ? 7 : 5;
      out.push({ clave: "ree:" + Math.floor(Date.now() / 18e5), grupo: "apagon|España", fuente: "ree", fuenteNombre: "Red Eléctrica", tipo: "sensor", tema: "energia", S,
        lugar: { nombre: "Península (incluida Asturias)", lat: 40.4, lon: -3.7, zona: "asturias" }, forzar: r < 0.6 ? 4 : undefined,
        titulo: `Posible apagón: la demanda eléctrica cae al ${Math.round(r * 100)} %`, url: "https://demanda.ree.es/visiona/peninsula/demandaqh/tablas",
        detalle: `Demanda ${Math.round(datos.dem10 || datos.real)} MW${datos.prevista ? ` (prevista ${Math.round(datos.prevista)} MW)` : ""}. Una caída así suele indicar un corte masivo. Ten a mano linterna, radio a pilas y el móvil cargado.` });
    }
    return { senales: out, msg: `Demanda ${Math.round(datos.dem10 || datos.real || 0)} MW · ${Math.round(r * 100)} % de lo esperado`, datos };
  }
};
