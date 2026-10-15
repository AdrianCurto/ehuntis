package com.ehuntis.widget.data

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import com.ehuntis.widget.TimetableWidgetProvider
import java.time.LocalDateTime
import java.time.ZoneId

object AlarmScheduler {

    private const val ALARM_REQUEST_CODE = 8888

    /**
     * Calcula y programa la siguiente alarma exacta en el sistema delegando en DayLogic.
     * Si el usuario tiene múltiples widgets colocados, calcula el evento más próximo
     * entre todos ellos para que cada widget se actualice exactamente a su hora.
     */
    fun scheduleNextAlarm(context: Context) {
        val cache = LocalCacheManager.getInstance(context)
        val allLessons = cache.getTimetable()
        if (allLessons.isEmpty()) return

        val now = LocalDateTime.now()
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val widgetIds = appWidgetManager.getAppWidgetIds(
            ComponentName(context, TimetableWidgetProvider::class.java)
        )

        val candidateEvents = mutableListOf<LocalDateTime>()

        if (widgetIds.isNotEmpty()) {
            for (id in widgetIds) {
                val config = cache.resolveConfigForWidget(id)
                val filtered = if (config != null) Subgroups.filterLessonsForConfig(allLessons, config) else allLessons
                DayLogic.computeNextEventTime(now, filtered)?.let { candidateEvents.add(it) }
            }
        } else {
            // Fallback si aún no hay widgets asignados (ej. primera instalación)
            val userData = cache.getUserData()
            val activeConfig = userData?.configs?.find { it.id == cache.getActiveConfigId() } ?: userData?.configs?.firstOrNull()
            val filtered = if (activeConfig != null) Subgroups.filterLessonsForConfig(allLessons, activeConfig) else allLessons
            DayLogic.computeNextEventTime(now, filtered)?.let { candidateEvents.add(it) }
        }

        val nextEventTime = candidateEvents.filter { it.isAfter(now) }.minOrNull() ?: return
        val epochMillis = nextEventTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

        val intent = Intent(context, TimetableWidgetProvider::class.java).apply {
            action = TimetableWidgetProvider.ACTION_REDRAW_ALL
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                }
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Delega en DayLogic para mantener una única fuente de la verdad para eventos temporales.
     */
    fun computeNextEventTime(
        now: LocalDateTime,
        timetable: List<TimetableLesson>
    ): LocalDateTime? {
        return DayLogic.computeNextEventTime(now, timetable)
    }
}
