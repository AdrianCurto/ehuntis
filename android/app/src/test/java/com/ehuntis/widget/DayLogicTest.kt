package com.ehuntis.widget

import com.ehuntis.widget.data.BreakStreakType
import com.ehuntis.widget.data.DayLogic
import com.ehuntis.widget.data.SelectedGroup
import com.ehuntis.widget.data.Subgroups
import com.ehuntis.widget.data.TimetableLesson
import com.ehuntis.widget.data.UserConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class DayLogicTest {

    @Test
    fun testAcademicYearBounds() {
        val dateAutumn = LocalDate.of(2025, 10, 15)
        val boundsAutumn = DayLogic.getAcademicYearBounds(dateAutumn)
        assertEquals(LocalDate.of(2025, 9, 1), boundsAutumn.first)
        assertEquals(LocalDate.of(2026, 6, 30), boundsAutumn.second)

        val dateSpring = LocalDate.of(2026, 3, 20)
        val boundsSpring = DayLogic.getAcademicYearBounds(dateSpring)
        assertEquals(LocalDate.of(2025, 9, 1), boundsSpring.first)
        assertEquals(LocalDate.of(2026, 6, 30), boundsSpring.second)
    }

    @Test
    fun testDateNumberConversion() {
        val date = LocalDate.of(2026, 3, 15)
        val num = DayLogic.toDateNumber(date)
        assertEquals(20260315, num)
        val parsed = DayLogic.parseDateNumber(num)
        assertEquals(date, parsed)
    }

    @Test
    fun testToMinutes() {
        assertEquals(510, DayLogic.toMinutes(830))
        assertEquals(870, DayLogic.toMinutes(1430))
        assertEquals(1200, DayLogic.toMinutes(2000))
    }

    @Test
    fun testGetResolvedTargetDate_DayWithClasses() {
        val today = LocalDate.of(2026, 3, 16) // Monday
        val todayNum = DayLogic.toDateNumber(today)

        val lessons = listOf(
            TimetableLesson(id = 1, date = todayNum, startTime = 900, endTime = 1300, subjects = listOf("Álgebra"))
        )

        // At 15:45 (finished at 13:00, 165 min > 60 min, but hour = 15 < 16) -> stays today
        val now1545 = LocalDateTime.of(2026, 3, 16, 15, 45)
        assertEquals(today, DayLogic.getResolvedTargetDate(now1545, lessons))

        // At 16:00 (finished at 13:00, hour >= 16 AND elapsed >= 60 min) -> jumps to tomorrow (Tuesday 17)
        val now1600 = LocalDateTime.of(2026, 3, 16, 16, 0)
        assertEquals(today.plusDays(1), DayLogic.getResolvedTargetDate(now1600, lessons))

        // Lesson ending at 15:30
        val lateLessons = listOf(
            TimetableLesson(id = 2, date = todayNum, startTime = 1100, endTime = 1530, subjects = listOf("Física"))
        )
        // At 16:00 (only 30 min elapsed < 60 min) -> stays today
        val now1600Late = LocalDateTime.of(2026, 3, 16, 16, 0)
        assertEquals(today, DayLogic.getResolvedTargetDate(now1600Late, lateLessons))

        // At 16:30 (60 min elapsed >= 60 min) -> jumps to tomorrow
        val now1630Late = LocalDateTime.of(2026, 3, 16, 16, 30)
        assertEquals(today.plusDays(1), DayLogic.getResolvedTargetDate(now1630Late, lateLessons))

        // Lesson ending at 20:30: at 20:45 (15 min < 60 min, hour = 20 < 21) -> stays today
        val nightLessons = listOf(
            TimetableLesson(id = 3, date = todayNum, startTime = 1800, endTime = 2030, subjects = listOf("Química"))
        )
        val now2045 = LocalDateTime.of(2026, 3, 16, 20, 45)
        assertEquals(today, DayLogic.getResolvedTargetDate(now2045, nightLessons))

        // At 21:00 (hour >= 21, cap hour) -> jumps to tomorrow
        val now2100 = LocalDateTime.of(2026, 3, 16, 21, 0)
        assertEquals(today.plusDays(1), DayLogic.getResolvedTargetDate(now2100, nightLessons))
    }

    @Test
    fun testGetResolvedTargetDate_DimmedLessonDoesNotDelayJump() {
        val today = LocalDate.of(2026, 3, 16)
        val todayNum = DayLogic.toDateNumber(today)

        val lessons = listOf(
            // Own class finishes at 12:00
            TimetableLesson(id = 1, date = todayNum, startTime = 900, endTime = 1200, isDimmed = false),
            // Other subgroup class finishes at 19:00 (dimmed)
            TimetableLesson(id = 2, date = todayNum, startTime = 1700, endTime = 1900, isDimmed = true)
        )

        // At 16:00: own class finished at 12:00 (4h ago >= 1h, hour >= 16). Dimmed class should NOT prevent jump!
        val now1600 = LocalDateTime.of(2026, 3, 16, 16, 0)
        assertEquals(today.plusDays(1), DayLogic.getResolvedTargetDate(now1600, lessons))
    }

    @Test
    fun testGetResolvedTargetDate_WeekendJump() {
        val saturday = LocalDate.of(2026, 3, 21)
        val sunday = LocalDate.of(2026, 3, 22)
        val monday = LocalDate.of(2026, 3, 23)
        val mondayNum = DayLogic.toDateNumber(monday)

        val lessons = listOf(
            TimetableLesson(id = 1, date = DayLogic.toDateNumber(LocalDate.of(2026, 3, 20)), startTime = 900, endTime = 1300),
            TimetableLesson(id = 2, date = mondayNum, startTime = 900, endTime = 1100)
        )

        // Weekend (gap = 2 < 5 days): Saturday and Sunday display Monday directly
        val nowSat = LocalDateTime.of(2026, 3, 21, 14, 0)
        assertEquals(monday, DayLogic.getResolvedTargetDate(nowSat, lessons))

        val nowSun = LocalDateTime.of(2026, 3, 22, 10, 0)
        assertEquals(monday, DayLogic.getResolvedTargetDate(nowSun, lessons))
    }

    @Test
    fun testGetResolvedTargetDate_Vacations() {
        // Vacation >= 5 days: last class Dec 19, return Jan 7 (18 days gap)
        val lessons = listOf(
            TimetableLesson(id = 1, date = 20251219, startTime = 900, endTime = 1300),
            TimetableLesson(id = 2, date = 20260107, startTime = 900, endTime = 1300)
        )

        // Dec 28 (during vacation): stays Dec 28 (shows break/countdown)
        val nowDec28 = LocalDateTime.of(2025, 12, 28, 12, 0)
        assertEquals(LocalDate.of(2025, 12, 28), DayLogic.getResolvedTargetDate(nowDec28, lessons))

        // Jan 6 (eve of return) at 15:59: stays Jan 6 (shows countdown)
        val nowEve1559 = LocalDateTime.of(2026, 1, 6, 15, 59)
        assertEquals(LocalDate.of(2026, 1, 6), DayLogic.getResolvedTargetDate(nowEve1559, lessons))

        // Jan 6 (eve of return) at 16:00: switches to Jan 7 (first class day)
        val nowEve1600 = LocalDateTime.of(2026, 1, 6, 16, 0)
        assertEquals(LocalDate.of(2026, 1, 7), DayLogic.getResolvedTargetDate(nowEve1600, lessons))
    }

    @Test
    fun testAnalyzeBreakStreak_EasterBreak() {
        val thursday = LocalDate.of(2026, 4, 2)
        val nextTuesday = LocalDate.of(2026, 4, 7) // Classes return Tuesday (5 days break)
        val evalDate = LocalDate.of(2026, 4, 3) // Friday during break

        val lessons = listOf(
            TimetableLesson(id = 1, date = DayLogic.toDateNumber(thursday), startTime = 900, endTime = 1100),
            TimetableLesson(id = 2, date = DayLogic.toDateNumber(nextTuesday), startTime = 900, endTime = 1100)
        )

        val streak = DayLogic.analyzeBreakStreak(evalDate, lessons)
        assertEquals(BreakStreakType.EXTENDED_BREAK, streak.type)
        assertEquals(4, streak.daysRemaining) // From April 3 to April 7 is 4 days
        assertNotNull(streak.returnDate)
        assertTrue(streak.message.contains("para volver a clase"))
    }

    @Test
    fun testSubgroupExtractionAndFiltering() {
        assertEquals("GL1", Subgroups.extractSubgroupKey("GL-1"))
        assertEquals("S2", Subgroups.extractSubgroupKey("S.2"))
        assertEquals(1, Subgroups.extractSubgroupNumber("GL1.1"))
        assertEquals(null, Subgroups.extractSubgroupKey("Magistral"))

        val config = UserConfig(
            id = "cfg_1",
            name = "Test",
            selectedGroups = listOf(SelectedGroup(ids = listOf(101))),
            disabledSubjectsByGroup = mapOf("101" to listOf("999")), // 999 disabled
            disabledSubgroupsBySubject = mapOf(
                "101" to mapOf("555" to listOf("GL2")) // GL2 disabled for subject 555
            ),
            showDimmedSubgroups = true
        )

        val lessons = listOf(
            // Normal class
            TimetableLesson(id = 1, classIds = listOf(101), subjectIds = listOf(555), type = "GL1"),
            // Disabled subject (999) -> should be excluded
            TimetableLesson(id = 2, classIds = listOf(101), subjectIds = listOf(999), type = "M"),
            // Disabled subgroup (GL2 for 555) -> should be dimmed because showDimmedSubgroups=true
            TimetableLesson(id = 3, classIds = listOf(101), subjectIds = listOf(555), type = "GL2")
        )

        val filtered = Subgroups.filterLessonsForConfig(lessons, config)
        assertEquals(2, filtered.size)
        assertFalse(filtered[0].isDimmed)
        assertTrue(filtered[1].isDimmed)

        // Si showDimmedSubgroups=false, la lección GL2 debe ser excluida totalmente
        val configNoDim = config.copy(showDimmedSubgroups = false)
        val filteredNoDim = Subgroups.filterLessonsForConfig(lessons, configNoDim)
        assertEquals(1, filteredNoDim.size)
        assertEquals(1L, filteredNoDim[0].id)

        // Test getLessonsForDate con includeDimmed
        val dateNum = 20260316
        val dayList = listOf(
            TimetableLesson(id = 1, date = dateNum, isDimmed = false),
            TimetableLesson(id = 2, date = dateNum, isDimmed = true)
        )
        val withoutDimmed = DayLogic.getLessonsForDate(dayList, dateNum, includeDimmed = false)
        assertEquals(1, withoutDimmed.size)
        assertEquals(1L, withoutDimmed[0].id)

        val withDimmed = DayLogic.getLessonsForDate(dayList, dateNum, includeDimmed = true)
        assertEquals(2, withDimmed.size)
    }

    @Test
    fun testComputeVisibleTimeRange_UserScenario11to17() {
        val lessons = listOf(
            TimetableLesson(id = 1, startTime = 1100, endTime = 1300),
            TimetableLesson(id = 2, startTime = 1500, endTime = 1700)
        )
        val range = DayLogic.computeVisibleTimeRange(lessons, isToday = false)
        assertEquals(11, range.firstHour)
        assertEquals(17, range.lastHour)
        assertEquals(11 * 60 - 10, range.startMinutes) // 10:50 (650) — 10 min antes
        assertEquals(17 * 60 + 15, range.endMinutes)   // 17:15 (1035) — 15 min después
        assertEquals(385, range.totalMinutes)           // 6h25min (1035 - 650)
    }

    @Test
    fun testComputeVisibleTimeRange_FullDay9to18DoesNotAddExtraHourBefore() {
        val lessons = listOf(
            TimetableLesson(id = 1, startTime = 900, endTime = 1800)
        )
        val range = DayLogic.computeVisibleTimeRange(lessons, isToday = false)
        // 9 to 18 is 9 hours >= 6, so firstHour stays 9 and does NOT go to 8
        assertEquals(9, range.firstHour)
        assertEquals(18, range.lastHour)
        assertEquals(9 * 60 - 10, range.startMinutes) // 08:50
        assertEquals(18 * 60 + 15, range.endMinutes)  // 18:15
        assertEquals(565, range.totalMinutes)
    }

    @Test
    fun testComputeVisibleTimeRange_MorningClassesWithMinSpan() {
        val lessons = listOf(
            TimetableLesson(id = 1, startTime = 830, endTime = 1130)
        )
        val range = DayLogic.computeVisibleTimeRange(lessons, isToday = false)
        // 8:30 starts at 510 -> hour 8. Ends at 11:30 (690) -> hour 12. Diff = 4 < 6.
        // Centering: needed = 2 -> addBefore=1, addAfter=1. Clamped to 8: firstHour=8, lastHour=14.
        assertEquals(8, range.firstHour)
        assertEquals(14, range.lastHour)
        assertEquals(8 * 60 - 10, range.startMinutes)  // 07:50 (470) — 10 min antes de las 8:00
        assertEquals(14 * 60 + 15, range.endMinutes)  // 14:15 (855) — 15 min después de las 14:00
        assertEquals(385, range.totalMinutes)
    }

    @Test
    fun testComputeVisibleTimeRange_CenteredWithMinSpan() {
        val lessons = listOf(
            TimetableLesson(id = 1, startTime = 1100, endTime = 1500)
        )
        // 11:00 to 15:00: span = 4 < 6. needed = 2 -> addBefore=1, addAfter=1 -> firstHour=10, lastHour=16.
        val range = DayLogic.computeVisibleTimeRange(lessons, isToday = true, nowMinutes = 10 * 60 + 15)
        assertEquals(10, range.firstHour)
        assertEquals(16, range.lastHour)
        assertEquals(10 * 60 - 10, range.startMinutes) // 09:50
        assertEquals(16 * 60 + 15, range.endMinutes)   // 16:15
        assertEquals(385, range.totalMinutes)
    }

    @Test
    fun testComputeVisibleTimeRange_EmptyLessons() {
        val range = DayLogic.computeVisibleTimeRange(emptyList())
        assertEquals(8, range.firstHour)
        assertEquals(21, range.lastHour)
        assertEquals(7 * 60 + 30, range.startMinutes)
        assertEquals(21 * 60 + 30, range.endMinutes)
        assertEquals(840, range.totalMinutes)
    }
}

