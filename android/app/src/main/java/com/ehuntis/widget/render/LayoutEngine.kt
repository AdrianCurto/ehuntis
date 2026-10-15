package com.ehuntis.widget.render

import android.graphics.Paint
import android.graphics.RectF
import com.ehuntis.widget.data.DayLogic
import com.ehuntis.widget.data.Subgroups
import com.ehuntis.widget.data.TimetableLesson

data class ColumnPlacement(
    val colIdx: Int,
    val span: Int,
    val totalColumns: Int
)

data class SubjectTier(
    val name: String,
    val words: List<String>,
    val isSiglas: Boolean = false,
    val isStacked: Boolean = false
)

data class StepState(val s: Int, val r: Int, val t: Int)

internal data class RoomCandidate(
    val show: Boolean,
    val text: String,
    val font: Float,
    val height: Float
)

internal data class TeacherCandidate(
    val show: Boolean,
    val text: String,
    val font: Float,
    val height: Float
)

data class BlockLayoutResult(
    val badgeText: String?,
    val badgeFontSizePx: Float,
    val badgeHeightPx: Float,
    val subjectLines: List<String>,
    val subjectFontSizePx: Float,
    val subjectLineHeightPx: Float,
    val roomText: String?,
    val roomFontSizePx: Float,
    val teacherText: String?,
    val teacherFontSizePx: Float
)

data class RenderedBlock(
    val lesson: TimetableLesson,
    val placement: ColumnPlacement,
    val rect: RectF,
    val subjectLines: List<String>,
    val subjectTextSizePx: Float,
    val roomText: String?,
    val roomTextSizePx: Float,
    val badgeText: String?,
    val color: BlockColor,
    val isPast: Boolean,
    val isActive: Boolean
)

object LayoutEngine {

    val STOP_WORDS = setOf(
        "de", "del", "la", "las", "el", "los", "y", "e", "en", "i", "eta", "a", "o", "d", "para", "por", "con", "al", "da"
    )

    fun getLessonKey(lesson: TimetableLesson): String {
        return "${lesson.id ?: 0L}_${lesson.date}_${lesson.startTime}_${lesson.endTime}"
    }

    /**
     * Algoritmo idéntico a arrangeColumns en WeekCalendar.js
     */
    fun arrangeColumns(lessons: List<TimetableLesson>): Map<String, ColumnPlacement> {
        if (lessons.isEmpty()) return emptyMap()
        val valid = lessons.filter { it.startTime > 0 && it.endTime > 0 }
        if (valid.isEmpty()) return emptyMap()

        val sorted = valid.sortedWith(
            compareBy<TimetableLesson> { it.startTime }.thenByDescending { it.endTime }
        )

        val clusters = mutableListOf<MutableList<TimetableLesson>>()
        var currentCluster = mutableListOf<TimetableLesson>()
        var clusterEnd = 0

        for (lesson in sorted) {
            val startMins = DayLogic.toMinutes(lesson.startTime)
            val endMins = DayLogic.toMinutes(lesson.endTime)

            if (currentCluster.isEmpty()) {
                currentCluster.add(lesson)
                clusterEnd = endMins
            } else if (startMins < clusterEnd) {
                currentCluster.add(lesson)
                clusterEnd = maxOf(clusterEnd, endMins)
            } else {
                clusters.add(currentCluster)
                currentCluster = mutableListOf(lesson)
                clusterEnd = endMins
            }
        }
        if (currentCluster.isNotEmpty()) {
            clusters.add(currentCluster)
        }

        val result = mutableMapOf<String, ColumnPlacement>()

        for (cluster in clusters) {
            val columns = mutableListOf<MutableList<TimetableLesson>>()

            for (lesson in cluster) {
                var placed = false
                for (col in columns) {
                    val lastInCol = col.last()
                    if (DayLogic.toMinutes(lastInCol.endTime) <= DayLogic.toMinutes(lesson.startTime)) {
                        col.add(lesson)
                        placed = true
                        break
                    }
                }
                if (!placed) {
                    columns.add(mutableListOf(lesson))
                }
            }

            for (colIdx in columns.indices) {
                for (lesson in columns[colIdx]) {
                    var span = 1
                    for (nextColIdx in (colIdx + 1) until columns.size) {
                        val hasOverlap = columns[nextColIdx].any { other ->
                            DayLogic.toMinutes(other.startTime) < DayLogic.toMinutes(lesson.endTime) &&
                            DayLogic.toMinutes(other.endTime) > DayLogic.toMinutes(lesson.startTime)
                        }
                        if (!hasOverlap) {
                            span++
                        } else {
                            break
                        }
                    }
                    result[getLessonKey(lesson)] = ColumnPlacement(
                        colIdx = colIdx,
                        span = span,
                        totalColumns = columns.size
                    )
                }
            }
        }

        return result
    }

