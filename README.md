# Brújula de Emergencia

Panel personal de riesgos para Asturias, España y el mundo. Se ejecuta entero en el navegador.

- **Capa del analista:** `datos/analisis.json`, sucesos revisados a mano con fuentes.
- **Capa automática:** al abrir la página consulta GDELT (noticias en 65 idiomas), USGS (terremotos), NOAA (tormentas solares) y Polymarket (mercados de predicción).
- **Bitácora:** cada escaneo se guarda en el navegador.

Herramienta de orientación. Ante una emergencia, sigue siempre a ES-Alert, el 112 y Protección Civil.

## Vigilante 24 h en un NAS

La carpeta [`nas/`](nas/) contiene un agente ligero (unos 60 MB de RAM) que vigila fuentes primarias sin parar y avisa al móvil con ntfy. Instalación paso a paso: [`nas/GUIA.md`](nas/GUIA.md).
