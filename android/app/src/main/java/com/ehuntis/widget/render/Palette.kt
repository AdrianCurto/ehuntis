package com.ehuntis.widget.render

import android.graphics.Color
import com.ehuntis.widget.data.ApiPalette
import com.ehuntis.widget.data.PaletteColor
import com.ehuntis.widget.data.TimetableLesson

data class BlockColor(
    val bg: Int,
    val text: Int,
    val border: Int
)

/**
 * Converts a CSS hex color string (#RRGGBB or #AARRGGBB) to an Android Color Int.
 * Returns the fallback if parsing fails.
 */
private fun String.toAndroidColor(fallback: Int = Color.LTGRAY): Int {
    return try {
        Color.parseColor(this.trim())
    } catch (_: Exception) {
        fallback
    }
}

/**
 * Converts a PaletteColor (from the API) to a BlockColor (Android ints).
 * The border field can be rgba(r,g,b,a) which Android can't parse directly — we approximate
 * with a semi-transparent black/white.
 */
private fun PaletteColor.toBlockColor(darkMode: Boolean): BlockColor {
    val bgInt = bg.toAndroidColor(if (darkMode) Color.DKGRAY else Color.LTGRAY)
    val textInt = text.toAndroidColor(if (darkMode) Color.WHITE else Color.BLACK)
    // Border is rgba(r,g,b,a) — approximate with 20% opacity black overlay
    val borderInt = if (darkMode) Color.argb(90, 255, 255, 255) else Color.argb(40, 0, 0, 0)
    return BlockColor(bg = bgInt, text = textInt, border = borderInt)
}

object Palette {