    /**
     * Genera combinaciones ordenadas alternando la reducción paso a paso de asignatura, aula y profesor,
     * idéntico a generateAlternatingSteps en WeekCalendar.js
     */
    fun generateAlternatingSteps(sLen: Int, rLen: Int, tLen: Int): List<StepState> {
        val steps = mutableListOf<StepState>()
        var s = 0
        var r = 0
        var t = 0
        steps.add(StepState(s, r, t))
        val order = listOf('s', 'r', 't')
        var orderIdx = 0

        while (s < sLen - 1 || r < rLen - 1 || t < tLen - 1) {
            var advanced = false
            for (i in order.indices) {
                val turn = order[(orderIdx + i) % order.size]
                if (turn == 's' && s < sLen - 1) {
                    s++
                    advanced = true
                    orderIdx = (orderIdx + i + 1) % order.size
                    break
                } else if (turn == 'r' && r < rLen - 1) {
                    r++
                    advanced = true
                    orderIdx = (orderIdx + i + 1) % order.size
                    break
                } else if (turn == 't' && t < tLen - 1) {
                    t++
                    advanced = true
                    orderIdx = (orderIdx + i + 1) % order.size
                    break
                }
            }
            if (!advanced) break
            steps.add(StepState(s, r, t))
        }
        return steps
    }

    fun buildSubjectTiers(fullName: String, lesson: TimetableLesson?): List<SubjectTier> {
        if (fullName.isBlank()) return emptyList()
        val clean = fullName.replace(Regex("[(),.\\-:/]"), " ").trim()
        val allTokens = clean.split(Regex("\\s+")).filter { it.isNotBlank() }
        if (allTokens.isEmpty()) return emptyList()

        val tiers = mutableListOf<SubjectTier>()

        fun shorten(w: String, len: Int): String {
            if (w.length <= len) return w
            return w.substring(0, 1).uppercase() + w.substring(1, len).lowercase()
        }

        val sigTokens = allTokens.filter { it.lowercase() !in STOP_WORDS }
        val hasMultipleWords = allTokens.size > 1

        // 1. Full
        tiers.add(SubjectTier("full", allTokens))

        // 2. 3-chars with stop words
        if (allTokens.any { it.length > 3 }) {
            val w3With = allTokens.map {
                if (it.lowercase() in STOP_WORDS) it.lowercase()
                else shorten(it, 3)
            }
            tiers.add(SubjectTier("3-chars-with", w3With))
        }

        // 3. 3-chars without stop words
        if (hasMultipleWords && sigTokens.isNotEmpty()) {
            val w3No = sigTokens.map { shorten(it, 3) }
            tiers.add(SubjectTier("3-chars-no", w3No))
        }

        // 4. 2-chars with stop words
        if (allTokens.any { it.length > 2 }) {
            val w2With = allTokens.map {
                if (it.lowercase() in STOP_WORDS) it.lowercase()
                else shorten(it, 2)
            }
            tiers.add(SubjectTier("2-chars-with", w2With))
        }

        // 5. 2-chars without stop words
        if (hasMultipleWords && sigTokens.isNotEmpty()) {
            val w2No = sigTokens.map { shorten(it, 2) }
            tiers.add(SubjectTier("2-chars-no", w2No))
        }

        // 6. Siglas inline
        val initials = (if (sigTokens.isNotEmpty()) sigTokens else allTokens)
            .map { it.substring(0, 1).uppercase() }
            .joinToString("")

        val officialShort = lesson?.subjectShortNames?.firstOrNull()?.trim()
        val siglas = if (!officialShort.isNullOrBlank() && officialShort.length <= 4 && !officialShort.equals(fullName, ignoreCase = true)) {
            officialShort
        } else {
            initials
        }

        if (siglas.length > 1) {
            tiers.add(SubjectTier("siglas-inline", listOf(siglas), isSiglas = true))
        }

        // 7. Siglas stacked
        tiers.add(SubjectTier("siglas-stacked", siglas.map { it.toString() }, isStacked = true))

        return tiers
    }

