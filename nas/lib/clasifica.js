// Clasificación de textos (titulares, mensajes): tema, gravedad y lugar. Misma lógica que la web.
import { km } from "./util.js";
import { CFG } from "./config.js";
const P = [
  ["asturias|oviedo|gij[oó]n|avil[eé]s|carre[ñn]o|siero|langreo|mieres|llanes|cangas|navia|luarca", "Asturias", 43.36, -5.85, "asturias"],
  ["cantabria|santander|le[oó]n|galicia|lugo|ourense|coru[ñn]a|vigo|bilbao|euskadi|pa[ií]s vasco", "Norte de España", 43.2, -4.5, "espana"],
  ["spain|españa|espagne|spanien|madrid|barcelona|valencia|sevilla|zaragoza|m[aá]laga|c[aá]diz|rota|mor[oó]n|canarias|baleares|ceuta|melilla|tarragona|lleida|l[eé]rida|girona|gerona|castell[oó]n|alicante|murcia|cartagena|almer[ií]a|granada|ja[eé]n|c[oó]rdoba|huelva|algeciras|gibraltar|badajoz|c[aá]ceres|extremadura|salamanca|zamora|valladolid|palencia|burgos|soria|segovia|[aá]vila|toledo|guadalajara|cuenca|albacete|ciudad real|teruel|huesca|navarra|pamplona|la rioja|logro[ñn]o|vitoria|[aá]lava|san sebasti[aá]n|donostia|guip[uú]zcoa|gipuzkoa|pontevedra|tenerife|gran canaria|las palmas|lanzarote|fuerteventura|la palma|mallorca|ibiza|menorca|andaluc[ií]a|catalu[ñn]a|catalonia|arag[oó]n|castilla", "España", 40.4, -3.7, "espana"],
  ["portugal|lisbon|lisboa|oporto|porto", "Portugal", 39.4, -8.2, "ue"], ["france|francia|par[ií]s|bordeaux|burdeos|toulouse|marseille", "Francia", 46.6, 2.4, "ue"],
  ["germany|alemania|deutschland|berl[ií]n|ramstein", "Alemania", 51.2, 10.4, "ue"], ["italy|italia|roma|rome|sicil|aviano|sigonella", "Italia", 42.8, 12.6, "ue"],
  ["poland|polonia|warsaw|varsovia|rzesz[oó]w", "Polonia", 52.1, 19.4, "ue"], ["lithuania|lituania|vilnius|suwa[lł]ki", "Lituania", 55.2, 23.9, "ue"],
  ["latvia|letonia|riga", "Letonia", 56.9, 24.6, "ue"], ["estonia|tallinn|narva", "Estonia", 58.6, 25.0, "ue"],
  ["finland|finlandia|helsinki", "Finlandia", 64.0, 26.0, "ue"], ["sweden|suecia|stockholm|gotland", "Suecia", 60.1, 18.6, "ue"],
  ["denmark|dinamarca|copenhag|bornholm", "Dinamarca", 56.0, 10.0, "ue"], ["netherlands|pa[ií]ses bajos|holanda|amsterdam|rotterdam", "Países Bajos", 52.1, 5.3, "ue"],
  ["belgium|b[eé]lgica|brussels|bruselas", "Bélgica", 50.5, 4.5, "ue"], ["romania|ruman[ií]a|bucharest|bucarest", "Rumanía", 45.9, 24.9, "ue"],
  ["greece|grecia|athens|atenas|crete|creta", "Grecia", 39.1, 21.8, "ue"], ["kaliningrad|kaliningrado", "Kaliningrado", 54.7, 20.5, "ue"],
  ["moldova|moldavia|transnistria", "Moldavia", 47.0, 28.8, "europa"], ["united kingdom|reino unido|britain|london|londres|scotland|escocia", "Reino Unido", 54.0, -2.0, "europa"],
  ["ireland|irlanda|dublin", "Irlanda", 53.3, -7.7, "ue"], ["norway|noruega|oslo", "Noruega", 61.0, 9.0, "europa"],
  ["ukraine|ucrania|kyiv|kiev|kharkiv|j[aá]rkiv|odesa|odessa|zaporizh|dnipro|lviv", "Ucrania", 48.4, 31.2, "europa"],
  ["russia|rusia|moscow|mosc[uú]|kremlin|kremlin|petersburg|petersburgo", "Rusia", 55.8, 37.6, "europa"], ["belarus|bielorrusia|minsk", "Bielorrusia", 53.7, 27.9, "europa"],
  ["serbia|kosovo|bosnia|balkans|balcanes", "Balcanes", 43.5, 20.8, "europa"], ["turkey|t[uü]rkiye|turqu[ií]a|ankara|istanbul|estambul", "Turquía", 39.0, 35.0, "mediterraneo"],
  ["morocco|marruecos|rabat|casablanca|tanger|t[aá]nger", "Marruecos", 31.8, -7.1, "mediterraneo"], ["algeria|argelia|algiers|argel", "Argelia", 28.0, 2.6, "mediterraneo"],
  ["libya|libia|tripoli", "Libia", 26.3, 17.2, "mediterraneo"], ["tunisia|t[uú]nez", "Túnez", 34.0, 9.0, "mediterraneo"], ["egypt|egipto|cairo|suez", "Egipto", 26.8, 30.8, "mediterraneo"],
  ["cyprus|chipre|akrotiri", "Chipre", 35.0, 33.0, "mediterraneo"],
  ["israel|tel aviv|jerusalem|jerusal[eé]n|haifa", "Israel", 31.4, 35.0, "oriente"], ["gaza|west bank|cisjordania", "Palestina", 31.5, 34.45, "oriente"],
  ["lebanon|l[ií]bano|beirut|hezbollah|hezbol[aá]", "Líbano", 33.9, 35.8, "oriente"], ["syria|siria|damascus|damasco", "Siria", 35.0, 38.5, "oriente"],
  ["iran|ir[aá]n|tehran|teher[aá]n|isfahan|bushehr|natanz|fordow", "Irán", 32.4, 53.7, "oriente"], ["hormuz|ormuz|qeshm|bandar abbas", "Ormuz", 26.6, 56.3, "oriente"],
  ["iraq|irak|baghdad|bagdad|erbil", "Irak", 33.2, 43.7, "oriente"], ["saudi|arabia saud[ií]|riyadh|riad", "Arabia Saudí", 23.9, 45.1, "oriente"],
  ["yemen|houthi|hut[ií]|red sea|mar rojo|bab el.mandeb", "Yemen / mar Rojo", 15.6, 48.5, "oriente"], ["qatar|catar|doha", "Catar", 25.3, 51.2, "oriente"],
  ["emirates|emiratos|dubai|abu dhabi", "Emiratos", 24.4, 54.4, "oriente"], ["kuwait", "Kuwait", 29.3, 47.9, "oriente"], ["bahrain|bar[eé]in", "Baréin", 26.0, 50.5, "oriente"],
  ["jordan|jordania|amman", "Jordania", 31.95, 35.9, "oriente"], ["pakistan|pakist[aá]n", "Pakistán", 30.4, 69.3, "mundo"],
  ["india|delhi|kashmir|cachemira", "India", 21.0, 78.0, "mundo"], ["china|beijing|pek[ií]n|shanghai", "China", 35.9, 104.2, "mundo"],
  ["taiwan|taiw[aá]n|taipei", "Taiwán", 23.7, 121.0, "mundo"], ["north korea|corea del norte|pyongyang", "Corea del Norte", 40.3, 127.5, "mundo"],
  ["japan|jap[oó]n|tokyo|tokio", "Japón", 36.2, 138.3, "mundo"], ["united states|estados unidos|ee\\.? ?uu|washington|pentagon|pent[aá]gono|white house|casa blanca", "EE. UU.", 38.9, -77.0, "mundo"],
  ["venezuela|caracas", "Venezuela", 6.4, -66.6, "mundo"], ["sudan|sud[aá]n", "Sudán", 15.5, 32.5, "mundo"]
].map(([re, nombre, lat, lon, zona]) => ({ re: new RegExp("(^|[^\\p{L}])(" + re + ")", "iu"), nombre, lat, lon, zona }));

