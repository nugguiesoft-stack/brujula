package es.nugguie.brujula;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Vuelve a poner en marcha la escucha de avisos al encender el móvil o al actualizar la app. */
public class Arranque extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { AvisosService.arrancar(c); Widget.refrescar(c); }
}
