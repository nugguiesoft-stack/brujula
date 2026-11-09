// Mercados de predicción (Polymarket): el dinero a veces se mueve antes que las noticias.
// Avisa si la probabilidad de un suceso geopolítico sube 12 puntos o más en poco tiempo.
export default {
  id: "mercados", nombre: "Mercados de predicción (Polymarket)", cada: 10,
  async run({ pedir, clasifica, mem }) {
    const d = await pedir("https://gamma-api.polymarket.com/events?active=true&closed=false&tag_slug=geopolitics&order=volume24hr&ascending=false&limit=40", { json: true, condicional: false });
    const out = []; const prev = (mem.base.poly ||= {}); let n = 0;
    for (const ev of Array.isArray(d) ? d : []) {
      for (const m of (ev.markets || []).filter((x) => x.active !== false && x.closed !== true).slice(0, 3)) {
        let pr = m.outcomePrices, oc = m.outcomes; try { if (typeof pr === "string") pr = JSON.parse(pr); if (typeof oc === "string") oc = JSON.parse(oc); } catch {}
        const iy = Array.isArray(oc) ? Math.max(0, oc.findIndex((o) => /^yes$/i.test(o))) : 0; const p = +pr?.[iy]; if (!isFinite(p)) continue;
        n++; const k = m.id || m.slug; const h = (prev[k] ||= []); h.push([Date.now(), p]); while (h.length && Date.now() - h[0][0] > 6 * 36e5) h.shift();
        const min = Math.min(...h.map((x) => x[1]));
        const q = m.question || ev.title; const c = clasifica(q);
        if (p - min >= 0.12 && p >= 0.2 && c.S >= 5) out.push({ clave: `poly:${k}:${Math.round(p * 20)}`, grupo: `${c.tema}|${c.lugar.nombre || c.lugar.zona}`, fuente: "polymarket", fuenteNombre: "Polymarket", tipo: "mercado", tema: c.tema,
          S: c.S, lugar: c.lugar, titulo: `Las apuestas se disparan: «${q}» pasa de ${Math.round(min * 100)} % a ${Math.round(p * 100)} %`, url: "https://polymarket.com/event/" + (ev.slug || ""),
          detalle: "Un salto así puede indicar información que aún no ha salido en los medios, o simple especulación." });
      }
    }
    for (const k of Object.keys(prev)) if (!prev[k].length || Date.now() - prev[k].at(-1)[0] > 864e5) delete prev[k];
    return { senales: out, msg: `${n} mercados vigilados; ${out.length} saltos` };
  }
};