export function lugar(texto = "") {
  for (const p of P) { const m = texto.match(p.re); if (!m) continue;
    // En España se guarda la ciudad concreta ("Tarragona"), útil en los avisos
    const nombre = /España/.test(p.nombre) && !/^(spain|españa|espagne|spanien)$/i.test(m[2]) ? m[2][0].toUpperCase() + m[2].slice(1).toLowerCase() : p.nombre;
    return { nombre, lat: p.lat, lon: p.lon, zona: p.zona }; }
  return { nombre: "", lat: null, lon: null, zona: "mundo" };
}
export function zonaDe(lat, lon) {
  if (lat == null || lon == null) return "mundo";
  const d = km(CFG.casa[0], CFG.casa[1], lat, lon);
  if (d < 250) return "asturias";
  if (lat > 35.8 && lat < 44 && lon > -9.5 && lon < 4.5) return "espana";
  if (lat > 27 && lat < 30 && lon > -18.5 && lon < -13) return "espana"; // Canarias
  if (lat > 34 && lat < 72 && lon > -25 && lon < 32) return d < 2500 ? "ue" : "europa";
  if (lat > 30 && lat < 46 && lon > -6 && lon < 37) return "mediterraneo";
  if (lat > 12 && lat < 42 && lon > 32 && lon < 63) return "oriente";
  return "mundo";
}
const TEMAS = [
  ["nuclear", 8, /nuclear|yodo|iodine|radiac|radiation|radiolog|at[oó]mic|atomic|ядерн/i],
  ["industrial", 5, /planta qu[ií]mica|petroqu[ií]mica|refiner[ií]a|fuga (de gas|t[oó]xica|qu[ií]mica)|nube t[oó]xica|escape de (gas|amon[ií]aco|cloro)|vertido t[oó]xico|chemical (plant|leak|spill)|toxic (cloud|leak|gas)|gas leak|derrumbe|collapse/i],
  ["belico", 6, /misil|missile|ataque|attack|strike|bombard|guerra|\bwar\b|invasi|tropas|troops|ej[eé]rcito|army|\bdrones?\b|otan|nato|militar|military|interceptad|intercepted|air raid|sirenas|sirens|explosi[oó]n|explosion|tiroteo|shooting|atentado|terror/i],
  ["energia", 4, /apag[oó]n|blackout|power outage|corte (de luz|el[eé]ctrico)|sin luz|red el[eé]ctrica|petr[oó]leo|\boil\b|combustible|fuel|gasolina|di[eé]sel|gasoducto|pipeline/i],
  ["ciber", 5, /hack|ciber|cyber|ransomware|ddos|malware|ca[ií]da (de|del) (sistema|servicio)|outage|infraestructura cr[ií]tica/i],
  ["banca", 5, /\bbanc|\bbank|corralito|cajero|\batm\b|p[aá]nico bancario|bank run|dep[oó]sit|bolsa se desploma|market crash/i],
  ["natural", 4, /terremoto|sismo|earthquake|tsunami|inundaci|flood|incendio|wildfire|temporal|hurac[aá]n|hurricane|erupci[oó]n|eruption|dana\b|riada/i],
  ["sanitario", 4, /virus|brote|outbreak|pandemi|epidemi|contagio|cuarentena|quarantine/i],
  ["social", 3, /huelga|strike|protesta|protest|disturbios|riots|manifestaci|toque de queda|curfew/i]
];
const SUBE = [
  [/nuclear (strike|attack|war|detonation)|ataque nuclear|guerra nuclear|detonaci[oó]n nuclear|frappe nucl[eé]aire/i, 9],
  [/iodine|pastillas de yodo|comprimidos de yodo/i, 8],
  [/declares? war|declara(ci[oó]n de)? la guerra|article 5|art[ií]culo 5|state of war|estado de guerra/i, 9],
  [/estado de (alarma|excepci[oó]n|sitio)|state of emergency|martial law|ley marcial/i, 7],
  [/shelter in place|conf[ií]nense|confina(r|miento|dos?)\b|qu[eé]dense en casa|stay indoors|refugio|bunker|b[uú]nker/i, 7],
  [/ballistic|bal[ií]stic|hypersonic|hipers[oó]nic|cruise missile|misil de crucero/i, 7],
  [/airspace (closed|closure)|cierre del espacio a[eé]reo|espacio a[eé]reo cerrado/i, 6],
  [/fuerte terremoto|strong earthquake|major earthquake|powerful earthquake|gran intensidad|desaloj/i, 6],
  [/evacuaci[oó]n|evacuate|evacuation|abandonen/i, 5],
  [/muertos|fallecidos|dead|killed|v[ií]ctimas/i, 5],
  [/bank run|corralito|colapso bancario|bank collapse/i, 6]
];
export const ALARMA = /breaking|just in|[uú]ltima hora|urgente|🚨|⚠️|alerta|alert|flash/i;

export function clasifica(texto = "") {
  let tema = "otros", S = 1;
  for (const [t, base, re] of TEMAS) if (re.test(texto)) { tema = t; S = base; break; }
  if (tema === "otros") return { tema, S: 0, lugar: lugar(texto) };
  for (const [re, v] of SUBE) if (re.test(texto)) S = Math.max(S, v);
  return { tema, S, lugar: lugar(texto) };
}
