package com.ehuntis.widget

import com.ehuntis.widget.data.ApiClient
import com.ehuntis.widget.data.CustomEventsLogic
import com.ehuntis.widget.data.TimetableLesson
import com.ehuntis.widget.data.UserResponse
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifica con el plugin real de kotlinx.serialization que el JSON exacto que genera
 * la web (incluyendo originalSnapshot con teachers/id, ignoreOfficialCancellation,
 * overrides dispersos, overrides antiguos densos y posibles nulls en listas) se deserializa
 * y re-serializa sin excepciones en LocalCacheManager y ApiClient.
 */
class LessonOverrideSerializationTest {

    @Test
    fun testDeserializeRealWebUserResponseWithOverridesAndSnapshots() {
        val rawJson = """
        {
          "username": "testuser01",
          "configs": [
            {
              "id": "cfg_1",
              "name": "Grado 1",
              "selectedGroups": [{"id": [101], "name": "1A"}],
              "disabledGroupIds": [],
              "disabledSubjectsByGroup": {},
              "disabledSubgroupsBySubject": {},
              "showDimmedSubgroups": false,
              "customColors": {}
            }
          ],
          "active_config_id": "cfg_1",
          "custom_events": [],
          "custom_categories": ["Estudio"],
          "lesson_overrides": {
            "20261109_7001": {
              "lessonKey": "20261109_7001",
              "lessonId": 7001,
              "date": 20261109,
              "customNotes": "Traer calculadora",
              "originalSnapshot": {
                "id": 7001,
                "date": 20261109,
                "startTime": 830,
                "endTime": 1030,
                "rooms": ["P3 G2A", null],
                "teachers": ["Prof. García"],
                "code": null
              },
              "updatedAt": 1763400000000
            },
            "20261109_7002": {
              "lessonKey": "20261109_7002",
              "lessonId": 7002,
              "date": 20261109,
              "customDate": 20261112,
              "ignoreOfficialCancellation": true,
              "originalSnapshot": {
                "id": "non_numeric_safe",
                "date": 20261109,
                "startTime": 900,
                "endTime": 1100,
                "rooms": ["Aula 1.1"],
                "teachers": [],
                "code": "cancelled"
              },
              "updatedAt": 1763400000001
            },
            "20261109_7003": {
              "lessonKey": "20261109_7003",
              "lessonId": 7003,
              "customRooms": ["P3G2A"],
              "originalSnapshot": {
                "date": null,
                "startTime": null,
                "endTime": null,
                "rooms": ["Aula 0.1"],
                "code": null
              }
            }
          }
        }
        """.trimIndent()

        // 1. Decode from API JSON
        val parsed = ApiClient.json.decodeFromString<UserResponse>(rawJson)
        assertNotNull(parsed.lesson_overrides)
        assertEquals(3, parsed.lesson_overrides!!.size)

        // 2. Roundtrip encode/decode (simulating LocalCacheManager.saveUserData -> getUserData)
        val encoded = ApiClient.json.encodeToString(parsed)
        val reparsed = ApiClient.json.decodeFromString<UserResponse>(encoded)
        val overrides = reparsed.lesson_overrides!!

        val ov1 = overrides["20261109_7001"]!!
        assertEquals("Traer calculadora", ov1.customNotes)
        assertEquals(listOf("P3 G2A", null), ov1.originalSnapshot?.rooms)

        val ov2 = overrides["20261109_7002"]!!
        assertEquals(true, ov2.ignoreOfficialCancellation)
        assertEquals(20261112, ov2.customDate)

        // 3. Apply decoded overrides against updated WebUntis lessons
        val lessons = listOf(
            TimetableLesson(id = 7001L, date = 20261109, startTime = 900, endTime = 1100, rooms = listOf("P1 I2S")),
            TimetableLesson(id = 7002L, date = 20261109, startTime = 900, endTime = 1100, rooms = listOf("Aula 1.1"), code = "cancelled"),
            TimetableLesson(id = 7003L, date = 20261109, startTime = 1100, endTime = 1300, rooms = listOf("P3 G2A"))
        )

        val applied = CustomEventsLogic.applyLessonOverrides(lessons, overrides)

        // 7001: orthogonal update -> gets new official room + time, preserves note
        assertTrue(applied[0].isOverridden)
        assertEquals(900, applied[0].startTime)
        assertEquals(listOf("P1 I2S"), applied[0].rooms)
        assertEquals("Traer calculadora", applied[0].notes)

        // 7002: ignoreOfficialCancellation -> stays active on moved date
        assertTrue(applied[1].isOverridden)
        assertEquals(20261112, applied[1].date)
        assertNull(applied[1].code)

        // 7003: room converged (P3G2A == P3 G2A) even with null snapshot fields -> unmarked
        assertFalse(applied[2].isOverridden)
        assertEquals(listOf("P3 G2A"), applied[2].rooms)
    }
}
