# NuKropAI — Phase 13 Full Product Architecture Audit

**Project:** NuKropAI Sovereign Agrarian Operating System  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Base Commit:** `ce7fe1c`  
**Pull Request #2:** OPEN & UNMERGED (Target: `main`)  
**Auditor:** Lead Architect & Senior Engineering Team  
**Date:** November 2026  

---

## 1. Executive Summary & Architecture Topology

NuKropAI is architected as a hybrid sovereign agrarian platform supporting physical Android devices, web browsers, and backend services. The system comprises five distinct architectural layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NUKROPAI SURFACES                              │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. Android Native & Hybrid Engine  │ 2. Web Portal & Landing Dashboard  │
│    - Kotlin: MainActivity.kt       │    - Vite 4 + React 18 + TS        │
│    - DriverLocationService.kt      │    - DPDP Legal & Privacy Modals   │
│    - Assets: index.html (40k LOC)  │    - Real APK Release Sync Engine  │
│    - AndroidBridge (GPS, Cam, Pkg) │    - Command Menu & Skeleton       │
├───────────────────────────────────┴────────────────────────────────────┤
│ 3. Enterprise Backend Services (Node.js / Fastify / TypeScript)        │
│    - JWT Authentication Security Controller & Middleware               │
│    - Agmarknet Live Ingestion & Data Gov Cache Pipeline                │
│    - State-Preserving In-Memory Resilient Database Fallback            │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Supabase Database & Security Fabric                                 │
│    - PostgreSQL with PostGIS Geography (ST_DWithin, ST_MakePoint)      │
│    - Server-Authoritative RLS Policies across 14 Core Tables           │
│    - Realtime Broadcast Channels (driver-tracking, haul-dispatches)     │
│    - Atomic RPC Functions (upsert_driver_location, accept_haul_booking)│
├────────────────────────────────────────────────────────────────────────┤
│ 5. Isolated Safety Boundary & Simulation Harness                       │
│    - target_validator.py: Fail-Closed Protection for yxjqseiegwjdfnccdchk│
│    - MiroFish Multi-Agent Adapter & k6 Load Tests                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Surface Authority Matrix
To prevent divergence across the multiple surfaces, authoritative ownership is established as follows:

| Feature Domain | Authoritative Surface | Secondary / Mirror Surface | Synchronization Mechanism |
| :--- | :--- | :--- | :--- |
| **Full Agricultural OS (18 Views)** | `app/src/main/assets/index.html` | `nukrop_emulator.html` | 100% SHA-256 byte parity enforced via `test_onboarding_and_splash_flows.js` |
| **Native GPS & Background Service** | `DriverLocationService.kt` | `WebAppInterface` in `MainActivity.kt` | `window.AndroidBridge.startDriverLocationService()` |
| **Camera & File Capture** | `MainActivity.kt` WebChromeClient | Local `navigator.mediaDevices` fallback | `onShowFileChooser` + FileProvider |
| **Web Marketing, APK Download & Legal** | `web/src/` (Vite + React) | Root `index.html` / `nukrop_emulator.html` | Dedicated client web routing |
| **Enterprise Auth & Batch Mandi Sync**| `backend/src/` (Fastify + TS) | Edge functions & direct Supabase client | REST API & Agmarknet ingestion pipeline |

---

## 2. Complete 18-Feature Product Inventory & Status Audit

All 18 core application views and functional subsystems were audited and classified according to the Phase 13 operational criteria:
- **`VERIFIED WORKING`**: UI complete, interaction functional, backend integration active or resiliently cached, RLS verified, tests pass.
- **`PARTIALLY WORKING`**: UI complete, interactive logic functional, requires optional external API key for cloud intelligence.
- **`BLOCKED BY EXTERNAL DEPENDENCY`**: Fully implemented in code, but requires physical device hardware or isolated external cloud instance.
- **`BROKEN`**: Implementation throws fatal runtime errors (0 in current tree).
- **`MISSING`**: Feature declared in mock UI without underlying engine (0 in current tree).

### Feature Inventory Table

