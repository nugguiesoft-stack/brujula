# Entrega del encargo (12 nov 2026)

Resumen de lo hecho sobre `docs/ENCARGO_FABLE.md`. Todo está en `main`.

## Fallos encontrados y arreglados

| Dónde | Fallo | Arreglo |
|---|---|---|
| Web y NAS | **Red Eléctrica:** las fechas se pedían en UTC y la API las lee en hora de Madrid. El detector de apagón miraba un dato de hace 1–2 h. | Fechas en hora de Madrid; se comprueba la antigüedad del dato. |
| NAS | El «visor de demanda» de REE ya no devuelve datos. | Quitado. La API oficial da un valor cada 10 min. |
| Web | **Oviedo:** «tiroteo», «bomba» o «atentado» no estaban en el clasificador; el suceso movía Asturias de 3,8 a 4,0. | Dominio «Terrorismo y seguridad» y suelo local en los índices. |
| Web y NAS | Se clasificaba titular + entradilla: «OTAN», «guerra» o «nuclear» de pasada daban gravedad 6–8 (con titulares reales de hoy: 56 falsas alarmas en 11 medios). | Solo el titular; mención política ≠ ataque. Quedan 16, ninguna local falsa. |
| NAS | **Tsunami:** todo boletín informativo contaba como alerta (el texto de la definición contiene «warning»). | Se lee la categoría del boletín. |
| Web y NAS | **AEMET:** las zonas asturianas no llevan la palabra «Asturias»; y «red» (rojo) casaba dentro de «alrededor» o «predicción». | Zonas por nombre, nivel por el título. |
| Web y NAS | **IODA** marca decenas de países al día con una sola técnica: cortes de internet fantasma. | Hace falta que lo vean dos técnicas. |
| NAS | **IGN:** la hora viene con un dígito («6:50:45»); no se leía y los sismos viejos pasaban por nuevos. | Formato corregido y cruce entre redes por cercanía. |
| NAS | Fuga de memoria en la caché de descargas (direcciones con fecha). | Caché acotada. |
| NAS | La Nueva España rechaza el identificador del NAS (406). | Reintento como navegador. |
| Web y NAS | «Romania» se leía como «Roma», «Sierra Leona» como «León», equipos de fútbol como ciudades. | Límite de palabra y lista de excepciones. |
| Web | Un solo medio contaba para el índice; un desmentido contaba como confirmación. | Reglas de «sin confirmar», datos atribuidos y desmentidos (también en el NAS). |
| Web | Móvil: la página se desbordaba por la derecha; botones pequeños; sin copia sin conexión. | Corregido; barra inferior; el service worker guarda la última copia. |
| Web | GDELT caído hacía esperar un minuto. | Se omite tras dos fallos. |

## Fuentes: comprobadas contra internet

Con `nas/prueba/fuentes.mjs` desde los servidores de GitHub (no desde tu casa).

- **Responden y con el formato esperado:** IGN, EMSC, USGS, tsunami.gov, REE (API), IODA, NOAA (tres), OpenSky, adsb.lol, GDACS (solo con identificador propio), INCIBE-SCI, avisos de viaje de EE. UU., Reino Unido y Alemania, alertas de Ucrania (Telegram), Polymarket, Wikimedia, fxtwitter, Google Noticias, ABC, Europa Press, El País, El Mundo, El Debate, 20minutos, El Comercio (Asturias), La Nueva España, RTPA, BBC, Al Jazeera, DW, France 24, The Guardian, ONU, DSN, OMS, ECDC, Copernicus EMS, Open-Meteo.
- **Muertas, quitadas o sustituidas:** visor de REE; canales de EFE (403) y RTVE (404); el 112 Asturias no tiene RSS (se consulta vía Google Noticias).
- **Sin verificar:** AEMET respondió bien dos veces y una devolvió una página de bloqueo; INCIBE (avisos) no respondió desde GitHub; GDELT dio 429; el código «63» de Asturias en AEMET; si la hora del IGN es local o UTC; que Google Noticias, GDELT e INCIBE respondan desde tu NAS.
- **Sin canal público fiable (no añadidas):** ES-Alert, tsunamis del Atlántico nordeste (IGN), red radiológica (CSN/EURDEP), NOTAM, radioavisos, caudales de la CHC, Cloudflare Radar (pide registro).

## Pendiente de ti

1. **Worker v4** (opcional): pegar `cloudflare/worker.js` en Cloudflare. Sin probar allí; arregla GDACS y cierra el uso por terceros. La web funciona igual con el v3.
2. **Instalar el NAS** (`nas/GUIA.md`) y la **app** (`android/LEEME.md`).
3. Comprobar en tu móvil que la alarma suena en silencio y que Android no duerme la app.
