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

class MandiWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_MANDI_UPDATED || action == ACTION_LOGOUT) {
            updateAllWidgets(context)
        }
    }

    companion object {
        const val PREFS_NAME = "nukrop_mandi_widget"
        const val ACTION_MANDI_UPDATED = "com.example.widget.ACTION_MANDI_UPDATED"
        const val ACTION_LOGOUT = "com.example.widget.ACTION_LOGOUT"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
            val componentName = ComponentName(context, MandiWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isLoggedOut = prefs.getBoolean("is_logged_out", false)
            val views = RemoteViews(context.packageName, R.layout.widget_mandi)

            if (isLoggedOut) {
                views.setTextViewText(R.id.widget_mandi_market, "Sign in to view Mandi Bhav")
                views.setTextViewText(R.id.widget_mandi_badge, "LOCKED")
                views.setTextViewText(R.id.widget_mandi_crop, "Commodity Rates")
                views.setTextViewText(R.id.widget_mandi_variety, "🔒 Authentication Required")
                views.setTextViewText(R.id.widget_mandi_price, "₹ --")
                views.setTextViewText(R.id.widget_mandi_unit, "")
                views.setTextViewText(R.id.widget_mandi_range, "Open app to log in")
                views.setTextViewText(R.id.widget_mandi_arrivals, "")
                views.setTextViewText(R.id.widget_mandi_updated, "Session closed · Tap to authenticate")
            } else {
                val market = prefs.getString("market", "Warangal APMC, Telangana") ?: "Warangal APMC, Telangana"
                val crop = prefs.getString("crop", "Cotton (Kapas)") ?: "Cotton (Kapas)"
                val variety = prefs.getString("variety", "Variety: Medium Staple") ?: "Variety: Medium Staple"
                val price = prefs.getString("price", "₹7,480") ?: "₹7,480"
                val unit = prefs.getString("unit", "/ quintal") ?: "/ quintal"
                val range = prefs.getString("range", "📊 Range: ₹7,100 - ₹7,650") ?: "📊 Range: ₹7,100 - ₹7,650"
                val arrivals = prefs.getString("arrivals", "🚜 2,400 Qtl") ?: "🚜 2,400 Qtl"
                val badge = prefs.getString("badge", "🏛️ AGMARKNET") ?: "🏛️ AGMARKNET"
                val updated = prefs.getString("updated", "Agmarknet DMI · Trade Date: 04/11/2026 · Tap to explore")
                    ?: "Agmarknet DMI · Trade Date: 04/11/2026 · Tap to explore"

                views.setTextViewText(R.id.widget_mandi_market, market)
                views.setTextViewText(R.id.widget_mandi_badge, badge)
                views.setTextViewText(R.id.widget_mandi_crop, crop)
                views.setTextViewText(R.id.widget_mandi_variety, variety)
                views.setTextViewText(R.id.widget_mandi_price, price)
                views.setTextViewText(R.id.widget_mandi_unit, unit)
                views.setTextViewText(R.id.widget_mandi_range, range)
                views.setTextViewText(R.id.widget_mandi_arrivals, arrivals)
                views.setTextViewText(R.id.widget_mandi_updated, updated)
            }

            // Deep-link PendingIntent to open Market screen
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse("nukrop://screen/market")
                putExtra("EXTRA_TARGET_SCREEN", "market")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getActivity(context, 2002, intent, flags)
            views.setOnClickPendingIntent(R.id.widget_mandi_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

