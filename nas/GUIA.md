# Brújula · vigilante del NAS — guía de instalación

El vigilante es un pequeño programa que corre en el NAS 24 horas. Lee fuentes primarias (sensores, organismos oficiales, agencias, Telegram, Wikipedia en directo, mercados) y **te manda un aviso al móvil** en cuanto detecta algo, estés donde estés.

- Consumo medido en pruebas: **unos 60–65 MB de RAM** (con un techo de 160 MB que no puede superar) y como mucho medio núcleo.
- Se actualiza solo: cuando publico una versión nueva, el NAS la descarga.
- No toca tus pelis ni tus copias. Solo usa la carpeta `Docker/brujula`.

> ⚠️ **Importante:** esto es un complemento, no un sustituto. Si se va la luz en casa, el NAS también se apaga. Lo primero siguen siendo **ES-Alert** (activado en el móvil) y el **112**.

---

## Paso 1 · Instala ntfy en el móvil (2 min)

1. Instala la app **ntfy** (gratis, Android o iPhone).
2. Pulsa **+** → **Suscribirse a un tema**.
3. Inventa un nombre de tema largo y difícil de adivinar (cualquiera que lo sepa puede leer tus avisos), por ejemplo `brujula-nacho-7Kq29xZ`. Apúntalo.
4. Servidor: déjalo en `ntfy.sh`.
5. En Android, entra en el tema → ajustes → activa **Instant delivery**. Si quieres que las EMERGENCIAS suenen aunque tengas el modo No molestar, permite que ntfy lo salte (Ajustes del móvil → Notificaciones → ntfy → No molestar).

Prueba: desde el navegador del PC abre `https://ntfy.sh/TU-TEMA` y escribe un mensaje. Debe llegarte al móvil.

## Paso 2 · Activa Docker en el NAS (5 min)

1. Entra en ADM (la web del NAS) con tu usuario administrador.
2. **App Central** → busca **Docker Engine** → Instalar.
3. Busca **Portainer CE** → Instalar. Te sirve para manejar el vigilante desde el navegador sin escribir comandos.
4. Abre Portainer desde el escritorio de ADM, crea el usuario administrador y elige el entorno **Local**.

> ❓ **Sin comprobar:** ASUSTOR dice que Docker Engine existe para «la mayoría de modelos», pero no he podido confirmar el AS1102TL en concreto. Si no aparece en App Central, avísame y buscamos otra vía.
>
> Con 1 GB de RAM, Portainer gasta unos 50–100 MB más. Si el NAS va justo, puedes desactivar Portainer cuando el vigilante ya funcione (App Central → Portainer CE → Desactivar). El vigilante sigue funcionando.

## Paso 3 · Crea la carpeta (1 min)

En **File Explorer** de ADM crea la carpeta `Docker/brujula` dentro de `Volume 1`. Si ya tienes una carpeta `Docker`, créala dentro.

## Paso 4 · Arranca el vigilante (3 min)

1. En Portainer: **Stacks** → **Add stack**.
2. Nombre: `brujula`.
3. En **Web editor** pega el contenido del fichero [`docker-compose.yml`](docker-compose.yml) de esta carpeta.
4. Cambia lo marcado con 👉:
   - `NTFY_TOPIC`: el tema del paso 1.
   - `CASA_LAT` / `CASA_LON`: no hace falta si vives cerca de Oviedo o Gijón.
   - La ruta `/volume1/Docker/brujula`: solo si tu carpeta está en otro sitio.
5. Pulsa **Deploy the stack**.

En menos de un minuto te llega al móvil un aviso **«Brújula NAS 1.0.0 en marcha»** con cuántas fuentes funcionan y cuáles fallan. **Si ese aviso llega, todo está bien instalado.**

Si no llega, ve a Portainer → **Containers** → `brujula` → **Logs** y mándame una captura.

## Qué avisos te llegarán

