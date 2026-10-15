package com.ehuntis.widget.receiver

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.ehuntis.widget.R
import com.ehuntis.widget.TimetableWidgetProvider
import com.ehuntis.widget.data.ApiClient
import com.ehuntis.widget.data.LocalCacheManager
import com.ehuntis.widget.data.WidgetAnalytics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WidgetRefreshReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_REFRESH) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val ids = appWidgetManager.getAppWidgetIds(ComponentName(context, TimetableWidgetProvider::class.java))

            // 1. Feedback visual instantáneo (< 10ms):
            // Actualiza únicamente la vista de texto del título respetando el color del tema
            val cache = LocalCacheManager.getInstance(context)
            val isDark = when (cache.getThemeMode()) {
                "DARK" -> true
                "LIGHT" -> false
                else -> {
                    val nightModeFlags = context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK
                    nightModeFlags == android.content.res.Configuration.UI_MODE_NIGHT_YES
                }
            }
            val headerTextColor = if (isDark) android.graphics.Color.parseColor("#F8FAFC") else android.graphics.Color.parseColor("#0F172A")

            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_timetable_layout)
                views.setTextViewText(R.id.widget_header_title, "EHUntis · Actualizando...")
                views.setTextColor(R.id.widget_header_title, headerTextColor)
                appWidgetManager.partiallyUpdateAppWidget(id, views)
            }

            // 2. Petición directa a red en segundo plano mediante corrutina rápida (sin colas pesadas de WorkManager)
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val cache = LocalCacheManager.getInstance(context)
                    val username = cache.getUsername()

                    if (!username.isNullOrBlank()) {
                        WidgetAnalytics.trackManualRefresh(username)

                        val userResult = ApiClient.fetchUserData(username)
                        val userData = if (userResult.isSuccess) {
                            val data = userResult.getOrThrow()
                            cache.saveUserData(data)
                            data
                        } else {
                            cache.getUserData()
                        }

                        if (userData != null) {
                            val allClassIds = userData.configs.flatMap { it.allClassIds }.distinct()
                            if (allClassIds.isNotEmpty()) {
                                val timetableResult = ApiClient.fetchTimetable(allClassIds, force = true)
                                if (timetableResult.isSuccess) {
                                    val lessons = timetableResult.getOrThrow()
                                    cache.saveTimetable(lessons)
                                    cache.saveLastSyncTime(System.currentTimeMillis())
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                } finally {
                    // 3. Redibuja los widgets con datos frescos, restaura el título con la fecha y programa la siguiente alarma
                    TimetableWidgetProvider.updateAllWidgets(context)
                    pendingResult.finish()
                }
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.ehuntis.widget.ACTION_REFRESH"
    }
}