    fun getRoomCandidates(rawRoom: String?): List<String> {
        if (rawRoom.isNullOrBlank()) return emptyList()
        val clean = rawRoom.trim().replace(Regex("\\s+"), "")
        val candidates = mutableListOf(clean)
        // EHU room codes: P2G1A -> P2G1
        if (Regex("[0-9][A-Za-z]$").containsMatchIn(clean)) {
            candidates.add(clean.substring(0, clean.length - 1))
        }
        return candidates
    }

    private fun wrapWords(words: List<String>, paint: Paint, maxWidth: Float): List<String>? {
        val lines = mutableListOf<String>()
        var currentLine = ""

        for (word in words) {
            val wordW = paint.measureText(word)
            if (wordW > maxWidth + 1f) {
                return null
            }
            val testLine = if (currentLine.isEmpty()) word else "$currentLine $word"
            val testW = paint.measureText(testLine)
            if (testW <= maxWidth + 1f) {
                currentLine = testLine
            } else {
                if (currentLine.isNotEmpty()) lines.add(currentLine)
                currentLine = word
            }
        }
        if (currentLine.isNotEmpty()) lines.add(currentLine)
        return lines
    }

    fun getTeacherCandidates(rawTeacher: String?): List<String> {
        if (rawTeacher.isNullOrBlank()) return emptyList()
        val clean = rawTeacher.replace(Regex("-\\d+$"), "").trim()
        if (clean.startsWith("PGD", ignoreCase = true)) return emptyList()
        val parts = clean.split(Regex("\\s+")).filter { it.isNotBlank() }
        if (parts.size <= 1) return listOf(clean)

        val prefixes = listOf("de la", "de las", "del", "de", "la", "las", "los", "san", "santa")
        var surname = parts.last()
        var firstNameParts = parts.dropLast(1)

        if (parts.size >= 3) {
            val twoBefore = parts.takeLast(3).dropLast(1).joinToString(" ").lowercase()
            if (twoBefore == "de la" || twoBefore == "de las") {
                surname = parts.takeLast(3).joinToString(" ")
                firstNameParts = parts.dropLast(3)
            }
        }
        if (firstNameParts.size == parts.size - 1 && parts.size >= 2) {
            val oneBefore = parts[parts.size - 2].lowercase()
            if (prefixes.contains(oneBefore)) {
                surname = parts.takeLast(2).joinToString(" ")
                firstNameParts = parts.dropLast(2)
            }
        }

        if (firstNameParts.isEmpty()) {
            firstNameParts = listOf(parts.first())
            surname = parts.drop(1).joinToString(" ")
        }

        val candidates = mutableListOf<String>()
        candidates.add(clean) // "Charles Richard Pinto"
        if (firstNameParts.size >= 2) {
            val inits = firstNameParts.map { "${it.first().uppercase()}." }.joinToString(" ")
            candidates.add("$inits $surname") // "C. R. Pinto"
        }
        candidates.add("${firstNameParts.first().first().uppercase()}. $surname") // "C. Pinto"
        candidates.add(surname) // "Pinto"
        return candidates.distinct()
    }