| Aviso | Cuándo | Sonido |
|---|---|---|
| 🔴 **EMERGENCIA** | Peligro serio y confirmado cerca: terremoto fuerte próximo, apagón masivo o alerta oficial grave | Máximo; suena también de noche |
| 🟠 **ALERTA** | Algo grave confirmado por varias fuentes, en España o cerca | Alto |
| 🟡 **AVISO** | Situación a vigilar | Normal |
| 👁 **SEÑAL TEMPRANA (sin confirmar)** | Una sola fuente poco fiable (Telegram, Wikipedia, apuestas) apunta a algo gordo. **No actúes todavía**: si se confirma, te llega «Se confirma · …» | Alto |
| ℹ️ Info | Arranque, resumen diario (8:30) y fuentes caídas | Bajo |

- Solo avisa cuando algo **sube** de nivel. Nunca repite lo mismo.
- De 23:00 a 8:00 solo suenan las emergencias. El resto te llega en el resumen de la mañana.
- Como máximo 8 avisos por hora, para que no te sature si hay un día movido.

## Encender, apagar y silenciar desde el móvil

Los avisos de sistema (arranque, estado y resumen diario) traen botones:

- **⏸ Apagar 2 h**: deja de vigilar durante 2 horas y después vuelve solo. Mientras está apagado **no te avisa de nada, ni de emergencias**.
- **🔕 Silenciar 8 h**: sigue vigilando, pero solo suenan las EMERGENCIAS. El resto lo encontrarás en el resumen.
- **▶ Encender** / **🔔 Sonido normal**: vuelve a la normalidad.
- **Estado**: te responde cómo está y cuántas fuentes funcionan.

También puedes escribir una orden en el tema `TU-TEMA-control` (tu tema seguido de `-control`). Puedes hacerlo, por ejemplo, desde la web de ntfy en el navegador del móvil (`ntfy.sh/TU-TEMA-control`). Las órdenes son:

`apaga` · `apaga 2h` · `apaga 30m` · `enciende` · `silencio` · `silencio 8h` · `normal` · `estado`

Sin tiempo (`apaga`, `silencio`), dura hasta que lo vuelvas a cambiar. El vigilante te confirma cada orden con un aviso.

> El tema de control también hace de contraseña: quien lo conozca podría apagarte el vigilante. No lo compartas.

## Qué vigila (16 módulos)

| Módulo | Fuente primaria | Cada |
|---|---|---|
| Terremotos | IGN, EMSC, USGS (se cruzan entre sí) | 2 min |
| Tsunamis | Centros de alerta de tsunami de EE. UU. | 5 min |
| Apagón | Demanda eléctrica de Red Eléctrica (detecta desplomes) | 5 min |
| Internet | IODA (cortes de internet por país) | 10 min |
| Tiempo espacial | NOAA (tormentas geomagnéticas, llamaradas X) | 10 min |
| Meteo | AEMET (avisos rojos; naranjas si son en Asturias) | 15 min |
| Desastres | GDACS (ONU / UE) | 15 min |
| Ciber | INCIBE-CERT (avisos críticos e industriales) | 30 min |
| Telegram | Alertas aéreas de Ucrania y los canales que añadas | 3 min |
| Tráfico aéreo | OpenSky: cierre de espacio aéreo y aviones secuestrados (7500) | 15 min |
| Aviación militar | adsb.lol: bombarderos, cisternas y movimientos raros en Rota, Morón, Torrejón y Zaragoza | 10 min |
| Wikipedia | Artículos nuevos sobre ataques o catástrofes, en directo | continuo |
| Mercados | Polymarket: saltos bruscos de probabilidad | 10 min |
| Prensa | 14 medios y agencias, entre ellos Europa Press, El Comercio, LNE, BBC y ONU | 5 min |
| GDELT | Picos de noticias mundiales sobre España, la OTAN y lo nuclear | 15 min |
| Oficial | Avisos de viaje de EE. UU. y R. Unido; webs oficiales (Interior, DSN, 112 Asturias, OTAN, OIEA…) | 20 min |

