package com.ehuntis.widget.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object WidgetAnalytics {

    private val POSTHOG_API_KEY: String = com.ehuntis.widget.BuildConfig.POSTHOG_API_KEY
    private const val POSTHOG_CAPTURE_URL = "https://eu.i.posthog.com/capture/"
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    /**
     * Envía un evento a PostHog de forma asíncrona sin bloquear ningún hilo ni retrasar la UI.
     */
    fun trackEvent(
        eventName: String,
        distinctId: String,
        properties: Map<String, Any?> = emptyMap()
    ) {
        if (POSTHOG_API_KEY.isBlank() || distinctId.isBlank()) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val props = JSONObject().apply {
                    put("\$lib", "ehuntis-android-widget")
                    put("platform", "android_widget")
                    put("app_version", com.ehuntis.widget.BuildConfig.VERSION_NAME)
                    for ((k, v) in properties) {
                        if (v != null) put(k, v)
                    }
                }

                val payload = JSONObject().apply {
                    put("api_key", POSTHOG_API_KEY)
                    put("event", eventName)
                    put("distinct_id", distinctId.trim())
                    put("properties", props)
                }

                val body = payload.toString().toRequestBody(JSON_MEDIA_TYPE)
                val request = Request.Builder()
                    .url(POSTHOG_CAPTURE_URL)
                    .post(body)
                    .build()

                httpClient.newCall(request).execute().close()
            } catch (e: Exception) {
                // Silencioso: las analíticas nunca deben interrumpir el funcionamiento
            }
        }
    }

    fun trackConfigured(
        username: String,
        configId: String?,
        viewMode: String,
        themeMode: String
    ) {
        trackEvent(
            eventName = "widget_configured",
            distinctId = username,
            properties = mapOf(
                "config_id" to configId,
                "view_mode" to viewMode,
                "theme_mode" to themeMode
            )
        )
    }

    fun trackManualRefresh(username: String) {
        trackEvent(
            eventName = "widget_manual_refresh",
            distinctId = username
        )
    }
}
