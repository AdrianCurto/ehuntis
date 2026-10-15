package com.ehuntis.widget.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

object ApiClient {

    var baseUrl: String = "https://ehuntis.vercel.app"

    val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    /**
     * Obtiene los datos del usuario desde /api/user/[username]
     */
    suspend fun fetchUserData(username: String): Result<UserResponse> = withContext(Dispatchers.IO) {
        val cleanUser = username.trim()
        val url = "$baseUrl/api/user/$cleanUser"
        val request = Request.Builder()
            .url(url)
            .header("Cache-Control", "no-cache")
            .get()
            .build()

        try {
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    if (response.code == 404) {
                        return@withContext Result.failure(IOException("Usuario no encontrado (@$cleanUser)"))
                    }
                    return@withContext Result.failure(IOException("Error HTTP ${response.code}: $body"))
                }
                val userResponse = json.decodeFromString<UserResponse>(body)
                Result.success(userResponse)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Obtiene el horario completo de lecciones desde /api/timetable?classIds=...
     */
    suspend fun fetchTimetable(
        classIds: List<Int>,
        force: Boolean = false
    ): Result<List<TimetableLesson>> = withContext(Dispatchers.IO) {
        if (classIds.isEmpty()) {
            return@withContext Result.success(emptyList())
        }

        val classIdsParam = classIds.joinToString(",")
        val forceParam = if (force) "&force=1&t=${System.currentTimeMillis()}" else ""

        // Calcular el rango del año escolar (Septiembre a Junio) exactamente igual que la web (page.js)
        val now = java.time.LocalDate.now()
        val startYear = if (now.monthValue >= 8) now.year else now.year - 1
        val startStr = "${startYear}-09-01T00:00:00.000Z"
        val endStr = "${startYear + 1}-06-30T23:59:59.000Z"

        val url = "$baseUrl/api/timetable?classIds=$classIdsParam&startDate=$startStr&endDate=$endStr$forceParam"

        val request = Request.Builder()
            .url(url)
            .get()
            .build()

        try {
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    return@withContext Result.failure(IOException("Error HTTP ${response.code}: $body"))
                }
                val lessons = json.decodeFromString<List<TimetableLesson>>(body)
                Result.success(lessons)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
