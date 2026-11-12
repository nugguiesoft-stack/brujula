#!/usr/bin/env bash
# Prueba de humo en el emulador (la lanza el workflow «App Android · prueba en emulador»).
set -u
P=es.nugguie.brujula; mkdir -p capturas; fallo=0
read ANCHO ALTO <<<"$(adb shell wm size | tr -c '0-9' ' ')"; echo "Pantalla: ${ANCHO}x${ALTO}"
adb install -r android/app/build/outputs/apk/release/app-release.apk || exit 1
adb shell pm grant $P android.permission.POST_NOTIFICATIONS
adb logcat -c
echo "== Abrir la pantalla principal"
adb shell am start -W -n $P/.MainActivity | tail -4
sleep 25
adb exec-out screencap -p > capturas/1-principal.png
adb shell pidof $P >/dev/null && echo "OK: la app sigue abierta" || { echo "FALLO: la app se ha cerrado"; fallo=1; }
echo "== Compartir un texto desde otra app (buzón)"
adb shell am start -W -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "https://www.aemet.es/es/eltiempo/prediccion/avisos" -n $P/.MainActivity | tail -2
sleep 12; adb exec-out screencap -p > capturas/2-compartir.png
echo "== Pulsar «Avisos y mando»"
adb shell uiautomator dump /sdcard/ui.xml >/dev/null; adb shell cat /sdcard/ui.xml > capturas/ui.xml
B=$(grep -o 'text="[^"]*Avisos y mando"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' capturas/ui.xml | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1)
if [ -n "$B" ]; then
  read x1 y1 x2 y2 <<<"$(echo "$B" | tr -c '0-9' ' ')"; adb shell input tap $(((x1+x2)/2)) $(((y1+y2)/2)); sleep 4
  adb exec-out screencap -p > capturas/3-panel.png
  adb shell dumpsys activity activities | grep -m1 "ResumedActivity" | grep -q PanelActivity && echo "OK: se abre la pantalla de avisos y mando" || { echo "FALLO: no se abrió la pantalla de avisos y mando"; fallo=1; }
  echo "== Probar un aviso y la alarma"
  pulsar() {   # busca un botón por su texto bajando por la pantalla y lo pulsa
    for i in 1 2 3 4 5 6 7; do
      adb shell uiautomator dump /sdcard/u.xml >/dev/null; adb shell cat /sdcard/u.xml > capturas/u.xml
      B=$(grep -o "text=\"$1[^\"]*\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" capturas/u.xml | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1)
      if [ -n "$B" ]; then read x1 y1 x2 y2 <<<"$(echo "$B" | tr -c '0-9' ' ')"; adb shell input tap $(((x1+x2)/2)) $(((y1+y2)/2)); sleep 3; echo "pulsado: $1"; return 0; fi
      adb shell input swipe $((ANCHO/2)) $((ALTO*3/4)) $((ANCHO/2)) $((ALTO/3)) 400; sleep 1
    done; echo "AVISO: no encuentro el botón «$1»"; return 1
  }
  pulsar "Probar un aviso normal"; pulsar "Probar la alarma"
  echo "Textos en pantalla: $(grep -o 'text="[^"]\{3,50\}"' capturas/u.xml | tr '\n' ' ' | cut -c1-900)"
  adb exec-out screencap -p > capturas/4-panel-abajo.png
  N=$(adb shell dumpsys notification --noredact | grep -c "pkg=$P")
  echo "Notificaciones de la app en el sistema: $N"; [ "$N" -ge 1 ] || { echo "FALLO: no aparece ninguna notificación"; fallo=1; }
  adb shell dumpsys notification --noredact | grep -A3 "pkg=$P" | grep -E "channel=|android.title" | head -8
  adb shell cmd statusbar expand-notifications; sleep 2; adb exec-out screencap -p > capturas/5-notificaciones.png; adb shell cmd statusbar collapse
else echo "FALLO: no encuentro el botón «Avisos y mando»"; fallo=1; fi
echo "== Recibir un aviso real por ntfy (como los del NAS)"
TEMA="brujula-prueba-$RANDOM$RANDOM$RANDOM"
for i in 1 2 3 4 5 6; do   # sube hasta ver el campo del tema
  adb shell uiautomator dump /sdcard/u.xml >/dev/null; adb shell cat /sdcard/u.xml > capturas/u.xml
  grep -q 'text="Tema de ntfy' capturas/u.xml && break; adb shell input swipe $((ANCHO/2)) $((ALTO/3)) $((ANCHO/2)) $((ALTO*2/3)) 400; sleep 1
done
B=$(grep -o 'class="android.widget.EditText"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' capturas/u.xml | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1)
if [ -n "$B" ]; then
  read x1 y1 x2 y2 <<<"$(echo "$B" | tr -c '0-9' ' ')"; adb shell input tap $(((x1+x2)/2)) $(((y1+y2)/2)); sleep 1
  adb shell input text "$TEMA"; sleep 1; adb shell input keyevent 4; sleep 1
  pulsar "Guardar ajustes"; sleep 12
  curl -s -H "Title: PRUEBA-EMULADOR alerta" -H "Priority: 4" -d "Aviso de prueba enviado como lo haria el NAS." "https://ntfy.sh/$TEMA" >/dev/null
  curl -s -H "Title: PRUEBA-EMULADOR emergencia" -H "Priority: 5" -d "Emergencia de prueba." "https://ntfy.sh/$TEMA" >/dev/null
  sleep 12
  R=$(adb shell dumpsys notification --noredact | grep -c "PRUEBA-EMULADOR")
  [ "$R" -ge 2 ] && echo "OK: los avisos enviados por ntfy llegan como notificaciones ($R menciones)" || { echo "FALLO: el aviso enviado por ntfy no ha llegado"; fallo=1; }
  adb shell dumpsys notification --noredact | grep -B1 -A2 "PRUEBA-EMULADOR" | grep -oE "channel=[a-z]+" | sort | uniq -c
  adb shell dumpsys activity services $P | grep -m2 -E "ServiceRecord|isForeground"
  adb shell cmd statusbar expand-notifications; sleep 2; adb exec-out screencap -p > capturas/6-avisos-ntfy.png; adb shell cmd statusbar collapse; sleep 1
  adb shell am start -n $P/.MainActivity >/dev/null; sleep 3
else echo "FALLO: no encuentro el campo del tema"; fallo=1; fi
adb shell pidof $P >/dev/null && echo "OK: la app sigue viva al final" || { echo "FALLO: la app se ha cerrado"; fallo=1; }
echo "== Errores graves en el registro"
E=$(adb logcat -d | grep -A14 "FATAL EXCEPTION" | grep -B3 -A12 "$P" | head -40)
if [ -n "$E" ]; then echo "$E"; fallo=1; else echo "OK: ninguno"; fi
[ $fallo -eq 0 ] && echo "RESULTADO: todo correcto" || echo "RESULTADO: hay fallos"
exit $fallo
