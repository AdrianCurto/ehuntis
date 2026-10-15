package com.ehuntis.widget.receiver

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import com.ehuntis.widget.TimetableWidgetProvider
import com.ehuntis.widget.data.LocalCacheManager

/**
 * Recibe la confirmación del sistema cuando el widget se ancla con éxito en la
 * pantalla de inicio (vía requestPinAppWidget con FLAG_MUTABLE en API 31+).
 *
 * El sistema inyecta automáticamente EXTRA_APPWIDGET_ID en el intent antes de
 * enviárnoslo — por eso el PendingIntent debía ser FLAG_MUTABLE.
 *
 * Acciones que realiza:
 *  1. Transfiere la configuración guardada con INVALID_APPWIDGET_ID al ID real del widget.
 *  2. Fuerza el primer renderizado del widget recién anclado.
 */
class PinnedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val realWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )

        val cache = LocalCacheManager.getInstance(context)

        // 1. Si tenemos un ID real, transferir la config y el modo de vista que se guardaron en el flujo inicial
        if (realWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            val pendingConfigId = cache.getWidgetConfigId(AppWidgetManager.INVALID_APPWIDGET_ID)
            val pendingViewMode = cache.getWidgetViewMode(AppWidgetManager.INVALID_APPWIDGET_ID)
            cache.saveWidgetConfigId(realWidgetId, pendingConfigId)
            cache.saveWidgetViewMode(realWidgetId, pendingViewMode)
            // Limpiar la entrada temporal
            cache.removeWidget(AppWidgetManager.INVALID_APPWIDGET_ID)

            // 2. Forzar el primer renderizado del widget
            val appWidgetManager = AppWidgetManager.getInstance(context)
            TimetableWidgetProvider.updateAppWidget(context, appWidgetManager, realWidgetId)

            // Asegurar que el trabajador de sincronización esté activo
            com.ehuntis.widget.worker.TimetableSyncWorker.enqueueImmediateSync(context, force = true)
            com.ehuntis.widget.worker.TimetableSyncWorker.enqueuePeriodicSync(context)
        }
    }
}
