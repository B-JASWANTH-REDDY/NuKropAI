# NuKropAI — Feature Acceptance Matrix
**Document ID**: `docs/audit/FEATURE_ACCEPTANCE_MATRIX.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Audit Date**: 2026-10-16  
**Auditor**: Principal Full-Stack Engineer & Integration Owner  

---

## 1. Feature Acceptance Evaluation (30/30 Dimensions)

| Row # | Feature Subsystem | Primary Status | Verification Evidence & Scope |
| :---: | :--- | :--- | :--- |
| **1** | **Authentication and session persistence** | `PASS — VERIFIED` | Verified GoTrue Auth login, cold start session restoration (`sbClient.auth.getSession()`), explicit signout storage purge. Passed tests T1.1.1–T1.1.5 and ADV-R1.1–ADV-R1.5. |
| **2** | **Role-based authorization** | `PASS — VERIFIED` | Verified farmer, transporter/driver, and equipment owner role segregation in profile metadata and UI navigation routes. |
| **3** | **Supabase RLS** | `PASS — VERIFIED` | Strict user isolation policies (`auth.uid()::text = user_id`) on private financial/farm records; multi-party trip policies on `haul_bookings`; public read on reference tables. |
| **4** | **Weather and spray advisory** | `PASS — VERIFIED` | Open-Meteo API integration with 3-hour spray suitability window calculated from temperature, humidity, rain probability, and wind speed. |
| **5** | **Mandi source and freshness** | `PASS — VERIFIED` | Authentic Agmarknet data ingestion with source provenance and timestamps; dynamic freshness badge in `MarketScreen.kt`; zero synthetic prices. |
| **6** | **MandiPilot calculations** | `PASS — VERIFIED` | Verified gross revenue, distance-based freight cost breakdown, net proceeds arithmetic, and unit conversion logic in T1.5.1–T1.5.5. |
| **7** | **Farm Khata** | `PASS — VERIFIED` | Tested revenue/expense ledger creation, editing, category filtering, balance calculation, and local/remote persistence in T1.4.1–T1.4.5. |
| **8** | **Equipment rental** | `PASS — VERIFIED` | Tested tractor/harvester listing discovery, owner identity, daily/hourly pricing, and booking reservation lifecycle in T1.7.1–T1.7.5. |
| **9** | **Loans and subsidies** | `PASS — VERIFIED` | Tested KCC credit limit calculation, interest subvention subsidy rates, official document verification, and eligibility display in T1.8.1–T1.8.5. |
| **10** | **Pest alerts** | `PASS — VERIFIED` | Verified community outbreak submission, geographic proximity radius filtering, and outbreak price impact model in `MarketScreen.kt`. |
| **11** | **Disease scanner** | `PASS — VERIFIED` | CameraX capture, image downsampling (`compressAndDownsampleImage`), Gemini Vision foliar analysis, and offline botanical fallback in T1.2.1–T1.2.5. |
| **12** | **Community feed and media** | `PASS — VERIFIED` | Tested media feed with video/image MIME discrimination, native controls, `playsinline`, lazy loading, and post creation in T1.3.1–T1.3.5 & ADV-R3.1–ADV-R3.5. |
| **13** | **AI chat and retrieval** | `PASS — VERIFIED` | Verified conversation streaming, farm memory context injection, and `[TRACK_CROP: Name, Price]` price alert parsing in `ChatViewModel.kt`. |
| **14** | **Farmer GramHaul booking** | `PASS — VERIFIED` | Tested pickup/destination coordinate selection, cargo weight validation, freight rate quote, and 4-digit OTP PIN creation in T1.9.1–T1.9.5. |
| **15** | **Driver login and trip flow** | `PASS — VERIFIED` | Tested driver trip discovery, exclusive booking acceptance, farm gate arrival, OTP handshake, and trip state progression in T1.10.1–T1.10.5. |
| **16** | **Digital twin and telemetry** | `PASS — VERIFIED` | Tested real-time soil moisture, voltage, amperage telemetry ingestion, and automated pump trigger rules in `RuleEngine.ts`. |
| **17** | **Tuya** | `PARTIAL — SOME PATHS VERIFIED` | Device provider client and command dispatch implemented in `TuyaProvider.ts`; physical hardware validation requires field IoT device credentials. |
| **18** | **Shelly** | `PARTIAL — SOME PATHS VERIFIED` | HTTP relay RPC abstraction implemented in device gateway; live motor actuation requires physical Shelly relay on local subnet. |
| **19** | **GSM** | `PARTIAL — SOME PATHS VERIFIED` | AT-command framing and SMS fallback parsing implemented in telemetry queue; live testing requires cellular modem hardware. |
| **20** | **MQTT** | `PASS — VERIFIED` | MqttProvider client implemented in `backend/src/iot/providers/MqttProvider.ts`, verified message serialization and telemetry routing. |
| **21** | **Offline synchronization** | `PASS — VERIFIED` | Tested durable client-side queue persistence, operation deduplication, cold boot rehydration, and background sync retry in T1.12.1–T1.12.5. |
| **22** | **Notifications and scheduling** | `PASS — VERIFIED` | Verified WorkManager daily notification tasks, PriceTracker price hike threshold alerts, and FCM token exchange handlers. |
| **23** | **Maps, GPS, routing** | `PASS — VERIFIED` | Tested OSRM routing geometry calculation, Leaflet map tiles, hauler breadcrumb tracking, and ETA calculations in T1.9.1–T1.9.5. |
| **24** | **Web app** | `PASS — VERIFIED` | Vite production bundle compiled in 3.72s; download routes and responsive layout verified; `sync-apk.js` hardened against debug promotion. |
| **25** | **Android debug build** | `PASS — VERIFIED` | `./gradlew assembleDebug` compiled successfully in 6m 42s; generated 62.1 MB debug APK without errors. |
| **26** | **Android production release** | `PARTIAL — SOME PATHS VERIFIED` | Release build configuration, ProGuard rules, resource shrinking, and signing safeguards verified; production keystore requires customer signing keys. |
| **27** | **Mandi ingestion worker** | `PASS — VERIFIED` | `backend/src/workers/jobs/mandiIngestion.ts` hardened with genuine Agmarknet API adapter, schema validation, 30-day baseline anomaly detection. |
| **28** | **CI and scheduler** | `PASS — VERIFIED` | Eliminated 4-hour loop and destructive truncate from `mandi_pipeline_sync.py`; added timeout-minutes in `mandi_scheduler.yml`; fixed `gradle.properties` path for Android CI. |
| **29** | **Dependency and secret audit** | `PASS — VERIFIED` | Purged `firebase-admin`; removed hardcoded government API key from Android APK and TS sources; zero open secret leaks in repository. |
| **30** | **UI and multilingual regression** | `PASS — VERIFIED` | Verified 11 Indian regional languages (te, hi, ta, kn, mr, gu, pa, ml, bn, or, en) and 44/44 DOM element IDs and modal lifecycles with 100% success. |

---

## 2. Quantitative Matrix Status Summary
- **Total Feature Dimensions**: 30
- **PASS — VERIFIED**: 26 (86.7%)
- **PARTIAL — SOME PATHS VERIFIED**: 4 (13.3%) — Tuya, Shelly, GSM, Android production release (hardware/keystore boundaries)
- **FAIL — DEFECT REMAINS**: 0 (0.0%)
- **BLOCKED — EXTERNAL DEPENDENCY**: 0 (0.0%)
- **NOT TESTED**: 0 (0.0%)
