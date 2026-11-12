// Configuración: variables de entorno (Portainer) con valores por defecto sensatos.
import fs from "node:fs";
const env = process.env;
const num = (v, d) => (v === undefined || v === "" || isNaN(+v) ? d : +v);
const lista = (v) => (v || "").split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export const DATA = env.BRUJULA_DATA || "/data";
let fichero = {};
try { fichero = JSON.parse(fs.readFileSync(`${DATA}/config.json`, "utf8")); } catch {}

export const CFG = {
  version: (() => { try { return fs.readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim(); } catch { return "dev"; } })(),
  ntfyServer: env.NTFY_SERVER || fichero.ntfyServer || "https://ntfy.sh",
  ntfyTopic: env.NTFY_TOPIC || fichero.ntfyTopic || "",
  ntfyToken: env.NTFY_TOKEN || fichero.ntfyToken || "",
  telegramToken: env.TELEGRAM_TOKEN || fichero.telegramToken || "",
  telegramChat: env.TELEGRAM_CHAT || fichero.telegramChat || "",
  casa: [num(env.CASA_LAT, fichero.casaLat ?? 43.36), num(env.CASA_LON, fichero.casaLon ?? -5.85)],
  silencio: env.SILENCIO || fichero.silencio || "23-08",          // horas en las que solo suenan emergencias
  resumen: env.RESUMEN_DIARIO || fichero.resumen || "08:30",      // "" para desactivar
  canales: [...new Set([...lista(env.TELEGRAM_CANALES), ...(fichero.canales || [])])], // canales públicos de Telegram extra
  gistId: env.GIST_ID || fichero.gistId || "",
  githubToken: env.GITHUB_TOKEN || fichero.githubToken || "",
  healthcheck: env.HEALTHCHECK_URL || fichero.healthcheck || "",
  repo: env.BRUJULA_REPO || "nugguiesoft-stack/brujula",
  web: env.BRUJULA_WEB || "https://nugguiesoft-stack.github.io/brujula/",
  desactivar: lista(env.DESACTIVAR || (fichero.desactivar || []).join(",")),
  intervaloDia: num(env.INTERVALO_DIA, 30),                      // minutos entre consultas de día (fuentes normales)
  intervaloNoche: num(env.INTERVALO_NOCHE, 60),                  // minutos entre consultas de noche (horario de SILENCIO)
  rapidos: (env.RAPIDOS ?? "sismos,tsunami,electricidad,local").split(",").map((x) => x.trim()).filter(Boolean), // sensores que siguen rápidos
  ritmo: num(env.RITMO, 1),                                       // 2 = la mitad de consultas (más lento, menos red)
  mock: env.BRUJULA_MOCK || ""
};
