package es.nugguie.brujula;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Ajustes y datos guardados en el móvil. Nada de esto sale del teléfono ni va al repositorio. */
final class Datos {
    static final String WEB = "https://nugguiesoft-stack.github.io/brujula/";
    static final int MAX_AVISOS = 60;

    private Datos() {}

    static SharedPreferences p(Context c) { return c.getApplicationContext().getSharedPreferences("brujula", Context.MODE_PRIVATE); }
    static String s(Context c, String k, String porDefecto) { String v = p(c).getString(k, null); return v == null || v.trim().isEmpty() ? porDefecto : v.trim(); }
    static void pon(Context c, String k, String v) { p(c).edit().putString(k, v == null ? "" : v.trim()).apply(); }
    static boolean si(Context c, String k, boolean d) { return p(c).getBoolean(k, d); }
    static void pon(Context c, String k, boolean v) { p(c).edit().putBoolean(k, v).apply(); }
    static long n(Context c, String k) { return p(c).getLong(k, 0L); }
    static void pon(Context c, String k, long v) { p(c).edit().putLong(k, v).apply(); }

    static String servidor(Context c) { String v = s(c, "servidor", "https://ntfy.sh"); return v.endsWith("/") ? v.substring(0, v.length() - 1) : v; }
    static String tema(Context c) { return s(c, "tema", ""); }
    static String gist(Context c) { return s(c, "gist", ""); }
    static String web(Context c) { return s(c, "web", WEB); }
    static boolean alarma(Context c) { return si(c, "alarma", true); }

    /** Lo que la web puede leer a través del puente (tema y Gist), para no tener que escribirlos dos veces. */
    static String configJson(Context c) {
        try { return new JSONObject().put("tema", tema(c)).put("servidor", servidor(c)).put("gist", gist(c)).toString(); }
        catch (Exception e) { return "{}"; }
    }

    static synchronized JSONArray avisos(Context c) {
        try { return new JSONArray(p(c).getString("avisos", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    /** Guarda un aviso recibido (el más nuevo primero). Devuelve false si ya estaba (mismo id). */
    static synchronized boolean guardaAviso(Context c, JSONObject a) {
        try {
            JSONArray viejos = avisos(c), nuevos = new JSONArray();
            String id = a.optString("id");
            for (int i = 0; i < viejos.length(); i++) if (!id.isEmpty() && id.equals(viejos.getJSONObject(i).optString("id"))) return false;
            nuevos.put(a);
            for (int i = 0; i < viejos.length() && nuevos.length() < MAX_AVISOS; i++) nuevos.put(viejos.get(i));
            p(c).edit().putString("avisos", nuevos.toString()).apply();
            return true;
        } catch (Exception e) { return true; }
    }

    static int colorNivel(double v) {
        return v < 2 ? 0xFF4CAF7D : v < 4 ? 0xFFE0C341 : v < 6 ? 0xFFF2A93B : v < 8 ? 0xFFE8623A : 0xFFE5484D;
    }
    static String nombreNivel(double v) {
        return v < 2 ? "Calma" : v < 4 ? "Vigilancia" : v < 6 ? "Tensión" : v < 8 ? "Alerta" : "Emergencia";
    }
    static String num(double v) { return String.format(java.util.Locale.ROOT, "%.1f", v).replace('.', ','); }
}
