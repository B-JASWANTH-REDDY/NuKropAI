package com.example.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import com.example.MainActivity
import com.example.R

class WeatherWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_WEATHER_UPDATED || action == ACTION_LOGOUT) {
            updateAllWidgets(context)
        }
    }

    companion object {
        const val PREFS_NAME = "nukrop_weather_widget"
        const val ACTION_WEATHER_UPDATED = "com.example.widget.ACTION_WEATHER_UPDATED"
        const val ACTION_LOGOUT = "com.example.widget.ACTION_LOGOUT"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
            val componentName = ComponentName(context, WeatherWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isLoggedOut = prefs.getBoolean("is_logged_out", false)
            val views = RemoteViews(context.packageName, R.layout.widget_weather)

            if (isLoggedOut) {
                views.setTextViewText(R.id.widget_weather_location, "Sign in to view farm weather")
                views.setTextViewText(R.id.widget_weather_badge, "LOCKED")
                views.setTextViewText(R.id.widget_weather_temp, "--°C")
                views.setTextViewText(R.id.widget_weather_condition, "🔒 Authentication Required")
                views.setTextViewText(R.id.widget_weather_hilo, "Open app to log in")
                views.setTextViewText(R.id.widget_weather_humidity, "💧 --")
                views.setTextViewText(R.id.widget_weather_rain, "🌧️ --")
                views.setTextViewText(R.id.widget_weather_wind, "💨 --")
                views.setTextViewText(R.id.widget_weather_updated, "Session closed · Tap to authenticate")
            } else {
                val location = prefs.getString("location", "Warangal Rural, Telangana") ?: "Warangal Rural, Telangana"
                val temp = prefs.getString("temp", "27°C") ?: "27°C"
                val status = prefs.getString("status", "LIVE") ?: "LIVE"
                val condition = prefs.getString("condition", "☀️ Spray Window: SAFE") ?: "☀️ Spray Window: SAFE"
                val hilo = prefs.getString("hilo", "H: 31°C · L: 21°C") ?: "H: 31°C · L: 21°C"
                val humidity = prefs.getString("humidity", "💧 71%") ?: "💧 71%"
                val rain = prefs.getString("rainfall", "🌧️ 0 mm") ?: "🌧️ 0 mm"
                val wind = prefs.getString("wind", "💨 9 km/h") ?: "💨 9 km/h"
                val updated = prefs.getString("updated", "Open-Meteo API · Updated just now · Tap to open")
                    ?: "Open-Meteo API · Updated just now · Tap to open"

                views.setTextViewText(R.id.widget_weather_location, location)
                views.setTextViewText(R.id.widget_weather_badge, if (status == "LIVE") "⚡ LIVE" else "📁 CACHED")
                views.setTextViewText(R.id.widget_weather_temp, temp)
                views.setTextViewText(R.id.widget_weather_condition, condition)
                views.setTextViewText(R.id.widget_weather_hilo, hilo)
                views.setTextViewText(R.id.widget_weather_humidity, humidity)
                views.setTextViewText(R.id.widget_weather_rain, rain)
                views.setTextViewText(R.id.widget_weather_wind, wind)
                views.setTextViewText(R.id.widget_weather_updated, updated)
            }

            // Deep-link PendingIntent to open Home / Weather screen
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse("nukrop://screen/home")
                putExtra("EXTRA_TARGET_SCREEN", "home")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getActivity(context, 2001, intent, flags)
            views.setOnClickPendingIntent(R.id.widget_weather_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
