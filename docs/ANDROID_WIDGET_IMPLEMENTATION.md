# NuKropAI Native Android Home-Screen Widgets Implementation

**Component**: Native Android AppWidgets (Weather & Mandi Intelligence)  
**Package**: `com.example.widget`  
**Minimum SDK**: 24 (Android 7.0 Nougat)  
**Target SDK**: 36  
**Architecture**: Native Android `AppWidgetProvider` + `RemoteViews` + `SharedPreferences` + `WorkManager`  

---

## 1. Architectural Architecture

NuKropAI provides two functional, native Android home-screen widgets that bridge live agrarian data from the WebView/AndroidBridge engine directly to the user's Android home-screen launcher:

```
┌────────────────────────────────────────────────────────┐
│            Android Home Screen Launcher                │
│   ┌────────────────────────┐  ┌────────────────────┐   │
│   │  Weather AppWidget     │  │  Mandi AppWidget   │   │
│   │  (widget_weather.xml)  │  │  (widget_mandi.xml)│   │
│   └───────────┬────────────┘  └─────────┬──────────┘   │
└───────────────┼─────────────────────────┼──────────────┘
                │ Broadcast onUpdate      │
┌───────────────▼─────────────────────────▼──────────────┐
│           Kotlin AppWidgetProvider Layer               │
│    • WeatherWidgetProvider.kt                          │
│    • MandiWidgetProvider.kt                            │
│    • Reads from encrypted SharedPreferences cache      │
│    • Dispatches deep links: nukrop://screen/*          │
└───────────────▲─────────────────────────▲──────────────┘
                │ SharedPreferences       │ Background Sync
┌───────────────┴────────────┐  ┌─────────┴──────────────┐
│  AndroidBridge (WebView)   │  │   WidgetUpdateWorker   │
│  • updateWeatherWidget()   │  │   • WorkManager 30m    │
│  • updateMandiWidget()     │  │   • Open-Meteo direct  │
│  • clearWidgetData()       │  │   • Zero battery drain │
└────────────────────────────┘  └────────────────────────┘
```

---

## 2. Weather Widget Specification

### Layout (`app/src/main/res/layout/widget_weather.xml`)
- **Background**: `@drawable/widget_weather_bg` (Rich emerald linear gradient `#06281E` → `#114A36`, rounded 20dp).
- **Header**:
  - Brand: `🌱 NuKrop Farm Weather`
  - Location: `@+id/widget_weather_location` (e.g. "Warangal Rural, Telangana").
  - Provenance: `@+id/widget_weather_badge` ("⚡ LIVE" or "📁 CACHED").
- **Center**:
  - Temperature: `@+id/widget_weather_temp` (32sp bold, e.g. "27°C").
  - Condition & Advisory: `@+id/widget_weather_condition` (e.g. "☀️ Spray Window: SAFE").
  - High / Low: `@+id/widget_weather_hilo` ("H: 31°C · L: 21°C").
- **Metrics**:
  - Humidity: `@+id/widget_weather_humidity` ("💧 71%").
  - Rainfall: `@+id/widget_weather_rain` ("🌧️ 0 mm").
  - Wind Speed: `@+id/widget_weather_wind` ("💨 9 km/h").
- **Footer**:
  - Sync Timestamp: `@+id/widget_weather_updated` ("Open-Meteo API · Updated just now · Tap to open").

### Provider (`app/src/main/java/com/example/widget/WeatherWidgetProvider.kt`)
- Extends `android.appwidget.AppWidgetProvider`.
- Responds to `android.appwidget.action.APPWIDGET_UPDATE`, `ACTION_WEATHER_UPDATED`, and `ACTION_LOGOUT`.
- Tapping anywhere on the widget launches `MainActivity` with deep link `nukrop://screen/home`.

---

## 3. Mandi Bhav Widget Specification

### Layout (`app/src/main/res/layout/widget_mandi.xml`)
- **Background**: `@drawable/widget_mandi_bg` (Forest green linear gradient `#052418` → `#0F4A34`, rounded 20dp).
- **Header**:
  - Brand: `📊 NuKrop Mandi Rates`
  - Market & State: `@+id/widget_mandi_market` (e.g. "Warangal APMC, Telangana").
  - Provenance: `@+id/widget_mandi_badge` ("🏛️ AGMARKNET").
- **Center**:
  - Commodity Name: `@+id/widget_mandi_crop` ("Cotton (Kapas)").
  - Variety: `@+id/widget_mandi_variety` ("Variety: Medium Staple").
  - Modal Price: `@+id/widget_mandi_price` (24sp bold green, "₹7,480").
  - Unit: `@+id/widget_mandi_unit` ("/ quintal").
- **Trading Details**:
  - Price Range: `@+id/widget_mandi_range` ("📊 Range: ₹7,100 - ₹7,650").
  - Daily Arrivals: `@+id/widget_mandi_arrivals` ("🚜 2,400 Qtl").
- **Footer**:
  - Source & Date: `@+id/widget_mandi_updated` ("Agmarknet DMI · Trade Date: 04/11/2026 · Tap to explore").

### Provider (`app/src/main/java/com/example/widget/MandiWidgetProvider.kt`)
- Extends `android.appwidget.AppWidgetProvider`.
- Responds to `android.appwidget.action.APPWIDGET_UPDATE`, `ACTION_MANDI_UPDATED`, and `ACTION_LOGOUT`.
- Tapping anywhere on the widget launches `MainActivity` with deep link `nukrop://screen/market`.

---

## 4. Background Refresh & WorkManager Scheduling

- **Worker**: `WidgetUpdateWorker.kt` implements `CoroutineWorker`.
- **Cadence**: Scheduled via `PeriodicWorkRequestBuilder<WidgetUpdateWorker>(30, TimeUnit.MINUTES)` on cold app startup.
- **Network Resilience**: Uses native `HttpURLConnection` with a strict 8-second timeout to fetch live Open-Meteo forecasts for the farmer's stored coordinates without waking the full WebView.
- **Fail-Safe**: If network is disconnected or server times out, marks status as `CACHED` and preserves existing figures without UI flashing.

---

## 5. Security, Logout & Data Isolation

1. **Authentication Privacy**:
   When a user signs out via `executeSignOutToLogin()`, `AndroidBridge.clearWidgetData()` is invoked immediately.
2. **Lockout Display**:
   On logout, both widgets transition into a privacy-preserving state:
   - Location / Market: `"Sign in to view farm weather"` / `"Sign in to view Mandi Bhav"`
   - Values: `"--°C"` / `"₹ --"`
   - Condition: `"🔒 Authentication Required"`
   - Subtext: `"Session closed · Tap to authenticate"`
3. **No Account Leakage**:
   Switching between Farmer A and Farmer B never reveals Farmer A's farm coordinate or crop book in the widget preview.

