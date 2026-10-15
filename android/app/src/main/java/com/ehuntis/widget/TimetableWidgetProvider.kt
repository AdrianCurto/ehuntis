package com.ehuntis.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import com.ehuntis.widget.data.DayLogic
import com.ehuntis.widget.data.LocalCacheManager
import com.ehuntis.widget.data.Subgroups
import com.ehuntis.widget.receiver.WidgetRefreshReceiver
import com.ehuntis.widget.render.TimetableRenderEngine
import com.ehuntis.widget.render.Palette
import java.time.LocalDate
import java.time.LocalDateTime

class TimetableWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateAppWidget(context, appWidgetManager, appWidgetId, newOptions)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val cache = LocalCacheManager.getInstance(context)
        for (id in appWidgetIds) {
            cache.removeWidget(id)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_TIME_TICK,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_USER_PRESENT,
            ACTION_REDRAW_ALL -> {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val ids = appWidgetManager.getAppWidgetIds(
                    ComponentName(context, TimetableWidgetProvider::class.java)
                )
                for (id in ids) {
                    updateAppWidget(context, appWidgetManager, id)
                }
                com.ehuntis.widget.data.AlarmScheduler.scheduleNextAlarm(context)
            }
        }
    }

    companion object {
        const val ACTION_REDRAW_ALL = "com.ehuntis.widget.ACTION_REDRAW_ALL"

        fun updateAllWidgets(context: Context) {
            try {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val ids = appWidgetManager.getAppWidgetIds(
                    ComponentName(context, TimetableWidgetProvider::class.java)
                )
                for (id in ids) {
                    updateAppWidget(context, appWidgetManager, id)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            com.ehuntis.widget.data.AlarmScheduler.scheduleNextAlarm(context)
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            customOptions: Bundle? = null
        ) {
            val cache = LocalCacheManager.getInstance(context)
            val username = cache.getUsername()

            val views = RemoteViews(context.packageName, R.layout.widget_timetable_layout)

            // 0. Determinar si es modo oscuro según preferencia o sistema y aplicar colores
            val themePref = cache.getThemeMode()
            val isDark = when (themePref) {
                "DARK" -> true
                "LIGHT" -> false
                else -> {
                    val nightModeFlags = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                    nightModeFlags == Configuration.UI_MODE_NIGHT_YES
                }
            }

            val containerBgRes = if (isDark) R.drawable.widget_container_bg_dark else R.drawable.widget_container_bg_light
            val headerTextColor = if (isDark) Color.parseColor("#F8FAFC") else Color.parseColor("#0F172A")
            val headerIconColor = if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#64748B")

            views.setInt(R.id.widget_root, "setBackgroundResource", containerBgRes)
            views.setTextColor(R.id.widget_header_title, headerTextColor)
            views.setInt(R.id.widget_btn_settings, "setColorFilter", headerIconColor)
            views.setInt(R.id.widget_btn_refresh, "setColorFilter", headerIconColor)

            // Si aún no está configurado el usuario
            if (username.isNullOrBlank()) {
                views.setTextViewText(R.id.widget_header_title, "EHUntis · Pulsa para configurar")
                val configIntent = Intent(context, WidgetConfigureActivity::class.java).apply {
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                val pendingConfig = PendingIntent.getActivity(
                    context, appWidgetId, configIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_timetable_image, pendingConfig)
                views.setOnClickPendingIntent(R.id.widget_header_title, pendingConfig)
                views.setOnClickPendingIntent(R.id.widget_root, pendingConfig)
                appWidgetManager.updateAppWidget(appWidgetId, views)
                return
            }

            // Click en [ ⚙ ] → Abre la configuración de este widget
            val settingsIntent = Intent(context, WidgetConfigureActivity::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingSettings = PendingIntent.getActivity(
                context,
                appWidgetId + 20000,
                settingsIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_settings, pendingSettings)

            // Click en el botón de refresco [ ↻ ] → Lanzar recarga forzada en segundo plano
            val refreshIntent = Intent(context, WidgetRefreshReceiver::class.java).apply {
                action = WidgetRefreshReceiver.ACTION_REFRESH
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            val pendingRefresh = PendingIntent.getBroadcast(
                context,
                appWidgetId + 10000,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_refresh, pendingRefresh)

            // 1. Resolver configuración activa con fallback resiliente
            val userData = cache.getUserData()
            val config = cache.resolveConfigForWidget(appWidgetId)
            val allLessons = cache.getTimetable()

            // Actualizar la paleta de colores desde el último API response (si disponible)
            Palette.updateFromApi(userData?.palette)

            // Colores personalizados del perfil activo (vacío = colores automáticos)
            val customColors: Map<String, Int> = config?.customColors ?: emptyMap()
            
            // Si el caché está vacío (primera instalación, aún sincronizando) mostramos
            // un estado de carga y lanzamos la sincronización en segundo plano de inmediato.
            if (allLessons.isEmpty()) {
                views.setTextViewText(R.id.widget_header_title, "EHUntis · Sincronizando...")
                appWidgetManager.updateAppWidget(appWidgetId, views)
                com.ehuntis.widget.worker.TimetableSyncWorker.enqueueImmediateSync(context, force = true)
                return
            }

            val filteredLessons = Subgroups.filterLessonsForConfig(allLessons, config)
            val finalLessons = if (config == null || config.selectedGroups.isEmpty()) {
                allLessons
            } else {
                filteredLessons
            }

            // 2. Determinar fecha objetivo mediante DayLogic
            val now = LocalDateTime.now()
            val targetDate = DayLogic.getResolvedTargetDate(now, finalLessons)

            // 3. Determinar modo de vista (Diario vs Semanal)
            val viewMode = cache.getWidgetViewMode(appWidgetId)
            val isWeekModeRequested = (viewMode == "WEEK")



            // 5. Dimensiones reales del widget con resolución proporcional en portrait y landscape
            val options = customOptions ?: appWidgetManager.getAppWidgetOptions(appWidgetId)
            val isPortrait = context.resources.configuration.orientation != Configuration.ORIENTATION_LANDSCAPE

            var widthDp = 0
            var heightDp = 0

            // A) Android 12+ (API 31+): OPTION_APPWIDGET_SIZES contiene la lista exacta de tamaños responsivos del launcher
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, android.util.SizeF::class.java)
                if (!sizes.isNullOrEmpty()) {
                    val targetSize = if (isPortrait) {
                        sizes.maxByOrNull { it.height } ?: sizes.first()
                    } else {
                        sizes.maxByOrNull { it.width } ?: sizes.first()
                    }
                    widthDp = targetSize.width.toInt()
                    heightDp = targetSize.height.toInt()
                }
            }

            // B) Fallback para cualquier launcher o versión de Android
            if (widthDp <= 0 || heightDp <= 0) {
                val minW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
                val maxW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0)
                val minH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
                val maxH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)

                if (isPortrait) {
                    widthDp = if (minW > 0) minW else 260
                    heightDp = if (maxH > 0) maxH else if (minH > 0) minH else 340
                } else {
                    widthDp = if (maxW > 0) maxW else if (minW > 0) minW else 260
                    heightDp = if (minH > 0) minH else if (maxH > 0) maxH else 180
                }
            }

            widthDp = maxOf(180, widthDp)
            heightDp = maxOf(180, heightDp)
            val density = context.resources.displayMetrics.density

            val widthPx = (widthDp * density).toInt()
            val heightPx = maxOf(100, ((heightDp - 44) * density).toInt()) // Restar altura de la cabecera (44dp)

            // La vista semanal requiere un ancho generoso (mínimo 4 columnas de la rejilla, ~270dp)
            val showWeekMode = isWeekModeRequested && (widthDp >= 270)

            // 6. Cabecera y Renderizado de Bitmap
            val allWidgetIds = appWidgetManager.getAppWidgetIds(ComponentName(context, TimetableWidgetProvider::class.java))
            val hasMultipleWidgets = allWidgetIds.size > 1
            val configSuffix = if (hasMultipleWidgets && config != null && config.name.isNotBlank()) {
                " · ${config.name}"
            } else {
                ""
            }

            val headerTitleText: String
            val bitmap = if (showWeekMode) {
                val monday = targetDate.with(java.time.DayOfWeek.MONDAY)
                val friday = monday.plusDays(4)
                val monStr = DayLogic.formatDateShort(monday)
                val friStr = DayLogic.formatDateShort(friday)
                headerTitleText = "Semana · $monStr - $friStr$configSuffix"
                views.setTextViewText(R.id.widget_header_title, headerTitleText)

                TimetableRenderEngine.renderWeekTimetable(
                    context = context,
                    widthPx = widthPx,
                    heightPx = heightPx,
                    weekStartDate = monday,
                    allLessons = finalLessons,
                    isDark = isDark,
                    nowTime = now,
                    customColors = customColors
                )
            } else {
                val dayNameShort = DayLogic.getDayOfWeekName(targetDate).take(3).replaceFirstChar { it.uppercase() }
                val dateFormatted = DayLogic.formatDateShort(targetDate)
                val prefix = when {
                    targetDate == now.toLocalDate() -> "Hoy"
                    targetDate == now.toLocalDate().plusDays(1) -> "Mañana"
                    else -> DayLogic.getDayOfWeekName(targetDate).replaceFirstChar { it.uppercase() }
                }
                headerTitleText = if (targetDate == now.toLocalDate() || targetDate == now.toLocalDate().plusDays(1)) {
                    "$prefix · $dayNameShort, $dateFormatted$configSuffix"
                } else {
                    "$prefix, $dateFormatted$configSuffix"
                }
                views.setTextViewText(R.id.widget_header_title, headerTitleText)

                TimetableRenderEngine.renderTimetable(
                    context = context,
                    widthPx = widthPx,
                    heightPx = heightPx,
                    targetDate = targetDate,
                    allLessons = finalLessons,
                    isDark = isDark,
                    nowTime = now,
                    customColors = customColors
                )
            }
            views.setImageViewBitmap(R.id.widget_timetable_image, bitmap)
            val accessibilityDesc = "Horario de EHUntis: $headerTitleText. Toca para abrir en el navegador."
            views.setContentDescription(R.id.widget_timetable_image, accessibilityDesc)

            // 7. Click en el horario -> Abrir web de EHUntis
            val openWebIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://ehuntis.vercel.app")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingWeb = PendingIntent.getActivity(
                context,
                appWidgetId + 30000,
                openWebIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_timetable_image, pendingWeb)
            views.setOnClickPendingIntent(R.id.widget_header_title, pendingWeb)

            appWidgetManager.updateAppWidget(appWidgetId, views)
            com.ehuntis.widget.data.AlarmScheduler.scheduleNextAlarm(context)
        }
    }
}
