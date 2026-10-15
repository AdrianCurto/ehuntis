package com.ehuntis.widget.data

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

object DayLogic {

    val DAYS_FULL = listOf("domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado")
    val MONTHS_SHORT = listOf("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")

    /**
     * Devuelve los límites del curso académico para una fecha dada (1 de septiembre al 30 de junio).
     */
    fun getAcademicYearBounds(date: LocalDate = LocalDate.now()): Pair<LocalDate, LocalDate> {
        val startYear = if (date.monthValue >= 8) date.year else date.year - 1
        val start = LocalDate.of(startYear, 9, 1)
        val end = LocalDate.of(startYear + 1, 6, 30)
        return Pair(start, end)
    }

    /**
     * Convierte LocalDate a entero YYYYMMDD.
     */
    fun toDateNumber(date: LocalDate): Int {
        return date.year * 10000 + date.monthValue * 100 + date.dayOfMonth
    }

    /**
     * Convierte entero YYYYMMDD a LocalDate.
     */
    fun parseDateNumber(dateNum: Int): LocalDate {
        if (dateNum < 10000101) return LocalDate.now()
        val y = dateNum / 10000
        val m = (dateNum % 10000) / 100
        val d = dateNum % 100
        return try {
            LocalDate.of(y, m, d)
        } catch (_: Exception) {
            LocalDate.now()
        }
    }

    /**
     * Convierte una hora WebUntis (830, 1430) a minutos desde medianoche (510, 870).
     */
    fun toMinutes(timeVal: Int): Int {
        val hour = timeVal / 100
        val min = timeVal % 100
        return hour * 60 + min
    }

    /**
     * Diferencia en días enteros (dateA - dateB).
     */
    fun differenceInDays(dateA: LocalDate, dateB: LocalDate): Int {
        return ChronoUnit.DAYS.between(dateB, dateA).toInt()
    }

    /**
     * Nombre del día en español en minúsculas.
     */
    fun getDayOfWeekName(date: LocalDate): String {
        return when (date.dayOfWeek) {
            DayOfWeek.MONDAY -> "lunes"
            DayOfWeek.TUESDAY -> "martes"
            DayOfWeek.WEDNESDAY -> "miércoles"
            DayOfWeek.THURSDAY -> "jueves"
            DayOfWeek.FRIDAY -> "viernes"
            DayOfWeek.SATURDAY -> "sábado"
            DayOfWeek.SUNDAY -> "domingo"
            null -> ""
        }
    }

    /**
     * Formato corto de fecha (ej. "15 sep", "20 abr").
     */
    fun formatDateShort(date: LocalDate): String {
        val monthIdx = (date.monthValue - 1).coerceIn(0, 11)
        return "${date.dayOfMonth} ${MONTHS_SHORT[monthIdx]}"
    }

    /**
     * Filtra las lecciones correspondientes a una fecha YYYYMMDD.
     * Por defecto excluye lecciones canceladas o atenuadas (isDimmed) para cálculos de saltos de día.
     * Si includeDimmed es true, incluye lecciones atenuadas para que el motor de renderizado las dibuje con su estilo visual propio.
     */
    fun getLessonsForDate(timetable: List<TimetableLesson>, dateNum: Int, includeDimmed: Boolean = false): List<TimetableLesson> {
        if (timetable.isEmpty()) return emptyList()
        return timetable.filter { l ->
            l.date == dateNum && l.code != "cancelled" && (includeDimmed || !l.isDimmed)
        }
    }

    /**
     * Hora de fin de la última clase de una lista de lecciones en minutos desde 00:00.
     */
    fun getLastLessonEndMinutes(lessons: List<TimetableLesson>): Int? {
        if (lessons.isEmpty()) return null
        return lessons.maxOfOrNull { toMinutes(it.endTime) }
    }

