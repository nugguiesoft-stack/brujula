package es.nugguie.brujula;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Pantalla principal: la web de la Brújula a pantalla completa (así la app siempre lleva la última versión
 * sin reinstalar), con dos botones propios arriba: recargar y «Avisos y mando».
 * Lo que la web no puede hacer (avisos con alarma, widget, mando) lo pone la parte nativa.
 */
public class MainActivity extends Activity {
    private WebView web;
    private LinearLayout sinRed;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Notis.canales(this);
        int dp = (int) getResources().getDisplayMetrics().density;

        LinearLayout raiz = new LinearLayout(this); raiz.setOrientation(LinearLayout.VERTICAL); raiz.setBackgroundColor(0xFF0D1318);
        raiz.setFitsSystemWindows(true);

        LinearLayout barra = new LinearLayout(this); barra.setGravity(Gravity.CENTER_VERTICAL); barra.setPadding(14 * dp, 4 * dp, 6 * dp, 4 * dp);
        TextView titulo = new TextView(this); titulo.setText("Brújula"); titulo.setTextColor(0xFFE8EEF2); titulo.setTextSize(18); titulo.setTypeface(null, android.graphics.Typeface.BOLD);
        barra.addView(titulo, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        barra.addView(boton("↻ Recargar", v -> { sinRed.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.reload(); }));
        barra.addView(boton("🔔 Avisos y mando", v -> startActivity(new Intent(this, PanelActivity.class))));
        raiz.addView(barra);

        FrameLayout marco = new FrameLayout(this);
        web = new WebView(this); web.setBackgroundColor(0xFF0D1318);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true); s.setSupportMultipleWindows(false);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Puente(), "BrujulaApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                // Solo la propia Brújula se queda dentro; cualquier otro enlace (fuentes, noticias, teléfono 112) se abre fuera
                if (esPropia(u)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* sin app que lo abra */ }
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) { web.setVisibility(View.GONE); sinRed.setVisibility(View.VISIBLE); }
            }
        });
        marco.addView(web, new FrameLayout.LayoutParams(-1, -1));

        sinRed = new LinearLayout(this); sinRed.setOrientation(LinearLayout.VERTICAL); sinRed.setGravity(Gravity.CENTER); sinRed.setPadding(28 * dp, 0, 28 * dp, 0); sinRed.setVisibility(View.GONE);
        TextView t = new TextView(this); t.setTextColor(0xFFE8EEF2); t.setTextSize(16); t.setGravity(Gravity.CENTER);
        t.setText("No se puede cargar la Brújula.\n\nSi no hay conexión, los avisos del vigilante tampoco llegan: guíate por ES-Alert, la radio y el 112.\n\nLos últimos avisos recibidos están en «Avisos y mando».");
        sinRed.addView(t); sinRed.addView(boton("Reintentar", v -> { sinRed.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(Datos.web(this)); }));
        marco.addView(sinRed, new FrameLayout.LayoutParams(-1, -1));
        raiz.addView(marco, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(raiz);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);

        if (b != null) web.restoreState(b); else cargar(getIntent());
        AvisosService.arrancar(this);
    }

    private Button boton(String txt, View.OnClickListener al) {
        Button x = new Button(this); x.setText(txt); x.setAllCaps(false); x.setTextColor(0xFFF2A93B); x.setBackgroundColor(Color.TRANSPARENT); x.setTextSize(14); x.setOnClickListener(al);
        x.setMinHeight((int) (48 * getResources().getDisplayMetrics().density));
        return x;
    }

    private boolean esPropia(Uri u) {
        Uri base = Uri.parse(Datos.web(this));
        return u != null && "https".equals(u.getScheme()) && base.getHost() != null && base.getHost().equals(u.getHost()) && u.getPath() != null && base.getPath() != null && u.getPath().startsWith(base.getPath());
    }

    /** Abre la web. Si llega un texto compartido desde otra app, lo pasa al buzón; si llega de una notificación, abre su enlace. */
    private void cargar(Intent i) {
        String base = Datos.web(this);
        if (i != null && i.getBooleanExtra("callar", false)) Notis.callar();
        if (i != null && Intent.ACTION_SEND.equals(i.getAction())) {
            String txt = i.getStringExtra(Intent.EXTRA_TEXT), asunto = i.getStringExtra(Intent.EXTRA_SUBJECT);
            if (txt != null) { web.loadUrl(Uri.parse(base).buildUpon().appendQueryParameter("text", txt).appendQueryParameter("title", asunto == null ? "" : asunto).build().toString()); return; }
        }
        String url = i == null ? null : i.getStringExtra("url");
        if (url != null && url.startsWith("https://") && !esPropia(Uri.parse(url))) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* nada */ }
        }
        if (web.getUrl() == null) web.loadUrl(base);
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); cargar(i); }
    @Override protected void onResume() { super.onResume(); Notis.callar(); web.onResume(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    /** Puente con la web: ella entrega los índices (para el widget) y lee el tema de ntfy y el Gist de los ajustes de la app. */
    private final class Puente {
        @JavascriptInterface public void indices(String json) {
            try { new org.json.JSONObject(json); Datos.pon(MainActivity.this, "idx", json); Widget.refrescar(MainActivity.this); } catch (Exception e) { /* dato ilegible */ }
        }
        @JavascriptInterface public String config() { return Datos.configJson(MainActivity.this); }
        @JavascriptInterface public String version() { return "1"; }
    }
}
