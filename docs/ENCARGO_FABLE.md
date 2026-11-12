# Encargo: revisión a fondo, mejoras y app Android de la Brújula de Emergencia

Este documento contiene todo lo que necesitas para trabajar en el proyecto sin preguntar lo básico. Léelo entero antes de empezar.

---

## 1. Qué es y para quién

**Brújula de Emergencia** es un proyecto personal de Nacho, que vive y trabaja en Asturias (España). Está pensado para estar **bien informado y enterarse antes** de cualquier peligro que le afecte: terremotos, apagones, ataques, escaladas bélicas, ciberataques o crisis económicas. Así puede tomar decisiones con tiempo.

- Da **tres índices de riesgo de 0 a 10**: Asturias, España y escalada global. Cada uno lleva su análisis, un mapa, los sucesos y las escaladas en seguimiento.
- Tiene una sección de **rumores sin contrastar** y un verificador de publicaciones que le pasan.
- **Todo debe ser gratuito.** No hay presupuesto para servicios de pago. Si algo cuesta dinero, se propone y se explica, pero no se usa sin que él lo apruebe.

### Cómo trabaja Nacho (respétalo)
- Escribe en **español** y quiere respuestas **en español, cortas, claras y directas**. Ante la duda, quita texto en vez de añadirlo.
- Valora que le **lleves la contraria** con argumentos cuando una idea suya no es buena.
- **Nunca inventes datos.** Si algo no está comprobado (fechas, cifras, nombres, formatos de una API), dilo explícitamente.
- **No programes tareas automáticas** (cron, tareas programadas de Claude, GitHub Actions que actualicen el análisis solas). El análisis del experto (`datos/analisis.json`) se actualiza solo cuando él dice «actualiza la brújula». Un workflow que **compile** la APK al subir código sí está bien, porque no es una actualización automática del análisis.
- Usa el **móvil Android** casi siempre. No usa el modo No molestar: silencia el sonido.
- El repositorio es **público**. No metas datos personales (direcciones, coordenadas de su casa, correos, tokens).

---

## 2. Arquitectura actual

Repositorio: `nugguiesoft-stack/brujula` (rama `main`). La web se publica con GitHub Pages en `https://nugguiesoft-stack.github.io/brujula/`.

### 2.1 Web (PWA estática)
| Fichero | Qué hace |
|---|---|
| `index.html` | Página única: índices, sensores en directo, análisis, mapa, sucesos, escaladas, rumores, verificador, estado de fuentes, ajustes y panel «Vigilante del NAS». |
| `app.js` | Toda la lógica. Al abrirse escanea fuentes a través del proxy, calcula los índices y lo pinta todo. La constante `VERSION` se muestra abajo; súbela en cada cambio. |
| `estilo.css` | Estilos (tema oscuro). |
| `land.js` | Contorno de tierra para el mapa. |
| `sw.js` | Service worker: primero la red, sin caché (`cache: "no-cache"`), para que nunca se quede la versión vieja. |
| `manifest.json`, `icono-*.png` | PWA instalable. |
| `datos/analisis.json` | **Capa del analista**: `estado` (resumen, notas), `eventos` (sucesos con S, nivel, tendencia, zona, fuentes, fiabilidad), `cadenas` (escaladas en seguimiento con pasos), `escenarios`, `fuentes`, `verificaciones`. Lo escribe Claude a mano cuando Nacho lo pide. |

**Puntos clave de `app.js`:**
- `pget()`: fetch a través del proxy. `PROXY_DEFAULT = "https://brujula.nugguiesoft.workers.dev"`.
- **Fuentes que escanea:**
  - Sismos y espacio: USGS, EMSC (sismos cerca de Asturias), NOAA (escalas, llamaradas, probabilidades).
  - Infraestructura: REE (demanda eléctrica, detector de apagón), IODA (cortes de internet), INCIBE-CERT.
  - Avisos oficiales: AEMET (CAP RSS), GDACS, avisos de viaje de EE. UU., Reino Unido y Alemania, alertas aéreas de Ucrania (`t.me/s/air_alert_ua`).
  - Prensa y mercados: prensa directa por RSS (española, asturiana con autodescubrimiento del feed de LNE, e internacional), Polymarket, GDELT (con Google Noticias como respaldo) y grupos de webs oficiales vía Google Noticias.
  - Lo que aprende el usuario: «fuentes que vigilas» (canales y webs que Nacho comparte).
- **Fórmula de los índices:**
  - Por suceso: `contrib = S × confianza(nivel) × proximidad(zona) × tendencia × decaimiento(edad)`.
  - Índice: `10·(1−e^(−sc/k))`. Los sucesos ordenados de mayor a menor pesan `[1, .35, .15, …]` hasta un máximo de 12. `k` vale 12 en lo local y 16 en lo global.
  - Suelos: S≥9 con confianza alta → índice ≥9; S≥8 → índice ≥8.
