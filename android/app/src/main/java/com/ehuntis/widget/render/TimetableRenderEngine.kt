package com.ehuntis.widget.render

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import com.ehuntis.widget.data.BreakStreakResult
import com.ehuntis.widget.data.BreakStreakType
import com.ehuntis.widget.data.DayLogic
import com.ehuntis.widget.data.TimetableLesson
import java.time.LocalDate
import java.time.LocalDateTime

object TimetableRenderEngine {

    const val START_MINUTES = 7 * 60 + 30 // 07:30
    const val END_MINUTES = 21 * 60 + 30   // 21:30
    const val TOTAL_MINUTES = END_MINUTES - START_MINUTES // 840 mins

    /**
     * Desatura un color en un porcentaje dado (0.0 a 1.0), replicando el filter: grayscale(0.55) de CSS
     */
    fun desaturateColor(color: Int, amount: Float = 0.55f): Int {
        val hsv = FloatArray(3)
        Color.colorToHSV(color, hsv)
        hsv[1] = (hsv[1] * (1f - amount)).coerceIn(0f, 1f)
        return Color.HSVToColor(Color.alpha(color), hsv)
    }

    /**
     * Renderizado continuo del horario diario en un único Bitmap de alta fidelidad
     */
    fun renderTimetable(
        context: Context,
        widthPx: Int,
        heightPx: Int,
        targetDate: LocalDate,
        allLessons: List<TimetableLesson>,
        isDark: Boolean,
        nowTime: LocalDateTime = LocalDateTime.now(),
        customColors: Map<String, Int> = emptyMap()
    ): Bitmap {
        val safeW = maxOf(200, widthPx)
        val safeH = maxOf(150, heightPx)
        val bitmap = Bitmap.createBitmap(safeW, safeH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val density = context.resources.displayMetrics.density
        val isToday = (targetDate == nowTime.toLocalDate())
        val nowMinutes = nowTime.hour * 60 + nowTime.minute

        // 1. Paletas y colores del lienzo
        val bgColor = if (isDark) Color.parseColor("#0B0F17") else Color.parseColor("#FFFFFF")
        val accentColor = Color.parseColor("#4F6EF7")

        // Fondo redondeado del lienzo
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = bgColor
            style = Paint.Style.FILL
        }
        canvas.drawColor(Color.TRANSPARENT)
        val boundsRect = RectF(0f, 0f, safeW.toFloat(), safeH.toFloat())
        canvas.drawRoundRect(boundsRect, 14f * density, 14f * density, bgPaint)

        // 2. Lecciones del día seleccionado (incluyendo atenuadas si el filtro las preservó)
        val targetDateNum = DayLogic.toDateNumber(targetDate)
        val dayLessons = DayLogic.getLessonsForDate(allLessons, targetDateNum, includeDimmed = true)

        if (dayLessons.isEmpty()) {
            val breakInfo = DayLogic.analyzeBreakStreak(targetDate, allLessons)
            drawEmptyOrBreakState(canvas, safeW, safeH, density, isDark, breakInfo, targetDate)
            return bitmap
        }

        // 3. Eje temporal dinámico adaptado al horario del día
        val timeRange = DayLogic.computeVisibleTimeRange(dayLessons, isToday, nowMinutes)
        val timeAxisWidth = (if (safeW >= 320 * density) 38f else if (safeW >= 240 * density) 35f else 32f) * density
        val topPad = 2f * density
        val bottomPad = 4f * density
        val rightMargin = 3.5f * density
        val contentH = safeH - topPad - bottomPad

        fun getY(mins: Int): Float {
            val clamped = mins.coerceIn(timeRange.startMinutes, timeRange.endMinutes)
            return topPad + ((clamped - timeRange.startMinutes).toFloat() / timeRange.totalMinutes) * contentH
        }

        // 4. Dibujar líneas divisoria vertical, etiquetas de horas y cuadrícula (idéntico a web)
        val dividerColor = if (isDark) Color.parseColor("#1C2940") else Color.parseColor("#EEF2F6")
        val gridHourColor = if (isDark) Color.parseColor("#1C2940") else Color.parseColor("#EEF2F6")
        val gridHalfColor = if (isDark) Color.parseColor("#152033") else Color.parseColor("#F8FAFC")
        val textMajorColor = if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#6B7280")
        val textMinorColor = if (isDark) Color.parseColor("#64748B") else Color.parseColor("#9CA3AF")

        val dividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = dividerColor
            strokeWidth = 1f * density
            style = Paint.Style.STROKE
        }
        canvas.drawLine(timeAxisWidth, topPad, timeAxisWidth, safeH - bottomPad, dividerPaint)

