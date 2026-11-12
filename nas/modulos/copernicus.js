// Copernicus EMS (servicio de emergencias de la UE): cuando un país pide cartografía urgente por una inundación,
// un incendio o un terremoto, la activación aparece aquí. Es una señal oficial de que el desastre es serio.
// Formato comprobado el 12 nov 2026 (code, countries[], category, name, centroid «POINT (lon lat)», activationTime, closed).
const CERCA = { Spain: "espana", Portugal: "ue", France: "ue", Morocco: "mediterraneo", Andorra: "ue" };
export default {
  id: "copernicus", nombre: "Copernicus EMS (desastres en Europa)", cada: 30,
  async run({ pedir, zonaDe }) {
    const d = await pedir("https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=15", { json: true, condicional: false });
    const out = []; const lista = d.results || [];
    for (const a of lista) {
      const t = Date.parse(a.activationTime + (/[zZ]|[+-]\d\d:?\d\d$/.test(a.activationTime) ? "" : "Z")); if (!t || Date.now() - t > 72 * 36e5) continue;
      const pais = (a.countries || []).map((c) => c.short_name); const cerca = pais.find((p) => CERCA[p]);
      const m = String(a.centroid || "").match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)/); const lon = m ? +m[1] : null, lat = m ? +m[2] : null;
      const zona = lat != null ? zonaDe(lat, lon) : cerca ? CERCA[cerca] : "mundo";
      if (!cerca && !["asturias", "espana", "ue"].includes(zona)) continue;
      out.push({ clave: "ems:" + a.code, fuente: "copernicus", fuenteNombre: "Copernicus EMS (UE)", tipo: "oficial", tema: "natural", S: zona === "asturias" ? 7 : zona === "espana" ? 5 : 4,
        lugar: { nombre: zona === "asturias" ? "Asturias" : pais.join(", ") || "Europa", lat, lon, zona }, titulo: `Copernicus activa cartografía de emergencia: ${a.name}`,
        url: `https://mapping.emergency.copernicus.eu/activations/${a.code}/`, detalle: `Tipo: ${a.category?.name || "?"}. Activación ${a.code}. Indica que las autoridades han pedido ayuda cartográfica urgente a la UE.` });
    }
    return { senales: out, msg: `${lista.length} activaciones recientes; ${out.length} cerca en 72 h` };
  }
};
