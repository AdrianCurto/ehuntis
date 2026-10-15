package com.ehuntis.widget

import com.ehuntis.widget.data.AlarmScheduler
import com.ehuntis.widget.data.DayLogic
import com.ehuntis.widget.data.TimetableLesson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class AlarmSchedulerTest {

    @Test
    fun testComputeNextEventTime_UpcomingClassToday() {
        val today = LocalDate.of(2026, 9, 21) // Monday
        val lessons = listOf(
            TimetableLesson(id = 1, date = 20260921, startTime = 900, endTime = 1100),
            TimetableLesson(id = 2, date = 20260921, startTime = 1200, endTime = 1400)
        )

        // At 10:30, class 1 ends at 11:00
        val now = today.atTime(10, 30, 0)
        val next = AlarmScheduler.computeNextEventTime(now, lessons)

        assertNotNull(next)
        assertEquals(today.atTime(11, 0, 2), next)
    }

    @Test
    fun testComputeNextEventTime_BetweenClassesToday() {
        val today = LocalDate.of(2026, 9, 21)
        val lessons = listOf(
            TimetableLesson(id = 1, date = 20260921, startTime = 900, endTime = 1100),
            TimetableLesson(id = 2, date = 20260921, startTime = 1200, endTime = 1400)
        )

        // At 11:05, class 1 ended, next class ends at 14:00
        val now = today.atTime(11, 5, 0)
        val next = AlarmScheduler.computeNextEventTime(now, lessons)

        assertNotNull(next)
        assertEquals(today.atTime(14, 0, 2), next)
    }

    @Test
    fun testComputeNextEventTime_AfterAllClassesJumpToTomorrow() {
        val today = LocalDate.of(2026, 9, 21)
        val lessons = listOf(
            TimetableLesson(id = 1, date = 20260921, startTime = 900, endTime = 1100),
            TimetableLesson(id = 2, date = 20260921, startTime = 1200, endTime = 1400)
        )

        // At 14:30, all classes finished. Last ended at 14:00.
        // Jump minute = minOf(21*60, maxOf(16*60, 14*60 + 60)) = 16:00
        val now = today.atTime(14, 30, 0)
        val next = AlarmScheduler.computeNextEventTime(now, lessons)

        assertNotNull(next)
        assertEquals(today.atTime(16, 0, 2), next)
    }

    @Test
    fun testComputeNextEventTime_LateNightJumpAtMidnight() {
        val today = LocalDate.of(2026, 9, 21)
        val lessons = listOf(
            TimetableLesson(id = 1, date = 20260921, startTime = 900, endTime = 1100)
        )

        // At 22:00, jump has already happened. Next alarm is midnight
        val now = today.atTime(22, 0, 0)
        val next = AlarmScheduler.computeNextEventTime(now, lessons)

        assertNotNull(next)
        assertEquals(today.plusDays(1).atTime(0, 0, 2), next)
    }
}