    // Fallback hardcoded palette (14 colors, kept in sync with colorLogic.js)
    // Only used when the API does not return a palette field.
    val PALETTE_LIGHT = listOf(
        BlockColor(0xFFBAE1FF.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 0 Azul cielo
        BlockColor(0xFFFFDFBA.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 1 Albaricoque
        BlockColor(0xFFBAFFC9.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 2 Verde menta
        BlockColor(0xFFFFB3BA.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 3 Coral
        BlockColor(0xFFD9BAFF.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 4 Lavanda
        BlockColor(0xFFFFF6BA.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 5 Amarillo
        BlockColor(0xFFBAFFFF.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 6 Cian
        BlockColor(0xFFFFC8DD.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 7 Rosa pastel
        BlockColor(0xFFF4B69C.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 8 Terracota
        BlockColor(0xFFDCB5DE.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 9 Malva
        BlockColor(0xFFA2D5C6.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 10 Jade
        BlockColor(0xFFCCE3A3.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 11 Pistacho
        BlockColor(0xFFF5D580.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 12 Miel
        BlockColor(0xFFBDC7EC.toInt(), 0xFF0F172A.toInt(), 0x28000000), // 13 Pervinca
    )

    val PALETTE_DARK = listOf(
        BlockColor(0xFF163B60.toInt(), 0xFFBAE6FD.toInt(), 0x5938BDF8.toInt()), // 0
        BlockColor(0xFF4A2A14.toInt(), 0xFFFED7AA.toInt(), 0x59FB923C.toInt()), // 1
        BlockColor(0xFF133E2B.toInt(), 0xFFBBF7D0.toInt(), 0x594ADE80.toInt()), // 2
        BlockColor(0xFF4C1D24.toInt(), 0xFFFECDD3.toInt(), 0x59FB7185.toInt()), // 3
        BlockColor(0xFF351F54.toInt(), 0xFFE9D5FF.toInt(), 0x59C084FC.toInt()), // 4
        BlockColor(0xFF42360E.toInt(), 0xFFFEF08A.toInt(), 0x59FACC15.toInt()), // 5
        BlockColor(0xFF0F3942.toInt(), 0xFFA5F3FC.toInt(), 0x5922D3EE.toInt()), // 6
        BlockColor(0xFF4A1D36.toInt(), 0xFFFBCFE8.toInt(), 0x59F472B6.toInt()), // 7
        BlockColor(0xFF542517.toInt(), 0xFFFED7AA.toInt(), 0x59FB923C.toInt()), // 8
        BlockColor(0xFF441B42.toInt(), 0xFFF5D0FE.toInt(), 0x59F0ABFC.toInt()), // 9
        BlockColor(0xFF143F37.toInt(), 0xFF99F6E4.toInt(), 0x595EEAD4.toInt()), // 10
        BlockColor(0xFF2E3A14.toInt(), 0xFFECFCCB.toInt(), 0x59BEF264.toInt()), // 11
        BlockColor(0xFF463311.toInt(), 0xFFFEF08A.toInt(), 0x59FACC15.toInt()), // 12
        BlockColor(0xFF1E2548.toInt(), 0xFFC7D2FE.toInt(), 0x59A5B4FC.toInt()), // 13
    )

    private val FALLBACK_LIGHT get() = PALETTE_LIGHT
    private val FALLBACK_DARK get() = PALETTE_DARK

    // Resolved palette from the last API response (null = use fallback)
    private var apiPalette: ApiPalette? = null

    // Automatic color assignment map: subjectId -> colorIndex
    private val autoColorMap = mutableMapOf<Int, Int>()

    /** Call this after every successful API sync to keep the palette up to date. */
    fun updateFromApi(palette: ApiPalette?) {
        apiPalette = palette
    }

    private fun resolvedPalette(isDark: Boolean): List<BlockColor> {
        val api = apiPalette
        val entries = if (isDark) api?.dark else api?.light
        return if (!entries.isNullOrEmpty()) {
            entries.map { it.toBlockColor(isDark) }
        } else {
            if (isDark) FALLBACK_DARK else FALLBACK_LIGHT
        }
    }

    private fun classifyPeriod(dates: Set<Int>): String {
        var q1Count = 0
        var q2Count = 0
        for (d in dates) {
            val m = (d % 10000) / 100
            if (m in 9..12) q1Count++
            else if (m in 2..6) q2Count++
        }
        if (q1Count >= 3 && q2Count >= 3) return "annual"
        if (q1Count > 0) return "q1"
        if (q2Count > 0) return "q2"
        return "q1"
    }

    /** Compatibility alias for updateAutoColors */
    fun updateSubjectColors(lessons: List<TimetableLesson>) = updateAutoColors(lessons)

    /**
     * Recomputes automatic color assignments from the timetable.
     * Should be called after timetable updates, before rendering.
     */
    fun updateAutoColors(lessons: List<TimetableLesson>) {
        val subjectDates = mutableMapOf<Int, MutableSet<Int>>()
        for (l in lessons) {
            val id = l.subjectIds.firstOrNull() ?: continue
            if (l.date > 0) subjectDates.getOrPut(id) { mutableSetOf() }.add(l.date)
        }

        val annualSubjects = mutableListOf<Int>()
        val q1Subjects = mutableListOf<Int>()
        val q2Subjects = mutableListOf<Int>()

        val uniqueIds = subjectDates.keys.sorted()
        for (id in uniqueIds) {
            when (classifyPeriod(subjectDates[id] ?: emptySet())) {
                "annual" -> annualSubjects.add(id)
                "q1"     -> q1Subjects.add(id)
                "q2"     -> q2Subjects.add(id)
            }
        }

        autoColorMap.clear()
        val paletteSize = FALLBACK_LIGHT.size  // always 14

        annualSubjects.forEachIndexed { i, id -> autoColorMap[id] = i % paletteSize }

        val numAnnual = annualSubjects.size
        val cuatPoolSize = maxOf(1, paletteSize - numAnnual)

        q1Subjects.forEachIndexed { i, id ->
            autoColorMap[id] = if (numAnnual < paletteSize) numAnnual + (i % cuatPoolSize) else i % paletteSize
        }
        q2Subjects.forEachIndexed { i, id ->
            autoColorMap[id] = if (numAnnual < paletteSize) numAnnual + (i % cuatPoolSize) else i % paletteSize
        }
    }

    /**
     * Returns the BlockColor for a given subject, respecting:
     * 1. User custom color from customColors map (overrides automatic)
     * 2. Automatically computed color from updateAutoColors()
     * 3. Fallback: hash of subjectId
     *
     * @param subjectId     The numeric subject ID
     * @param isDark        Whether the widget is in dark mode
     * @param customColors  The customColors map from the active UserConfig (subjectId string -> colorIndex)
     */
    fun getColorForSubject(
        subjectId: Int,
        isDark: Boolean,
        customColors: Map<String, Int> = emptyMap()
    ): BlockColor {
        val palette = resolvedPalette(isDark)
        val paletteSize = palette.size

        // Priority 1: user custom color
        val customIdx = customColors[subjectId.toString()]
        if (customIdx != null) {
            return palette[customIdx.coerceIn(0, paletteSize - 1)]
        }

        // Priority 2: automatic assignment
        val autoIdx = autoColorMap[subjectId]
        if (autoIdx != null) {
            return palette[autoIdx % paletteSize]
        }

        // Priority 3: deterministic fallback
        return palette[Math.abs(subjectId) % paletteSize]
    }
}
