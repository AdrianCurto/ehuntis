package com.ehuntis.widget.data

object Subgroups {

    fun getMergeType(lstext: String?): String {
        if (lstext.isNullOrBlank()) return ""
        val upper = lstext.trim().uppercase()
        if (upper.contains("MAGIS") ||
            upper == "M" ||
            upper.startsWith("GA") ||
            upper.startsWith("G.A.") ||
            upper == "T" ||
            upper.startsWith("T0")
        ) {
            return "MAGISTRAL_GA"
        }
        return upper
    }

    private val PREFIX_REGEX = Regex("^(?:G\\.?L\\.?|G\\.?O\\.?|G\\.?C\\.?A\\.?|T\\.?I\\.?|T\\.?A\\.?|P\\.?A\\.?|P\\.?L\\.?|S)[,\\-.\\s]*(\\d+)")
    private val RAW_PREFIX_REGEX = Regex("^(G\\.?L\\.?|G\\.?O\\.?|G\\.?C\\.?A\\.?|T\\.?I\\.?|T\\.?A\\.?|P\\.?A\\.?|P\\.?L\\.?|S)")
    private val FALLBACK_REGEX = Regex("^([A-Z]{1,4})[,\\-.\\s]*(\\d+)")

    fun extractSubgroupKey(lstext: String?): String? {
        if (lstext.isNullOrBlank()) return null
        val upper = lstext.trim().uppercase()
        if (upper.contains("MAGIS") ||
            upper == "M" ||
            upper.startsWith("GA ") ||
            upper == "GA" ||
            upper.startsWith("G.A.") ||
            upper == "T" ||
            upper.startsWith("T0") ||
            upper.contains("EM/CM") ||
            upper.contains("EXAMEN") ||
            upper.contains("BERRESKUR") ||
            upper.contains("RECUPER") ||
            upper.contains("CLASE ADICIONAL")
        ) {
            return null
        }

        val prefixMatch = PREFIX_REGEX.find(upper)
        if (prefixMatch != null) {
            val rawPrefix = RAW_PREFIX_REGEX.find(upper)?.groupValues?.get(1) ?: ""
            val normPrefix = rawPrefix.replace(".", "")
            return normPrefix + prefixMatch.groupValues[1]
        }

        val fallback = FALLBACK_REGEX.find(upper)
        if (fallback != null) {
            return fallback.groupValues[1] + fallback.groupValues[2]
        }

        return null
    }

    fun extractSubgroupNumber(lstext: String?): Int? {
        val key = extractSubgroupKey(lstext) ?: return null
        val match = Regex("\\d+").find(key)
        return match?.value?.toIntOrNull()
    }

    /**
     * Comprueba si un grupo está deshabilitado en la configuración.
     */
    fun isGroupDisabled(g: SelectedGroup, disabledGroupIds: Set<String>): Boolean {
        if (g.groupKey in disabledGroupIds) return true
        if (!g.uniqueId.isNullOrEmpty() && g.uniqueId in disabledGroupIds) return true
        if (g.name.isNotEmpty() && g.name in disabledGroupIds) return true
        if (g.ids.isNotEmpty()) {
            if (g.ids.joinToString(",") in disabledGroupIds) return true
            if (g.ids.any { it.toString() in disabledGroupIds }) return true
        }
        return false
    }

    /**
     * Retorna todas las posibles representaciones de clave para un grupo (uniqueId, IDs, nombre).
     */
    private fun getGroupCandidateKeys(g: SelectedGroup): List<String> {
        val keys = mutableListOf<String>()
        if (g.groupKey.isNotEmpty()) keys.add(g.groupKey)
        if (!g.uniqueId.isNullOrEmpty() && !keys.contains(g.uniqueId)) keys.add(g.uniqueId)
        if (g.name.isNotEmpty() && !keys.contains(g.name)) keys.add(g.name)
        val idsStr = g.ids.joinToString(",")
        if (idsStr.isNotEmpty() && !keys.contains(idsStr)) keys.add(idsStr)
        g.ids.forEach { id ->
            val s = id.toString()
            if (!keys.contains(s)) keys.add(s)
        }
        return keys
    }

