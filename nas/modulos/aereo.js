// Espacio aéreo sobre la península (OpenSky): si el número de aviones se desploma de golpe,
// puede ser un cierre del espacio aéreo (ataque, emergencia nacional o fallo grave). También detecta código 7500 (secuestro).
const CAJA = "lamin=35.5&lamax=44.5&lomin=-10&lomax=4.5";
export default {
  id: "aereo", nombre: "Espacio aéreo de España (OpenSky)", cada: 15,
  async run({ pedir, base, mem }) {
    const d = await pedir(`https://opensky-network.org/api/states/all?${CAJA}`, { json: true, timeout: 30000, condicional: false });
    const st = (d.states || []).filter((s) => !s[8]);
    const n = st.length; const h = new Date().getUTCHours(), dow = new Date().getUTCDay();
    const clave = `aer:${dow}:${h}`; const b = base(clave, n, 0.25); const muestras = (mem.base[clave + ":n"] = (mem.base[clave + ":n"] || 0) + 1);
    const prev = mem.base.aerPrev; mem.base.aerPrev = n;
    const out = [];
    const caidaBase = b && muestras > 3 && b > 60 && n < 0.45 * b, caidaBrusca = prev > 80 && n < 0.5 * prev;
    if (caidaBase || caidaBrusca) out.push({ clave: "aer:" + Math.floor(Date.now() / 36e5), grupo: "belico|España|espacio aereo", fuente: "opensky", fuenteNombre: "OpenSky (radar ADS-B)", tipo: "sensor", tema: "belico",
      S: n < 0.25 * (b || prev) ? 8 : 6, conf: 0.5, lugar: { nombre: "España", zona: "espana" }, titulo: `Desplome del tráfico aéreo sobre la península: ${n} aviones (normal ~${Math.round(b || prev)})`,
      url: "https://opensky-network.org/network/explorer", detalle: "Puede ser un cierre del espacio aéreo o un fallo de la red de receptores. Se confirma si lo publican ENAIRE o la prensa." });
    for (const s of st.filter((s) => s[14] === "7500")) out.push({ clave: "7500:" + s[0] + ":" + new Date().toISOString().slice(0, 13), fuente: "opensky", fuenteNombre: "OpenSky", tipo: "sensor", tema: "belico", S: 6, conf: 0.35,
      lugar: { nombre: "Espacio aéreo de España", zona: "espana" }, titulo: `Avión ${String(s[1] || s[0]).trim()} emite código 7500 (secuestro)`, url: `https://globe.adsbexchange.com/?icao=${s[0]}`,
      detalle: "El código 7500 indica secuestro, aunque a veces es un error del piloto. Señal muy temprana." });
    return { senales: out, msg: `${n} aviones en vuelo${b ? ` (habitual a esta hora ~${Math.round(b)})` : " (aprendiendo lo normal)"}`, datos: { n, base: b } };
  }
};
