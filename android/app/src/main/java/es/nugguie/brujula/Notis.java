package es.nugguie.brujula;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Canales de notificación y la alarma sonora de las EMERGENCIAS. */
final class Notis {
    static final String SERVICIO = "servicio", INFO = "info", AVISO = "aviso", ALERTA = "alerta", EMERGENCIA = "emergencia";
    private static Ringtone sonando;
    private static final Handler H = new Handler(Looper.getMainLooper());

    private Notis() {}

    static void canales(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        canal(nm, SERVICIO, "Conexión con el vigilante", "Aviso fijo y silencioso mientras la app escucha.", NotificationManager.IMPORTANCE_MIN, false);
        canal(nm, INFO, "Información y resúmenes", "Estado del vigilante, resumen diario, correcciones.", NotificationManager.IMPORTANCE_LOW, false);
        canal(nm, AVISO, "Avisos", "Algo relevante cerca, sin urgencia.", NotificationManager.IMPORTANCE_DEFAULT, true);
        canal(nm, ALERTA, "Alertas y señales tempranas", "Algo serio. Suena y vibra.", NotificationManager.IMPORTANCE_HIGH, true);
        canal(nm, EMERGENCIA, "EMERGENCIAS", "Peligro general. Suena y vibra; además puede sonar como alarma.", NotificationManager.IMPORTANCE_HIGH, true);
    }
    private static void canal(NotificationManager nm, String id, String nombre, String desc, int imp, boolean vibra) {
        NotificationChannel ch = new NotificationChannel(id, nombre, imp);
        ch.setDescription(desc); ch.enableVibration(vibra);
        if (id.equals(EMERGENCIA)) { ch.setVibrationPattern(new long[] { 0, 600, 250, 600, 250, 900 }); ch.setBypassDnd(true); ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC); }
        if (id.equals(SERVICIO)) ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    static String canalDe(int prioridad) { return prioridad >= 5 ? EMERGENCIA : prioridad == 4 ? ALERTA : prioridad == 3 ? AVISO : INFO; }

    static PendingIntent abrir(Context c, String url, int codigo) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("callar", true);
        if (url != null && !url.isEmpty()) i.putExtra("url", url);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void mostrar(Context c, int id, String titulo, String texto, int prioridad, String url) {
        Notification.Builder b = new Notification.Builder(c, canalDe(prioridad))
                .setSmallIcon(R.drawable.ic_aviso).setContentTitle(titulo).setContentText(texto)
                .setStyle(new Notification.BigTextStyle().bigText(texto)).setAutoCancel(true).setShowWhen(true)
                .setColor(prioridad >= 5 ? 0xFFE5484D : prioridad == 4 ? 0xFFE8623A : 0xFFF2A93B)
                .setContentIntent(abrir(c, url, id));
        if (prioridad >= 5) b.setCategory(Notification.CATEGORY_ALARM).setVisibility(Notification.VISIBILITY_PUBLIC);
        c.getSystemService(NotificationManager.class).notify(id, b.build());
        if (prioridad >= 5 && Datos.alarma(c)) alarma(c, 30000);
    }

    /** Hace sonar el tono de alarma del teléfono por el canal de ALARMAS: suena aunque el timbre esté en silencio
     *  (siempre que el volumen de alarma no esté a cero). Se calla sola a los 30 s o al abrir la app. */
    static synchronized void alarma(Context c, long ms) {
        try {
            callar();
            Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            Ringtone r = RingtoneManager.getRingtone(c.getApplicationContext(), u);
            if (r == null) return;
            r.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            r.play(); sonando = r;
            Vibrator v = c.getSystemService(Vibrator.class);
            if (v != null) v.vibrate(VibrationEffect.createWaveform(new long[] { 0, 700, 300, 700, 300, 700, 300, 1200 }, -1));
            H.removeCallbacksAndMessages(null);
            H.postDelayed(Notis::callar, ms);
        } catch (Exception e) { /* sin tono de alarma: queda la notificación normal */ }
    }
    static synchronized void callar() {
        try { if (sonando != null && sonando.isPlaying()) sonando.stop(); } catch (Exception e) { /* nada */ }
        sonando = null;
    }
}