- **Análisis cruzado:**
  - Convergencia: ≥3 familias de fuentes sobre la misma región en 48 h generan un suceso «cruce».
  - Aceleración: un volumen de titulares ≥3× la media marca la tendencia como «escala».
- `TEND = {escala, estable, desescala}`: no existen otros valores.
- Sensores con historial guardado en `localStorage` (`brujula.senshist`): sparklines y barras.

### 2.2 Proxy Cloudflare Worker
`cloudflare/worker.js` (v3), desplegado a mano por Nacho en `brujula.nugguiesoft.workers.dev`:
- Exige `Origin` (la web de Pages o `localhost:8765`) y bloquea IPs privadas.
- Usa una cabecera User-Agent de navegador.
- Caché: GDELT 15 min y el resto 5 min.
- **Problema conocido:** desde las IPs de Cloudflare, Google Noticias responde 503, GDELT 429 y GDACS devuelve HTML. Por eso esas fuentes salen en rojo en la web.
- Si cambias el Worker, Nacho tiene que pegarlo a mano en el editor de Cloudflare desde el móvil. Minimiza esos cambios y, si los haces, dale instrucciones paso a paso muy concretas.

### 2.3 Vigilante del NAS (`nas/`)
Es un agente 24 h para su NAS **ASUSTOR AS1102TL**: ARM64 Realtek RTD1619B, **1 GB de RAM no ampliable**, sistema ADM y Docker con Portainer.
- **Técnica:** Node 22 alpine sin dependencias, `--max-old-space-size=64`, `mem_limit 160m`. En las pruebas consume unos 63 MB.
- **Código y actualización:** se descarga el código de GitHub (tarball de codeload) al arrancar el contenedor. Cada 6 h compara `nas/VERSION` y, si hay versión nueva, se reinicia para actualizarse. **Sube `nas/VERSION` en cada cambio del agente.**
- **Avisos:**
  - Se envían por **ntfy**, a un tema secreto (variable `NTFY_TOPIC`). Telegram es opcional.
  - Niveles: 4 EMERGENCIA, 3 ALERTA, 2 AVISO, 1.5 SEÑAL TEMPRANA (sin confirmar) y 1 info.
  - Solo avisa cuando un suceso sube de nivel.
  - Horario de silencio (solo suenan las emergencias), un máximo de 8 avisos por hora y resumen diario a las 8:30.
- **Motor** (`lib/motor.js`):
  - Agrupa las señales por `tema|lugar`.
  - Confianza combinada: `1−Π(1−c_i)`.
  - Las señales de prensa se suman al suceso de un sensor si coinciden en tema y zona en las últimas 3 h.
- **Mando a distancia** (`lib/control.js`): escucha el tema `NTFY_TOPIC-control` y acepta `apaga [2h]`, `enciende`, `silencio [8h]`, `normal` y `estado`. Los avisos de sistema llevan botones de acción http.
- **Ritmo:** fuentes normales cada 30 min de día y cada 60 de noche. Los sensores rápidos (`RAPIDOS`: sismos, tsunami, electricidad) van cada 2–5 min. Escribe en disco como mucho cada 10 min.
- **16 módulos** en `nas/modulos/`: sismos (IGN, EMSC, USGS), tsunami, electricidad (REE), internet (IODA), espacio (NOAA), meteo (AEMET), desastres (GDACS), ciber (INCIBE), telegram, aereo (OpenSky), militar (adsb.lol), wikipedia (SSE page-create), mercados (Polymarket), prensa (14 RSS), gdelt y oficial.
- **Publicación:** genera `estado.json` y, si se configura, lo sube a un Gist que la web lee en el panel «Vigilante del NAS».
- **Pruebas sin internet:**
  - `node nas/prueba/ensayo.mjs`: simula un día normal y después un suceso grave.
  - `node nas/prueba/mando.mjs`: prueba el mando a distancia.
- **Guía de instalación:** `nas/GUIA.md`.
- **Estado:** Nacho **todavía no lo ha instalado**. Nada del vigilante está probado contra las fuentes reales desde su red. Formatos sin verificar: el visor JSONP de REE, IODA, la clave futura de adsb.lol y que ASUSTOR ofrezca Docker para su modelo.

---

## 3. Lo que te pido

### Tarea A · Revisión completa y arreglos
1. Lee **todo** el código (web, Worker y NAS) y busca errores, casos límite, fugas de memoria, condiciones de carrera, problemas de accesibilidad y de rendimiento en móvil, y texto confuso para el usuario.
2. **Comprueba que las fuentes funcionan de verdad.** Usa WebFetch y la búsqueda web para confirmar las URL y los formatos actuales de cada fuente. Si una ha cambiado o ha muerto, sustitúyela. Marca como «sin verificar» lo que no puedas comprobar.
3. Revisa la **calibración de los índices** con casos reales recientes:
   - **Oviedo, 10 nov 2026**: tiroteo y mochila bomba con un policía muerto y el autor huido. Fue un suceso local grave: ¿el índice de Asturias reaccionó lo bastante rápido y lo bastante alto?
   - La escalada EE. UU.–Irán: que una semana tensa no dispare los índices de España.
