package com.example.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class WidgetUpdateWorker(
    private val appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val weatherPrefs = appContext.getSharedPreferences(WeatherWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val isLoggedOut = weatherPrefs.getBoolean("is_logged_out", false)
            if (isLoggedOut) {
                return@withContext Result.success()
            }

            val lat = weatherPrefs.getFloat("lat", 17.9689f).toDouble()
            val lon = weatherPrefs.getFloat("lon", 79.5941f).toDouble()

            // Fetch live Open-Meteo weather
            val endpoint = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min&timezone=auto"
            val conn = URL(endpoint).openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            if (conn.responseCode == 200) {
                val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                val rootJson = JSONObject(responseText)
                val current = rootJson.optJSONObject("current")
                val daily = rootJson.optJSONObject("daily")

                if (current != null) {
                    val temp = Math.round(current.optDouble("temperature_2m", 27.0)).toInt()
                    val humidity = Math.round(current.optDouble("relative_humidity_2m", 70.0)).toInt()
                    val wind = Math.round(current.optDouble("wind_speed_10m", 9.0)).toInt()
                    val precip = current.optDouble("precipitation", 0.0)

                    val maxTemp = daily?.optJSONArray("temperature_2m_max")?.optDouble(0, 31.0) ?: 31.0
                    val minTemp = daily?.optJSONArray("temperature_2m_min")?.optDouble(0, 21.0) ?: 21.0

                    val sprayCondition = if (wind < 15 && precip < 1.0) "☀️ Spray Window: SAFE" else "⚠️ High Wind/Rain"

                    weatherPrefs.edit().apply {
                        putString("temp", "$temp°C")
                        putString("condition", sprayCondition)
                        putString("hilo", "H: ${Math.round(maxTemp)}°C · L: ${Math.round(minTemp)}°C")
                        putString("humidity", "💧 $humidity%")
                        putString("rainfall", "🌧️ $precip mm")
                        putString("wind", "💨 $wind km/h")
                        putString("status", "LIVE")
                        putString("updated", "Open-Meteo API · Auto-synced · Tap to open")
                        apply()
                    }

                    WeatherWidgetProvider.updateAllWidgets(appContext)
                }
            }
            Result.success()
        } catch (e: Exception) {
            // Mark cached on error
            try {
                val weatherPrefs = appContext.getSharedPreferences(WeatherWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                weatherPrefs.edit().putString("status", "CACHED").apply()
                WeatherWidgetProvider.updateAllWidgets(appContext)
            } catch (_: Exception) {}
            Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "nukrop_widget_periodic_sync"

        fun schedulePeriodicUpdates(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val periodicWorkRequest = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(30, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .addTag("nukrop_widget_sync")
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
            )
        }
    }
}