    fun isMagistralType(rawType: String?): Boolean {
        if (rawType.isNullOrBlank()) return false
        val raw = rawType.trim()
        val upper = raw.uppercase()
        val numMatch = Regex("\\d+").find(raw)
        val subNum = Subgroups.extractSubgroupNumber(raw) ?: numMatch?.value?.toIntOrNull()
        return (
            upper.contains("MAGIS") ||
            upper == "M" ||
            upper == "GA" ||
            upper.startsWith("GA ") ||
            upper.startsWith("G.A.") ||
            upper == "T" ||
            upper.startsWith("T0") ||
            upper.contains("TEOR")
        ) && subNum == null
    }

    fun getBadgeCandidates(rawType: String?): List<String> {
        if (rawType.isNullOrBlank()) return emptyList()
        val raw = rawType.trim()
        val upper = raw.uppercase()

        // 1. Clases magistrales y de teoría genéricas:
        // Producen candidatos para mostrarse si hay espacio, pero tendrán MENOR prioridad que el aula.
        if (isMagistralType(raw)) {
            val candidates = mutableListOf<String>()
            if (upper.contains("MAGIS")) {
                candidates.add("Magistral")
                candidates.add("Magis")
                candidates.add("M")
            } else if (upper.startsWith("GA") || upper.startsWith("G.A.")) {
                candidates.add("GA")
            } else if (upper == "T" || upper.startsWith("T0") || upper.contains("TEOR")) {
                candidates.add("Teoría")
                candidates.add("Teor")
                candidates.add("T")
            } else {
                candidates.add(raw)
            }
            return candidates.distinct()
        }

        val candidates = mutableListOf<String>()
        val numMatch = Regex("\\d+").find(raw)
        val subNum = Subgroups.extractSubgroupNumber(raw) ?: numMatch?.value?.toIntOrNull()

        // 1. Texto original con guión preservado (ej. "GL-1", "S-1", "GL-3", "GO-2")
        candidates.add(raw)

        // 2. Tipos especializados de sesión
        if (upper.contains("LAB")) {
            if (subNum != null) candidates.add("P. Lab $subNum")
            candidates.add("P. Lab")
            candidates.add("PLab")
        } else if (upper.contains("ORD")) {
            if (subNum != null) candidates.add("P. Ord $subNum")
            candidates.add("P. Ord")
            candidates.add("POrd")
        } else if (upper.contains("SEM")) {
            if (subNum != null) candidates.add("Sem. $subNum")
            candidates.add("Seminario")
            candidates.add("Sem.")
        }

        // 3. Clave de subgrupo compacta sin guión como recurso de reserva (ej. "GL1", "GO2", "S1", "PA3")
        val subKey = Subgroups.extractSubgroupKey(raw)
        if (subKey != null) {
            candidates.add(subKey)
            // Versión con espacio (ej. "GL 1")
            val letters = subKey.takeWhile { it.isLetter() }
            val digits = subKey.takeLastWhile { it.isDigit() }
            if (letters.isNotEmpty() && digits.isNotEmpty()) {
                candidates.add("$letters $digits")
            }
        }

        // 4. Solo el número del subgrupo como opción ultra-compacta
        if (subNum != null) {
            candidates.add(subNum.toString())
        }

        // 5. Si no encajó en los patrones anteriores, permitimos el texto limpio
        val cleaned = raw.replace(Regex("[.\\-,\\s]"), "")
        if (cleaned.isNotEmpty() && cleaned.length <= 8) {
            candidates.add(cleaned)
        }

        return candidates.distinct()
    }

