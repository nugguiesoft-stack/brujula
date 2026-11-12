package es.nugguie.brujula;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/** Widget de la pantalla de inicio: índice de Asturias, nivel y hora del dato. Al tocarlo abre la app.
 *  Toma el dato más reciente entre el último escaneo de la web y lo que publica el NAS. */
public class Widget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { pintar(c, m, ids); }

    static void refrescar(Context c) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = m.getAppWidgetIds(new ComponentName(c, Widget.class));
            if (ids != null && ids.length > 0) pintar(c, m, ids);
        } catch (Exception e) { /* sin widgets */ }
    }

    private static void pintar(Context c, AppWidgetManager m, int[] ids) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        try {
            JSONObject web = new JSONObject(Datos.s(c, "idx", "{}")), nas = new JSONObject(Datos.s(c, "nas", "{}"));
            long tw = web.optLong("t", 0), tn = nas.optLong("t", 0);
            JSONObject in = nas.optJSONObject("indices");
            boolean usaNas = in != null && tn > tw;
            JSONObject d = usaNas ? in : web;
            long t = usaNas ? tn : tw;
            if (t > 0) {
                double a = d.optDouble("asturias", 0), e = d.optDouble("espana", 0), g = d.optDouble("global", 0);
                v.setTextViewText(R.id.w_num, Datos.num(a));
                v.setTextColor(R.id.w_num, Datos.colorNivel(a));
                v.setTextViewText(R.id.w_nivel, "Asturias · " + Datos.nombreNivel(a));
                v.setTextViewText(R.id.w_otros, "España " + Datos.num(e) + " · Global " + Datos.num(g));
                long min = (System.currentTimeMillis() - t) / 60000;
                String hora = new SimpleDateFormat(min > 20 * 60 ? "d MMM HH:mm" : "HH:mm", new Locale("es", "ES")).format(new Date(t));
                v.setTextViewText(R.id.w_hora, (usaNas ? "NAS · " : "Web · ") + hora + (min > 180 ? " (dato antiguo)" : "") + (nas.optBoolean("apagado") ? " · NAS apagado" : ""));
            }
        } catch (Exception e) { /* se queda el texto inicial */ }
        v.setOnClickPendingIntent(R.id.w_raiz, Notis.abrir(c, null, 2));
        for (int id : ids) m.updateAppWidget(id, v);
    }
}
