// Lógica común para leer titulares de medios: fechas raras, filtro de gravedad y marcas de desmentido / dato atribuido.
export function fechaDe(it) {
  let t = Date.parse(it.date);
  // RTPA no trae fecha en el canal: va en la dirección (…/2026-11-12/…)
  if (!t) { const m = (it.url || "").match(/\/(20\d{2})-(\d{2})-(\d{2})\//); if (m) { const hoy = new Date().toISOString().slice(0, 10); t = `${m[1]}-${m[2]}-${m[3]}` === hoy ? Date.now() - 36e5 : Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`); } }
  return t || 0;
}
// Convierte los titulares de un medio en señales. Devuelve [señales, leídos].
export function senalesDe(its, medio, tipo, { clasifica, ALARMA }, { horas = 6, local = false } = {}) {
  const out = []; let leidos = 0;
  for (const it of its) {
    leidos++; const t = fechaDe(it);
    if (t && (Date.now() - t > horas * 36e5 || t - Date.now() > 2 * 36e5)) continue;   // viejo, o con fecha futura (agenda de actos)
    if (/\/(agenda|club|opinion|deportes|cultura|ocio|gastronomia|motor|tecnologia|gente|sociedad\/famosos)\//i.test(it.url || "")) continue;
    const txt = it.title + ". " + (it.desc || "").slice(0, 200); const k = clasifica(txt), kt = clasifica(it.title);
    const deAqui = local && !k.lugar.nombre && !/nacional|internacional|espana|mundo|economia|politica|deportes/i.test(it.url || "");
    const lugar = deAqui ? { nombre: "Asturias", lat: 43.36, lon: -5.85, zona: "asturias" } : k.lugar;
    const zona = lugar.zona, umbral = zona === "asturias" ? 3 : zona === "espana" ? 4 : 5;
    // Un desmentido interesa aunque su «gravedad» sea baja, si es de aquí
    if (k.S < umbral && !(kt.desmiente && (lugar.zona === "asturias" || lugar.zona === "espana"))) continue;
    out.push({ clave: "pr:" + medio + ":" + (it.id || it.url || it.title), fuente: "pr:" + medio, fuenteNombre: medio, tipo, tema: k.tema,
      S: Math.min(10, k.S + (ALARMA.test(it.title) ? 1 : 0)), lugar, titulo: it.title, url: it.url, detalle: (it.desc || "").slice(0, 280),
      desmiente: kt.desmiente, atribuido: kt.atribuido && !kt.desmiente });
  }
  return [out, leidos];
}