| ID | Feature Name | Primary Implementation | Backend Dependency | Status | Missing / Required Enhancements | Required Tests | Priority |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **F01** | **App Startup & Splash** | `renderSplashScreen()`, `advanceSlide()` | Local state, no network required | **VERIFIED WORKING** | Add reduced-motion CSS bypass | `test_onboarding_and_splash_flows.js` (OS.1-5) | P0 |
| **F02** | **Multi-Step Onboarding** | `renderPlantixFlow()`, `OnboardingFlow.kt` | `localStorage`, Supabase Auth | **VERIFIED WORKING** | Persist farm size and units | `test_onboarding_and_splash_flows.js` (OS.6-10) | P0 |
| **F03** | **Auth & Role Identity** | `NuKropRoleGuard`, Supabase Auth | Supabase GoTrue, RLS policies | **VERIFIED WORKING** | Prevent cross-role screen access | `test_role_integrity_anti_loophole.js`, `test_jwt_auth_security.js` | P0 |
| **F04** | **Home Command Center** | `APP_VIEWS.home()`, `updateWeatherCardDom()` | Supabase, OpenWeather, Agmarknet | **VERIFIED WORKING** | Add shimmer skeletons for async cards | `run_e2e_tests.js` (T4.1) | P0 |
| **F05** | **AI Crop Scanner** | `APP_VIEWS.scanner()`, `startScannerDiagnostic()` | Gemini Vision AI, ICAR pathology DB, Supabase `disease_scans` | **PARTIALLY WORKING** | Cloud Vision requires `GEMINI_API_KEY`; fallback to ICAR DB is 100% active | `adversarial_stress_r2_r4.js`, `test_inspect_modals.py` | P0 |
| **F06** | **Outbreak BioShield Radar** | `APP_VIEWS.bioshield()`, `fetchDynamicPestAlerts()` | Supabase telemetry, Regional Pest Matrix | **VERIFIED WORKING** | Configurable economic threshold limits | `verify_milestone2_pest_alerts.js` | P1 |
| **F07** | **Live Mandi Intelligence** | `APP_VIEWS.market()`, `fetchRealMandiRatesLive()` | Agmarknet (data.gov.in), Supabase PostGIS, daily cache | **VERIFIED WORKING** | Display data freshness badge & cache indicator | `adversarial_stress_r2_r4.js`, `test_mandi_strict_location_lock.js` | P0 |
| **F08** | **GramHaul Dispatch** | `APP_VIEWS.gramhaul()`, `GramHaulEngine.kt` | Supabase `truck_listings`, `haul_bookings`, RPCs | **VERIFIED WORKING** | Map Leaflet tiles render smoothly | `verify_milestone1_gramhaul.js`, `run_e2e_tests.js` (T4.2) | P0 |
| **F09** | **Live Driver GPS Tracking** | `APP_VIEWS.gramhaul_tracking()`, `DriverLocationService` | Supabase Realtime, Android Location Manager, PostGIS | **VERIFIED WORKING** | Inactivity timeout & stale ping prune | `test_m2_challenger_telemetry_stress.js` | P0 |
| **F10** | **Driver Cockpit & Duty** | `APP_VIEWS.driver_dashboard()` | Supabase `driver_telemetry`, `driver_locations` | **VERIFIED WORKING** | OTP PIN verification modal integration | `test_m2_adversarial_critic.js` | P0 |
| **F11** | **Equipment Rental Hub** | `APP_VIEWS.equipment()`, `YantraShareEngine.kt` | Supabase `equipment_listings`, `equipment_bookings` | **VERIFIED WORKING** | CHC dispatch pass generation | `test_inspect_modals.py` | P1 |
| **F12** | **Community & Farmer Social**| `APP_VIEWS.community()`, `CommunityScreen.kt` | Supabase `community_posts`, `community_stories`, `post_likes` | **VERIFIED WORKING** | Media upload (image/video) and follow counts | `test_community_stories_and_real_posts.js` | P1 |
| **F13** | **AI Agronomist Copilot** | `APP_VIEWS.chat()`, `callGroqAI()` | Groq / Gemini LLM API, local agronomy rules | **PARTIALLY WORKING** | Cloud LLM requires API key; PJTSAU advisory rule engine is active | `run_e2e_tests.js` (T1.9) | P1 |
| **F14** | **Govt Schemes & Subsidies** | `APP_VIEWS.loan()`, `SubsidiesApiService.kt` | GOVT_SCHEMES_CATALOG, PM-KISAN, NABARD KCC | **VERIFIED WORKING** | Pre-approved credit limit & document checklist | `test_inspect_modals.py` | P1 |
| **F15** | **Farm Khata Ledger** | `APP_VIEWS.khata()`, `FarmKhataScreen.kt` | `farmKhataEntries`, Supabase `khata_transactions` | **VERIFIED WORKING** | Seasonal P&L calculation & crop tagging | `test_inspect_modals.py` | P1 |
| **F16** | **AgriStack & Land Records** | `APP_VIEWS.agristack()`, `AgriStackPassportScreen.kt` | Digital Public Infrastructure (DPI) RoR | **VERIFIED WORKING** | Survey number search & land title verification | `test_inspect_modals.py` | P1 |
| **F17** | **Scientific Dosage Calculators** | `APP_VIEWS.calc_fert()`, `calc_pest()`, `calc_budget()` | ICAR NPK ratios, CIB&RC dilution tables | **VERIFIED WORKING** | Dynamic acre/hectare/gunta unit conversion | `CalculatorsAndOnboardingTest.kt` | P1 |
| **F18** | **Farmer Profile & Identity** | `APP_VIEWS.profile()`, `ProfileScreen.kt` | Supabase Auth, `profiles` table | **VERIFIED WORKING** | Role switching with clean session purge | `adversarial_runtime_live_eval.js` | P0 |