## Ajustes opcionales

Se cambian en Portainer → Stacks → `brujula` → Editor. Descomenta la línea (quita el `#`), pulsa **Update the stack**.

- **`TELEGRAM_CANALES`**: canales públicos de Telegram que quieras vigilar, separados por comas. Escribe el nombre que aparece en `t.me/nombre`.
- **`DESACTIVAR`**: módulos que no quieras, por ejemplo `aereo,militar`.
- **`SILENCIO`** y **`RESUMEN_DIARIO`**: horario de silencio y hora del resumen.
- **Segundo canal por Telegram**: crea un bot con @BotFather y pon `TELEGRAM_TOKEN` y `TELEGRAM_CHAT`.
- **Ver el NAS en la web de la Brújula**:
  1. En github.com → **Gists** crea un gist secreto con un fichero `brujula-nas.json` que contenga `{}`. Copia su ID (lo último de la dirección).
  2. En Ajustes → Developer settings → **Fine-grained token**, crea un token con permiso solo de **Gists: Read and write**.
  3. Pon `GIST_ID` y `GITHUB_TOKEN` en el stack.
  4. En la web, abajo en Ajustes, pega el ID del Gist en «Gist del vigilante del NAS».

  Aparecerá el panel **Vigilante del NAS** con su estado y sus últimos avisos.
- **Que te avisen si el NAS se cae**: crea una cuenta gratis en healthchecks.io, crea un check de 10 minutos y pon su dirección en `HEALTHCHECK_URL`. Si el NAS deja de dar señales, healthchecks te avisa por correo o por la app.

## Mantenimiento

- **Actualizar**: no hace falta nada. Cada 6 h comprueba si hay versión nueva, se reinicia y la descarga. Te llega un aviso «Actualizando…».
- **Reiniciar a mano**: Portainer → Containers → `brujula` → Restart.
- **Empezar de cero**: borra `Docker/brujula/memoria.json` y reinicia. Volverá a aprender lo que es normal (unos 3 días para los aviones).
- **Desinstalar**: Portainer → Stacks → `brujula` → Delete. Después borra la carpeta.

## Limitaciones honestas

- **Antes que los medios, sí; antes que ES-Alert, no siempre.** Los sensores (sismos, red eléctrica, internet) suelen adelantarse a la prensa, a veces minutos y a veces horas. Pero una alerta oficial de Protección Civil puede llegarte antes por ES-Alert.
- **Necesita luz e internet en casa.** Si quieres más autonomía, un SAI pequeño para el NAS y el router da margen en cortes cortos.
- **Puntos sin verificar:**
  - El formato del visor de Red Eléctrica: si cambia, el detector usa la API horaria, que es más lenta.
  - El formato exacto de IODA.
  - adsb.lol podría pedir clave en el futuro.
  - OpenSky permite unas 400 consultas anónimas al día; el módulo está ajustado a eso.

  El aviso de arranque te dirá qué funciona en tu NAS.
- **Puede haber falsas alarmas**, sobre todo en las señales tempranas. Por eso van marcadas como «sin confirmar».

---

## Para ampliarlo (versiones siguientes)

Cada fuente es un fichero en `modulos/`. Para añadir una nueva:

```js
export default {
  id: "mifuente", nombre: "Mi fuente", cada: 10,          // minutos
  async run({ pedir, rss, clasifica }) {
    const items = rss(await pedir("https://…/feed.xml"));
    return { senales: items.map((i) => ({ clave: i.id, fuente: "mifuente", tipo: "oficial", ...clasifica(i.title), titulo: i.title, url: i.url })), msg: `${items.length} entradas` };
  }
};
```

El motor se encarga de lo demás: agrupar con otras fuentes, calcular la confianza, decidir el nivel y avisar.

**Prueba sin internet:** `node prueba/ensayo.mjs` simula un día normal y después un suceso grave, y muestra los avisos que se enviarían y la memoria usada.