    /**
     * Filtra una lista de lecciones aplicando la configuración del usuario con exactitud 1:1 con la web:
     * - Oculta lecciones que no pertenecen a los grupos seleccionados.
     * - Oculta lecciones de grupos deshabilitados.
     * - Oculta lecciones de asignaturas deshabilitadas.
     * - Oculta o atenúa (isDimmed) según showDimmedSubgroups las lecciones de subgrupos deshabilitados.
     */
    fun filterLessonsForConfig(
        lessons: List<TimetableLesson>,
        config: UserConfig?
    ): List<TimetableLesson> {
        if (config == null) return lessons
        val selectedGroups = config.selectedGroups
        val disabledGroupIds = config.disabledGroupIds.toSet()
        val disabledSubjectsByGroup = config.disabledSubjectsByGroup
        val disabledSubgroupsBySubject = config.disabledSubgroupsBySubject
        val showDimmed = config.showDimmedSubgroups

        // Grupos activos (no deshabilitados)
        val activeGroups = selectedGroups.filter { !isGroupDisabled(it, disabledGroupIds) }

        return lessons.mapNotNull { lesson ->
            val lessonGroupIds = if (lesson.classIds.isNotEmpty()) lesson.classIds else listOfNotNull(lesson.classId)

            // Si hay grupos seleccionados configurados, la lección debe pertenecer a alguno de ellos
            if (selectedGroups.isNotEmpty()) {
                val belongsToAnyConfigGroup = selectedGroups.any { g ->
                    lessonGroupIds.any { id -> id in g.ids }
                }
                if (!belongsToAnyConfigGroup) {
                    return@mapNotNull null
                }
            }

            // Grupos dueños activos para esta lección
            val ownerGroups = if (selectedGroups.isEmpty()) {
                emptyList()
            } else {
                activeGroups.filter { g ->
                    lessonGroupIds.any { id -> id in g.ids }
                }
            }

            // Si la lección pertenecía a grupos del usuario pero todos están deshabilitados, se oculta
            if (selectedGroups.isNotEmpty() && ownerGroups.isEmpty()) {
                return@mapNotNull null
            }

            val groupsToEvaluate = if (ownerGroups.isNotEmpty()) ownerGroups else listOf(SelectedGroup(ids = lessonGroupIds))

            var isVisible = false
            var isDimmed = false

            for (g in groupsToEvaluate) {
                val candidateKeys = getGroupCandidateKeys(g)

                // 1. Asignaturas deshabilitadas para este grupo
                val disabledSubjects = mutableSetOf<String>()
                for (k in candidateKeys) {
                    disabledSubjectsByGroup[k]?.let { list ->
                        list.forEach { disabledSubjects.add(it.trim().lowercase()) }
                    }
                }

                val isSubjDisabled = lesson.subjectIds.filterNotNull().any { it.toString().lowercase() in disabledSubjects } ||
                        lesson.subjects.any { it.trim().lowercase() in disabledSubjects } ||
                        lesson.subjectShortNames.any { it.trim().lowercase() in disabledSubjects }

                if (isSubjDisabled) {
                    continue
                }

                // 2. Subgrupos deshabilitados para esta asignatura
                val subKey = extractSubgroupKey(lesson.type)
                val isSubgroupDisabled = if (subKey != null) {
                    val normSubKey = subKey.replace(Regex("[.\\-,\\s]"), "").uppercase()

                    // Recolectar listas de subgrupos deshabilitados para las asignaturas de la lección
                    val disabledSubgroupLists = mutableListOf<List<String>>()

                    // Claves de asignaturas de la lección (IDs numéricos, nombres y acrónimos)
                    val subjectKeys = mutableListOf<String>()
                    lesson.subjectIds.filterNotNull().forEach { subjectKeys.add(it.toString()) }
                    lesson.subjects.forEach { if (it.isNotBlank()) subjectKeys.add(it.trim()) }
                    lesson.subjectShortNames.forEach { if (it.isNotBlank()) subjectKeys.add(it.trim()) }

                    for (subjKey in subjectKeys) {
                        for (grpKey in candidateKeys) {
                            disabledSubgroupsBySubject[grpKey]?.get(subjKey)?.let { disabledSubgroupLists.add(it) }
                        }
                        // Soporte para formato plano
                        disabledSubgroupsBySubject["_all_"]?.get(subjKey)?.let { disabledSubgroupLists.add(it) }
                        disabledSubgroupsBySubject[subjKey]?.let {
                            // Si vino mapeado directamente como mapa
                            disabledSubgroupLists.add(it.values.flatten())
                        }
                    }

                    if (disabledSubgroupLists.isEmpty()) {
                        false
                    } else {
                        disabledSubgroupLists.any { list ->
                            list.any { item ->
                                val normItem = item.replace(Regex("[.\\-,\\s]"), "").uppercase()
                                normItem == normSubKey || item.equals(subKey, ignoreCase = true)
                            }
                        }
                    }
                } else {
                    false
                }

                if (!isSubgroupDisabled) {
                    isVisible = true
                    isDimmed = false
                    break
                } else {
                    if (showDimmed) {
                        isVisible = true
                        isDimmed = true
                    }
                }
            }

            if (!isVisible) null
            else lesson.copy(isDimmed = isDimmed)
        }
    }
}