---

## 3. Native Android Engine & Bridge Architecture

### 3.1 Android Manifest & Permissions (`app/src/main/AndroidManifest.xml`)
The Android application requests minimal necessary permissions with optional hardware fallbacks:
- `android.permission.INTERNET`: Core communication with Supabase and government data sources.
- `android.permission.CAMERA`: Optional for Crop Scanner (camera hardware marked `required="false"`).
- `android.permission.ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION`: For APMC Mandi geolocation and driver proximity.
- `android.permission.FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_LOCATION`: For background driver tracking with system notification.
- `android.permission.POST_NOTIFICATIONS`: Android 13+ push notifications for severe pest alerts.
- `android.permission.GET_ACCOUNTS`: For device Google Account picker.

### 3.2 Foreground Driver Service (`app/src/main/java/com/example/DriverLocationService.kt`)
The driver tracking subsystem runs as an Android Foreground Service with type `location`:
- Posts persistent notification on channel `nukrop_driver_dispatch`.
- Broadcasts real hardware GPS fixes to the WebView via Javascript bridge.
- Automatically cleans up and shuts down when the driver goes OFF DUTY or completes a trip.

### 3.3 Native Bridge (`MainActivity.kt: WebAppInterface`)
Exposes safe JavaScript bindings to the WebView:
```kotlin
@JavascriptInterface fun requestDeviceLocation()
@JavascriptInterface fun requestLocationPermission()
@JavascriptInterface fun requestCameraPermission()
@JavascriptInterface fun requestNotificationPermission()
@JavascriptInterface fun startDriverLocationService(driverId, driverName, vehiclePlate, vehicleType)
@JavascriptInterface fun stopDriverLocationService()
@JavascriptInterface fun openDialer(phoneNumber)
@JavascriptInterface fun openExternalUrl(url)
@JavascriptInterface fun postSystemNotification(title, message)
@JavascriptInterface fun pickDeviceGoogleAccount()
```

---

## 4. Web Landing & Portal Engine (`web/`)

The web frontend located in `web/` provides:
- High-performance marketing portal built with Vite 4 + React 18.
- Comprehensive DPDP Act 2023 compliance with Privacy Policy, Terms, Cookie Preferences, and Refund Notices.
- Command Menu (`Ctrl+K` / `Cmd+K`) for fast keyboard navigation.
- Automatic APK Release Synchronization (`sync-apk.js`): Syncs production release APK (`app-release.apk`, 35.5 MB) to public endpoints (`NuKropAI.apk`, `NuKropAI_v2.0.apk`, `NuKropAI_latest.apk`).
- Builds with zero TypeScript or Vite errors (`npm --prefix web run build` completes in ~5s).

---

## 5. Security Architecture & RLS Review

### 5.1 PostgREST & PostgreSQL RLS Enforcement
- **`profiles`**: Sensitive columns (`phone`, `agristack_id`, `kcc_balance`) are strictly owner-restricted. Non-sensitive profile data is exposed only via `public_profiles` view with zero mutations.
- **`truck_listings` & `haul_bookings`**: All mutations enforce `auth.uid() = driver_id` or `auth.uid() = farmer_id`.
- **`driver_telemetry`**: INSERT/UPDATE restricted to authenticated driver; SELECT enforces active booking association and a 24-hour expiration window.
- **`storage.objects`**: The `crop-scans` bucket is marked private (`public = false`) with cryptographic signed URL downloads.

### 5.2 Fail-Closed Target Protection
- Simulations and load tests strictly reject `https://yxjqseiegwjdfnccdchk.supabase.co` through `target_validator.py`.
- Automated test scripts (`test_phase8_two_account_acceptance.py`, `test_phase9_reconnection_and_telemetry.py`) fail-closed if targeted at production.
