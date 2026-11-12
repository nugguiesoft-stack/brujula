// Calibración de los índices de la web con casos reales. Uso: node pruebas/indices.mjs
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const N = require("../nucleo.js"); const ana = require("../datos/analisis.json");
let fallos = 0, n = 0; const ok = (c, t) => { n++; if (!c) fallos++; console.log(`  ${c ? "✓" : "✗ FALLA:"} ${t}`); };
const AHORA = +new Date("2026-11-12T12:00:00+01:00"); const I = (evs, s) => N.indice(evs, s, AHORA);
const sinOviedo = ana.eventos.filter((e) => !/^oviedo/.test(e.id)), oviedo = ana.eventos.find((e) => /^oviedo/.test(e.id));

console.log("\n1) Oviedo (10 nov 2026)");
const base = I(sinOviedo, "asturias");
ok(oviedo && oviedo.zona === "asturias", `el análisis recoge el suceso: «${oviedo?.titulo}» (gravedad ${oviedo?.S}, ${oviedo?.nivel})`);
const con = I(ana.eventos, "asturias");
ok(con - base >= 1, `con el análisis actual, Asturias pasa de ${base} a ${con} (antes del arreglo: de 3,8 a 4,0)`);
const dia0 = { ...oviedo, S: 7, nivel: "varios_medios", tendencia: "escala", fecha: "2026-11-12" };
const v0 = I([...sinOviedo, dia0], "asturias");
ok(v0 >= 6 && v0 < 8, `el primer día (gravedad 7, varios medios, en escalada): ${v0} → ${N.nivelDe(v0)[0]}`);
ok(I([...sinOviedo, { ...dia0, nivel: "fuente_unica" }], "asturias") - base < 1, "con una sola fuente todavía no sube: hace falta confirmación");
ok(I([...sinOviedo, { ...dia0, nivel: "confirmado", desmentido: true }], "asturias") - base < 0.5, "si una fuente oficial lo desmiente, deja de contar");
const semanas = I([...sinOviedo, { ...dia0, tendencia: "estable", fecha: "2026-10-20" }], "asturias");
ok(semanas < v0, `y se va apagando si no hay novedades (a las tres semanas: ${semanas})`);

console.log("\n2) Semana tensa EE. UU.–Irán");
const e0 = I(ana.eventos, "espana"), a0 = I(ana.eventos, "asturias"), g0 = I(ana.eventos, "global");
const iran = ["Ataque de EE. UU. a bases de misiles", "Irán lanza misiles contra una base en Irak", "Israel bombardea Teherán", "Cierre total de Ormuz", "Derribo de un avión de EE. UU.", "Ataque a un petrolero en el golfo"]
  .map((t, i) => ({ id: "x" + i, titulo: t, S: 8, nivel: "confirmado", tendencia: "escala", zona: "oriente", dominio: "belico", fecha: "2026-11-12" }));
const e1 = I([...ana.eventos, ...iran], "espana"), a1 = I([...ana.eventos, ...iran], "asturias"), g1 = I([...ana.eventos, ...iran], "global");
ok(e1 < 6 && e1 - e0 <= 1.2, `seis ataques graves y confirmados en Oriente Medio: España ${e0} → ${e1} (sigue por debajo de «Alerta»)`);
ok(a1 < 6 && a1 - a0 <= 1.2, `Asturias ${a0} → ${a1}`);
ok(g1 > g0 && g1 >= 6, `donde sí se nota es en la escalada global: ${g0} → ${g1}`);
ok(I([...ana.eventos, { ...iran[0], impacto_espana: true }], "espana") < 8, "ni siquiera marcado con «impacto en España» activa el suelo local");

console.log("\n3) Coherencia general");
ok(I([], "asturias") === 0, "sin sucesos, índice 0");
ok(I([{ S: 9, nivel: "confirmado", zona: "espana", tendencia: "estable" }], "asturias") >= 9, "gravedad 9 confirmada en España: suelo de 9");
ok(I([{ S: 5, nivel: "oficial", zona: "asturias", tendencia: "estable" }], "asturias") >= 4 && I([{ S: 5, nivel: "oficial", zona: "asturias", tendencia: "estable" }], "asturias") < 6, "aviso naranja en Asturias (gravedad 5, oficial): «Tensión», no «Alerta»");
ok(I(Array.from({ length: 30 }, (_, i) => ({ S: 3, nivel: "varios_medios", zona: "espana", tendencia: "estable" })), "espana") < 4, "treinta noticias menores no suman una alerta");
for (const e of ana.eventos) if (!N.TEND[e.tendencia] || !N.NIV[e.nivel]) { ok(false, `analisis.json: valor desconocido en ${e.id}`); }
console.log(`\n${n - fallos}/${n} comprobaciones correctas.`); process.exit(fallos ? 1 : 0);
