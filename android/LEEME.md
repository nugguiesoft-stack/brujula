# Brújula para Android

Una app pequeña (menos de 1 MB) que abre la web de la Brújula y añade lo que una web no puede hacer:

- **Avisos del vigilante del NAS** con su nivel (información, aviso, alerta, emergencia), cada uno en su canal de Android.
- **Las EMERGENCIAS suenan como alarma** aunque el móvil esté en silencio (se calla sola a los 30 s o al abrir la app). Se puede desactivar.
- **Widget** para la pantalla de inicio con el índice de Asturias.
- **Mando del vigilante:** apagar, silenciar, encender y pedir el estado.
- **Compartir → Brújula:** desde cualquier app, manda un enlace o un texto al buzón para valorarlo.
- **Aviso si el NAS deja de dar señales** más de 45 min (necesita el ID del Gist).

La app siempre muestra la última versión de la web: no hay que reinstalarla cuando cambia la web.

## Instalarla (5 minutos)

1. En el móvil, abre **https://github.com/nugguiesoft-stack/brujula/releases/latest**
2. Pulsa **brujula.apk** para descargarla y después ábrela.
3. Android preguntará si permites instalar apps desde el navegador: pulsa **Ajustes**, activa **Permitir desde esta fuente** y vuelve atrás. Pulsa **Instalar**.
   Si Play Protect avisa de que no conoce la app, pulsa **Más detalles → Instalar de todas formas** (es normal: no viene de la tienda).
4. Ábrela y pulsa **Permitir** cuando pida permiso para las notificaciones.
5. Arriba a la derecha pulsa **🔔 Avisos y mando**, baja hasta **Ajustes** y rellena:
   - **Tema de ntfy:** el mismo que pusiste en el NAS.
   - **ID del Gist del NAS:** opcional; sirve para el widget y para avisarte si el NAS calla.
   - Pulsa **Guardar ajustes**.
6. Pulsa **Permitir que funcione en segundo plano (batería)** y acepta. Sin esto, Android puede dormir la app y retrasar los avisos.
7. Pulsa **Probar la alarma de EMERGENCIA** para oír cómo suena. Si no suena, sube el **volumen de alarma** del móvil (es distinto del de timbre).
8. Widget: mantén pulsado un hueco de la pantalla de inicio → **Widgets** → **Brújula**.

### ¿Y la app ntfy?

Las dos pueden convivir, pero cada aviso te llegará dos veces. Mi consejo: **mantén las dos una semana**. Si la Brújula no se retrasa respecto a ntfy, silencia el tema en ntfy o desinstálala. Si notas retrasos, deja ntfy como principal.

## Actualizarla

En la app: **🔔 Avisos y mando → Buscar una versión nueva de la app**. Descarga la nueva `brujula.apk` e instálala encima; no se pierden los ajustes.

## Límites que conviene conocer

- **No sustituye a ES-Alert.** ES-Alert llega por la red móvil aunque no haya internet. Esta app necesita internet.
- **Si el volumen de alarma está a cero, la alarma no suena.** Y en modo No molestar depende de que tengas permitidas las alarmas (por defecto lo están).
- **Los avisos dependen de que Android no cierre la app.** Algunos móviles (Xiaomi, Huawei, Samsung con ahorro agresivo) cierran apps en segundo plano aunque lo hayas permitido. La app recupera al reconectar lo que se perdió (hasta unas 12 h), pero llegaría tarde.
- **Probada en un emulador de Android 14**, no en tu teléfono: compila, se abre, muestra la web, abre el panel y lanza notificaciones. Lo que solo se puede comprobar en un móvil real (que la alarma suene en silencio, que la batería no la duerma de madrugada) está por verificar contigo.

## Cómo se compila

GitHub lo hace solo cada vez que cambia algo en `android/` (Actions → «App Android») y publica la APK en **Releases**. No hace falta instalar nada en el PC. Para lanzarlo a mano: Actions → «App Android» → **Run workflow**.

### La firma

La APK se firma con la clave `android/firma/brujula-publica.jks`, que está en el repositorio a propósito: así cada versión nueva se instala encima de la anterior sin tener que configurar nada. Al ser pública, cualquiera podría firmar una APK con ella; solo importa si instalas una APK que no venga de tu propio repositorio. **Instala siempre desde tu página de Releases.**

Si prefieres una clave privada (habrá que desinstalar la app una vez, porque cambia la firma):

1. En un PC con Java: `keytool -genkeypair -keystore brujula.jks -storetype PKCS12 -alias brujula -keyalg RSA -keysize 2048 -validity 10000` (te pedirá una contraseña; guárdala).
2. Conviértela a texto: `base64 -w0 brujula.jks` (en Windows: `certutil -encode brujula.jks salida.txt` y quita la primera y la última línea y los saltos).
3. En GitHub → repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea dos secretos: `ANDROID_CLAVES_B64` (el texto del paso 2) y `ANDROID_CLAVES_CLAVE` (la contraseña).
4. Lanza de nuevo «App Android». Guarda el fichero `brujula.jks` en lugar seguro: sin él no podrás actualizar.
