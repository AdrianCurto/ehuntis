package com.ehuntis.widget.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*
import java.time.LocalDate

/** Color entry from the API palette: { bg: "#RRGGBB", text: "#RRGGBB", border: "rgba(...)" } */
@Serializable
data class PaletteColor(
    val bg: String = "#BAE1FF",
    val text: String = "#0F172A",
    val border: String = "rgba(0,0,0,0.1)"
)

/** The full palette for both light and dark mode, returned by GET /api/user/[username] */
@Serializable
data class ApiPalette(
    val light: List<PaletteColor> = emptyList(),
    val dark: List<PaletteColor> = emptyList()
)

@Serializable
data class UserResponse(
    val username: String = "",
    val configs: List<UserConfig> = emptyList(),
    val active_config_id: String? = null,
    val updated_at: String? = null,
    /** Palette provided by the server — widgets use this instead of hardcoded colors */
    val palette: ApiPalette? = null
)

@Serializable(with = SelectedGroupSerializer::class)
data class SelectedGroup(
    val ids: List<Int> = emptyList(),
    val name: String = "",
    val uniqueId: String? = null
) {
    val groupKey: String
        get() = uniqueId ?: ids.joinToString(",")
}

object SelectedGroupSerializer : KSerializer<SelectedGroup> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SelectedGroup")

    override fun deserialize(decoder: Decoder): SelectedGroup {
        val input = decoder as? JsonDecoder ?: throw SerializationException("Expected JsonDecoder")
        val element = input.decodeJsonElement()

        return when (element) {
            is JsonPrimitive -> {
                val intVal = element.intOrNull ?: element.content.toIntOrNull()
                SelectedGroup(ids = listOfNotNull(intVal))
            }
            is JsonObject -> {
                val name = element["name"]?.jsonPrimitive?.contentOrNull ?: ""
                val uniqueId = element["uniqueId"]?.jsonPrimitive?.contentOrNull
                val idElem = element["id"]

                val ids = when (idElem) {
                    is JsonArray -> idElem.mapNotNull { it.jsonPrimitive.intOrNull ?: it.jsonPrimitive.content.toIntOrNull() }
                    is JsonPrimitive -> listOfNotNull(idElem.intOrNull ?: idElem.content.toIntOrNull())
                    else -> emptyList()
                }
                SelectedGroup(ids = ids, name = name, uniqueId = uniqueId)
            }
            is JsonArray -> {
                val ids = element.mapNotNull { it.jsonPrimitive.intOrNull ?: it.jsonPrimitive.content.toIntOrNull() }
                SelectedGroup(ids = ids)
            }
            else -> SelectedGroup()
        }
    }

    override fun serialize(encoder: Encoder, value: SelectedGroup) {
        val output = encoder as? JsonEncoder ?: throw SerializationException("Expected JsonEncoder")
        val obj = buildJsonObject {
            put("name", value.name)
            put("id", JsonArray(value.ids.map { JsonPrimitive(it) }))
            if (value.uniqueId != null) put("uniqueId", value.uniqueId)
        }
        output.encodeJsonElement(obj)
    }
}

@Serializable(with = UserConfigSerializer::class)
data class UserConfig(
    val id: String,
    val name: String,
    val selectedGroups: List<SelectedGroup> = emptyList(),
    val disabledGroupIds: List<String> = emptyList(),
    val disabledSubjectsByGroup: Map<String, List<String>> = emptyMap(),
    val disabledSubgroupsBySubject: Map<String, Map<String, List<String>>> = emptyMap(),
    val showDimmedSubgroups: Boolean = true,
    val last_modified: Long = 0L,
    /** Maps subjectId (as String) to a palette colorIndex (0–13). Empty = use automatic colors. */
    val customColors: Map<String, Int> = emptyMap()
) {
    val allClassIds: List<Int>
        get() = selectedGroups.flatMap { it.ids }.distinct()
}