    /**
     * Calcula dinámicamente la ventana temporal visible (horas y minutos de inicio/fin)
     * optimizada para el horario del día para maximizar el tamaño y legibilidad de las tarjetas.
     * Añade un margen cómodo de ~30 a 60 minutos antes de la primera clase y después de la última,
     * garantizando un respiro visual natural, inclusión del indicador de hora actual si procede,
     * y un rango mínimo de horas (por defecto 5) para evitar que clases aisladas se sobredimensionen.
     */
    fun computeVisibleTimeRange(
        dayLessons: List<TimetableLesson>,
        isToday: Boolean = false,
        nowMinutes: Int = 0,
        minHoursSpan: Int = 6
    ): VisibleTimeRange {
        if (dayLessons.isEmpty()) {
            val defFirst = 8
            val defLast = 21
            val defStart = defFirst * 60 - 30 // 07:30
            val defEnd = defLast * 60 + 30     // 21:30
            return VisibleTimeRange(
                firstHour = defFirst,
                lastHour = defLast,
                startMinutes = defStart,
                endMinutes = defEnd,
                totalMinutes = defEnd - defStart
            )
        }

        val minClassMins = dayLessons.minOf { toMinutes(it.startTime) }
        val maxClassMins = dayLessons.maxOf { toMinutes(it.endTime) }

        var firstHour = minClassMins / 60
        var lastHour = (maxClassMins + 59) / 60

        // Si la jornada dura menos de 6 horas, completamos hasta el mínimo para no sobredimensionar las tarjetas.
        // Solo añadimos como máximo 1 hora de margen arriba (si cabe sin bajar de las 8:00); el resto del relleno va abajo.
        // Si la jornada ya tiene 6 o más horas, NO se añade ninguna hora extra arriba (empieza directo en firstHour).
        val span = lastHour - firstHour
        if (span < minHoursSpan) {
            val needed = minHoursSpan - span
            val maxCanAddBefore = (firstHour - 8).coerceAtLeast(0)
            val addBefore = minOf(1, minOf(needed, maxCanAddBefore))
            val addAfter = needed - addBefore

            firstHour -= addBefore
            lastHour += addAfter
        }

        // Limitar estrictamente al horario oficial (8:00 a 21:00)
        if (lastHour > 21) {
            val overflow = lastHour - 21
            lastHour = 21
            firstHour = maxOf(8, firstHour - overflow)
        }
        if (firstHour < 8) {
            val underflow = 8 - firstHour
            firstHour = 8
            lastHour = minOf(21, lastHour + underflow)
        }

        firstHour = firstHour.coerceIn(8, 21 - minHoursSpan)
        lastHour = lastHour.coerceIn(firstHour + minHoursSpan, 21)

        val startMins = firstHour * 60 - 10
        val endMins = lastHour * 60 + 15

        return VisibleTimeRange(
            firstHour = firstHour,
            lastHour = lastHour,
            startMinutes = startMins,
            endMinutes = endMins,
            totalMinutes = endMins - startMins
        )
    }

