package com.ehuntis.widget

import com.ehuntis.widget.data.TimetableLesson
import com.ehuntis.widget.render.LayoutEngine
import com.ehuntis.widget.render.Palette
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LayoutEngineTest {

    @Test
    fun testArrangeColumns_OverlappingLessons() {
        val l1 = TimetableLesson(id = 101, date = 20260316, startTime = 900, endTime = 1100)
        val l2 = TimetableLesson(id = 102, date = 20260316, startTime = 1000, endTime = 1200)

        val placements = LayoutEngine.arrangeColumns(listOf(l1, l2))
        assertEquals(2, placements.size)

        val p1 = placements[LayoutEngine.getLessonKey(l1)]
        val p2 = placements[LayoutEngine.getLessonKey(l2)]

        assertNotNull(p1)
        assertNotNull(p2)
        assertEquals(2, p1!!.totalColumns)
        assertEquals(2, p2!!.totalColumns)
        assertEquals(0, p1.colIdx)
        assertEquals(1, p2.colIdx)
    }

    @Test
    fun testArrangeColumns_SequentialLessons() {
        val l1 = TimetableLesson(id = 101, date = 20260316, startTime = 900, endTime = 1100)
        val l2 = TimetableLesson(id = 102, date = 20260316, startTime = 1100, endTime = 1300)

        val placements = LayoutEngine.arrangeColumns(listOf(l1, l2))
        assertEquals(2, placements.size)

        val p1 = placements[LayoutEngine.getLessonKey(l1)]
        val p2 = placements[LayoutEngine.getLessonKey(l2)]

        assertEquals(1, p1!!.totalColumns)
        assertEquals(1, p2!!.totalColumns)
        assertEquals(0, p1.colIdx)
        assertEquals(0, p2.colIdx)
    }

    @Test
    fun testSubjectTiers() {
        val fullName = "Elasticidad y Resistencia de Materiales"
        val tiers = LayoutEngine.buildSubjectTiers(fullName, null)
        assertTrue(tiers.isNotEmpty())

        val tierNames = tiers.map { it.name }
        assertTrue(tierNames.contains("full"))
        assertTrue(tierNames.contains("siglas-inline"))

        val siglasTier = tiers.find { it.name == "siglas-inline" }
        assertEquals("ERM", siglasTier?.words?.first())
    }

    @Test
    fun testPaletteDistinctness() {
        assertEquals(14, Palette.PALETTE_LIGHT.size)
        assertEquals(14, Palette.PALETTE_DARK.size)

        val lessons = listOf(
            TimetableLesson(id = 1, subjectIds = listOf(10), date = 20251010),
            TimetableLesson(id = 2, subjectIds = listOf(20), date = 20260310)
        )
        Palette.updateSubjectColors(lessons)

        val colorLight = Palette.getColorForSubject(10, isDark = false)
        val colorDark = Palette.getColorForSubject(10, isDark = true)
        assertNotNull(colorLight)
        assertNotNull(colorDark)

        // Test custom color override
        val customColor = Palette.getColorForSubject(10, isDark = false, customColors = mapOf("10" to 8))
        assertEquals(Palette.PALETTE_LIGHT[8].bg, customColor.bg)
    }

    @Test
    fun testTeacherCandidates() {
        val candidates = LayoutEngine.getTeacherCandidates("Charles Richard Pinto")
        assertTrue(candidates.contains("Charles Richard Pinto"))
        assertTrue(candidates.contains("C. R. Pinto"))
        assertTrue(candidates.contains("C. Pinto"))
        assertTrue(candidates.contains("Pinto"))

        val singleName = LayoutEngine.getTeacherCandidates("Palmero")
        assertEquals(listOf("Palmero"), singleName)
    }

    @Test
    fun testBadgeCandidates() {
        // Clases magistrales / teoría genérica generan insignias adaptadas (con menor prioridad que el aula)
        assertTrue(LayoutEngine.isMagistralType("Magistral"))
        assertTrue(LayoutEngine.isMagistralType("GA"))
        assertTrue(LayoutEngine.isMagistralType("M"))
        assertTrue(LayoutEngine.isMagistralType("Teoría"))

        val magis = LayoutEngine.getBadgeCandidates("Magistral")
        assertTrue(magis.contains("Magistral"))
        assertTrue(magis.contains("M"))

        val ga = LayoutEngine.getBadgeCandidates("GA")
        assertTrue(ga.contains("GA"))

        // Subgrupos y tipos específicos NO son magistrales y generan insignias prioritarias
        assertTrue(!LayoutEngine.isMagistralType("GL-1"))
        assertTrue(!LayoutEngine.isMagistralType("P. Lab 1"))
        assertTrue(!LayoutEngine.isMagistralType("Seminario"))

        val gl1 = LayoutEngine.getBadgeCandidates("GL-1")
        assertEquals("GL-1", gl1.first()) // Preservar guión como primera opción
        assertTrue(gl1.contains("GL1"))
        assertTrue(gl1.contains("1"))

        val plab = LayoutEngine.getBadgeCandidates("P. Lab 1")
        assertTrue(plab.contains("P. Lab 1"))
        assertTrue(plab.contains("1"))

        val sem = LayoutEngine.getBadgeCandidates("Seminario")
        assertTrue(sem.contains("Seminario"))
        assertTrue(sem.contains("Sem."))
    }

    @Test
    fun testUserConfigSerializationRoundtrip() {
        val config = com.ehuntis.widget.data.UserConfig(
            id = "cfg_roundtrip",
            name = "Mecánica 3º",
            selectedGroups = listOf(
                com.ehuntis.widget.data.SelectedGroup(ids = listOf(10872), name = "GITECX301", uniqueId = "GITECX301::Mecanica")
            ),
            disabledGroupIds = listOf("GITECX301::Mecanica"),
            disabledSubjectsByGroup = mapOf("GITECX301::Mecanica" to listOf("1042", "1045")),
            disabledSubgroupsBySubject = mapOf("GITECX301::Mecanica" to mapOf("1042" to listOf("GL2"))),
            showDimmedSubgroups = true,
            last_modified = 123456789L
        )

        val jsonStr = com.ehuntis.widget.data.ApiClient.json.encodeToString(
            com.ehuntis.widget.data.UserConfigSerializer,
            config
        )

        val deserialized = com.ehuntis.widget.data.ApiClient.json.decodeFromString(
            com.ehuntis.widget.data.UserConfigSerializer,
            jsonStr
        )

        assertEquals("cfg_roundtrip", deserialized.id)
        assertEquals("Mecánica 3º", deserialized.name)
        assertEquals(listOf("GITECX301::Mecanica"), deserialized.disabledGroupIds)
        assertEquals(listOf("1042", "1045"), deserialized.disabledSubjectsByGroup["GITECX301::Mecanica"])
        assertEquals(listOf("GL2"), deserialized.disabledSubgroupsBySubject["GITECX301::Mecanica"]?.get("1042"))
        assertTrue(deserialized.showDimmedSubgroups)
    }

    @Test
    fun testMagistralTypeDetectionAndPriority() {
        assertTrue(LayoutEngine.isMagistralType("Magistral"))
        assertTrue(LayoutEngine.isMagistralType("GA"))
        assertTrue(LayoutEngine.isMagistralType("Teoría"))
        assertTrue(!LayoutEngine.isMagistralType("GL-1"))
        assertTrue(!LayoutEngine.isMagistralType("S-2"))

        // Candidate verification
        val magisBadges = LayoutEngine.getBadgeCandidates("Magistral")
        assertEquals("Magistral", magisBadges.first())

        val gaBadges = LayoutEngine.getBadgeCandidates("GA")
        assertEquals("GA", gaBadges.first())

        val glBadges = LayoutEngine.getBadgeCandidates("GL-1")
        assertEquals("GL-1", glBadges.first())
        assertTrue(glBadges.contains("GL1"))

        val rooms = LayoutEngine.getRoomCandidates("S1A8A")
        assertTrue(rooms.contains("S1A8A"))
        assertTrue(rooms.contains("S1A8"))
    }
}
