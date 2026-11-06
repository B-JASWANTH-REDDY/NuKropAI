# NuKropAI — Master Defect Register
**Document ID**: `docs/audit/MASTER_DEFECT_REGISTER.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Branch**: `main`  
**Audit Date**: 2026-10-16  
**Auditor**: Principal Integration & Quality Assurance Lead  

---

## 1. Defect Inventory & Remediation Matrix

| Defect ID | Component | Severity | Defect Description | Root Cause | Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | `MandiApiService.kt`, `mandi_pipeline_sync.py`, `MandiSyncService.ts` | **Critical** | Private Government Agmarknet API key embedded in active source code and client bundles. | Key hardcoded as string literal in client & scripts instead of strict server environment variables. | **FIXED** | Key removed from Kotlin & TS sources; replaced with `process.env.GOVT_API_KEY` and Supabase DB proxy. |
| **DEF-02** | `backend/mandi_pipeline_sync.py` | **Critical** | Ingestion pipeline executed `TRUNCATE TABLE public.mandi_live_rates;` on every run, destroying all historic and non-updated market data. | Destructive table wipe was used as a shortcut before bulk insert. | **FIXED** | Replaced with transactional staging table (`CREATE TEMP TABLE stage_mandi_live_rates`) and targeted upsert. Unit test `test_empty_records_does_not_modify_database` passed. |
| **DEF-03** | `.github/workflows/mandi_scheduler.yml` & `mandi_pipeline_sync.py` | **High** | Daily scheduled workflow ran for 6 hours before being cancelled by GitHub Actions timeout. | Script contained a continuous `while True: sleep(4h)` daemon loop inside a short-lived scheduled cron action. | **FIXED** | Converted to single-run execution with `--daemon` flag option; added `timeout-minutes: 15` in workflow. All 10 historical failures reproduced from `gh run list`. |
| **DEF-04** | `backend/src/workers/jobs/mandiIngestion.ts` | **Critical** | Background worker inserted hardcoded simulated prices (Wheat: ₹2150, Onion: ₹2000) into production DB. | Mock array used as placeholder fallback in ingestion worker. | **FIXED** | Removed simulated array; implemented authentic Agmarknet API adapter, schema validation, 30-day baseline anomaly detection, and post-commit cache invalidation. |
| **DEF-05** | `app/build.gradle.kts` & `web/sync-apk.js` | **Critical** | Debug APK was automatically copied to public production download filenames (`NuKropAI.apk`, `NuKropAI_latest.apk`). | `maxByOrNull { lastModified() }` candidate selection preferred newest debug builds; release signing defaulted to debug keystore. | **FIXED** | `build.gradle.kts` bound `syncApkToWeb` exclusively to `assembleRelease`; `sync-apk.js` only promotes verified release artifacts and isolates debug builds to `NuKropAI_debug.apk`. |
| **DEF-06** | `gradle.properties` & `.github/workflows/android.yml` | **High** | Android CI failed on 100% of pushes on GitHub Actions Ubuntu runners. | Hardcoded Windows JBR path `org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr` committed to repo. | **FIXED** | Removed hardcoded property from `gradle.properties`. Gradle uses environment `JAVA_HOME` cleanly across both Windows and Linux CI. |
| **DEF-07** | `backend/package.json` | **Medium** | Repository included `firebase-admin` dependency violating zero-Firebase architectural constraint. | Legacy package remnant in backend `package.json`. | **FIXED** | Removed `firebase-admin`; verified zero references in `backend/src/`; lockfile synchronized. |
| **DEF-08** | `supabase/CANONICAL_PRODUCTION_SETUP.sql` | **Critical** | Script created hardcoded dummy farmer `NK-87621`, dropped all existing foreign keys, and applied permissive `USING (true)` RLS bypasses. | Monolithic setup script attempted to force visual ERD lines and convenience access without regard to data isolation. | **FIXED** | Removed dummy user; replaced permissive RLS with user-isolated RLS (`auth.uid()::text = user_id`); eliminated destructive constraints drops. |
| **DEF-09** | `app/src/main/java/com/example/UpdateManager.kt` | **High** | App crashed with `RuntimeException` when checking for updates. | `Toast.makeText().show()` invoked directly on background thread (`Dispatchers.IO`) without Looper. | **FIXED** | Wrapped Toast invocation in `withContext(Dispatchers.Main)`; corrected repo slug to `B-JASWANTH-REDDY/NuKropAI`. |
| **DEF-10** | `SavedReportsScreen.kt` & `DiseaseScannerScreen.kt` | **Medium** | File querying and saving crashed on Android < 10 (API < 29). | `MediaStore.Files.FileColumns.RELATIVE_PATH` queried unconditionally, but was only introduced in API 29. | **FIXED** | Added `Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q` check before referencing `RELATIVE_PATH`. |
| **DEF-11** | `DiseaseScannerScreen.kt` | **Medium** | Full uncompressed CameraX images (15MB-30MB) sent to AI API, risking OOM crashes and HTTP 413. | Raw byte stream passed directly to Base64 encoder without downsampling. | **FIXED** | Added `compressAndDownsampleImage` downsampling to max 1024x1024 / JPEG 85% before base64 encoding. |
| **DEF-12** | `app/src/main/java/com/example/MarketScreen.kt` | **Medium** | Screen displayed unsubstantiated `"7-Day AI Price Forecast"` with fixed `1.054` multiplier and `"BEST DAY TO SELL: THURSDAY"`. | Static speculative claim hardcoded in UI. | **FIXED** | Relabeled to "Market Trend & Estimates" with documented econometric baseline or pest outbreak impact models; removed arbitrary Thursday claim. |
| **DEF-13** | `app/src/main/java/com/example/MarketScreen.kt` | **Medium** | Screen displayed green "Live Cached" badge even during loading, offline, or network errors. | Static Badge markup ignored actual `MandiState`. | **FIXED** | Connected badge to reactive `MandiState`: "Live APMC" (green), "Cached Offline" (orange), "Feed Offline" (red), "Updating..." (accent). |
| **DEF-14** | `backend/src/` | **High** | Backend failed TypeScript compilation (`npm run build` returned exit code 1). | Typo import paths in `RuleEngine.ts`, OpenTelemetry `Resource` type misuse in `Tracing.ts`, and Fastify websocket typing. | **FIXED** | Fixed relative import paths, adopted `resourceFromAttributes`, and cast websocket route. `npm --prefix backend run build` completed with 0 errors. |

---

## 2. Quantitative Summary
- **Total Defects Identified**: 14
- **Total Defects Remediated**: 14 (100%)
- **Critical Severity Defects**: 5 (All Fixed)
- **High Severity Defects**: 4 (All Fixed)
- **Medium Severity Defects**: 5 (All Fixed)
- **Remaining Open Defects**: 0
