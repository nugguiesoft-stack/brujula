/* Brújula de Emergencia — núcleo de cálculo de los índices.
   Fichero aparte y sin dependencias para poder probarlo fuera del navegador (node pruebas/indices.mjs). */
(function (raiz) {
"use strict";
const NIV = {
  rumor: [0.15, "Rumor", 1], fuente_unica: [0.35, "Fuente única", 2], medios_locales: [0.45, "Medios locales", 3],
  varios_medios: [0.65, "Varios medios", 4], oficial: [0.85, "Oficial", 5], confirmado: [1, "Confirmado", 6]
};
const TEND = { escala: [1.15, "↑ Escala"], estable: [1, "→ Estable"], desescala: [0.85, "↓ Se calma"] };
const ZP = {
  asturias: { asturias: 1, espana: 0.85, ue: 0.7, europa: 0.6, mediterraneo: 0.5, oriente: 0.4, mundo: 0.2 },
  espana:   { asturias: 1, espana: 1,    ue: 0.75, europa: 0.65, mediterraneo: 0.55, oriente: 0.45, mundo: 0.2 }
};
// Zonas que cuentan como «en casa» para cada índice
const LOCAL = { asturias: ["asturias"], espana: ["asturias", "espana"] };
// Confianza para el suelo local: un suceso de aquí confirmado por varios medios ya es un hecho a efectos prácticos
const CONF_SUELO = { varios_medios: 0.85, oficial: 0.95, confirmado: 1 };

function pScope(e, scope) {
  if (scope === "global") return 1;
  let p = ZP[scope][e.zona] ?? 0.2;
  if (e.impacto_espana) p = Math.max(p, 0.9);
  return p;
}
// Lo antiguo pesa menos: un suceso sin novedades en semanas no debe mandar en el índice de hoy.
function edad(e, ahora = Date.now()) {
  if (!e.fecha) return 1;
  const d = (ahora - new Date(e.fecha)) / 864e5;
  return isNaN(d) || d <= 3 ? 1 : d <= 14 ? 0.85 : d <= 45 ? 0.7 : 0.5;
}
function contrib(e, scope = "asturias", ahora) {
  let c = (+e.S || 0) * (NIV[e.nivel]?.[0] ?? 0.35) * pScope(e, scope) * (TEND[e.tendencia]?.[0] ?? 1) * edad(e, ahora);
  if (e.desmentido) c *= 0.3;                       // desmentido por una fuente oficial: casi no cuenta
  return e.nivel === "rumor" ? Math.min(c, 1) : c;
}
function suma(cs, k) {
  // Cada suceso adicional pesa menos que el anterior: muchos titulares sobre lo mismo no disparan el índice.
  const W = [1, 0.35, 0.15];
  const sc = cs.slice(0, 12).reduce((a, c, i) => a + c * (W[i] ?? 0.15 * Math.pow(0.5, i - 2)), 0);
  return 10 * (1 - Math.exp(-sc / k));
}
/* Suelo local (v. 12 nov 2026): el índice de Asturias o de España no puede quedar por debajo de lo que
   marca un suceso grave y confirmado EN CASA. Sin esto, el atentado de Oviedo del 10 nov movió el índice
   de Asturias de 3,8 a 4,0: pesaban más las noticias de Irán que una bomba a pocos kilómetros.
   Solo se aplica a sucesos situados en la zona (no a los lejanos marcados con «impacto en España»),
   para que una semana tensa en Oriente Medio no dispare los índices de aquí. */
function suelo(e, scope, ahora) {
  if (scope === "global" || e.desmentido || !LOCAL[scope].includes(e.zona)) return 0;
  const c = CONF_SUELO[e.nivel]; if (!c) return 0;
  return Math.min(9.5, (+e.S || 0) * c * (ZP[scope][e.zona] ?? 0) * (TEND[e.tendencia]?.[0] ?? 1) * edad(e, ahora));
}
function indice(evs, scope, ahora) {
  if (!evs.length) return 0;
  const cs = evs.map((e) => contrib(e, scope, ahora)).sort((a, b) => b - a);
  let v = suma(cs, scope === "global" ? 16 : 12);
  if (scope !== "global") for (const e of evs) {
    v = Math.max(v, suelo(e, scope, ahora));
    const c = NIV[e.nivel]?.[0] ?? 0, p = pScope(e, scope);
    if (e.desmentido) continue;
    if (e.S >= 9 && c >= 0.85 && p >= 0.7) v = Math.max(v, 9);
    else if (e.S >= 8 && c >= 0.85 && p >= 1) v = Math.max(v, 8);
  }
  return Math.round(Math.min(10, v) * 10) / 10;
}
function dominio(evs, d, scope = "asturias", ahora) {
  const cs = evs.filter((e) => e.dominio === d).map((e) => contrib(e, scope, ahora)).sort((a, b) => b - a);
  if (!cs.length) return 0;
  return Math.round(10 * suma(cs, 6)) / 10;
}
function nivelDe(v) {
  if (v < 2) return ["Calma", "--ok"]; if (v < 4) return ["Vigilancia", "--watch"];
  if (v < 6) return ["Tensión", "--tense"]; if (v < 8) return ["Alerta", "--alert"]; return ["Emergencia", "--crit"];
}
// Qué hacer en cada nivel: una línea clara y prudente. Siempre remite a las fuentes oficiales.
const QUE_HACER = {
  Calma: "Nada especial. Día normal.",
  Vigilancia: "Nada especial. Hay asuntos en seguimiento; échale un vistazo a los sucesos si quieres.",
  "Tensión": "Mantente informado. Repasa lo básico en casa: móvil cargado, algo de efectivo, linterna y agua.",
  Alerta: "Infórmate en fuentes oficiales (112 Asturias, AEMET, Policía, Protección Civil) y evita la zona afectada. Ten el móvil cargado y con sonido.",
  Emergencia: "Sigue las instrucciones de ES-Alert y del 112. No te desplaces si no es necesario. Llama al 112 solo si necesitas ayuda."
};
const api = { NIV, TEND, ZP, pScope, edad, contrib, indice, dominio, nivelDe, suelo, QUE_HACER };
if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.BRUJULA_NUCLEO = api;
})(typeof window !== "undefined" ? window : globalThis);