object UserConfigSerializer : KSerializer<UserConfig> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("UserConfig")

    override fun deserialize(decoder: Decoder): UserConfig {
        val input = decoder as? JsonDecoder ?: throw SerializationException("Expected JsonDecoder")
        val obj = input.decodeJsonElement().jsonObject

        val id = obj["id"]?.jsonPrimitive?.contentOrNull ?: ""
        val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: ""
        val lastModified = obj["last_modified"]?.jsonPrimitive?.longOrNull ?: 0L
        val showDimmed = obj["showDimmedSubgroups"]?.jsonPrimitive?.booleanOrNull ?: true

        // 1. selectedGroups
        val selectedGroups = mutableListOf<SelectedGroup>()
        obj["selectedGroups"]?.jsonArray?.forEach { elem ->
            val decoded = input.json.decodeFromJsonElement(SelectedGroupSerializer, elem)
            selectedGroups.add(decoded)
        }

        // 2. disabledGroupIds (pueden ser strings o ints)
        val disabledGroupIds = mutableListOf<String>()
        obj["disabledGroupIds"]?.jsonArray?.forEach { elem ->
            when (elem) {
                is JsonPrimitive -> disabledGroupIds.add(elem.content)
                else -> {}
            }
        }

        // 3. disabledSubjectsByGroup
        val disabledSubjectsByGroup = mutableMapOf<String, List<String>>()
        obj["disabledSubjectsByGroup"]?.jsonObject?.forEach { (key, valElem) ->
            if (valElem is JsonArray) {
                disabledSubjectsByGroup[key] = valElem.mapNotNull { it.jsonPrimitive.contentOrNull }
            }
        }

        // 4. disabledSubgroupsBySubject (soporta formato anidado por grupo o plano por asignatura)
        val disabledSubgroupsBySubject = mutableMapOf<String, Map<String, List<String>>>()
        val flatSubgroups = mutableMapOf<String, List<String>>()
        obj["disabledSubgroupsBySubject"]?.jsonObject?.forEach { (key, valElem) ->
            if (valElem is JsonObject) {
                val innerMap = mutableMapOf<String, List<String>>()
                valElem.forEach { (subKey, arrElem) ->
                    if (arrElem is JsonArray) {
                        innerMap[subKey] = arrElem.mapNotNull { it.jsonPrimitive.contentOrNull }
                    }
                }
                disabledSubgroupsBySubject[key] = innerMap
            } else if (valElem is JsonArray) {
                flatSubgroups[key] = valElem.mapNotNull { it.jsonPrimitive.contentOrNull }
            }
        }
        if (flatSubgroups.isNotEmpty()) {
            disabledSubgroupsBySubject["_all_"] = flatSubgroups
        }

        // 5. customColors: { "subjectId": colorIndex }
        val customColors = mutableMapOf<String, Int>()
        obj["customColors"]?.jsonObject?.forEach { (subjectId, colorElem) ->
            val idx = colorElem.jsonPrimitive.intOrNull
            if (idx != null) customColors[subjectId] = idx
        }

        return UserConfig(
            id = id,
            name = name,
            selectedGroups = selectedGroups,
            disabledGroupIds = disabledGroupIds,
            disabledSubjectsByGroup = disabledSubjectsByGroup,
            disabledSubgroupsBySubject = disabledSubgroupsBySubject,
            showDimmedSubgroups = showDimmed,
            last_modified = lastModified,
            customColors = customColors
        )
    }

    override fun serialize(encoder: Encoder, value: UserConfig) {
        val output = encoder as? JsonEncoder ?: throw SerializationException("Expected JsonEncoder")
        val obj = buildJsonObject {
            put("id", value.id)
            put("name", value.name)
            put("showDimmedSubgroups", value.showDimmedSubgroups)
            put("last_modified", value.last_modified)
            put("selectedGroups", JsonArray(value.selectedGroups.map { grp ->
                buildJsonObject {
                    put("name", grp.name)
                    put("id", JsonArray(grp.ids.map { JsonPrimitive(it) }))
                    if (grp.uniqueId != null) put("uniqueId", grp.uniqueId)
                }
            }))
            put("disabledGroupIds", JsonArray(value.disabledGroupIds.map { JsonPrimitive(it) }))
            put("disabledSubjectsByGroup", buildJsonObject {
                value.disabledSubjectsByGroup.forEach { (k, list) ->
                    put(k, JsonArray(list.map { JsonPrimitive(it) }))
                }
            })
            put("disabledSubgroupsBySubject", buildJsonObject {
                value.disabledSubgroupsBySubject.forEach { (k, innerMap) ->
                    put(k, buildJsonObject {
                        innerMap.forEach { (subKey, list) ->
                            put(subKey, JsonArray(list.map { JsonPrimitive(it) }))
                        }
                    })
                }
            })
            put("customColors", buildJsonObject {
                value.customColors.forEach { (subjectId, colorIdx) ->
                    put(subjectId, JsonPrimitive(colorIdx))
                }
            })
        }
        output.encodeJsonElement(obj)
    }
}

@Serializable
data class TimetableLesson(
    val id: Long? = null,
    val date: Int = 0,
    val startTime: Int = 0,
    val endTime: Int = 0,
    val classId: Int? = null,
    val classIds: List<Int> = emptyList(),
    val subjects: List<String> = emptyList(),
    val subjectShortNames: List<String> = emptyList(),
    val subjectIds: List<Int?> = emptyList(),
    val rooms: List<String> = emptyList(),
    val teachers: List<String> = emptyList(),
    val code: String? = null,
    val type: String? = null,
    var isDimmed: Boolean = false
)

enum class BreakStreakType {
    END_OF_YEAR,
    EXTENDED_BREAK,
    NO_CLASS_TODAY
}

data class BreakStreakResult(
    val type: BreakStreakType,
    val message: String,
    val totalDays: Int = 0,
    val daysRemaining: Int = 0,
    val returnDate: LocalDate? = null
)

data class VisibleTimeRange(
    val firstHour: Int,
    val lastHour: Int,
    val startMinutes: Int,
    val endMinutes: Int,
    val totalMinutes: Int
)
