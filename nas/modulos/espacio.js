// Tiempo espacial (NOAA): tormentas geomagnéticas (afectan a la red eléctrica y GPS) y llamaradas solares.
export default {
  id: "espacio", nombre: "Tiempo espacial (NOAA)", cada: 10,
  async run({ pedir }) {
    const out = [];
    const d = await pedir("https://services.swpc.noaa.gov/products/noaa-scales.json", { json: true });
    const g = ["0", "1", "2", "3"].map((k) => +d?.[k]?.G?.Scale || 0); const gAhora = g[0], gMax = Math.max(...g);
    const r = +d?.["0"]?.R?.Scale || 0;
    let fl = []; try { fl = await pedir("https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json", { json: true }); } catch {}
    const xs = (fl || []).filter((f) => /^X/.test(f.max_class || "") && Date.now() - Date.parse(f.max_time) < 6 * 36e5);
    if (gMax >= 4) out.push({ clave: `g:${gMax}:${new Date().toISOString().slice(0, 10)}`, grupo: "espacio|G", fuente: "noaa", fuenteNombre: "NOAA SWPC", tipo: "oficial", tema: "energia",
      S: gMax >= 5 ? 7 : 5, lugar: { nombre: "Global (también España)", zona: "espana" }, titulo: `Tormenta geomagnética G${gMax} ${gAhora >= 4 ? "en curso" : "prevista"}`,
      url: "https://www.swpc.noaa.gov/", detalle: "Puede afectar a redes eléctricas, satélites y GPS. Las G5 son excepcionales (la última, mayo de 2024)." });
    for (const f of xs) out.push({ clave: "fl:" + f.max_time, grupo: "espacio|X", fuente: "noaa", fuenteNombre: "NOAA (GOES)", tipo: "sensor", tema: "natural",
      S: parseFloat(f.max_class.slice(1)) >= 5 ? 4 : 3, lugar: { nombre: "Sol", zona: "mundo" }, titulo: `Llamarada solar ${f.max_class}`, url: "https://www.swpc.noaa.gov/products/goes-x-ray-flux",
      detalle: "Solo afecta a la radio de onda corta durante minutos u horas. Si lanzó una eyección hacia la Tierra, puede haber tormenta geomagnética en 1–3 días." });
    return { senales: out, msg: `G${gAhora} ahora (máx. previsto G${gMax}) · R${r} · ${xs.length} llamaradas X en 6 h`, datos: { gAhora, gMax, r } };
  }
};
