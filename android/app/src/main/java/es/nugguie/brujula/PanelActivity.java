package es.nugguie.brujula;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Pantalla nativa: mando del vigilante, últimos avisos recibidos y ajustes. Funciona aunque la web no cargue. */
public class PanelActivity extends Activity {
    private LinearLayout caja, lista;
    private TextView estado, msg;
    private int dp;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable tic = new Runnable() { @Override public void run() { pintarEstado(); h.postDelayed(this, 4000); } };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        dp = (int) getResources().getDisplayMetrics().density;
        ScrollView sv = new ScrollView(this); sv.setBackgroundColor(0xFF0D1318); sv.setFitsSystemWindows(true);
        caja = new LinearLayout(this); caja.setOrientation(LinearLayout.VERTICAL); caja.setPadding(16 * dp, 12 * dp, 16 * dp, 32 * dp);
        sv.addView(caja); setContentView(sv);

        boton("← Volver a la Brújula", v -> finish());
        titulo("Estado");
        estado = texto("", 15, 0xFFE8EEF2);

        titulo("Mando del vigilante");
        texto("Las órdenes viajan por ntfy al NAS. Te lo confirma con un aviso en unos segundos.", 13, 0xFF8FA3B0);
        LinearLayout f1 = fila(), f2 = fila();
        f1.addView(mini("⏸ Apagar 2 h", "apaga 2h")); f1.addView(mini("▶ Encender", "enciende")); f1.addView(mini("Estado", "estado"));
        f2.addView(mini("🔕 Silenciar 8 h", "silencio 8h")); f2.addView(mini("🔔 Sonido normal", "normal"));
        msg = texto("«Apagar» deja de vigilar del todo: tampoco avisará de emergencias. «Silenciar» sigue vigilando y solo suenan las emergencias.", 13, 0xFF8FA3B0);

        titulo("Últimos avisos");
        lista = new LinearLayout(this); lista.setOrientation(LinearLayout.VERTICAL); caja.addView(lista);