        val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            strokeWidth = 1f * density
            style = Paint.Style.STROKE
        }
        val labelMajorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMajorColor
            textSize = 11f * density
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        val labelMinorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMinorColor
            textSize = 9.5f * density
            typeface = Typeface.create("sans-serif", Typeface.NORMAL)
            textAlign = Paint.Align.RIGHT
        }

        for (h in timeRange.firstHour..timeRange.lastHour) {
            val mins = h * 60
            val y = getY(mins)
            gridPaint.color = gridHourColor
            canvas.drawLine(timeAxisWidth, y, safeW - rightMargin, y, gridPaint)
            val textCenterY = y - (labelMajorPaint.descent() + labelMajorPaint.ascent()) / 2f
            canvas.drawText("$h:00", timeAxisWidth - 7f * density, textCenterY, labelMajorPaint)

            val halfMins = mins + 30
            if (halfMins < timeRange.endMinutes && h < timeRange.lastHour) {
                val halfY = getY(halfMins)
                gridPaint.color = gridHalfColor
                canvas.drawLine(timeAxisWidth, halfY, safeW - rightMargin, halfY, gridPaint)
                val halfTextCenterY = halfY - (labelMinorPaint.descent() + labelMinorPaint.ascent()) / 2f
                canvas.drawText("$h:30", timeAxisWidth - 7f * density, halfTextCenterY, labelMinorPaint)
            }
        }

        val widgetWidthDp = safeW / density

        val placements = LayoutEngine.arrangeColumns(dayLessons)
        Palette.updateAutoColors(allLessons)

        val blockPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        val subtextPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        val cardStartMargin = 3f * density
        val cardEndMargin = 3.5f * density
        val colGap = 2f * density
        val availableContentW = safeW - timeAxisWidth - cardStartMargin - cardEndMargin
        val cornerRadius = 9.5f * density

        // ── Supresión en cascada de badges magistrales (vista diaria) ────────
        // Si algún bloque magistral del día no tiene badge, suprimir todos.
        val magistralDayLessons = dayLessons.filter { LayoutEngine.isMagistralType(it.type) }
        val suppressMagistralBadgesDay = if (magistralDayLessons.isNotEmpty()) {
            magistralDayLessons.any { lesson ->
                val placement = placements[LayoutEngine.getLessonKey(lesson)] ?: ColumnPlacement(0, 1, 1)
                val totalCols = maxOf(1, placement.totalColumns)
                val colW = (availableContentW - (totalCols - 1) * colGap) / totalCols
                val left = timeAxisWidth + cardStartMargin + placement.colIdx * (colW + colGap)
                val right = left + (colW * placement.span) + ((placement.span - 1) * colGap)
                val startMins = DayLogic.toMinutes(lesson.startTime)
                val endMins = DayLogic.toMinutes(lesson.endTime)
                val top = getY(startMins) + 0.5f * density
                val bottom = maxOf(top + 20f * density, getY(endMins) - 1.5f * density)
                val blockW = right - left
                val blockH = bottom - top
                val layout = LayoutEngine.computeFullBlockLayout(lesson, blockW, blockH, density, textPaint, subtextPaint, widgetWidthDp, isDayView = true)
                layout.badgeText == null
            }
        } else false
        // ─────────────────────────────────────────────────────────────────────

        for (lesson in dayLessons) {
            val placement = placements[LayoutEngine.getLessonKey(lesson)] ?: ColumnPlacement(0, 1, 1)
            val totalCols = maxOf(1, placement.totalColumns)
            val colW = (availableContentW - (totalCols - 1) * colGap) / totalCols
            val left = timeAxisWidth + cardStartMargin + placement.colIdx * (colW + colGap)
            val right = left + (colW * placement.span) + ((placement.span - 1) * colGap)

            val startMins = DayLogic.toMinutes(lesson.startTime)
            val endMins = DayLogic.toMinutes(lesson.endTime)
            // Ajuste continuo con la rejilla (idéntico a web): el bloque arranca en la línea horaria y deja 2dp de separación con el siguiente
            val top = getY(startMins) + 0.5f * density
            val bottom = maxOf(top + 20f * density, getY(endMins) - 1.5f * density)

            val blockRect = RectF(left, top, right, bottom)
            drawLessonCard(
                canvas = canvas,
                lesson = lesson,
                blockRect = blockRect,
                isToday = isToday,
                nowMinutes = nowMinutes,
                startMins = startMins,
                endMins = endMins,
                density = density,
                isDark = isDark,
                accentColor = accentColor,
                cornerRadius = cornerRadius,
                blockPaint = blockPaint,
                borderPaint = borderPaint,
                textPaint = textPaint,
                subtextPaint = subtextPaint,
                widgetWidthDp = widgetWidthDp,
                isDayView = true,
                suppressMagistralBadge = suppressMagistralBadgesDay && LayoutEngine.isMagistralType(lesson.type),
                customColors = customColors
            )
        }

        return bitmap
    }

    /**
     * Renderizado continuo de la Semana Completa (Lunes a Viernes) en un único Bitmap
     */
    fun renderWeekTimetable(
        context: Context,
        widthPx: Int,
        heightPx: Int,
        weekStartDate: LocalDate,
        allLessons: List<TimetableLesson>,
        isDark: Boolean,
        nowTime: LocalDateTime = LocalDateTime.now(),
        customColors: Map<String, Int> = emptyMap()
    ): Bitmap {
        val safeW = maxOf(300, widthPx)
        val safeH = maxOf(150, heightPx)
        val bitmap = Bitmap.createBitmap(safeW, safeH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val density = context.resources.displayMetrics.density
        val todayDate = nowTime.toLocalDate()
        val nowMinutes = nowTime.hour * 60 + nowTime.minute

        val bgColor = if (isDark) Color.parseColor("#0B0F17") else Color.parseColor("#FFFFFF")
        val accentColor = Color.parseColor("#4F6EF7")
        val dividerColor = if (isDark) Color.parseColor("#1C2940") else Color.parseColor("#E2E8F0")
        val gridHourColor = if (isDark) Color.parseColor("#1C2940") else Color.parseColor("#EEF2F6")
        val textMajorColor = if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#334155")
        val textSecondaryColor = if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#64748B")

        // Fondo redondeado del lienzo
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = bgColor
            style = Paint.Style.FILL
        }
        canvas.drawColor(Color.TRANSPARENT)
        val boundsRect = RectF(0f, 0f, safeW.toFloat(), safeH.toFloat())
        canvas.drawRoundRect(boundsRect, 14f * density, 14f * density, bgPaint)

        // Días de lunes a viernes
        val weekDates = (0L..4L).map { weekStartDate.plusDays(it) }
        val weekDateNums = weekDates.map { DayLogic.toDateNumber(it) }

        val lessonsByDate = weekDateNums.associateWith { dateNum ->
            DayLogic.getLessonsForDate(allLessons, dateNum, includeDimmed = true)
        }
        val allWeekLessons = lessonsByDate.values.flatten()

        if (allWeekLessons.isEmpty()) {
            val breakInfo = DayLogic.analyzeBreakStreak(weekStartDate, allLessons)
            drawEmptyOrBreakState(canvas, safeW, safeH, density, isDark, breakInfo, weekStartDate)
            return bitmap
        }

        // Rango de horas común para toda la semana
        val isCurrentWeek = weekDates.contains(todayDate)
        val timeRange = DayLogic.computeVisibleTimeRange(
            dayLessons = allWeekLessons,
            isToday = isCurrentWeek,
            nowMinutes = nowMinutes,
            minHoursSpan = 6
        )

        val timeAxisWidth = (if (safeW >= 340 * density) 30f else 27f) * density
        val dayHeaderH = 22f * density
        val topPad = dayHeaderH + 2f * density
        val bottomPad = 4f * density
        val rightMargin = 3.5f * density
        val contentH = safeH - topPad - bottomPad

        fun getY(mins: Int): Float {
            val clamped = mins.coerceIn(timeRange.startMinutes, timeRange.endMinutes)
            return topPad + ((clamped - timeRange.startMinutes).toFloat() / timeRange.totalMinutes) * contentH
        }

        // Cabeceras de días (Lunes a Viernes)
        val totalDaysW = safeW - timeAxisWidth - rightMargin
        val colW = totalDaysW / 5f
        val dayNames = listOf("L", "M", "X", "J", "V")

        val dividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = dividerColor
            strokeWidth = 1f * density
            style = Paint.Style.STROKE
        }
        val colDividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isDark) Color.parseColor("#152033") else Color.parseColor("#F1F5F9")
            strokeWidth = 1f * density
            style = Paint.Style.STROKE
        }

        // Línea divisoria horizontal bajo las cabeceras
        canvas.drawLine(timeAxisWidth, dayHeaderH, safeW - rightMargin, dayHeaderH, dividerPaint)
        // Línea divisoria vertical tras el eje horario
        canvas.drawLine(timeAxisWidth, 0f, timeAxisWidth, safeH - bottomPad, dividerPaint)

        val headerTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            textSize = 10f * density
        }

        for (i in 0..4) {
            val date = weekDates[i]
            val colLeft = timeAxisWidth + i * colW
            val isToday = (date == todayDate)
            val headerCenterX = colLeft + colW / 2f
            val headerCenterY = dayHeaderH / 2f + 3.5f * density

            val dayText = "${dayNames[i]} ${date.dayOfMonth}"

            if (isToday) {
                // Cápsula redondeada para destacar el día actual
                val textW = headerTextPaint.measureText(dayText)
                val pillW = maxOf(textW + 12f * density, 24f * density)
                val pillH = 16f * density
                val pillRect = RectF(
                    headerCenterX - pillW / 2f,
                    headerCenterY - pillH / 2f - 3f * density,
                    headerCenterX + pillW / 2f,
                    headerCenterY + pillH / 2f - 3f * density
                )
                val pillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = accentColor
                    style = Paint.Style.FILL
                }
                canvas.drawRoundRect(pillRect, 8f * density, 8f * density, pillPaint)
                headerTextPaint.color = Color.WHITE
                headerTextPaint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
            } else {
                headerTextPaint.color = textSecondaryColor
                headerTextPaint.typeface = Typeface.create("sans-serif", Typeface.NORMAL)
            }

            canvas.drawText(dayText, headerCenterX, headerCenterY - 1f * density, headerTextPaint)

            // Divisores verticales de columnas entre días
            if (i > 0) {
                canvas.drawLine(colLeft, dayHeaderH, colLeft, safeH - bottomPad, colDividerPaint)
            }
        }

        // Cuadrícula y horas
        val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            strokeWidth = 1f * density
            style = Paint.Style.STROKE
        }
        val labelMajorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMajorColor
            textSize = 9.5f * density
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }

        for (h in timeRange.firstHour..timeRange.lastHour) {
            val mins = h * 60
            val y = getY(mins)
            gridPaint.color = gridHourColor
            canvas.drawLine(timeAxisWidth, y, safeW - rightMargin, y, gridPaint)
            val textCenterY = y - (labelMajorPaint.descent() + labelMajorPaint.ascent()) / 2f
            canvas.drawText("$h:00", timeAxisWidth - 4f * density, textCenterY, labelMajorPaint)
        }

        // Renderizado de tarjetas por día
        Palette.updateAutoColors(allLessons)

        val blockPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        val subtextPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        val colMargin = 1.5f * density
        val colGap = 1.5f * density
        val cornerRadius = 7f * density

        // ── Supresión en cascada de badges magistrales (ámbito: toda la semana) ──
        // Si cualquier bloque GA/Magistral de la semana no cabe, se suprimen todos los de la semana.
        var anyMagistralMissingInWeek = false
        for (i in 0..4) {
            val dateNum = weekDateNums[i]
            val dayLessons = lessonsByDate[dateNum] ?: emptyList()
            val dayColLeft = timeAxisWidth + i * colW
            val placements = LayoutEngine.arrangeColumns(dayLessons)

            for (lesson in dayLessons) {
                if (!LayoutEngine.isMagistralType(lesson.type)) continue
                val placement = placements[LayoutEngine.getLessonKey(lesson)] ?: ColumnPlacement(0, 1, 1)
                val totalCols = maxOf(1, placement.totalColumns)
                val subColW = (colW - colMargin * 2 - (totalCols - 1) * colGap) / totalCols
                val left = dayColLeft + colMargin + placement.colIdx * (subColW + colGap)
                val right = left + (subColW * placement.span) + ((placement.span - 1) * colGap)
                val startMins = DayLogic.toMinutes(lesson.startTime)
                val endMins = DayLogic.toMinutes(lesson.endTime)
                val top = getY(startMins) + 0.5f * density
                val bottom = maxOf(top + 16f * density, getY(endMins) - 1.5f * density)
                val layout = LayoutEngine.computeFullBlockLayout(lesson, right - left, bottom - top, density, textPaint, subtextPaint, safeW / density, isDayView = false)
                if (layout.badgeText == null) {
                    anyMagistralMissingInWeek = true
                    break
                }
            }
            if (anyMagistralMissingInWeek) break
        }
        val suppressMagistralBadgesWeek = anyMagistralMissingInWeek
        // ──────────────────────────────────────────────────────────────────────

        for (i in 0..4) {
            val date = weekDates[i]
            val dateNum = weekDateNums[i]
            val dayLessons = lessonsByDate[dateNum] ?: emptyList()
            val dayColLeft = timeAxisWidth + i * colW
            val isDayToday = (date == todayDate)

            val placements = LayoutEngine.arrangeColumns(dayLessons)

            for (lesson in dayLessons) {
                val placement = placements[LayoutEngine.getLessonKey(lesson)] ?: ColumnPlacement(0, 1, 1)
                val totalCols = maxOf(1, placement.totalColumns)
                val subColW = (colW - colMargin * 2 - (totalCols - 1) * colGap) / totalCols
                val left = dayColLeft + colMargin + placement.colIdx * (subColW + colGap)
                val right = left + (subColW * placement.span) + ((placement.span - 1) * colGap)

                val startMins = DayLogic.toMinutes(lesson.startTime)
                val endMins = DayLogic.toMinutes(lesson.endTime)
                val top = getY(startMins) + 0.5f * density
                val bottom = maxOf(top + 16f * density, getY(endMins) - 1.5f * density)

                val blockRect = RectF(left, top, right, bottom)
                drawLessonCard(
                    canvas = canvas,
                    lesson = lesson,
                    blockRect = blockRect,
                    isToday = isDayToday,
                    nowMinutes = nowMinutes,
                    startMins = startMins,
                    endMins = endMins,
                    density = density,
                    isDark = isDark,
                    accentColor = accentColor,
                    cornerRadius = cornerRadius,
                    blockPaint = blockPaint,
                    borderPaint = borderPaint,
                    textPaint = textPaint,
                    subtextPaint = subtextPaint,
                    widgetWidthDp = safeW / density,
                    isDayView = false,
                    suppressMagistralBadge = suppressMagistralBadgesWeek && LayoutEngine.isMagistralType(lesson.type),
                    customColors = customColors
                )
            }
        }

        return bitmap
    }

    /**
     * Dibuja una tarjeta de lección con soporte exhaustivo para estados atenuados (isDimmed)
     * y estética idéntica a la versión web.
     */
    private fun drawLessonCard(
        canvas: Canvas,
        lesson: TimetableLesson,
        blockRect: RectF,
        isToday: Boolean,
        nowMinutes: Int,
        startMins: Int,
        endMins: Int,
        density: Float,
        isDark: Boolean,
        accentColor: Int,
        cornerRadius: Float,
        blockPaint: Paint,
        borderPaint: Paint,
        textPaint: Paint,
        subtextPaint: Paint,
        widgetWidthDp: Float = 260f,
        isDayView: Boolean = true,
        suppressMagistralBadge: Boolean = false,
        customColors: Map<String, Int> = emptyMap()
    ) {
        val blockW = blockRect.width()
        val blockH = blockRect.height()
        val centerX = blockRect.centerX()
        val left = blockRect.left
        val top = blockRect.top
        val bottom = blockRect.bottom

        val isPast = isToday && nowMinutes >= endMins

        val rawBlockColor = Palette.getColorForSubject(
            subjectId = lesson.subjectIds.filterNotNull().firstOrNull() ?: 0,
            isDark = isDark,
            customColors = customColors
        )
        val blockColor = if (lesson.isDimmed) {
            BlockColor(
                bg = desaturateColor(rawBlockColor.bg, 0.55f),
                text = rawBlockColor.text,
                border = desaturateColor(rawBlockColor.border, 0.55f)
            )
        } else {
            rawBlockColor
        }

        // Opacidad del fondo de la tarjeta:
        // isDimmed en web usa opacity: 0.45 (115/255)
        // isPast en web usa opacity: 0.58 (148) en tema claro y 0.52 (133) en tema oscuro
        blockPaint.color = blockColor.bg
        blockPaint.alpha = when {
            lesson.isDimmed -> 115
            isPast -> if (isDark) 133 else 148
            else -> 255
        }

        // Esquinas redondeadas suaves y proporcionadas a la altura del bloque
        val dynamicCornerRadius = minOf(cornerRadius, maxOf(3.5f * density, blockH * 0.16f))
        canvas.drawRoundRect(blockRect, dynamicCornerRadius, dynamicCornerRadius, blockPaint)

        // Borde dentro del recuadro (inset border idéntico a box-sizing: border-box en web)
        val strokeWidth = if (lesson.isDimmed) 1.3f * density else 1f * density
        val strokeHalf = strokeWidth / 2f
        val insetRect = RectF(
            blockRect.left + strokeHalf,
            blockRect.top + strokeHalf,
            blockRect.right - strokeHalf,
            blockRect.bottom - strokeHalf
        )
        val insetRadius = maxOf(1f * density, dynamicCornerRadius - strokeHalf)

        if (lesson.isDimmed) {
            // Borde discontinuo (dashed) idéntico a web .lesson-block.is-dimmed: 1.5px dashed rgba(0,0,0,0.25)
            borderPaint.color = if (isDark) Color.argb(85, 255, 255, 255) else Color.argb(68, 0, 0, 0)
            borderPaint.strokeWidth = strokeWidth
            borderPaint.pathEffect = DashPathEffect(floatArrayOf(4.5f * density, 3f * density), 0f)
            canvas.drawRoundRect(insetRect, insetRadius, insetRadius, borderPaint)
            borderPaint.pathEffect = null
        } else {
            // En modo oscuro usamos el borde sutil con tono de la paleta; en modo claro borde sutil rgba(0,0,0,0.1)
            borderPaint.color = if (isDark) blockColor.border else Color.argb(26, 0, 0, 0)
            borderPaint.strokeWidth = strokeWidth
            borderPaint.pathEffect = null
            canvas.drawRoundRect(insetRect, insetRadius, insetRadius, borderPaint)
        }

        // Disposición de contenidos internos adaptada a vista diaria o semanal
        val rawLayoutResult = LayoutEngine.computeFullBlockLayout(
            lesson = lesson,
            blockWidthPx = blockW,
            blockHeightPx = blockH,
            density = density,
            textPaint = textPaint,
            subtextPaint = subtextPaint,
            widgetWidthDp = widgetWidthDp,
            isDayView = isDayView
        )
        // Aplicar supresión en cascada de badge magistral si corresponde
        val layoutResult = if (suppressMagistralBadge && rawLayoutResult.badgeText != null) {
            rawLayoutResult.copy(badgeText = null, badgeHeightPx = 0f)
        } else {
            rawLayoutResult
        }


        val contentAlpha = when {
            lesson.isDimmed -> 135 // Suficiente contraste y nitidez, matching web opacity
            isPast -> if (isDark) 133 else 148
            else -> 255
        }

        val padTopPx = if (isDayView) (if (blockH < 45f * density) 2f * density else 3.5f * density) else 2f * density
        val padBottomPx = if (isDayView) (if (blockH < 45f * density) 2f * density else 3.5f * density) else 2f * density

        // A) Badge superior centrado
        var badgeBottomY = top + padTopPx
        if (!layoutResult.badgeText.isNullOrBlank() && layoutResult.badgeHeightPx > 0f) {
            val bText = layoutResult.badgeText
            subtextPaint.textSize = layoutResult.badgeFontSizePx
            subtextPaint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
            subtextPaint.letterSpacing = 0.02f
            subtextPaint.textAlign = Paint.Align.CENTER

            val textW = subtextPaint.measureText(bText)
            val badgePadXPx = (if (isDayView) 3.5f else 2.5f) * density
            val badgeW = textW + (badgePadXPx * 2)
            val badgeH = layoutResult.badgeHeightPx
            val badgeTop = top + padTopPx
            val badgeRect = RectF(centerX - (badgeW / 2f), badgeTop, centerX + (badgeW / 2f), badgeTop + badgeH)

            val badgeBgColor = if (isDark) Color.parseColor("#38FFFFFF") else Color.parseColor("#26000000")
            val badgeBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = badgeBgColor
                alpha = (Color.alpha(badgeBgColor) * (contentAlpha / 255f)).toInt()
                style = Paint.Style.FILL
            }
            val badgeRadius = 3f * density
            canvas.drawRoundRect(badgeRect, badgeRadius, badgeRadius, badgeBgPaint)

            if (isDark) {
                val badgeBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.parseColor("#59FFFFFF")
                    alpha = (0x59 * (contentAlpha / 255f)).toInt()
                    style = Paint.Style.STROKE
                    this.strokeWidth = 0.8f * density
                }
                canvas.drawRoundRect(badgeRect, badgeRadius, badgeRadius, badgeBorderPaint)
            }

            subtextPaint.color = if (lesson.isDimmed) {
                if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#475569")
            } else {
                if (isDark) Color.WHITE else Color.parseColor("#0F172A")
            }
            subtextPaint.alpha = contentAlpha
            val badgeTextCenterY = badgeRect.centerY() - (subtextPaint.descent() + subtextPaint.ascent()) / 2f
            canvas.drawText(bText, centerX, badgeTextCenterY, subtextPaint)

            badgeBottomY = badgeTop + badgeH
        }

        // B) Aula y Profesor en la base centrados (anclados abajo hacia arriba)
        var currentBottomY = bottom - padBottomPx
        if (!layoutResult.teacherText.isNullOrBlank()) {
            subtextPaint.textSize = layoutResult.teacherFontSizePx
            subtextPaint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
            subtextPaint.letterSpacing = 0.01f
            subtextPaint.textAlign = Paint.Align.CENTER
            subtextPaint.color = if (lesson.isDimmed) {
                if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#475569")
            } else {
                if (isDark) blockColor.text else Color.parseColor("#0F172A")
            }
            subtextPaint.alpha = (contentAlpha * 0.85f).toInt()

            val teacherBaseline = currentBottomY - subtextPaint.descent()
            canvas.drawText(layoutResult.teacherText, centerX, teacherBaseline, subtextPaint)
            val teacherItemH = layoutResult.teacherFontSizePx * 1.12f + (if (blockH < 36f * density) 1f else 1.5f) * density
            currentBottomY -= teacherItemH
        }

        if (!layoutResult.roomText.isNullOrBlank()) {
            subtextPaint.textSize = layoutResult.roomFontSizePx
            subtextPaint.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            subtextPaint.letterSpacing = 0.01f
            subtextPaint.textAlign = Paint.Align.CENTER
            subtextPaint.color = if (lesson.isDimmed) {
                if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#475569")
            } else {
                if (isDark) blockColor.text else Color.parseColor("#0F172A")
            }
            subtextPaint.alpha = (contentAlpha * 0.75f).toInt()

            val roomBaseline = currentBottomY - subtextPaint.descent()
            canvas.drawText(layoutResult.roomText, centerX, roomBaseline, subtextPaint)
            val roomItemH = layoutResult.roomFontSizePx * (if (layoutResult.roomFontSizePx <= 8f * density) 1.05f else 1.1f) + (if (blockH < 36f * density) 0.5f else 1f) * density
            currentBottomY -= roomItemH
        }

        // C) Asignatura centrada horizontalmente y verticalmente entre el badge y el aula/profesor
        val subjectLines = layoutResult.subjectLines
        if (subjectLines.isNotEmpty()) {
            val hasBottom = !layoutResult.roomText.isNullOrBlank() || !layoutResult.teacherText.isNullOrBlank()
            val subjectTopLimit = if (layoutResult.badgeHeightPx > 0f) {
                badgeBottomY + (if (isDayView) 2f else 1f) * density
            } else {
                top + padTopPx
            }
            val subjectBottomLimit = if (hasBottom) {
                currentBottomY - (if (isDayView) 2.5f else 1.5f) * density
            } else {
                currentBottomY
            }

            val subjectAvailH = subjectBottomLimit - subjectTopLimit
            val totalSubjectH = subjectLines.size * layoutResult.subjectLineHeightPx

            if (subjectAvailH >= layoutResult.subjectFontSizePx * 0.75f) {
                textPaint.textSize = layoutResult.subjectFontSizePx
                textPaint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
                textPaint.letterSpacing = if (subjectLines.size == 1) 0.02f else 0.012f
                textPaint.textAlign = Paint.Align.CENTER
                textPaint.color = blockColor.text
                textPaint.alpha = contentAlpha

                // Centrado vertical exacto en el espacio disponible (como flex: 1, justify-content: center en web)
                val startSubjectY = if (subjectAvailH >= totalSubjectH) {
                    subjectTopLimit + (subjectAvailH - totalSubjectH) / 2f
                } else {
                    subjectTopLimit
                }

                var currentLineTop = startSubjectY
                val maxBottomLimit = subjectBottomLimit + 0.5f * density
                for (line in subjectLines) {
                    val lineBaseline = currentLineTop + layoutResult.subjectFontSizePx * 0.85f
                    if (lineBaseline <= maxBottomLimit) {
                        canvas.drawText(line, centerX, lineBaseline, textPaint)
                        currentLineTop += layoutResult.subjectLineHeightPx
                    }
                }
            }
        }
    }

    /**
     * Dibuja pantalla estética para vacaciones, puentes o días sin clase
     */
    private fun drawEmptyOrBreakState(
        canvas: Canvas,
        w: Int,
        h: Int,
        density: Float,
        isDark: Boolean,
        breakInfo: BreakStreakResult,
        targetDate: LocalDate
    ) {
        val textColor = if (isDark) Color.parseColor("#F8FAFC") else Color.parseColor("#0F172A")
        val subColor = if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#64748B")
        val accentColor = Color.parseColor("#4F6EF7")

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textColor
            textSize = 14f * density
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = subColor
            textSize = 11f * density
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            textAlign = Paint.Align.CENTER
        }
        val numberPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accentColor
            textSize = 34f * density
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }

        val centerX = w / 2f
        val centerY = h / 2f

        when (breakInfo.type) {
            BreakStreakType.EXTENDED_BREAK -> {
                canvas.drawText("${breakInfo.daysRemaining}", centerX, centerY - 10f * density, numberPaint)
                val daysLabel = if (breakInfo.daysRemaining == 1) "día para volver a clase" else "días para volver a clase"
                canvas.drawText(daysLabel, centerX, centerY + 8f * density, titlePaint)
                if (breakInfo.returnDate != null) {
                    val returnDay = DayLogic.getDayOfWeekName(breakInfo.returnDate).replaceFirstChar { it.uppercase() }
                    val returnDateStr = DayLogic.formatDateShort(breakInfo.returnDate)
                    canvas.drawText("Vuelves el $returnDay $returnDateStr", centerX, centerY + 26f * density, subPaint)
                }
            }
            BreakStreakType.END_OF_YEAR -> {
                canvas.drawText("Fin de curso", centerX, centerY - 4f * density, titlePaint)
                canvas.drawText("No hay más clases programadas", centerX, centerY + 14f * density, subPaint)
            }
            BreakStreakType.NO_CLASS_TODAY -> {
                val dayName = DayLogic.getDayOfWeekName(targetDate).replaceFirstChar { it.uppercase() }
                val dateStr = DayLogic.formatDateShort(targetDate)
                canvas.drawText("Sin clases hoy", centerX, centerY - 4f * density, titlePaint)
                canvas.drawText("$dayName, $dateStr", centerX, centerY + 14f * density, subPaint)
            }
        }
    }
}
