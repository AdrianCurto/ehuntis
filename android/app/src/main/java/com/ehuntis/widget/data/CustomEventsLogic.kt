package com.ehuntis.widget.data

import java.text.Normalizer
import java.time.DayOfWeek
import java.time.LocalDate

object CustomEventsLogic {

    private val ROOM_SUFFIX_REGEX = Regex("_\\d+$")
    private val DIACRITICS_REGEX = Regex("\\p{InCombiningDiacriticalMarks}+")
    private val WHITESPACE_REGEX = Regex("\\s+")

    /**
     * Normaliza una lista de aulas para comparación fiable (sin espacios, sin sufijos _id,
     * sin tildes, minúsculas, deduplicadas y ordenadas). Ej.: "P3 G2A" == "P3G2A".
     */
    fun normalizeRooms(rooms: List<String>?): List<String> {
        if (rooms.isNullOrEmpty()) return emptyList()
        val seen = LinkedHashSet<String>()
        for (entry in rooms) {
            for (part in entry.split(",")) {
                val cleaned = part.trim().replace(ROOM_SUFFIX_REGEX, "")
                if (cleaned.isEmpty()) continue
                val nfd = Normalizer.normalize(cleaned, Normalizer.Form.NFD)
                val token = DIACRITICS_REGEX.replace(nfd, "")
                    .replace(WHITESPACE_REGEX, "")
                    .lowercase()
                if (token.isNotEmpty()) {
                    seen.add(token)
                }
            }
        }
        return seen.sorted()
    }

    fun areRoomsEqual(roomsA: List<String>?, roomsB: List<String>?): Boolean {
        return normalizeRooms(roomsA) == normalizeRooms(roomsB)
    }

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
     * Aplica los overrides sobre la lista de clases oficiales de WebUntis con reconciliación 3-way:
     * - Si WebUntis cambia un campo que el usuario no modificó (según originalSnapshot), aplica el cambio oficial.
     * - Si el cambio oficial converge al valor del usuario (p. ej. "P3 G2A" == "P3G2A"), descarta ese override.
     * - Si no queda ningún cambio real respecto a la clase oficial, la devuelve sin marcarla como editada.
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
                val snap = ov.originalSnapshot
                val officialDate = lesson.date
                val officialStart = lesson.startTime
                val officialEnd = lesson.endTime
                val officialRooms = lesson.rooms
                val officialCode = lesson.code
                val isOfficialCancelled = officialCode == "cancelled"

                // 1. Fecha
                val baseDate = snap?.date ?: officialDate
                val customDate = ov.customDate
                val userModifiedDate = customDate != null && customDate != baseDate
                val effectiveDateChange = userModifiedDate && customDate != officialDate
                val finalDate = if (effectiveDateChange) customDate else officialDate

                // 2. Horario (atómico startTime + endTime)
                val baseStart = snap?.startTime ?: officialStart
                val baseEnd = snap?.endTime ?: officialEnd
                val userStart = ov.customStartTime ?: baseStart
                val userEnd = ov.customEndTime ?: baseEnd
                val userModifiedTime =
                    (ov.customStartTime != null && ov.customStartTime != baseStart) ||
                    (ov.customEndTime != null && ov.customEndTime != baseEnd)
                val effectiveTimeChange = userModifiedTime && (userStart != officialStart || userEnd != officialEnd)
                val finalStart = if (effectiveTimeChange) userStart else officialStart
                val finalEnd = if (effectiveTimeChange) userEnd else officialEnd

                // 3. Aulas
                val baseRooms = snap?.rooms ?: officialRooms
                val customRooms = ov.customRooms
                val userModifiedRoom = customRooms != null && !areRoomsEqual(customRooms, baseRooms)
                val effectiveRoomsChange = userModifiedRoom && !areRoomsEqual(customRooms, officialRooms)
                val finalRooms = if (effectiveRoomsChange) customRooms else officialRooms

                // 4. Swap (solo sigue activo si aún difiere algún campo posicional)
                val hasPositionalChange = effectiveDateChange || effectiveTimeChange || effectiveRoomsChange
                val activeSwap = if (ov.swappedWith != null && hasPositionalChange) ov.swappedWith else null

                // 5. Cancelación
                val rawUserCancelled = ov.userCancelled == true
                val effectiveUserCancelled = rawUserCancelled && !isOfficialCancelled
                val wasOfficialCancelled = snap?.code == "cancelled"
                val pendingCancelConflict =
                    snap != null && !wasOfficialCancelled && isOfficialCancelled && !rawUserCancelled &&
                    ov.ignoreOfficialCancellation != true && (hasPositionalChange || activeSwap != null)
                val effectiveIgnoreOfficialCancel =
                    (ov.ignoreOfficialCancellation == true || pendingCancelConflict) && isOfficialCancelled

                val finalCode = when {
                    effectiveUserCancelled -> "cancelled"
                    effectiveIgnoreOfficialCancel -> null
                    else -> officialCode
                }

                // 6. Notas
                val hasNotes = !ov.customNotes.isNullOrBlank()

                val hasChanges =
                    effectiveUserCancelled ||
                    effectiveIgnoreOfficialCancel ||
                    activeSwap != null ||
                    hasNotes ||
                    hasPositionalChange

                if (!hasChanges) {
                    lesson
                } else {
                    lesson.copy(
                        date = finalDate,
                        startTime = finalStart,
                        endTime = finalEnd,
                        rooms = finalRooms,
                        notes = if (hasNotes) ov.customNotes else lesson.notes,
                        isUserCancelled = effectiveUserCancelled,
                        code = finalCode,
                        isOverridden = true,
                        swappedWith = activeSwap
                    )
                }
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
