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
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class CustomEventsLogicTest {

    @Test
    fun testLessonOverrideKeyWithId() {
        val lesson = TimetableLesson(
            id = 998877L,
            date = 20261107,
            startTime = 900,
            endTime = 1100,
            subjectIds = listOf(42)
        )
        val key = CustomEventsLogic.getLessonOverrideKey(lesson)
        assertEquals("20261107_998877", key)
    }

    @Test
    fun testLessonOverrideKeyWithoutId() {
        val lesson = TimetableLesson(
            id = null,
            date = 20261107,
            startTime = 830,
            endTime = 1030,
            subjectIds = listOf(105),
            type = "PL1"
        )
        val key = CustomEventsLogic.getLessonOverrideKey(lesson)
        assertEquals("20261107_105_830_pl1", key)
    }

    @Test
    fun testApplyLessonOverrides_Cancellation() {
        val lesson = TimetableLesson(
            id = 12345L,
            date = 20261107,
            startTime = 900,
            endTime = 1100,
            subjects = listOf("Física"),
            subjectIds = listOf(10),
            rooms = listOf("Aula 1.1")
        )
        val overrides = mapOf(
            "20261107_12345" to LessonOverrideDto(
                lessonKey = "20261107_12345",
                lessonId = 12345L,
                date = 20261107,
                userCancelled = true
            )
        )

        val result = CustomEventsLogic.applyLessonOverrides(listOf(lesson), overrides)
        assertEquals(1, result.size)
        val overridden = result[0]
        assertTrue(overridden.isOverridden)
        assertTrue(overridden.isUserCancelled)
        assertEquals("cancelled", overridden.code)
        // Original timing and rooms are preserved
        assertEquals(900, overridden.startTime)
        assertEquals(1100, overridden.endTime)
        assertEquals(listOf("Aula 1.1"), overridden.rooms)
    }

    @Test
    fun testApplyLessonOverrides_EditTimeRoomsNotes() {
        val lesson = TimetableLesson(
            id = 54321L,
            date = 20261107,
            startTime = 830,
            endTime = 1030,
            subjects = listOf("Cálculo"),
            subjectIds = listOf(20),
            rooms = listOf("Aula 0.5")
        )
        val overrides = mapOf(
            "20261107_54321" to LessonOverrideDto(
                lessonKey = "20261107_54321",
                lessonId = 54321L,
                customStartTime = 930,
                customEndTime = 1130,
                customRooms = listOf("Aula 2.3", "Aula 2.4"),
                customNotes = "Revisión de examen parcial",
                swappedWith = SwappedWithDto(lessonKey = "20261107_999", subjectName = "Álgebra")
            )
        )

        val result = CustomEventsLogic.applyLessonOverrides(listOf(lesson), overrides)
        assertEquals(1, result.size)
        val overridden = result[0]
        assertTrue(overridden.isOverridden)
        assertFalse(overridden.isUserCancelled)
        assertEquals(930, overridden.startTime)
        assertEquals(1130, overridden.endTime)
        assertEquals(listOf("Aula 2.3", "Aula 2.4"), overridden.rooms)
        assertEquals("Revisión de examen parcial", overridden.notes)
        assertNotNull(overridden.swappedWith)
        assertEquals("Álgebra", overridden.swappedWith?.subjectName)
    }

    @Test
    fun testExpandCustomEventsForDates_SingleEvent() {
        val event = CustomEventDto(
            id = "evt_single",
            title = "Tutoría Álgebra",
            location = "Despacho 3.12",
            category = "Estudio",
            colorIndex = 5,
            startTime = 1200,
            endTime = 1300,
            recurrence = CustomEventRecurrenceDto(
                type = "none",
                date = 20261107
            )
        )

        val targetDates = listOf(
            LocalDate.of(2026, 11, 6),
            LocalDate.of(2026, 11, 7),
            LocalDate.of(2026, 11, 8)
        )

        val expanded = CustomEventsLogic.expandCustomEventsForDates(listOf(event), targetDates)
        assertEquals(1, expanded.size)
        val inst = expanded[0]
        assertTrue(inst.isCustomEvent)
        assertEquals(20261107, inst.date)
        assertEquals("Tutoría Álgebra", inst.subjects.firstOrNull())
        assertEquals("Despacho 3.12", inst.rooms.firstOrNull())
        assertEquals(5, inst.colorIndex)
        assertEquals(1200, inst.startTime)
        assertEquals(1300, inst.endTime)
    }

    @Test
    fun testExpandCustomEventsForDates_WeeklyWithExceptions() {
        // Monday (1) and Thursday (4)
        val event = CustomEventDto(
            id = "evt_gym",
            title = "Gimnasio",
            location = "Polideportivo",
            category = "Deporte",
            colorIndex = 2,
            startTime = 1900,
            endTime = 2030,
            recurrence = CustomEventRecurrenceDto(
                type = "weekly",
                startDate = 20261101,
                endDate = 20261130,
                daysOfWeek = listOf(1, 4),
                exceptions = listOf(20261109) // Monday 9th is skipped
            )
        )

        val mondayNov2 = LocalDate.of(2026, 11, 2)   // matched
        val thursdayNov5 = LocalDate.of(2026, 11, 5) // matched
        val fridayNov6 = LocalDate.of(2026, 11, 6)   // not in daysOfWeek
        val mondayNov9 = LocalDate.of(2026, 11, 9)   // exception -> skipped!
        val thursdayNov12 = LocalDate.of(2026, 11, 12)// matched

        val dates = listOf(mondayNov2, thursdayNov5, fridayNov6, mondayNov9, thursdayNov12)
        val expanded = CustomEventsLogic.expandCustomEventsForDates(listOf(event), dates)

        assertEquals(3, expanded.size)
        assertEquals(listOf(20261102, 20261105, 20261112), expanded.map { it.date })
    }

    @Test
    fun testDayLogic_GetLessonsForDate_CancelledHandling() {
        val activeLesson = TimetableLesson(
            id = 1L,
            date = 20261107,
            startTime = 900,
            endTime = 1100,
            subjects = listOf("Activa")
        )
        val cancelledLesson = TimetableLesson(
            id = 2L,
            date = 20261107,
            startTime = 1100,
            endTime = 1300,
            subjects = listOf("Cancelada"),
            code = "cancelled",
            isUserCancelled = true
        )
        val list = listOf(activeLesson, cancelledLesson)

        // Default getLessonsForDate should exclude cancelled
        val normal = DayLogic.getLessonsForDate(list, 20261107, includeCancelled = false)
        assertEquals(1, normal.size)
        assertEquals("Activa", normal[0].subjects[0])

        // Rendering getLessonsForDate with includeCancelled = true should include it
        val withCancelled = DayLogic.getLessonsForDate(list, 20261107, includeCancelled = true)
        assertEquals(2, withCancelled.size)
    }

    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val test = CustomEventsLogicTest()
            test.testLessonOverrideKeyWithId()
            println("✓ testLessonOverrideKeyWithId passed")
            test.testLessonOverrideKeyWithoutId()
            println("✓ testLessonOverrideKeyWithoutId passed")
            test.testApplyLessonOverrides_Cancellation()
            println("✓ testApplyLessonOverrides_Cancellation passed")
            test.testApplyLessonOverrides_EditTimeRoomsNotes()
            println("✓ testApplyLessonOverrides_EditTimeRoomsNotes passed")
            test.testExpandCustomEventsForDates_SingleEvent()
            println("✓ testExpandCustomEventsForDates_SingleEvent passed")
            test.testExpandCustomEventsForDates_WeeklyWithExceptions()
            println("✓ testExpandCustomEventsForDates_WeeklyWithExceptions passed")
            test.testDayLogic_GetLessonsForDate_CancelledHandling()
            println("✓ testDayLogic_GetLessonsForDate_CancelledHandling passed")
            println("\n=== ALL 7 TESTS PASSED SUCCESSFULLY! ===")
        }
    }
}