    /**
     * Algoritmo universal de decisión: ¿Qué día mostrar?
     */
    fun getResolvedTargetDate(
        now: LocalDateTime = LocalDateTime.now(),
        timetable: List<TimetableLesson> = emptyList()
    ): LocalDate {
        val currentDate = now.toLocalDate()

        // CASO ESPECIAL 1: Sin timetable
        if (timetable.isEmpty()) {
            var fallback = currentDate
            if (fallback.dayOfWeek == DayOfWeek.SUNDAY) {
                fallback = fallback.plusDays(1)
            } else if (fallback.dayOfWeek == DayOfWeek.SATURDAY) {
                fallback = fallback.plusDays(2)
            }
            val m = fallback.monthValue
            if (m == 7 || m == 8 || (m == 9 && fallback.dayOfMonth < 7)) {
                return LocalDate.of(fallback.year, 9, 7)
            }
            return fallback
        }

        // CASO ESPECIAL 2: Verano (julio, agosto o antes del 7 de septiembre)
        val m = currentDate.monthValue
        if (m == 7 || m == 8 || (m == 9 && currentDate.dayOfMonth < 7)) {
            val todayLessons = getLessonsForDate(timetable, toDateNumber(currentDate))
            if (todayLessons.isEmpty()) {
                val tomorrow = currentDate.plusDays(1)
                val tomorrowLessons = getLessonsForDate(timetable, toDateNumber(tomorrow))
                if (tomorrowLessons.isEmpty()) {
                    return LocalDate.of(currentDate.year, 9, 7)
                }
            }
        }

        val todayNum = toDateNumber(currentDate)
        val todayLessons = getLessonsForDate(timetable, todayNum, includeDimmed = false)

        // CASO A: Hoy TIENE clases propias
        if (todayLessons.isNotEmpty()) {
            val lastEnd = getLastLessonEndMinutes(todayLessons)
            val nowM = now.hour * 60 + now.minute
            val minutesSinceLast = if (lastEnd != null) nowM - lastEnd else 0
            val nowH = now.hour

            val shouldJump = (nowH >= 16 && minutesSinceLast >= 60) || (nowH >= 21)
            if (!shouldJump) {
                return currentDate
            }

            // Al cumplirse el salto, buscar el próximo día con clase lectiva
            val nextClassDate = findClosestClassDate(currentDate, 1, timetable) ?: return currentDate.plusDays(1)
            val gapDays = differenceInDays(nextClassDate, currentDate) - 1

            return if (gapDays < 5) {
                // Brecha corta (< 5 días: mañana, día libre suelto, finde o puente 3-4 días): salto directo al próximo día lectivo
                nextClassDate
            } else {
                // Vacaciones largas (>= 5 días): pasar a la cuenta atrás del periodo vacacional
                if (currentDate == nextClassDate.minusDays(1) && nowH >= 16) {
                    nextClassDate
                } else {
                    currentDate.plusDays(1)
                }
            }
        }

        // CASO B: Hoy NO tiene clases propias (fin de semana, día libre o vacaciones)
        val nextClassDate = findClosestClassDate(currentDate, 1, timetable) ?: return currentDate
        val pastClassDate = findClosestClassDate(currentDate, -1, timetable)
        val totalGap = if (pastClassDate != null) {
            differenceInDays(nextClassDate, pastClassDate) - 1
        } else {
            differenceInDays(nextClassDate, currentDate)
        }

        return if (totalGap < 5) {
            // Periodo no vacacional (< 5 días): mostrar siempre el próximo día con clase
            nextClassDate
        } else {
            // Vacaciones largas (>= 5 días): solo mostrar horario a partir de las 16:00 del día anterior
            if (currentDate == nextClassDate.minusDays(1) && now.hour >= 16) {
                nextClassDate
            } else {
                currentDate
            }
        }
    }

    /**
     * Calcula la fecha y hora exacta del próximo evento temporal que requiere redibujar el widget
     * (Fin de clase para sombrear, salto de día según DayLogic o medianoche).
     */
    fun computeNextEventTime(
        now: LocalDateTime,
        timetable: List<TimetableLesson>
    ): LocalDateTime? {
        val today = now.toLocalDate()
        val nowMinutes = now.hour * 60 + now.minute
        val todayNum = toDateNumber(today)
        val ownTodayLessons = getLessonsForDate(timetable, todayNum, includeDimmed = false)
        val allTodayLessons = getLessonsForDate(timetable, todayNum, includeDimmed = true)

        val candidates = mutableListOf<LocalDateTime>()

        // 1. Fin de clases de hoy que aún no hayan terminado (para sombreado visual isPast)
        val upcomingClassEnds = allTodayLessons
            .map { toMinutes(it.endTime) }
            .filter { it > nowMinutes }

        for (endMin in upcomingClassEnds) {
            candidates.add(today.atTime(endMin / 60, endMin % 60, 2))
        }

        // 2. Momento del salto de día según DayLogic
        if (ownTodayLessons.isNotEmpty()) {
            val lastEnd = getLastLessonEndMinutes(ownTodayLessons)
            if (lastEnd != null) {
                // (nowH >= 16 && minutesSinceLast >= 60) || (nowH >= 21)
                val jumpMinute = minOf(21 * 60, maxOf(16 * 60, lastEnd + 60))
                if (jumpMinute > nowMinutes) {
                    candidates.add(today.atTime(jumpMinute / 60, jumpMinute % 60, 2))
                }
            }
        } else {
            // Hoy no tiene clases propias: comprobar si estamos en la víspera de retorno de vacaciones largas
            val nextClass = findClosestClassDate(today, 1, timetable)
            if (nextClass != null) {
                val dayBefore = nextClass.minusDays(1)
                if (today == dayBefore && now.hour < 16) {
                    candidates.add(today.atTime(16, 0, 2))
                }
            }
        }

        // 3. Medianoche (00:00:02 de mañana) para cambio formal de fecha
        candidates.add(today.plusDays(1).atTime(0, 0, 2))

        return candidates.filter { it.isAfter(now) }.minOrNull()
    }

