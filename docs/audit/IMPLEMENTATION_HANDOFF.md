# NuKropAI Implementation Handoff & Operations Manual

**Document Version**: 2.0 (Post-Remediation Hardened Release)  
**Date**: October 16, 2026  
**Auditor / Integration Owner**: Principal Full-Stack Engineer (Antigravity Team Preview)  
**Target Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Primary Maintainer**: B. JASWANTH REDDY  

---

## 1. System Architecture Overview

NuKropAI is composed of five tightly integrated subsystems:

```
┌────────────────────────────────────────────────────────────────────────┐
│ NuKropAI Unified Agrarian Intelligence Platform                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ Client Interfaces              │ Backing Infrastructure                │
├────────────────────────────────┼───────────────────────────────────────┤
│ 1. Android Kotlin Native App   │ • Supabase Auth (GoTrue)              │
│    (Jetpack Compose + WebView) │ • PostgreSQL 15 + Row Level Security  │
│ 2. React / Vite Web Portal     │ • Supabase Realtime Channels (P2P)    │
│    (Showcase + APK Downloads)  │ • Fastify TypeScript Backend (Port 3000)│
│ 3. Standalone Mobile Emulator  │ • Redis Sentinel (Cache & Rate Limits)│
│    (nukrop_emulator.html)      │ • BullMQ Worker Job Queue             │
│                                │ • Scheduled Python Ingestion Worker   │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Environment Variables & Secret Configuration

### 2.1 Backend Environment (`backend/.env`)
Create `backend/.env` using `.env.example` as a template:
```ini
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Supabase Platform
SUPABASE_URL=https://yxjqseiegwjdfnccdchk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... # KEEP PRIVATE - Server-side only!
SUPABASE_ANON_KEY=eyJhbGciOi...

# Redis Cache
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Agricultural AI Diagnostic Services
GROQ_API_KEY=gsk_...

# Government Mandi Rates
AGMARKNET_API_KEY=579b464...
```

### 2.2 Web Environment (`web/.env.production`)
Create `web/.env.production`:
```ini
VITE_API_URL=https://api.nukropai.com
VITE_SUPABASE_URL=https://yxjqseiegwjdfnccdchk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 2.3 Scheduled Pipeline Secrets (GitHub Actions Secrets)
Configure under GitHub Repository Settings -> Secrets and variables -> Actions:
- `GOVT_API_KEY`: Official Data.gov.in / Agmarknet API key.
- `DB_CONNECTION_STRING`: PostgreSQL connection URI (`postgresql://postgres:[PASSWORD]@db.yxjqseiegwjdfnccdchk.supabase.co:5432/postgres`).

---

## 3. Database Setup & Migration Runbook

The database schema has been verified and hardened in `supabase/CANONICAL_PRODUCTION_SETUP.sql`.

### Safe Execution Steps
1. Navigate to the [Supabase Dashboard](https://supabase.com/dashboard/project/yxjqseiegwjdfnccdchk/sql).
2. Open the **SQL Editor**.
3. Paste the contents of `supabase/CANONICAL_PRODUCTION_SETUP.sql`.
4. Review the script:
   - Zero `TRUNCATE` or `DROP TABLE` statements.
   - All table creations use `CREATE TABLE IF NOT EXISTS`.
   - All profile defaults are non-synthetic.
   - All RLS policies enforce `auth.uid() = user_id`.
5. Execute the script.
6. Verify table creation:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```
   Ensure `profiles`, `farms`, `farm_khata`, `crop_scans`, `equipment_listings`, `equipment_bookings`, `community_posts`, `rides`, `mandi_live_rates`, and `iot_telemetry` exist.

---

## 4. Build & Testing Execution Guide

### 4.1 Android Builds
- **Compile Debug APK**:
  ```bash
  ./gradlew assembleDebug
  ```
  Artifact: `app/build/outputs/apk/debug/app-debug.apk`
- **Compile Release APK**:
  ```bash
  ./gradlew assembleRelease
  ```
  Artifact: `app/build/outputs/apk/release/app-release.apk`

### 4.2 Web Portal Build
```bash
npm --prefix web run build
```
Synchronizes the latest release APK to `web/public/` and generates the production bundle in `web/dist/`.

### 4.3 Backend Compilation
```bash
npm --prefix backend run build
```
Compiles TypeScript into `backend/dist/` with 0 type errors.

### 4.4 Automated Test Suites
Run the verified test suites:
- **E2E & Integration Suite (153 tests)**:
  ```bash
  node tests/run_e2e_tests.js
  ```
- **Adversarial Runtime Suite (23 tests)**:
  ```bash
  node tests/adversarial_runtime_live_eval.js
  ```
- **Stress & Concurrency Suites (20 tests)**:
  ```bash
  node tests/adversarial_stress_r1_r3.js
  node tests/adversarial_stress_r2_r4.js
  ```
- **Lifecycle Suite (44 tests)**:
  ```bash
  python tests/test_44_ids_lifecycle.py
  ```
- **Python Mandi Ingestion Unit Tests (4 tests)**:
  ```bash
  python -m unittest tests/test_mandi_pipeline_sync.py
  ```

---

## 5. Android Production Release & Signing Guide

### Generating a Production Keystore
```bash
keytool -genkey -v -keystore release-keystore.jks -alias nukrop-release -keyalg RSA -keysize 2048 -validity 10000
```

### Configuring Signing Credentials in CI/CD
Set the following environment variables or secrets:
- `RELEASE_STORE_FILE`: Path to `release-keystore.jks`
- `RELEASE_STORE_PASSWORD`: Password for keystore
- `RELEASE_KEY_ALIAS`: `nukrop-release`
- `RELEASE_KEY_PASSWORD`: Password for key alias

### Verifying APK Checksum
```bash
Get-FileHash -Algorithm SHA256 app\build\outputs\apk\release\app-release.apk
```
Confirm the SHA-256 hash matches the release catalog before public distribution.

---

## 6. Scheduled Worker Maintenance & Troubleshooting

### Running the Mandi Ingestion Worker Locally
```bash
python backend/mandi_pipeline_sync.py
```
- Requires `GOVT_API_KEY` and `DB_CONNECTION_STRING` in the environment.
- Exits with `0` on successful upsert.
- Exits with `1` if credentials are missing or database connection fails.
- Preserves all existing records on failure.

### GitHub Actions Cron Job
- Workflow file: `.github/workflows/mandi_scheduler.yml`
- Scheduled trigger: `0 */4 * * *` (Every 4 hours)
- Hard execution timeout: `15 minutes` (prevents hung runners).

---

## 7. Emergency Rollback Procedures

### 7.1 Mandi Data Inconsistency
If upstream Agmarknet data contains malformed records:
```sql
-- Query latest arrival date
SELECT state, commodity, count(*), max(arrival_date) 
FROM public.mandi_live_rates 
GROUP BY state, commodity;

-- Rollback today's batch if needed
DELETE FROM public.mandi_live_rates 
WHERE source_timestamp > NOW() - INTERVAL '1 day';
```

### 7.2 Web Portal Rollback
1. Web assets are static in `web/dist/`.
2. Redeploy previous Git commit tag via your static hosting provider (Vercel, Cloudflare Pages, or Netlify).

### 7.3 Mobile APK Rollback
1. In `app/build.gradle.kts`, decrement or increment `versionCode` and update `versionName`.
2. In Google Play Console, halt rollout of the active release track and promote the previous stable release bundle.

---

## 8. Handoff Sign-off

The codebase has been verified, all security credentials removed, all CI blockers fixed, and all tests passing. The repository is ready for official production handover.
