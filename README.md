# Brújula de Emergencia

Panel personal de riesgos para Asturias, España y el mundo. Tres piezas:

| Pieza | Dónde | Qué hace |
|---|---|---|
| **Web** | raíz del repositorio (GitHub Pages) | Escanea las fuentes al abrirla, calcula los tres índices y muestra semáforo, mapa, sucesos, rumores sin confirmar y el estado del NAS. |
| **Vigilante del NAS** | [`nas/`](nas/) | Agente ligero (unos 65 MB de RAM) que vigila 24 h y avisa al móvil con ntfy. Guía: [`nas/GUIA.md`](nas/GUIA.md). |
| **App Android** | [`android/`](android/) | Envuelve la web y añade avisos con alarma, widget y mando del vigilante. Guía: [`android/LEEME.md`](android/LEEME.md). |

- **Capa del analista:** `datos/analisis.json`, sucesos revisados a mano con fuentes. Solo se actualiza cuando se pide.
- **Capa automática:** sensores (sismos, red eléctrica, internet, tiempo espacial), avisos oficiales (AEMET, GDACS, Copernicus, OMS, avisos de viaje) y prensa leída directamente.
- **Sin confirmar frente a hecho:** lo que solo cuenta una fuente no oficial no cuenta para los índices; un desmentido oficial lo retira o deja anotada la corrección.

## Pruebas

```
node nas/prueba/casos.mjs      # motor del NAS: Oviedo 10-nov, rumor y desmentido, semana de Irán, formatos reales
node nas/prueba/ensayo.mjs     # ensayo completo del NAS sin internet
node nas/prueba/mando.mjs      # mando a distancia
node pruebas/indices.mjs       # calibración de los índices de la web
python3 -m http.server 8765 &  # y después:
node pruebas/web.mjs           # la web en un navegador real con fuentes simuladas (necesita Playwright)
```

`node nas/prueba/fuentes.mjs` comprueba contra internet que cada fuente responde. También se puede lanzar a mano en GitHub → Actions → «Comprobar fuentes». No hay nada programado: ninguna tarea se ejecuta sola.

Herramienta de orientación. Ante una emergencia, sigue siempre a ES-Alert, el 112 y Protección Civil.
