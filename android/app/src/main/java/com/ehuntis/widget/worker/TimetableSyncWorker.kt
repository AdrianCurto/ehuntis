package com.ehuntis.widget.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.ehuntis.widget.TimetableWidgetProvider
import com.ehuntis.widget.data.ApiClient
import com.ehuntis.widget.data.LocalCacheManager
import java.util.concurrent.TimeUnit

class TimetableSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val cache = LocalCacheManager.getInstance(applicationContext)
        val username = cache.getUsername() ?: return Result.success()

        val force = inputData.getBoolean(KEY_FORCE, false)
        val lastSync = cache.getLastSyncTime()
        val elapsed = System.currentTimeMillis() - lastSync
        // Margen de seguridad: si no es forzado, evitamos peticiones redundantes si se
        // sincronizó hace menos de 30 minutos y ya tenemos datos en caché.
        // Esto evita que el jitter de WorkManager (que programa a 6h) descarte la sincronización periódica.
        val minIntervalMillis = 30 * 60 * 1000L

        if (!force && elapsed < minIntervalMillis && cache.getTimetable().isNotEmpty()) {
            TimetableWidgetProvider.updateAllWidgets(applicationContext)
            return Result.success()
        }

        return try {
            val prevUserData = cache.getUserData()
            val userResult = ApiClient.fetchUserData(username)
            val userData = if (userResult.isSuccess) {
                val data = userResult.getOrThrow()
                cache.saveUserData(data)
                data
            } else {
                prevUserData
            }

            if (userData != null) {
                // 2. Extraer todos los grupos seleccionados
                val allClassIds = userData.configs.flatMap { it.allClassIds }.distinct()

                // 3. Descargar horario completo
                if (allClassIds.isNotEmpty()) {
                    val userChanged = prevUserData == null || prevUserData != userData
                    val shouldForceTt = force || userChanged || elapsed >= 6 * 3600 * 1000L

                    val timetableResult = ApiClient.fetchTimetable(allClassIds, force = shouldForceTt)
                    if (timetableResult.isSuccess) {
                        val lessons = timetableResult.getOrThrow()
                        cache.saveTimetable(lessons)
                        cache.saveLastSyncTime(System.currentTimeMillis())
                    }
                }
            }

            // 4. Actualizar todos los widgets con los nuevos datos o los datos en caché
            TimetableWidgetProvider.updateAllWidgets(applicationContext)
            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            // Si la red falla pero tenemos datos locales, no rompemos el widget
            TimetableWidgetProvider.updateAllWidgets(applicationContext)
            Result.success()
        }
    }

    companion object {
        const val KEY_FORCE = "key_force"
        private const val UNIQUE_PERIODIC_WORK = "EHUntisTimetablePeriodicSync"
        private const val UNIQUE_IMMEDIATE_WORK = "EHUntisTimetableImmediateSync"

        /**
         * Programa la sincronización periódica cada 6 horas con restricción de red
         */
        fun enqueuePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<TimetableSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        /**
         * Lanza una sincronización inmediata (al refrescar o configurar)
         */
        fun enqueueImmediateSync(context: Context, force: Boolean = false) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<TimetableSyncWorker>()
                .setInputData(workDataOf(KEY_FORCE to force))
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_IMMEDIATE_WORK,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
