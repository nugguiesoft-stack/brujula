// Canales públicos de Telegram (vista web t.me/s/...): alertas aéreas de Ucrania (oficial) y los canales que añadas.
// Los canales oficiales suelen publicar antes que la prensa.
function leer(html) {
  const out = [];
  for (const b of html.split('class="tgme_widget_message ').slice(1)) {
    const post = (b.match(/data-post="([^"]+)"/) || [])[1];
    const txt = (b.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    const t = (b.match(/datetime="([^"]+)"/) || [])[1];
    if (post && txt) out.push({ post, t: Date.parse(t), texto: txt.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim() });
  }
  return out;
}
export default {
  id: "telegram", nombre: "Telegram (alertas Ucrania y canales)", cada: 3,
  async run({ pedir, clasifica, CFG, mem }) {
    const out = []; const msgs = [];
    // 1) Alertas aéreas de Ucrania: cuenta zonas en alerta ahora
    const ua = leer(await pedir("https://t.me/s/air_alert_ua"));
    const act = new Map();
    for (const m of ua) { if (Date.now() - m.t > 12 * 36e5) continue; const r = (m.texto.match(/#([\p{L}_]+)/u) || [])[1]; if (!r) continue; if (/відбій/i.test(m.texto)) act.delete(r); else if (/тривог/i.test(m.texto)) act.set(r, m.t); }
    const n = act.size; mem.base.uaZonas = n;
    if (n >= 15) out.push({ clave: "ua:" + Math.floor(Date.now() / 108e5), grupo: "belico|Ucrania|masivo", fuente: "ucrania", fuenteNombre: "Alertas aéreas de Ucrania (oficial)", tipo: "oficial", tema: "belico",
      S: n >= 20 ? 7 : 6, lugar: { nombre: "Ucrania", zona: "europa" }, titulo: `Ataque masivo en Ucrania: ${n} zonas en alerta aérea`, url: "https://t.me/air_alert_ua",
      detalle: "Alerta aérea casi en todo el país. Vigila si hay drones o misiles hacia Polonia, Rumanía o Moldavia (OTAN)." });
    msgs.push(`Ucrania: ${n} zona(s) en alerta`);
    // 2) Canales que tú añadas (TELEGRAM_CANALES)
    for (const c of CFG.canales) {
      try {
        for (const m of leer(await pedir(`https://t.me/s/${c.replace(/^@|https?:\/\/t\.me\/(s\/)?/g, "")}`))) {
          if (Date.now() - m.t > 3 * 36e5) continue;
          const k = clasifica(m.texto); if (k.S < 5 && !k.desmiente) continue;
          out.push({ clave: "tg:" + m.post, fuente: "tg:" + c, fuenteNombre: "Telegram @" + c, tipo: "social", tema: k.tema, S: k.S, lugar: k.lugar,
            titulo: m.texto.split("\n")[0].slice(0, 140), url: "https://t.me/" + m.post, detalle: m.texto.slice(0, 400), desmiente: k.desmiente, atribuido: k.atribuido });
        }
      } catch (e) { msgs.push(`@${c}: ${e.message}`); }
    }
    return { senales: out, msg: msgs.join(" · ") + (CFG.canales.length ? ` · ${CFG.canales.length} canal(es) propios` : ""), datos: { ucrania: n } };
  }
};