    /**
     * Calcula el diseño completo del bloque (Badge, Asignatura, Aula y Profesor)
     * priorizando el mayor nivel de detalle legible sin desbordar el bloque.
     *
     * Orden de prioridad:
     * - Subgrupos / Prácticas / Seminarios: Insignia de subgrupo > Aula (el subgrupo es crítico)
     * - Magistral / GA (Teoría genérica): Aula > Insignia (el aula es más importante que saber que es teoría)
     *
     * @param widgetWidthDp Ancho total del widget en dp. Se usa para escalar las fuentes de manera
     *                      suave y no-lineal: en widgets pequeños las fuentes se reducen, en widgets
     *                      grandes se quedan en el máximo. La curva usa sqrt para evitar extremos.
     */
    fun computeFullBlockLayout(
        lesson: TimetableLesson,
        blockWidthPx: Float,
        blockHeightPx: Float,
        density: Float,
        textPaint: Paint,
        subtextPaint: Paint,
        widgetWidthDp: Float = 260f,
        isDayView: Boolean = true
    ): BlockLayoutResult {
        // Relleno interno adaptativo proporcional a las dimensiones reales del bloque (idéntico a WeekCalendar.js)
        val padXPx = if (isDayView) {
            if (blockWidthPx < 130f * density) 4f * density else 6.5f * density
        } else {
            if (blockWidthPx < 30f * density) 1.5f * density else 2.5f * density
        }
        val padTopPx = if (isDayView) {
            if (blockHeightPx < 45f * density) 2f * density else 3.5f * density
        } else {
            if (blockHeightPx < 32f * density) 1.5f * density else 2.5f * density
        }
        val padBottomPx = if (isDayView) {
            if (blockHeightPx < 45f * density) 2f * density else 3.5f * density
        } else {
            if (blockHeightPx < 32f * density) 1.5f * density else 2.5f * density
        }

        val availWidth = maxOf(0f, blockWidthPx - padXPx * 2)
        val availHeight = maxOf(0f, blockHeightPx - padTopPx - padBottomPx)

        // Escala de fuente dinámica no-lineal: rango de anchura 180dp–380dp → curva sqrt(t) ∈ [0.85, 1.0]
        val t = ((widgetWidthDp - 180f) / (380f - 180f)).coerceIn(0f, 1f)
        val fontScale = if (isDayView) {
            0.85f + 0.15f * kotlin.math.sqrt(t.toDouble()).toFloat()
        } else {
            1.0f // En vista semanal cada columna es fija e independiente
        }

        val isMagistral = isMagistralType(lesson.type)

        // 1. Candidatos de Badge (estilo cápsula sutil idéntico a BADGE_STYLES de web)
        var bestBadgeText: String? = null
        var bestBadgeFont = if (isDayView) 9.5f * density * fontScale else 8.5f * density
        var bestBadgeHeight = 0f

        val badgeCandidates = getBadgeCandidates(lesson.type)
        val badgeFonts = if (isDayView) {
            listOf(10.5f, 10f, 9.5f, 9f, 8.5f, 8f).map { it * density * fontScale }
        } else {
            listOf(9f, 8.5f, 8f, 7.5f, 7f).map { it * density }
        }

        if (badgeCandidates.isNotEmpty()) {
            val badgePadXPx = (if (isDayView) 3.5f else 2.5f) * density
            badgeLoop@ for (bText in badgeCandidates) {
                for (bFont in badgeFonts) {
                    subtextPaint.textSize = bFont
                    subtextPaint.typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
                    subtextPaint.letterSpacing = 0.02f
                    val w = subtextPaint.measureText(bText) + (badgePadXPx * 2f)
                    if (w <= availWidth) {
                        bestBadgeText = bText
                        bestBadgeFont = bFont
                        bestBadgeHeight = bFont * 1.1f + (if (isDayView) 2.5f else 2f) * density
                        break@badgeLoop
                    }
                }
            }
        }

        // 2. Candidatos de Aula (genera opciones con distintos tamaños de fuente para alternar)
        val rawRoom = lesson.rooms.firstOrNull()?.trim()
        val roomTexts = getRoomCandidates(rawRoom)
        val validRoomCandidates = mutableListOf<RoomCandidate>()
        if (roomTexts.isNotEmpty()) {
            val baseRoomFonts = if (isDayView) {
                listOf(11.5f, 11f, 10f, 9f, 8.5f).map { it * density * fontScale }
            } else {
                listOf(9.5f, 8.5f, 7.5f, 7f).map { it * density }
            }
            for (rFont in baseRoomFonts) {
                subtextPaint.textSize = rFont
                subtextPaint.isFakeBoldText = false
                for (rText in roomTexts) {
                    if (subtextPaint.measureText(rText) <= availWidth) {
                        val rHeight = rFont * (if (rFont <= 8f * density) 1.05f else 1.1f) + (if (blockHeightPx < 36f * density) 0.5f else 1f) * density
                        validRoomCandidates.add(RoomCandidate(show = true, text = rText, font = rFont, height = rHeight))
                        break
                    }
                }
            }
        }
        val hiddenRoom = RoomCandidate(show = false, text = "", font = 0f, height = 0f)

        // 3. Candidatos de Profesor (solo en vista diaria, idéntico a web WeekCalendar.js)
        val rawTeacher = lesson.teachers.firstOrNull()?.trim()
        val teacherTexts = if (isDayView) getTeacherCandidates(rawTeacher) else emptyList()
        val validTeacherCandidates = mutableListOf<TeacherCandidate>()
        if (teacherTexts.isNotEmpty()) {
            val baseTeacherFonts = listOf(11f, 10.5f, 10f, 9.5f, 9f, 8.5f).map { it * density * fontScale }
            var chosenTeacherText: String? = null
            for (tText in teacherTexts) {
                for (tFont in baseTeacherFonts) {
                    subtextPaint.textSize = tFont
                    subtextPaint.isFakeBoldText = true
                    if (subtextPaint.measureText(tText) <= availWidth) {
                        chosenTeacherText = tText
                        break
                    }
                }
                if (chosenTeacherText != null) break
            }

            if (chosenTeacherText != null) {
                for (tFont in baseTeacherFonts) {
                    subtextPaint.textSize = tFont
                    subtextPaint.isFakeBoldText = true
                    if (subtextPaint.measureText(chosenTeacherText) <= availWidth) {
                        val tHeight = tFont * 1.12f + (if (blockHeightPx < 36f * density) 1f else 1.5f) * density
                        validTeacherCandidates.add(TeacherCandidate(show = true, text = chosenTeacherText, font = tFont, height = tHeight))
                    }
                }
            }
        }
        val hiddenTeacher = TeacherCandidate(show = false, text = "", font = 0f, height = 0f)

        // 4. Candidatos de Asignatura (con tipografía e interletraje idéntico a web)
        val fullName = lesson.subjects.firstOrNull()?.takeIf { it.isNotBlank() }
            ?: lesson.subjectShortNames.firstOrNull()?.takeIf { it.isNotBlank() }
            ?: ""
        val tiers = buildSubjectTiers(fullName, lesson)

        // Control de altura física para asegurar legibilidad
        val canTeacher = isDayView && validTeacherCandidates.isNotEmpty() && blockHeightPx >= 44f * density
        val canRoom = validRoomCandidates.isNotEmpty() && blockHeightPx >= (if (isDayView) 24f else 20f) * density
        // Para clases magistrales el badge solo se considera si hay espacio vertical holgado;
        // para subgrupos, la insignia tiene prioridad máxima y se admite desde 18dp.
        val canBadge = if (isMagistral) {
            bestBadgeText != null && blockHeightPx >= (if (isDayView) 55f else 45f) * density
        } else {
            bestBadgeText != null && blockHeightPx >= 18f * density
        }

        data class ConfigAttempt(val allowBadge: Boolean, val allowRoom: Boolean, val allowTeacher: Boolean)
        val attempts = mutableListOf<ConfigAttempt>()

        if (isMagistral) {
            // CLASES MAGISTRALES / GA: El Aula tiene PRIORIDAD ABSOLUTA frente a la insignia
            // 1. Todo completo (si cabe de sobra)
            if (canBadge && canRoom && canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = true, allowTeacher = true))
            }
            // 2. Badge + Aula
            if (canBadge && canRoom) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = true, allowTeacher = false))
            }
            // 3. Aula + Profesor (el badge magistral cae primero siempre)
            if (canRoom && canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = false, allowRoom = true, allowTeacher = true))
            }
            // 4. Aula SOLA (¡Prioridad absoluta! Se mantiene el aula y desaparece la insignia de magistral)
            if (canRoom) {
                attempts.add(ConfigAttempt(allowBadge = false, allowRoom = true, allowTeacher = false))
            }
            // 5. Badge + Profesor (cuando no hay aula)
            if (canBadge && canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = false, allowTeacher = true))
            }
            // 6. Badge SOLO (por si no había aula en los datos del horario)
            if (canBadge) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = false, allowTeacher = false))
            }
            // 7. Profesor solo (por si no hubiera aula ni badge)
            if (canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = false, allowRoom = false, allowTeacher = true))
            }
            // 8. Solo asignatura (si ni siquiera el aula cabe con la asignatura)
            attempts.add(ConfigAttempt(allowBadge = false, allowRoom = false, allowTeacher = false))
        } else {
            // SUBGRUPOS / PRÁCTICAS / SEMINARIOS: La insignia de subgrupo tiene PRIORIDAD MÁXIMA frente al aula
            // 1. Todo completo
            if (canBadge && canRoom && canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = true, allowTeacher = true))
            }
            // 2. Badge + Aula
            if (canBadge && canRoom) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = true, allowTeacher = false))
            }
            // 3. Badge + Profesor
            if (canBadge && canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = false, allowTeacher = true))
            }
            // 4. Badge SOLO (¡Prioridad absoluta! Se mantiene el subgrupo y desaparece el aula)
            if (canBadge) {
                attempts.add(ConfigAttempt(allowBadge = true, allowRoom = false, allowTeacher = false))
            }
            // 5. Aula + Profesor (si no hubo badge)
            if (canRoom && canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = false, allowRoom = true, allowTeacher = true))
            }
            // 6. Aula SOLA
            if (canRoom) {
                attempts.add(ConfigAttempt(allowBadge = false, allowRoom = true, allowTeacher = false))
            }
            // 7. Profesor solo (si no hubo badge ni aula)
            if (canTeacher) {
                attempts.add(ConfigAttempt(allowBadge = false, allowRoom = false, allowTeacher = true))
            }
            // 8. Solo asignatura
            attempts.add(ConfigAttempt(allowBadge = false, allowRoom = false, allowTeacher = false))
        }

        // Proceso iterativo idéntico a WeekCalendar.js:
        // Se prueban las combinaciones secundarias y se reduce en lockstep (alternando paso a paso)
        // la asignatura, el aula y el profesor, garantizando que el nombre de asignatura nunca
        // quede más pequeño que el resto y preservando margen inferior cómodo.
        for (attempt in attempts) {
            val curBadgeH = if (attempt.allowBadge && bestBadgeText != null) bestBadgeHeight else 0f
            val curBadgeText = if (attempt.allowBadge) bestBadgeText else null
            val curBadgeFont = if (attempt.allowBadge) bestBadgeFont else 0f

            val candidateTeachers = if (attempt.allowTeacher && validTeacherCandidates.isNotEmpty()) {
                validTeacherCandidates
            } else {
                listOf(hiddenTeacher)
            }

            val candidateRooms = if (attempt.allowRoom && validRoomCandidates.isNotEmpty()) {
                validRoomCandidates
            } else {
                listOf(hiddenRoom)
            }

            for (tier in tiers) {
                val fonts = if (isDayView) {
                    listOf(14f, 13f, 12f, 11f, 10f).map { it * density * fontScale }
                } else {
                    if (tier.isStacked) {
                        listOf(10f, 9f, 8f).map { it * density }
                    } else {
                        listOf(10.5f, 9.5f, 8.5f, 7.5f).map { it * density }
                    }
                }

                val steps = generateAlternatingSteps(fonts.size, candidateRooms.size, candidateTeachers.size)

                for (step in steps) {
                    val sFont = fonts[step.s]
                    val roomCand = candidateRooms[step.r]
                    val teacherCand = candidateTeachers[step.t]

                    val roomH = roomCand.height
                    val teacherH = teacherCand.height

                    // Margen inferior garantizado para no pegar la asignatura al aula/profesor
                    val subjectBottomGap = if (roomCand.show || teacherCand.show) {
                        (if (isDayView) 3f else 1.5f) * density
                    } else 0f

                    val remainingH = availHeight - curBadgeH - roomH - teacherH - subjectBottomGap
                    if (remainingH < (if (isDayView) 10f else 8f) * density) {
                        continue
                    }

                    textPaint.textSize = sFont
                    textPaint.isFakeBoldText = true
                    textPaint.letterSpacing = if (tier.words.size <= 2) 0.02f else 0.012f

                    val lines = if (tier.isStacked) {
                        if (tier.words.all { textPaint.measureText(it) <= availWidth }) tier.words else null
                    } else {
                        wrapWords(tier.words, textPaint, availWidth)
                    }
                    if (lines == null) continue

                    val lineHeight = if (sFont >= 11f * density) sFont * 1.14f else sFont * 1.10f
                    val subjectH = lines.size * lineHeight

                    if (subjectH <= remainingH + 1f) {
                        return BlockLayoutResult(
                            badgeText = curBadgeText,
                            badgeFontSizePx = curBadgeFont,
                            badgeHeightPx = curBadgeH,
                            subjectLines = lines,
                            subjectFontSizePx = sFont,
                            subjectLineHeightPx = lineHeight,
                            roomText = if (roomCand.show) roomCand.text else null,
                            roomFontSizePx = roomCand.font,
                            teacherText = if (teacherCand.show) teacherCand.text else null,
                            teacherFontSizePx = teacherCand.font
                        )
                    }
                }
            }
        }

        // Fallback garantizado: si hay subgrupo, priorizamos la insignia; si es magistral, priorizamos el aula
        val fallback = tiers.firstOrNull { it.isSiglas } ?: tiers.lastOrNull()
        val fallbackLines = fallback?.words ?: listOf(fullName.take(10))

        val fallbackBadgeText: String?
        val fallbackBadgeHeight: Float
        val fallbackRoom: String?
        val fallbackRoomFont = if (isDayView) 10f * density * fontScale else 8f * density

        if (!isMagistral) {
            if (canBadge) {
                fallbackBadgeText = bestBadgeText
                fallbackBadgeHeight = bestBadgeHeight
                fallbackRoom = null
            } else {
                fallbackBadgeText = null
                fallbackBadgeHeight = 0f
                fallbackRoom = if (canRoom && validRoomCandidates.isNotEmpty() && blockHeightPx >= 22f * density) validRoomCandidates.lastOrNull()?.text else null
            }
        } else {
            // CLASE MAGISTRAL / GA: ¡Prioridad absoluta del aula!
            if (canRoom && validRoomCandidates.isNotEmpty() && blockHeightPx >= 22f * density) {
                fallbackRoom = validRoomCandidates.lastOrNull()?.text
                fallbackBadgeText = null
                fallbackBadgeHeight = 0f
            } else {
                fallbackRoom = null
                fallbackBadgeText = if (canBadge) bestBadgeText else null
                fallbackBadgeHeight = if (canBadge) bestBadgeHeight else 0f
            }
        }

        val baseFallbackFont = (if (isDayView) 11f else 9f) * density * fontScale
        return BlockLayoutResult(
            badgeText = fallbackBadgeText,
            badgeFontSizePx = bestBadgeFont,
            badgeHeightPx = fallbackBadgeHeight,
            subjectLines = fallbackLines,
            subjectFontSizePx = baseFallbackFont,
            subjectLineHeightPx = baseFallbackFont * 1.12f,
            roomText = fallbackRoom,
            roomFontSizePx = fallbackRoomFont,
            teacherText = null,
            teacherFontSizePx = 0f
        )
    }

    /**
     * Calcula la mejor combinación tipográfica para que los textos quepan sin desbordar el bloque
     */
    fun computeBlockLayout(
        lesson: TimetableLesson,
        blockWidthPx: Float,
        blockHeightPx: Float,
        density: Float,
        paint: Paint
    ): Pair<List<String>, Float> {
        val result = computeFullBlockLayout(lesson, blockWidthPx, blockHeightPx, density, paint, paint)
        return Pair(result.subjectLines, result.subjectFontSizePx)
    }
}
