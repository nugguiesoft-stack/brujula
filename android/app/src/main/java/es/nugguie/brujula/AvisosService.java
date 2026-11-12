package es.nugguie.brujula;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Escucha los avisos del vigilante del NAS. Mantiene abierta una conexión con el servidor ntfy
 * (la misma técnica que usa la app ntfy en su modo «entrega instantánea») y convierte cada mensaje
 * en una notificación del nivel que toca. Si la conexión se corta, vuelve a conectar y recupera lo perdido.
 * También lee de vez en cuando el estado que publica el NAS (Gist) para el widget y para avisar si el NAS calla.
 */
public class AvisosService extends Service {
    static volatile String estado = "Parado";
    static volatile long ultimoContacto = 0;
    private volatile boolean vivo;
    private volatile HttpURLConnection conexion;
    private Thread hilo;

    static void arrancar(Context c) {
        if (Datos.tema(c).isEmpty() && Datos.gist(c).isEmpty()) return;
        try { c.startForegroundService(new Intent(c, AvisosService.class)); } catch (Exception e) { /* Android no lo permite ahora: se reintentará al abrir la app */ }
    }
    static void reiniciar(Context c) { c.stopService(new Intent(c, AvisosService.class)); arrancar(c); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        Notis.canales(this);
        Notification n = new Notification.Builder(this, Notis.SERVICIO).setSmallIcon(R.drawable.ic_aviso)
                .setContentTitle("Brújula escuchando").setContentText("Conectada al vigilante para avisarte al instante.")
                .setOngoing(true).setContentIntent(Notis.abrir(this, null, 1)).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE); else startForeground(1, n);
    }

    @Override public int onStartCommand(Intent i, int f, int id) {
        if (hilo == null || !hilo.isAlive()) { vivo = true; hilo = new Thread(this::bucle, "brujula-avisos"); hilo.start(); }
        return START_STICKY;
    }

    @Override public void onDestroy() {
        vivo = false; estado = "Parado";
        HttpURLConnection c = conexion; if (c != null) try { c.disconnect(); } catch (Exception e) { /* nada */ }
        if (hilo != null) hilo.interrupt();
        super.onDestroy();
    }

    private void bucle() {
        long espera = 3000, ultimoNas = 0;
        while (vivo) {
            String tema = Datos.tema(this);
            try {
                if (System.currentTimeMillis() - ultimoNas > 15 * 60000L) { ultimoNas = System.currentTimeMillis(); leerNas(); }
                if (tema.isEmpty()) { estado = "Sin tema de ntfy (ponlo en Ajustes)"; Thread.sleep(60000); continue; }
                String desde = Datos.s(this, "ultimoId", "");
                // «since» recupera lo que se envió mientras no había conexión (ntfy lo guarda unas 12 h)
                URL u = new URL(Datos.servidor(this) + "/" + URLEncoder.encode(tema, "UTF-8") + "/json?since=" + (desde.isEmpty() ? "10m" : desde));
                HttpURLConnection c = (HttpURLConnection) u.openConnection();
                conexion = c; c.setConnectTimeout(20000); c.setReadTimeout(150000);   // ntfy manda un latido cada ~45 s
                c.setRequestProperty("User-Agent", "BrujulaAndroid/1.0");
                int codigo = c.getResponseCode();
                if (codigo != 200) throw new Exception("el servidor respondió " + codigo);
                estado = "Conectada"; espera = 3000;
                try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
                    String linea;
                    while (vivo && (linea = r.readLine()) != null) {
                        ultimoContacto = System.currentTimeMillis();
                        if (linea.isEmpty()) continue;
                        JSONObject m = new JSONObject(linea);
                        if ("message".equals(m.optString("event"))) recibir(m);
                        if (System.currentTimeMillis() - ultimoNas > 15 * 60000L) { ultimoNas = System.currentTimeMillis(); leerNas(); }
                    }
                }
            } catch (InterruptedException e) { break; }
            catch (Exception e) { estado = "Reconectando (" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()) + ")"; }
            finally { HttpURLConnection c = conexion; conexion = null; if (c != null) try { c.disconnect(); } catch (Exception e) { /* nada */ } }
            if (!vivo) break;
            try { Thread.sleep(espera); } catch (InterruptedException e) { break; }
            espera = Math.min(espera * 2, 60000);
        }
    }

    private void recibir(JSONObject m) throws Exception {
        PowerManager.WakeLock w = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "brujula:aviso");
        w.acquire(10000);
        try {
            String id = m.optString("id");
            if (!id.isEmpty()) Datos.pon(this, "ultimoId", id);
            int p = m.optInt("priority", 3);
            String titulo = m.optString("title", "Brújula"), texto = m.optString("message", ""), url = m.optString("click", "");
            JSONObject a = new JSONObject().put("id", id).put("t", m.optLong("time", System.currentTimeMillis() / 1000) * 1000).put("p", p).put("titulo", titulo).put("texto", texto).put("url", url);
            if (!Datos.guardaAviso(this, a)) return;                 // ya lo teníamos (reconexión)
            Notis.mostrar(this, 100 + Math.abs(id.hashCode() % 100000), titulo, texto, p, url);
            Widget.refrescar(this);
        } finally { if (w.isHeld()) w.release(); }
    }

    /** Lee el estado que publica el NAS en el Gist: índices para el widget y «¿sigue vivo?». */
    private void leerNas() {
        String gist = Datos.gist(this); if (gist.isEmpty()) return;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL("https://api.github.com/gists/" + URLEncoder.encode(gist, "UTF-8")).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(20000); c.setRequestProperty("User-Agent", "BrujulaAndroid/1.0"); c.setRequestProperty("Accept", "application/vnd.github+json");
            if (c.getResponseCode() != 200) return;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
            JSONObject f = new JSONObject(sb.toString()).getJSONObject("files").optJSONObject("brujula-nas.json"); if (f == null) return;
            JSONObject e = new JSONObject(f.getString("content"));
            long t = java.time.Instant.parse(e.getString("generado")).toEpochMilli();
            JSONObject idx = e.optJSONObject("indices");
            Datos.pon(this, "nas", new JSONObject().put("t", t).put("indices", idx).put("apagado", !e.isNull("apagado")).put("version", e.optString("version")).toString());
            // Vigilante del vigilante: si el NAS lleva más de 45 min callado (y no lo apagaste tú), avisa una vez
            boolean callado = System.currentTimeMillis() - t > 45 * 60000L && e.isNull("apagado");
            if (callado && !Datos.si(this, "nasCallado", false)) {
                Datos.pon(this, "nasCallado", true);
                Notis.mostrar(this, 7, "El vigilante del NAS no da señales", "Lleva más de 45 min sin publicar su estado. Puede estar apagado, sin internet o sin luz: ahora mismo no te avisaría de nada.", 3, null);
            } else if (!callado && Datos.si(this, "nasCallado", false)) {
                Datos.pon(this, "nasCallado", false);
                Notis.mostrar(this, 7, "El vigilante del NAS vuelve a funcionar", "Ha publicado su estado de nuevo.", 2, null);
            }
            Widget.refrescar(this);
        } catch (Exception e) { /* sin red o Gist ilegible: se reintenta en 15 min */ }
    }
}