4. **Rumores frente a hechos.** El 10 nov un sindicato policial dio por muerto a un segundo agente y la Policía lo desmintió horas después. Asegúrate de que tanto la web como el NAS tratan un dato de una sola fuente no oficial como «sin confirmar», y que una desmentida oficial lo corrige.
5. Ejecuta las pruebas del NAS y añade las que falten. Si cambias la web, comprueba que no hay errores en la consola. En el entorno hay Playwright y se puede servir la web con `python3 -m http.server 8765`.

### Tarea B · Mejoras a mayores (las que veas oportunas)
Investiga qué hacen bien otros sistemas de alerta temprana y de vigilancia de crisis, e incorpora lo que aporte valor sin romper la regla de «gratis y ligero». Algunas ideas, para valorar y no para aplicar a ciegas:
- **Fuentes primarias nuevas:**
  - ES-Alert y Protección Civil: ¿hay algún feed público?
  - 112 Asturias: ¿tiene RSS o X?
  - CSN (avisos radiológicos), la red de alerta a la radiactividad (REA) y EURDEP (radiactividad en Europa).
  - Copernicus EMS.
  - Avisos a la navegación y NAVTEX del Cantábrico.
  - Cierres de aeropuertos (NOTAM y Eurocontrol).
  - Cloudflare Radar (cortes de internet) y Downdetector u otros equivalentes gratuitos.
  - El Sistema de Alerta Temprana de incendios.
  - Calidad del aire en Asturias.
  - Caudales de ríos (Confederación Hidrográfica del Cantábrico).
  - Alertas de la OMS y del ECDC.
- **Contexto para el usuario:** para cada nivel de riesgo, una línea de «qué hacer» clara y prudente, que no sea alarmista y que remita siempre a ES-Alert, 112 y fuentes oficiales.
- **Que la web aproveche más el NAS:** historial de índices, sucesos con su línea temporal, «qué ha cambiado desde tu última visita».
- **Reducir dependencias del proxy de Cloudflare** donde sea posible: fuentes con CORS abierto y leídas directamente.

Para cada mejora, piensa en el coste en memoria del NAS y en lo que tendría que hacer Nacho. Prioriza; no lo metas todo.

### Tarea C · App Android (APK) chula
Nacho quiere una **app Android instalable** que reúna todo. Decide tú la mejor vía y justifícala en dos líneas. Algunas opciones:
- **Capacitor envolviendo la PWA**, con notificaciones locales y lectura del tema ntfy o del Gist del NAS.
- **TWA (Trusted Web Activity)**, que es más ligera.
- **App nativa sencilla.**

Requisitos y deseos:
- Debe funcionar **sin Google Play**: APK para instalar a mano, con instrucciones paso a paso para Android.
- Que **se vea bien y sea rápida**:
  - Pantalla principal con los tres índices bien visibles.
  - Un «semáforo» del día.
  - Mapa, sucesos, escaladas y el estado del vigilante del NAS.
  - Un widget de pantalla de inicio con el índice de Asturias, si es viable.
- **Avisos al móvil.** Lo ideal es que los avisos del NAS lleguen a la app, o que la app se integre con ntfy (por ejemplo, con UnifiedPush). Nacho tiene el móvil en silencio y no usa No molestar: valora si una EMERGENCIA puede sonar por el canal de alarma, y explica límites y permisos con honestidad.
- Botones del mando del vigilante (apagar, silenciar, estado) dentro de la app.
- **Compilación gratuita y reproducible:** si en el entorno no puedes compilar (falta el SDK de Android o hay restricciones de red), crea un **workflow de GitHub Actions** que compile la APK al subir código y la publique en una *Release* del repositorio. Así Nacho la descarga desde el móvil. Firma la APK con una clave de depuración o con una clave guardada como secreto del repositorio, y explícale cómo crearla si hace falta.
- El repo es público: **nada de secretos en el código** (temas de ntfy, tokens o coordenadas). Se configuran dentro de la app, en la pantalla de ajustes.

---

## 4. Forma de trabajar y entrega

- Haz una **lista de tareas** visible y ve marcándola.
- Haz *commits* pequeños y con mensajes claros en español. Sube a `main` solo lo que hayas probado.
- **Sube `VERSION` en `app.js` y `nas/VERSION`** cuando toquen.
- No rompas lo que funciona: si cambias el formato de `analisis.json` o de `estado.json`, mantén la compatibilidad.
- **Entrega final**, corta y en español, para Nacho:
  1. Qué has arreglado.
  2. Qué fuentes has añadido o cambiado, y cuáles no has podido verificar.
  3. Cómo instalar la APK, paso a paso para Android.
  4. Qué tiene que hacer él, si hay algo: actualizar el Worker, el stack de Portainer, etc.
  5. Lo que queda pendiente o propones para la próxima versión.

Gracias. Hazlo lo mejor posible: esto le sirve a una persona real para anticiparse a emergencias.
