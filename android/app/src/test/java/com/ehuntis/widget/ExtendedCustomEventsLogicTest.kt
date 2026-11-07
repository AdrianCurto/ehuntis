package com.ehuntis.widget

import com.ehuntis.widget.data.CustomEventDto
import com.ehuntis.widget.data.CustomEventRecurrenceDto
import com.ehuntis.widget.data.CustomEventsLogic
import com.ehuntis.widget.data.DayLogic
import com.ehuntis.widget.data.LessonOverrideDto
import com.ehuntis.widget.data.SwappedWithDto
import com.ehuntis.widget.data.TimetableLesson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class ExtendedCustomEventsLogicTest {

    @Test
    fun testWeeklyMultiDayWithDateBounds() {
        val event = CustomEventDto(
            id = "evt_bounds",
            title = "Laboratorio Especial",
            location = "Lab 4.1",
            startTime = 1500,
            endTime = 1700,
            recurrence = CustomEventRecurrenceDto(
                type = "weekly",
                startDate = 20261110, // Tuesday Nov 10
                endDate = 20261120,   // Friday Nov 20
                daysOfWeek = listOf(2, 4), // Tuesday (2), Thursday (4) in java.time.DayOfWeek
                exceptions = listOf(20261117) // Tuesday 17th is exception
            )
        )

        val targetDates = listOf(
            LocalDate.of(2026, 11, 3),  // Tue Nov 3 (before startDate) -> excluded
            LocalDate.of(2026, 11, 5),  // Thu Nov 5 (before startDate) -> excluded
            LocalDate.of(2026, 11, 10), // Tue Nov 10 (startDate) -> INCLUDED
            LocalDate.of(2026, 11, 12), // Thu Nov 12 -> INCLUDED
            LocalDate.of(2026, 11, 17), // Tue Nov 17 (exception) -> EXCLUDED
            LocalDate.of(2026, 11, 19), // Thu Nov 19 -> INCLUDED
            LocalDate.of(2026, 11, 24)  // Tue Nov 24 (after endDate) -> excluded
        )

        val expanded = CustomEventsLogic.expandCustomEventsForDates(listOf(event), targetDates)
        assertEquals(3, expanded.size)
        assertEquals(listOf(20261110, 20261112, 20261119), expanded.map { it.date })
    }

    @Test
    fun testWeekendCustomEvents() {
        // Saturday (6) and Sunday (7) in java.time.DayOfWeek
        val event = CustomEventDto(
            id = "evt_weekend",
            title = "Torneo Universitario",
            location = "Polideportivo",
            category = "Deporte",
            colorIndex = 1,
            startTime = 900,
            endTime = 1400,
            recurrence = CustomEventRecurrenceDto(
                type = "weekly",
                daysOfWeek = listOf(6, 7),
                startDate = 20261101,
                endDate = 20261130
            )
        )

        val saturday = LocalDate.of(2026, 11, 14)
        val sunday = LocalDate.of(2026, 11, 15)
        val monday = LocalDate.of(2026, 11, 16)

        val expanded = CustomEventsLogic.expandCustomEventsForDates(listOf(event), listOf(saturday, sunday, monday))
        assertEquals(2, expanded.size)
        assertEquals(20261114, expanded[0].date)
        assertEquals(20261115, expanded[1].date)
        assertEquals(1, expanded[0].colorIndex)
    }

    @Test
    fun testYearBoundaryRollover() {
        // Event recurring weekly on Wednesdays across New Year: Dec 30, 2026 to Jan 6, 2027
        val event = CustomEventDto(
            id = "evt_nye",
            title = "Reunión Fin de Año",
            recurrence = CustomEventRecurrenceDto(
                type = "weekly",
                daysOfWeek = listOf(3), // Wednesday
                startDate = 20261220,
                endDate = 20270115
            )
        )

        val wedDec30 = LocalDate.of(2026, 12, 30) // 20261230
        val wedJan6  = LocalDate.of(2027, 1, 6)   // 20270106

        val expanded = CustomEventsLogic.expandCustomEventsForDates(listOf(event), listOf(wedDec30, wedJan6))
        assertEquals(2, expanded.size)
        assertEquals(20261230, expanded[0].date)
        assertEquals(20270106, expanded[1].date)
    }

    @Test
    fun testApplyLessonOverrides_SwappedWithBidirectional() {
        val lessonA = TimetableLesson(
            id = 101L,
            date = 20261109,
            startTime = 830,
            endTime = 1030,
            subjects = listOf("Física"),
            rooms = listOf("Aula 1")
        )
        val lessonB = TimetableLesson(
            id = 102L,
            date = 20261109,
            startTime = 1100,
            endTime = 1300,
            subjects = listOf("Química"),
            rooms = listOf("Aula 2")
        )

        val overrides = mapOf(
            "20261109_101" to LessonOverrideDto(
                lessonKey = "20261109_101",
                lessonId = 101L,
                customStartTime = 1100,
                customEndTime = 1300,
                customRooms = listOf("Aula 2"),
                swappedWith = SwappedWithDto(lessonKey = "20261109_102", subjectName = "Química")
            ),
            "20261109_102" to LessonOverrideDto(
                lessonKey = "20261109_102",
                lessonId = 102L,
                customStartTime = 830,
                customEndTime = 1030,
                customRooms = listOf("Aula 1"),
                swappedWith = SwappedWithDto(lessonKey = "20261109_101", subjectName = "Física")
            )
        )

        val results = CustomEventsLogic.applyLessonOverrides(listOf(lessonA, lessonB), overrides)
        assertEquals(2, results.size)

        val resA = results.find { it.id == 101L }!!
        val resB = results.find { it.id == 102L }!!

        assertEquals(1100, resA.startTime)
        assertEquals(1300, resA.endTime)
        assertEquals(listOf("Aula 2"), resA.rooms)
        assertEquals("Química", resA.swappedWith?.subjectName)

        assertEquals(830, resB.startTime)
        assertEquals(1030, resB.endTime)
        assertEquals(listOf("Aula 1"), resB.rooms)
        assertEquals("Física", resB.swappedWith?.subjectName)
    }

    @Test
    fun testLessonOverrideKeyCompositeFallback() {
        val lessonWithoutId = TimetableLesson(
            id = null,
            date = 20261109,
            startTime = 1530,
            subjectIds = listOf(99),
            type = "GA2"
        )
        val key = CustomEventsLogic.getLessonOverrideKey(lessonWithoutId)
        assertEquals("20261109_99_1530_ga2", key)
    }

    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val test = ExtendedCustomEventsLogicTest()
            test.testWeeklyMultiDayWithDateBounds()
            println("✓ testWeeklyMultiDayWithDateBounds passed")
            test.testWeekendCustomEvents()
            println("✓ testWeekendCustomEvents passed")
            test.testYearBoundaryRollover()
            println("✓ testYearBoundaryRollover passed")
            test.testApplyLessonOverrides_SwappedWithBidirectional()
            println("✓ testApplyLessonOverrides_SwappedWithBidirectional passed")
            test.testLessonOverrideKeyCompositeFallback()
            println("✓ testLessonOverrideKeyCompositeFallback passed")
            println("\n=== ALL EXTENDED ANDROID TESTS PASSED SUCCESSFULLY! ===")
        }
    }
}
