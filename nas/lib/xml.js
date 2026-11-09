// Lector mínimo de RSS/Atom (sin librerías): suficiente para titulares, enlaces, fechas y coordenadas.
import { limpia } from "./util.js";
const tag = (b, t) => { const m = b.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? limpia(m[1]) : ""; };
export function rss(xml) {
  const bloques = xml.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || [];
  return bloques.map((b) => {
    let url = tag(b, "link");
    if (!url) { const m = b.match(/<link[^>]*href="([^"]+)"[^>]*>/i); url = m ? m[1] : ""; }
    const pt = tag(b, "georss:point").split(/\s+/).map(Number);
    return {
      title: tag(b, "title"), desc: tag(b, "description") || tag(b, "summary") || tag(b, "content"),
      url, date: tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date"),
      id: tag(b, "guid") || tag(b, "id") || url,
      lat: pt.length === 2 && !isNaN(pt[0]) ? pt[0] : +tag(b, "geo:lat") || null, lon: pt.length === 2 && !isNaN(pt[1]) ? pt[1] : +tag(b, "geo:long") || null
    };
  });
}
