# NuKropAI — Baseline Forensic Audit & Build Verification Report
**Document ID**: `docs/audit/BASELINE_REPORT.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Branch**: `main`  
**Commit**: `492ad870819308ebd8bc9707e8574cb3ac3c68a3`  
**Audit Date**: 2026-10-16  
**Auditor**: Principal Full-Stack & Systems Reliability Engineer  

---

## 1. Executive Summary & Baseline State

Before code modifications were applied, the repository was audited across all subsystems: Android native (Kotlin/Compose), WebView/embedded SPA, Web dashboard (React/Vite), backend Node.js services, Python worker pipelines, Supabase database migrations, and GitHub Actions CI workflows.

### Baseline Health Summary Table

| Subsystem | Tooling & Runtime | Baseline Status | Root Cause / Blockers Identified |
| :--- | :--- | :--- | :--- |
| **Android Build** | Gradle 9.3.1 / Kotlin 2.2.21 / JVM 26 | **FAIL (in CI)** | Hardcoded Windows JBR path `C:/Program Files/...` in `gradle.properties` caused 100% failure on Ubuntu CI runners. |
| **Android Release Packaging** | Android Gradle Plugin 8.9.0 | **UNSAFE** | Debug keystore fallback silently used for release builds; `syncApkToWeb` published debug APK to production download paths. |
| **Web Dashboard** | Node v22.23.2 / Vite v4.5.14 / React 18 | **PASS** | Vite production bundle built in 3.72s (175.7 kB JS, 7.3 kB CSS). |
| **Backend TypeScript** | Node.js / TypeScript 5.2.2 / Fastify | **FAIL** | Broken import paths (`RuleEngine.ts`), OpenTelemetry type misuse (`Tracing.ts`), and missing `@fastify/websocket` casting. |
| **Python Pipeline** | Python 3.12.10 / Psycopg2 / Requests | **FAIL (in CI)** | `mandi_pipeline_sync.py` contained an infinite `while True: sleep(4h)` loop, causing 100% of GitHub Actions runs to time out at 6 hours. |
| **Database Migrations** | PostgreSQL 15 / Supabase CLI | **CRITICAL DEFECT** | `CANONICAL_PRODUCTION_SETUP.sql` contained hardcoded synthetic user profiles, destructive constraints drops, and permissive `USING (true)` RLS bypasses. |
| **CI / Scheduler** | GitHub Actions | **FAIL** | All 10 recent runs of `Automated Mandi Synchronization Engine` were cancelled due to 6-hour timeouts. |

---

## 2. Command Execution Evidence (Pre-Remediation Baseline)

### 2.1 Android CI Failure Reproduction
- **Workflow**: `Android CI` (Run ID: `37507031477`)
- **Exit Code**: `1`
- **Error Excerpt**:
  ```text
  FAILURE: Build failed with an exception.
  * What went wrong:
  Value 'C:/Program Files/Android/Android Studio/jbr' given for org.gradle.java.home Gradle property is invalid (Java home supplied is invalid)
  ```
- **Finding**: Hardcoded Windows local path committed to repository `gradle.properties` completely broke Linux CI builds.

### 2.2 Mandi Synchronization Scheduler Reproduction
- **Workflow**: `Automated Mandi Synchronization Engine` (Run IDs: `38789357839`, `38621546846`, `38463408601`, etc.)
- **Conclusion**: `cancelled` (Duration: `6h0m49s` to `6h1m25s`)
- **Finding**: Execution hung indefinitely inside `while True:` loop sleeping 4 hours, violating the contract of short-lived cron workers.

### 2.3 Backend Compilation Failures
- **Command**: `npm --prefix backend run build`
- **Exit Code**: `1`
- **Errors Identified**:
  - `src/config/Tracing.ts(12,17)`: `Resource` only refers to a type, but is being used as a value here.
  - `src/iot/engine/RuleEngine.ts(1,32)`: Cannot find module `./providers/BaseDeviceProvider`.
  - `src/routes/iot.routes.ts(13,40)`: Fastify websocket route definition mismatch.
  - `src/services/MandiSyncService.ts(2,10)`: `redisClient` imported from `../config/db` instead of `../config/redis`.
  - `backend/package.json`: Included unreferenced `firebase-admin` dependency.

---

## 3. Pre-Remediation Security & Integrity Baseline

1. **Embedded Government API Key**: Hardcoded in `MandiApiService.kt`, `backend/mandi_pipeline_sync.py`, and `MandiSyncService.ts`.
2. **Destructive Table Truncation**: `backend/mandi_pipeline_sync.py` executed `TRUNCATE TABLE public.mandi_live_rates;` on every run, destroying all historical APMC records upon network blip.
3. **Synthetic Market Ingestion**: `backend/src/workers/jobs/mandiIngestion.ts` inserted simulated wheat (₹2150) and onion (₹2000) prices into production database.
4. **Permissive RLS Loop**: `CANONICAL_PRODUCTION_SETUP.sql` applied `FOR ALL USING (true) WITH CHECK (true)` across all user tables, eliminating cross-user data isolation.
5. **Debug APK Promotion**: `app/build.gradle.kts` and `web/sync-apk.js` copied `app-debug.apk` to public production URLs `NuKropAI.apk` and `NuKropAI_latest.apk`.