        titulo("Ajustes");
        texto("Se guardan solo en este móvil.", 13, 0xFF8FA3B0);
        EditText tema = campo("Tema de ntfy (el mismo que en el NAS)", Datos.tema(this), true);
        EditText servidor = campo("Servidor de ntfy", Datos.servidor(this), false);
        EditText gist = campo("ID del Gist del NAS (opcional: widget y «¿sigue vivo?»)", Datos.gist(this), false);
        CheckBox alarma = new CheckBox(this); alarma.setText("Las EMERGENCIAS suenan como alarma aunque el móvil esté en silencio"); alarma.setTextColor(0xFFE8EEF2); alarma.setChecked(Datos.alarma(this)); alarma.setPadding(0, 8 * dp, 0, 8 * dp); caja.addView(alarma);
        boton("Guardar ajustes", v -> {
            Datos.pon(this, "tema", tema.getText().toString()); Datos.pon(this, "servidor", servidor.getText().toString());
            Datos.pon(this, "gist", gist.getText().toString()); Datos.pon(this, "alarma", alarma.isChecked()); Datos.pon(this, "ultimoId", "");
            AvisosService.reiniciar(this); msg("Guardado. Conectando…");
        });
        boton("Probar un aviso normal", v -> Notis.mostrar(this, 9001, "🟡 AVISO: prueba de la Brújula", "Así se ve un aviso normal.", 3, null));
        boton("Probar la alarma de EMERGENCIA (suena 8 s)", v -> { Notis.mostrar(this, 9002, "🔴 EMERGENCIA: prueba de la Brújula", "Así suena una emergencia. Se calla sola.", 4, null); Notis.alarma(this, 8000); });
        boton("Permitir que funcione en segundo plano (batería)", v -> bateria());
        boton("Ajustes de notificaciones de la app", v -> startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())));
        boton("Buscar una versión nueva de la app", v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/nugguiesoft-stack/brujula/releases/latest"))));
        String ver = "?"; try { ver = getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { /* nada */ }
        texto("Brújula para Android " + ver + ". Herramienta de orientación: ante una emergencia manda ES-Alert y el 112.", 12, 0xFF8FA3B0);
    }

    @Override protected void onResume() { super.onResume(); Notis.callar(); pintarAvisos(); h.post(tic); }
    @Override protected void onPause() { h.removeCallbacks(tic); super.onPause(); }

    private void pintarEstado() {
        StringBuilder s = new StringBuilder("Escucha de avisos: " + AvisosService.estado);
        if (AvisosService.ultimoContacto > 0) s.append(" · última señal hace ").append((System.currentTimeMillis() - AvisosService.ultimoContacto) / 1000).append(" s");
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) s.append("\n⚠ Android puede dormir la app y retrasar los avisos. Pulsa «Permitir que funcione en segundo plano».");
        try {
            JSONObject n = new JSONObject(Datos.s(this, "nas", "{}"));
            if (n.optLong("t", 0) > 0) {
                long min = (System.currentTimeMillis() - n.getLong("t")) / 60000; JSONObject i = n.optJSONObject("indices");
                s.append("\nNAS ").append(n.optString("version")).append(n.optBoolean("apagado") ? " · APAGADO desde el mando" : min > 45 ? " · SIN SEÑALES" : " · vigilando").append(" · publicó hace ").append(min).append(" min");
                if (i != null) s.append("\nÍndices del NAS: Asturias ").append(Datos.num(i.optDouble("asturias"))).append(" · España ").append(Datos.num(i.optDouble("espana"))).append(" · Global ").append(Datos.num(i.optDouble("global")));
            }
        } catch (Exception e) { /* nada */ }
        estado.setText(s);
    }

    private void pintarAvisos() {
        lista.removeAllViews();
        JSONArray a = Datos.avisos(this);
        if (a.length() == 0) { TextView t = new TextView(this); t.setText("Todavía no ha llegado ningún aviso a esta app."); t.setTextColor(0xFF8FA3B0); lista.addView(t); return; }
        SimpleDateFormat f = new SimpleDateFormat("d MMM HH:mm", new Locale("es", "ES"));
        for (int i = 0; i < a.length() && i < 30; i++) {
            JSONObject o = a.optJSONObject(i); if (o == null) continue;
            int p = o.optInt("p", 3);
            TextView t = new TextView(this); t.setTextColor(0xFFE8EEF2); t.setTextSize(14); t.setPadding(12 * dp, 10 * dp, 12 * dp, 10 * dp);
            t.setBackgroundColor(0xFF151E26);
            t.setText(f.format(new Date(o.optLong("t"))) + " · " + o.optString("titulo") + "\n" + o.optString("texto"));
            t.setCompoundDrawablePadding(8 * dp);
            View raya = new View(this); raya.setBackgroundColor(p >= 5 ? 0xFFE5484D : p == 4 ? 0xFFE8623A : p == 3 ? 0xFFF2A93B : 0xFF3A4A57);
            String url = o.optString("url");
            if (url.startsWith("https://")) t.setOnClickListener(v -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* nada */ } });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, 3 * dp); lp.topMargin = 8 * dp;
            lista.addView(raya, lp); lista.addView(t);
        }
    }

    private void mandar(String orden) {
        String tema = Datos.tema(this);
        if (tema.isEmpty()) { msg("Primero pon el tema de ntfy en Ajustes, más abajo."); return; }
        msg("Enviando «" + orden + "»…");
        new Thread(() -> {
            String r;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(Datos.servidor(this) + "/" + URLEncoder.encode(tema, "UTF-8") + "-control").openConnection();
                c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(15000);
                c.getOutputStream().write(orden.getBytes(StandardCharsets.UTF_8)); c.getOutputStream().close();
                int cod = c.getResponseCode();
                r = cod == 200 ? "Orden «" + orden + "» enviada. El vigilante te lo confirma con un aviso." : "El servidor respondió " + cod + ".";
            } catch (Exception e) { r = "No se pudo enviar: " + e.getMessage(); }
            final String fin = r; h.post(() -> msg(fin));
        }).start();
    }

    private void bateria() {
        try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
        catch (Exception e) { try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception e2) { msg("Ábrelo a mano: Ajustes → Aplicaciones → Brújula → Batería → Sin restricciones."); } }
    }

    private void msg(String s) { msg.setText(s); }
    private void titulo(String s) { TextView t = texto(s.toUpperCase(new Locale("es", "ES")), 13, 0xFFF2A93B); t.setPadding(0, 22 * dp, 0, 6 * dp); t.setLetterSpacing(0.08f); }
    private TextView texto(String s, int sp, int color) { TextView t = new TextView(this); t.setText(s); t.setTextSize(sp); t.setTextColor(color); t.setLineSpacing(0, 1.2f); caja.addView(t); return t; }
    private LinearLayout fila() { LinearLayout f = new LinearLayout(this); caja.addView(f, new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT)); return f; }
    private Button mini(String txt, String orden) { Button b = new Button(this); b.setText(txt); b.setAllCaps(false); b.setTextSize(13); b.setOnClickListener(v -> mandar(orden)); b.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1)); return b; }
    private Button boton(String txt, View.OnClickListener al) { Button b = new Button(this); b.setText(txt); b.setAllCaps(false); b.setOnClickListener(al); caja.addView(b, new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT)); return b; }
    private EditText campo(String pista, String valor, boolean secreto) {
        TextView l = texto(pista, 13, 0xFF8FA3B0); l.setPadding(0, 10 * dp, 0, 0);
        EditText e = new EditText(this); e.setText(valor); e.setTextColor(0xFFE8EEF2); e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | (secreto ? InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_TEXT_VARIATION_URI));
        caja.addView(e, new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT)); return e;
    }
}
