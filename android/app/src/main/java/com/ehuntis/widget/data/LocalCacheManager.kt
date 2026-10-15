package com.ehuntis.widget.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.encodeToString
import java.io.File

class LocalCacheManager(private val context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("ehuntis_widget_prefs", Context.MODE_PRIVATE)



    // --- Username & Config IDs ---

    fun saveUsername(username: String) {
        prefs.edit().putString(PREF_USERNAME, username.trim()).apply()
    }

    fun getUsername(): String? {
        return prefs.getString(PREF_USERNAME, null)
    }

    fun saveActiveConfigId(configId: String?) {
        prefs.edit().putString(PREF_ACTIVE_CONFIG_ID, configId).apply()
    }

    fun getActiveConfigId(): String? {
        return prefs.getString(PREF_ACTIVE_CONFIG_ID, null)
    }

    fun saveThemeMode(mode: String) {
        prefs.edit().putString(PREF_THEME_MODE, mode).apply()
    }

    fun getThemeMode(): String {
        return prefs.getString(PREF_THEME_MODE, "AUTO") ?: "AUTO"
    }

    fun saveWidgetConfigId(appWidgetId: Int, configId: String?) {
        if (configId == null) {
            prefs.edit().remove(PREF_WIDGET_CONFIG_PREFIX + appWidgetId).apply()
        } else {
            prefs.edit().putString(PREF_WIDGET_CONFIG_PREFIX + appWidgetId, configId).apply()
        }
    }

    fun getWidgetConfigId(appWidgetId: Int): String? {
        return prefs.getString(PREF_WIDGET_CONFIG_PREFIX + appWidgetId, null)
    }

    fun saveWidgetViewMode(appWidgetId: Int, mode: String) {
        prefs.edit().putString(PREF_WIDGET_VIEW_MODE_PREFIX + appWidgetId, mode).apply()
    }

    fun getWidgetViewMode(appWidgetId: Int): String {
        return prefs.getString(PREF_WIDGET_VIEW_MODE_PREFIX + appWidgetId, "DAY") ?: "DAY"
    }

    fun removeWidget(appWidgetId: Int) {
        prefs.edit()
            .remove(PREF_WIDGET_CONFIG_PREFIX + appWidgetId)
            .remove(PREF_WIDGET_VIEW_MODE_PREFIX + appWidgetId)
            .apply()
    }

    fun saveLastSyncTime(timeMillis: Long) {
        prefs.edit().putLong(PREF_LAST_SYNC_TIME, timeMillis).apply()
    }

    fun getLastSyncTime(): Long {
        return prefs.getLong(PREF_LAST_SYNC_TIME, 0L)
    }

    // --- User Data JSON Persistence ---

    fun saveUserData(userData: UserResponse) {
        try {
            val jsonStr = ApiClient.json.encodeToString(userData)
            val file = File(context.filesDir, FILE_USER_DATA)
            file.writeText(jsonStr)
            if (!userData.active_config_id.isNullOrBlank()) {
                saveActiveConfigId(userData.active_config_id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getUserData(): UserResponse? {
        return try {
            val file = File(context.filesDir, FILE_USER_DATA)
            if (!file.exists()) return null
            val content = file.readText()
            ApiClient.json.decodeFromString<UserResponse>(content)
        } catch (e: Exception) {
            null
        }
    }

    // --- Timetable JSON Persistence ---

    fun saveTimetable(lessons: List<TimetableLesson>) {
        try {
            val jsonStr = ApiClient.json.encodeToString(lessons)
            val file = File(context.filesDir, FILE_TIMETABLE_CACHE)
            file.writeText(jsonStr)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getTimetable(): List<TimetableLesson> {
        return try {
            val file = File(context.filesDir, FILE_TIMETABLE_CACHE)
            if (!file.exists()) return emptyList()
            val content = file.readText()
            ApiClient.json.decodeFromString<List<TimetableLesson>>(content)
        } catch (e: Exception) {
            emptyList()
        }
    }

    // --- Resilient Cascade Fallback Strategy ---

    /**
     * Resuelve de forma blindada qué configuración debe mostrar un widget concreto:
     * - Nivel 1: Busca si el widget tiene un ID asignado específicamente y aún existe.
     * - Nivel 2: Si no existe (se borró) o no tiene asignado, usa active_config_id del usuario.
     * - Nivel 3: Si no hay activo, toma la primera configuración disponible (configs[0]).
     * - Nivel 4: Retorna null si el usuario no tiene ninguna configuración creada.
     */
    fun resolveConfigForWidget(appWidgetId: Int): UserConfig? {
        val userData = getUserData() ?: return null
        val configs = userData.configs
        val assignedId = getWidgetConfigId(appWidgetId)
        val activeId = userData.active_config_id ?: getActiveConfigId()
        return resolveConfig(configs, assignedId, activeId)
    }

    companion object {
        private const val PREF_USERNAME = "pref_username"
        private const val PREF_ACTIVE_CONFIG_ID = "pref_active_config_id"
        private const val PREF_THEME_MODE = "pref_theme_mode" // "AUTO", "LIGHT", "DARK"
        private const val PREF_LAST_SYNC_TIME = "pref_last_sync_time"
        private const val PREF_WIDGET_CONFIG_PREFIX = "pref_widget_cfg_"
        private const val PREF_WIDGET_VIEW_MODE_PREFIX = "pref_widget_view_mode_"

        private const val FILE_USER_DATA = "user_data.json"
        private const val FILE_TIMETABLE_CACHE = "timetable_cache.json"

        @Volatile
        private var instance: LocalCacheManager? = null

        fun getInstance(context: Context): LocalCacheManager {
            return instance ?: synchronized(this) {
                instance ?: LocalCacheManager(context.applicationContext).also { instance = it }
            }
        }

        fun resolveConfig(
            configs: List<UserConfig>,
            assignedId: String?,
            activeId: String?
        ): UserConfig? {
            if (configs.isEmpty()) return null

            if (!assignedId.isNullOrBlank()) {
                val found = configs.find { it.id == assignedId }
                if (found != null) return found
            }

            if (!activeId.isNullOrBlank()) {
                val foundActive = configs.find { it.id == activeId }
                if (foundActive != null) return foundActive
            }

            return configs.firstOrNull()
        }
    }
}
