package com.ehuntis.widget.data

import java.time.DayOfWeek
import java.time.LocalDate

object CustomEventsLogic {

    /**
     * Genera la clave compuesta determinista para identificar una clase de WebUntis en overrides.
     * Prefiere ${date}_${lesson.id} si existe. Fallback a ${date}_${subjectId}_${start}_${type}.
     */
    fun getLessonOverrideKey(lesson: TimetableLesson): String {
        val date = lesson.date
        if (lesson.id != null && lesson.id != 0L) {
            return "${date}_${lesson.id}"
        }
        val subjId = lesson.subjectIds.filterNotNull().firstOrNull()?.toString()
            ?: lesson.subjects.firstOrNull() ?: "nosubj"
        val start = lesson.startTime
        val type = (lesson.type ?: "").trim().lowercase()
        return "${date}_${subjId}_${start}_${type}"
    }

    /**
     * Aplica los overrides sobre la lista de clases oficiales de WebUntis.
     * Modifica horarios, aula, notas, estado de cancelación visual (userCancelled) o swaps.
     */
    fun applyLessonOverrides(
        lessons: List<TimetableLesson>,
        overrides: Map<String, LessonOverrideDto>
    ): List<TimetableLesson> {
        if (lessons.isEmpty() || overrides.isEmpty()) return lessons
        val overridesList = overrides.values.toList()

        return lessons.map { lesson ->
            if (lesson.isCustomEvent) return@map lesson

            val key = getLessonOverrideKey(lesson)
            val ov = overrides[key]
                ?: if (lesson.id != null) overridesList.firstOrNull { it.lessonId == lesson.id } else null

            if (ov == null) {
                lesson
            } else {
                val isUserCancelled = ov.userCancelled == true
                lesson.copy(
                    date = ov.customDate ?: lesson.date,
                    startTime = ov.customStartTime ?: lesson.startTime,
                    endTime = ov.customEndTime ?: lesson.endTime,
                    rooms = ov.customRooms ?: lesson.rooms,
                    notes = ov.customNotes ?: lesson.notes,
                    isUserCancelled = isUserCancelled,
                    code = if (isUserCancelled) "cancelled" else lesson.code,
                    isOverridden = true,
                    swappedWith = ov.swappedWith
                )
            }
        }
    }

    /**
     * Expande las definiciones de eventos personalizados en ocurrencias puntuales
     * para un conjunto de fechas (targetDates).
     */
    fun expandCustomEventsForDates(
        customEvents: List<CustomEventDto>,
        targetDates: List<LocalDate>
    ): List<TimetableLesson> {
        if (customEvents.isEmpty() || targetDates.isEmpty()) return emptyList()
        val instances = mutableListOf<TimetableLesson>()

        for (dateObj in targetDates) {
            val dateNum = DayLogic.toDateNumber(dateObj)
            // Mapear DayOfWeek de Java (1 = Lunes .. 7 = Domingo) a formato JS (0 = Domingo .. 6 = Sábado)
            val jsDayOfWeek = if (dateObj.dayOfWeek == DayOfWeek.SUNDAY) 0 else dateObj.dayOfWeek.value

            for (event in customEvents) {
                val rec = event.recurrence
                val exceptions = rec.exceptions
                if (exceptions.contains(dateNum)) continue

                val matches = when (rec.type.lowercase()) {
                    "none" -> rec.date == dateNum
                    "weekly" -> {
                        val isDayMatched = rec.daysOfWeek.contains(jsDayOfWeek) || (jsDayOfWeek == 0 && rec.daysOfWeek.contains(7))
                        val isAfterStart = rec.startDate == null || dateNum >= rec.startDate
                        val isBeforeEnd = rec.endDate == null || dateNum <= rec.endDate
                        isDayMatched && isAfterStart && isBeforeEnd
                    }
                    else -> false
                }

                if (matches) {
                    val title = if (event.title.isNotBlank()) event.title.trim() else "Evento personal"
                    instances.add(
                        TimetableLesson(
                            id = null,
                            date = dateNum,
                            startTime = event.startTime,
                            endTime = event.endTime,
                            subjects = listOf(title),
                            subjectShortNames = listOf(title),
                            rooms = if (event.location.isNotBlank()) listOf(event.location.trim()) else emptyList(),
                            teachers = emptyList(),
                            notes = event.notes,
                            code = null,
                            type = if (event.category.isNotBlank()) event.category.trim().uppercase() else "PERSONAL",
                            isDimmed = false,
                            isCustomEvent = true,
                            colorIndex = event.colorIndex
                        )
                    )
                }
            }
        }
        return instances
    }
}
