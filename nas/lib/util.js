export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const ahora = () => Date.now();
export function km(a, b, c, d) {
  const R = 6371, r = Math.PI / 180, x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export const hora = (t = Date.now()) => new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const horaLocal = () => { const p = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date()); const g = (t) => +p.find((x) => x.type === t).value; return [g("hour") % 24, g("minute")]; };
export const limpia = (s = "") => String(s).replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
// Convierte una fecha en hora de Madrid (sin zona) a milisegundos UTC
export function madrid(y, mo, d, h = 0, mi = 0, s = 0) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = (t) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)); const g = (x) => +p.find((q) => q.type === x).value; return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - t; };
  return guess - off(guess);
}
// "2026-11-12T12:40" en hora de Madrid (Red Eléctrica interpreta así las fechas de sus consultas)
export const isoMadrid = (t = Date.now()) => new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Madrid", hour12: false }).replace(" ", "T").slice(0, 16);