    /**
     * Busca el día lectivo más cercano en una dirección (+1 adelante, -1 atrás).
     */
    fun findClosestClassDate(
        fromDate: LocalDate,
        direction: Int,
        timetable: List<TimetableLesson>,
        bounds: Pair<LocalDate, LocalDate> = getAcademicYearBounds(fromDate)
    ): LocalDate? {
        if (timetable.isEmpty()) return null
        val step = if (direction >= 0) 1L else -1L
        var curr = fromDate.plusDays(step)
        var iterations = 0

        while (iterations < 365) {
            iterations++
            if (curr.isBefore(bounds.first) || curr.isAfter(bounds.second)) {
                return null
            }
            val lessons = getLessonsForDate(timetable, toDateNumber(curr))
            if (lessons.isNotEmpty()) {
                return curr
            }
            curr = curr.plusDays(step)
        }
        return null
    }

    /**
     * Analiza la racha de días sin clase en torno a targetDate (vacaciones/puentes).
     */
    fun analyzeBreakStreak(
        targetDate: LocalDate,
        timetable: List<TimetableLesson>,
        schoolYearEndDate: LocalDate? = null
    ): BreakStreakResult {
        val bounds = getAcademicYearBounds(targetDate)
        val end = schoolYearEndDate ?: bounds.second

        val pastClassDate = findClosestClassDate(targetDate, -1, timetable, bounds)
        val futureClassDate = findClosestClassDate(targetDate, 1, timetable, bounds)

        // Fin de curso
        if (futureClassDate == null || futureClassDate.isAfter(end)) {
            return BreakStreakResult(
                type = BreakStreakType.END_OF_YEAR,
                message = "No hay más clases programadas para este curso"
            )
        }

        val totalDaysWithoutClass = if (pastClassDate != null) {
            differenceInDays(futureClassDate, pastClassDate) - 1
        } else {
            differenceInDays(futureClassDate, targetDate)
        }

        // Brecha larga (>= 3 días)
        if (totalDaysWithoutClass >= 3) {
            val daysRemaining = maxOf(1, differenceInDays(futureClassDate, targetDate))
            val dayName = getDayOfWeekName(futureClassDate)
            val dateStr = formatDateShort(futureClassDate)
            val plural = if (daysRemaining == 1) "Falta" else "Faltan"
            val unit = if (daysRemaining == 1) "día" else "días"

            return BreakStreakResult(
                type = BreakStreakType.EXTENDED_BREAK,
                message = "$plural $daysRemaining $unit para volver a clase (Vuelves el $dayName $dateStr)",
                totalDays = totalDaysWithoutClass,
                daysRemaining = daysRemaining,
                returnDate = futureClassDate
            )
        }

        // Brecha corta (< 3 días)
        return BreakStreakResult(
            type = BreakStreakType.NO_CLASS_TODAY,
            message = "Sin clases hoy"
        )
    }
}
