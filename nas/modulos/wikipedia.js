// Wikipedia en tiempo real: cuando ocurre algo grave, voluntarios crean el artículo en minutos
// ("Atentado de...", "Terremoto de...", "2026 ... strike"). Escuchamos solo las páginas nuevas.
const WIKIS = /^(eswiki|enwiki|frwiki|dewiki|ptwiki|itwiki|plwiki|ukwiki|astwiki)$/;
const GRAVE = /attack|atentado|attentat|anschlag|explosi|earthquake|terremoto|s[ée]isme|erdbeben|tsunami|strike|bombing|bombardeo|airstrike|blackout|apag[oó]n|stromausfall|invasion|invasi[oó]n|missile|misil|shooting|tiroteo|massacre|masacre|coup|golpe de estado|evacuation|evacuaci[oó]n|nuclear|outage|hijack|secuestro|derailment|descarrilamiento|ciberataque|cyberattack|incendio|wildfire|flood|inundaci/i;
export default {
  id: "wikipedia", nombre: "Wikipedia en tiempo real (artículos nuevos)", continuo: true,
  async run({ CFG, clasifica, procesar, log, sleep, estado }) {
    // Conexión permanente; se reconecta sola si se corta
    for (let intento = 0; ; intento++) {
      try {
        if (CFG.mock) { estado("ok", "simulado"); return; }
        const r = await fetch("https://stream.wikimedia.org/v2/stream/page-create", { headers: { Accept: "text/event-stream", "User-Agent": "BrujulaEmergencia/1.0 (uso personal)" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        estado("ok", "escuchando artículos nuevos"); intento = 0;
        const dec = new TextDecoder(); let buf = "", vistos = 0;
        for await (const chunk of r.body) {
          buf += dec.decode(chunk, { stream: true });
          let i; while ((i = buf.indexOf("\n")) >= 0) {
            const linea = buf.slice(0, i); buf = buf.slice(i + 1);
            if (!linea.startsWith("data: ")) continue;
            let e; try { e = JSON.parse(linea.slice(6)); } catch { continue; }
            if (!WIKIS.test(e.database || "") || e.page_namespace !== 0) continue;
            vistos++; const t = (e.page_title || "").replace(/_/g, " ");
            if (!GRAVE.test(t) || !/20(2[6-9]|3\d)/.test(t) && !/\b(today|hoy)\b/i.test(t)) continue;
            const k = clasifica(t); if (k.S < 4) continue;
            estado("ok", `escuchando · último relevante: «${t}»`);
            await procesar([{ clave: "wiki:" + e.database + ":" + t, grupo: `${k.tema}|${k.lugar.nombre || k.lugar.zona}`, fuente: "wiki:" + e.database, fuenteNombre: "Wikipedia (" + e.database.replace("wiki", "") + ")",
              tipo: "social", conf: 0.3, tema: k.tema, S: k.S, lugar: k.lugar, titulo: `Nuevo artículo en Wikipedia: «${t}»`, url: e.meta?.uri,
              detalle: "Alguien acaba de crear este artículo. Suele ocurrir minutos después de un suceso real, pero aún no está contrastado." }]);
          }
          if (buf.length > 1e6) buf = "";
        }
        throw new Error("conexión cerrada");
      } catch (e) {
        estado("err", "reconectando: " + e.message); log("wikipedia:", e.message);
        await sleep(Math.min(300000, 10000 * 2 ** Math.min(intento, 5)));
      }
    }
  }
};
