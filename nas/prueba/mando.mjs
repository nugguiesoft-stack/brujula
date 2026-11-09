// Prueba del mando a distancia con un servidor ntfy simulado (sin internet)
import http from "node:http"; import fs from "node:fs";
const recibidos = []; let stream;
const srv = http.createServer((q, r) => {
  if (q.method === "GET" && q.url.includes("/json")) { r.writeHead(200, { "Content-Type": "application/x-ndjson" }); stream = r; return; }
  let b = ""; q.on("data", (c) => (b += c)); q.on("end", () => { try { recibidos.push(JSON.parse(b)); } catch {} r.end("{}"); });
}).listen(0);
fs.rmSync("/tmp/bd-mando", { recursive: true, force: true });
Object.assign(process.env, { BRUJULA_DATA: "/tmp/bd-mando", NTFY_TOPIC: "t", NTFY_SERVER: "http://127.0.0.1:" + srv.address().port, SILENCIO: "-" });
const ctl = await import("../lib/control.js"); const { avisar } = await import("../lib/avisar.js");
ctl.escuchar(async (r) => avisar({ nivel: 1, forzar: true, sistema: true, titulo: "Brújula NAS", texto: r || "estado" }));
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
const orden = (m) => stream.write(JSON.stringify({ id: "x" + Math.random(), event: "message", message: m }) + "\n");
await sl(300);
for (const m of ["apaga 2h", "estado", "enciende", "silencio 8h"]) { orden(m); await sl(150); console.log(`«${m}» → apagado=${ctl.apagado()} silencio=${ctl.silenciado()}`); }
await avisar({ nivel: 2, titulo: "Aviso normal (debe quedar retenido por el silencio)" });
await avisar({ nivel: 4, titulo: "EMERGENCIA (debe sonar aunque haya silencio)" });
orden("normal"); await sl(150); orden("hola"); await sl(150);
for (const x of recibidos) console.log(`[p${x.priority}] ${x.title} | ${x.message.split("\n")[0]} | botones: ${(x.actions || []).map((a) => a.label).join(", ")}`);
process.exit(0);
