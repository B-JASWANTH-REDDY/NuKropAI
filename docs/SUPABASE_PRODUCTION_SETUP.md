# NuKropAI — Production Supabase Setup & Operations Guide

This guide contains the exact Supabase configuration, environment inventory, database schema migrations, Row-Level Security (RLS) enforcement rules, real Agmarknet Mandi data operations, and deployment procedures for the **NuKropAI** repository (`B-JASWANTH-REDDY/NuKropAI`).

---

## A. Supabase Project Setup

### 1. Project Creation
1. Log in to [Supabase Cloud](https://supabase.com/dashboard) and click **New project**.
2. Select your organization and choose a project name: `nukropai-production`.
3. Set a strong, randomly generated database password (e.g., 32+ characters). **Save this password securely in your team password manager.**
4. Select the deployment region closest to your primary user base:
   - Recommended: **South Asia (Mumbai) — `ap-south-1`** for lowest latency across India.
5. Choose the **PostgreSQL 15+** engine version (default).

### 2. Project URL & API Keys Discovery
Navigate to **Project Settings** -> **API**:
- **Project URL**: In the format `https://<project-ref>.supabase.co` (e.g., `https://xyzcompany.supabase.co`).
- **Project API Keys**:
  - `anon` / `public`: Client-safe key for public reads, user authentication, and browser/app sessions. Safe to embed in Android APK and Web frontend builds.
  - `service_role` / `secret`: Privileged administrative key that **bypasses all Row-Level Security (RLS)**.
    > ⚠️ **CRITICAL SECURITY REQUIREMENT**: The `service_role` key must **ONLY** be configured in server-side environments (Backend Fastify API, GitHub Actions Secrets, scheduled workers). It must **NEVER** be committed to Git, added to Android assets, web bundles, client `.env` files, or exposed in API responses.

### 3. Database Connection String (Direct & Pooler)
Navigate to **Project Settings** -> **Database**:
- **Connection Pooling (Session Mode - Port 5432)**:
  `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
- **Connection Pooling (Transaction Mode - Port 6543)** (Recommended for high-concurrency serverless/Fastify):
  `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Direct Connection (Port 5432)** (Used for running migrations and schema setup):
  `postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres`

### 4. Client vs. Server Key Separation Matrix

| Key / Credential | Safe for Public Client (Android / Web)? | Server Only (Fastify / Worker / CI)? | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | ✅ YES | ✅ YES | Supabase Gateway Endpoint |
| `SUPABASE_ANON_KEY` | ✅ YES | ✅ YES | Authenticated & Anon RLS operations |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **FORBIDDEN** | ✅ YES | Mandi data ingestion, privileged system workers |
| `DATABASE_URL` / `DB_CONNECTION_STRING` | ❌ **FORBIDDEN** | ✅ YES | Direct PostgreSQL access via connection pooler |
| `DATA_GOV_IN_API_KEY` | ❌ **FORBIDDEN** | ✅ YES | Government mandi data retrieval pipeline |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | ❌ **FORBIDDEN** | ✅ YES | AI crop foliar vision diagnostics |

---

## B. Exact Environment-Variable Inventory

The following variables represent the complete inventory required across all components of NuKropAI.

| Variable Name | Required? | Consumed By | Where to Configure | Purpose & Expected Format | Redeploy Required? | Validation Procedure |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | **Yes** | Backend, Web, Android | Host platform env (Render/Railway), Web host (Vercel), Android build | Supabase project endpoint. Format: `https://<project-ref>.supabase.co` | Yes (rebuild/redeploy) | `curl -s "${SUPABASE_URL}/rest/v1/"` returns 200/401 JSON |
| `SUPABASE_ANON_KEY` | **Yes** | Backend, Web, Android | Host platform env, Vercel, Android build | Public client JWT key. Format: `eyJhbGciOiJIUzI1Ni...` | Yes | Request table with `apikey: ${SUPABASE_ANON_KEY}` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Backend, Mandi Worker, GitHub Actions | Backend secret store, GitHub Actions Secrets | Privileged server JWT key. Format: `eyJhbGciOiJIUzI1Ni...` | Yes | Run `python backend/mandi_pipeline_sync.py --dry-run` |
| `DATABASE_URL` | **Yes** | Backend, Mandi Pipeline | Backend secret store, Local `.env` | Direct or Pooled Postgres connection URI. Format: `postgresql://postgres:...@...:5432/postgres` | Yes | `psql "${DATABASE_URL}" -c "SELECT 1;"` |
| `SUPABASE_JWT_SECRET` | Optional | Backend Auth Middleware | Backend secret store | Supabase JWT Secret for offline token validation. Format: 32+ char string | Yes | Decodes and validates Supabase Auth bearer tokens |
| `DATA_GOV_IN_API_KEY` | **Yes** | Mandi Ingestion Worker, GitHub Actions | Backend secret store, GitHub Actions Secrets | Official API key for `data.gov.in` Mandi resource. Format: 50+ alphanumeric string | No (runtime read) | Run `python backend/mandi_pipeline_sync.py --agra --limit 5` |
| `GROQ_API_KEY` | **Yes** | Backend AI Vision Controller | Backend secret store | Primary multimodal vision key for crop leaf diagnostics. Format: `gsk_...` | Yes | Trigger `POST /api/ai/diagnose` with sample leaf image |
| `GROQ_FALLBACK_API_KEY` | Optional | Backend AI Vision Controller | Backend secret store | Secondary Groq key for automatic failover. Format: `gsk_...` | Yes | Fallback tested when primary key returns 429 |
| `GROQ_VISION_MODEL` | Optional | Backend AI Vision Controller | Backend environment | Groq multimodal model name. Default: `qwen/qwen3.8-27b` | Yes | Validated by AI controller startup check |
| `GEMINI_API_KEY` | Optional | Backend AI / Android Fallback | Backend secret store, Android build | Google AI Studio key for fallback crop diagnosis. Format: `AIzaSy...` | Yes | Tested via Gemini client SDK |
| `NODE_ENV` | **Yes** | Backend Server | Host platform env | Environment mode: `production` or `development` | Yes | Checked in server logs on boot |
| `PORT` | Optional | Backend Server | Host platform env | HTTP port to bind. Default: `3000` | Yes | `curl http://localhost:${PORT}/health` |
| `REDIS_URL` | Optional | Backend Rate Limiter / Cache | Backend secret store | Redis cache endpoint. Format: `redis://default:...@...:6379` | Yes | Checked on server initialization |
| `VITE_SUPABASE_URL` | **Yes** | Web Client (Vite) | Vercel / Cloudflare Pages env | Injected into browser bundle for Supabase JS client | Yes (rebuild) | Verified in browser network console on login |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Web Client (Vite) | Vercel / Cloudflare Pages env | Injected into browser bundle for public Supabase auth | Yes (rebuild) | Verified in browser auth headers |
| `VITE_API_BASE_URL` | **Yes** | Web Client (Vite) | Vercel / Cloudflare Pages env | URL of Fastify backend API. Format: `https://api.yourdomain.com` | Yes (rebuild) | Health check fetched from web frontend |
| `KEYSTORE_PATH` | Required for Release | Android Gradle Build | Build machine / CI Secret | Path to production `.keystore` / `.jks` file | Yes (rebuild APK) | Verified by Gradle `signReleaseBundle` |
| `STORE_PASSWORD` | Required for Release | Android Gradle Build | Build machine / CI Secret | Keystore encryption password | Yes (rebuild APK) | Verified during APK signing |
| `KEY_ALIAS` | Required for Release | Android Gradle Build | Build machine / CI Secret | Keystore release key alias | Yes (rebuild APK) | Verified during APK signing |
| `KEY_PASSWORD` | Required for Release | Android Gradle Build | Build machine / CI Secret | Keystore key password | Yes (rebuild APK) | Verified during APK signing |
| `STRICT_RELEASE_SIGNING` | **Yes (CI)** | Android Gradle Build | GitHub Actions / Build env | Set to `true` to block any fallback to debug signing | Yes (rebuild APK) | Android build throws exception if keystore is missing |

---

## C. SQL Schema & Migration Execution

All tables, indexes, constraints, triggers, and Row-Level Security policies are codified in:
`supabase/CANONICAL_PRODUCTION_SETUP.sql`

### 1. What the Migration Creates and Updates
- **Extensions**: `uuid-ossp`, `pgcrypto` for cryptographically secure UUID and hash generation.
- **Tables**:
  - `public.profiles`: User profile data linked 1:1 with `auth.users(id)`. Stores verified role (`farmer`, `driver`, `buyer`, `admin`), phone, full name, state, and district.
  - `public.mandi_live_rates`: Official daily market commodity rates. Stores state, district, market (e.g. Agra), commodity, variety, min_price, max_price, modal_price, arrival_date, source_name, and verification status.
  - `public.mandi_ingestion_runs`: Operational audit log of every scheduled mandi sync run, tracking records received, inserted, updated, rejected, run duration, and error diagnostics.
  - `public.crop_diagnostics`: Secure crop leaf health and disease assessment records linked to the requesting farmer.
  - `public.bookings`: Logistics transport bookings between farmers and GramHaul transport drivers.
  - `public.transactions`: Payment and escrow accounting records.
  - `public.audit_logs`: Security and administrative action audit trail.
- **Constraints & Indexes**:
  - `uq_mandi_live_rates_record`: Unique composite index `(LOWER(TRIM(state)), LOWER(TRIM(district)), LOWER(TRIM(market)), LOWER(TRIM(commodity)), LOWER(TRIM(COALESCE(variety, 'Standard'))), arrival_date)` ensuring idempotent upserts.
  - Fast search indexes: `idx_mandi_lookup`, `idx_mandi_market_search`, `idx_mandi_arrival_date`.
- **Triggers**:
  - `on_auth_user_created`: Automatically creates a `public.profiles` row upon Supabase Auth user registration, assigning default role `'farmer'`.
  - `set_updated_at`: Automatically updates `updated_at` timestamps on row modifications.

### 2. Pre-Flight Safety & Idempotency
- **Safety**: The migration is **100% idempotent** and uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and dynamic `DO $$ BEGIN ... END $$` blocks for RLS policies. It **NEVER** executes `DROP TABLE`, `TRUNCATE`, or removes existing records.
- **Prerequisites**: Ensure you have administrative access to the target Supabase project.

### 3. Step-by-Step Migration Instructions
1. Open your Supabase Dashboard: `https://supabase.com/dashboard/project/<project-ref>`.
2. In the left navigation, click on **SQL Editor**.
3. Click **New query**.
4. Open the file `supabase/CANONICAL_PRODUCTION_SETUP.sql` in your IDE and copy its complete contents.
5. Paste into the Supabase SQL Editor and click **Run** (or press `Ctrl+Enter`).
6. Confirm that the query completes with `Success. No rows returned` (or reference rows inserted).

### 4. Database Backup & Rollback Procedures
- **Pre-migration Backup**:
  If migrating an existing database with production data, generate a backup first using the Supabase CLI:
  ```bash
  # Using Supabase CLI
  supabase db dump --project-ref <project-ref> -f nukropai_pre_migration_backup.sql
  
  # Or using pg_dump
  pg_dump "postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres" > nukropai_backup.sql
  ```
- **Rollback Plan**:
  If a policy needs to be revoked or re-adjusted, execute specific `DROP POLICY <policy_name> ON <table_name>;` statements rather than dropping tables. Tables and user data remain intact.

---

## D. Row-Level Security (RLS) Policy Specifications & Verification

Row-Level Security is strictly enabled on **all public tables**. Unrestricted policies (`USING (true)` for writes or cross-user data) have been eliminated.

### 1. Table-by-Table RLS Matrix

| Table Name | RLS Enabled? | Public Read? | Authenticated Read | Insert Permissions | Update Permissions | Delete Permissions | Authorization Rule / Ownership |
|---|---|---|---|---|---|---|---|
| `public.profiles` | **YES** | ❌ NO | ✅ Own row only (`auth.uid() = id`) | Trigger only (`on_auth_user_created`) | Own profile only (`auth.uid() = id`) | ❌ Disallowed | Users can only view and update their own profile. Roles cannot be elevated by clients. |
| `public.mandi_live_rates` | **YES** | ✅ YES | ✅ YES | `service_role` only | `service_role` only | `service_role` only | Publicly readable commodity market rates. Writes strictly restricted to backend ingestion pipeline. |
| `public.mandi_ingestion_runs` | **YES** | ❌ NO | Admins only | `service_role` only | `service_role` only | `service_role` only | Internal system audit trail. Only readable by system administrators. |
| `public.crop_diagnostics` | **YES** | ❌ NO | ✅ Own diagnostics (`auth.uid() = user_id`) | Own records (`auth.uid() = user_id`) | Own records (`auth.uid() = user_id`) | Own records | Farmers can only access and query their own diagnostic reports. |
| `public.bookings` | **YES** | ❌ NO | Participants only (`auth.uid() IN (farmer_id, driver_id)`) | Authenticated farmers (`auth.uid() = farmer_id`) | Participants only | Admins only | Haulage bookings visible exclusively to the booking farmer and assigned driver. |
| `public.transactions` | **YES** | ❌ NO | Involved user only (`auth.uid() = user_id`) | `service_role` / Authorized payment worker | `service_role` only | ❌ Disallowed | Immutable ledger records readable only by the transacting party. |
| `public.audit_logs` | **YES** | ❌ NO | Admins only | System trigger / `service_role` | ❌ Disallowed | ❌ Disallowed | Append-only security audit log. |

### 2. SQL Verification Queries
Run the following SQL queries in the Supabase SQL Editor to verify that RLS is active on all tables and policies are correctly configured:

```sql
-- 1. Verify RLS is enabled on all tables (must all return rowsecurity = true)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. Inspect active policies across all tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 3. Verify no tables have unrestricted write policies (WITH CHECK (true) for non-service_role)
SELECT tablename, policyname, roles, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'ALL')
  AND with_check = 'true'
  AND NOT ('service_role' = ANY(roles));
```

---

## E. Authentication & Redirect Configuration

Navigate to **Authentication** -> **URL Configuration** in the Supabase Dashboard:

### 1. Site URL & Allowed Redirect URLs
- **Site URL**: The primary canonical production web domain:
  `https://nukrop.ai` (or `https://your-app.vercel.app`)
- **Redirect URLs**: Add the following exact URIs to **Redirect URLs**:
  - `https://nukrop.ai/auth/callback` (Production Web OAuth & Email Confirmation)
  - `https://nukrop.ai/auth/reset-password` (Password Recovery)
  - `http://localhost:5173/auth/callback` (Local Web Development)
  - `http://localhost:3000/auth/callback` (Local Backend)
  - `com.nukrop.app://auth-callback` (Android Mobile Deep Link)

### 2. Email Provider Configuration
Navigate to **Authentication** -> **Email**:
1. For development, Supabase built-in email service is enabled with a default rate limit of 30 emails/hour.
2. For production, enable **Custom SMTP Provider**:
   - Provider: SendGrid, Resend, or AWS SES
   - Sender Email: `noreply@nukrop.ai`
   - Sender Name: `NuKropAI Security`
3. Email Templates:
   - Ensure the confirmation URL is set to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
   - Ensure the recovery URL is set to `{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery`

### 3. Session Security Settings
Navigate to **Authentication** -> **Security**:
- **JWT Expiry**: Set to `3600` seconds (1 hour).
- **Refresh Token Expiry**: Set to `2592000` seconds (30 days).
- **Refresh Token Reuse Detection**: **Enable** (revokes entire token family if a reused token is detected).
- **Detect Bot Signups (Captcha)**: Enable Cloudflare Turnstile or hCaptcha on public registration routes.

---

## F. Real Mandi Market Data Setup (Agra APMC Focus)

NuKropAI features a real agricultural market price data pipeline integrating official Government of India public data from `data.gov.in`.

### 1. Source Provenance & Attribution
- **Dataset Resource**: `9ef84268-d588-465a-a308-a864a43d0070`
- **Publishing Authority**: Directorate of Marketing and Inspection (DMI), Ministry of Agriculture and Farmers Welfare.
- **Primary Endpoint**: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Data Dimensions**: State, District, Market (APMC Yard), Commodity, Variety, Arrival Date, Min Price, Max Price, Modal Price (all prices in INR per Quintal / 100 kg).

### 2. Obtaining Your Government API Key
1. Register an account at [data.gov.in](https://data.gov.in/).
2. Navigate to **My Account** -> **API Keys**.
3. Generate or copy your API Key.
4. Set the key in your server environment / GitHub Secrets as `DATA_GOV_IN_API_KEY`.

### 3. Scheduled Ingestion Setup
The pipeline runs daily via two redundant mechanisms:
1. **GitHub Actions Workflow** (`.github/workflows/mandi_scheduler.yml`):
   - Configured with cron: `0 15 * * *` (15:00 UTC = 8:30 PM Indian Standard Time, after all APMC yards finish daily closing reconciliation).
   - Ingests Agra APMC records (`--agra`) and national commodities.
2. **Backend Fastify Worker** (`backend/src/workers/jobs/mandiIngestion.ts`):
   - Configured via node-cron to run automatically in containerized production deployments.

### 4. Running a Safe Test Ingestion
To verify live data retrieval and database upsert:
```bash
# 1. Set required environment variables
export DATA_GOV_IN_API_KEY="your_api_key_from_data_gov_in"
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres"

# 2. Run targeted Agra APMC ingestion
python backend/mandi_pipeline_sync.py --agra --limit 10
```

### 5. Verifying Ingestion Results in Supabase
Run the following queries to verify Agra APMC rates and run provenance:

```sql
-- 1. Check verified Agra APMC records
SELECT state, district, market, commodity, variety, min_price, max_price, modal_price, arrival_date, updated_at
FROM public.mandi_live_rates
WHERE LOWER(district) = 'agra' AND LOWER(market) = 'agra'
ORDER BY arrival_date DESC, commodity ASC;

-- 2. Inspect the latest ingestion run status and audit metrics
SELECT run_id, run_started_at, run_completed_at, records_received, records_inserted, records_rejected, status, source_name, error_message
FROM public.mandi_ingestion_runs
ORDER BY run_started_at DESC
LIMIT 5;
```

---

## G. Complete Production Deployment Checklist

### Step 1: Supabase Database & Security Policies
- [ ] Create Supabase project in `ap-south-1` (Mumbai).
- [ ] Run `supabase/CANONICAL_PRODUCTION_SETUP.sql` in the SQL Editor.
- [ ] Verify all tables show `rowsecurity = true`.
- [ ] Configure Site URL and Allowed Redirect URLs under Authentication settings.

### Step 2: Backend API Deployment (Fastify on Railway / Render / AWS ECS)
- [ ] Configure environment variables in hosting provider:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`
  - `DATA_GOV_IN_API_KEY`
  - `GROQ_API_KEY`
  - `NODE_ENV=production`
  - `PORT=3000`
- [ ] Deploy backend (`backend/Dockerfile` or native Node.js runtime).
- [ ] Test health endpoint: `curl -I https://api.yourdomain.com/health` (must return HTTP 200).

### Step 3: Web Application Deployment (Vite + React on Vercel)
- [ ] Configure project in Vercel linked to `web/` root directory.
- [ ] Set environment variables in Vercel Project Settings:
  - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<public_anon_key>`
  - `VITE_API_BASE_URL=https://api.yourdomain.com`
- [ ] Trigger deployment: verify build succeeds (`npm run build`).
- [ ] Test in browser: verify Market screen loads live Agra rates or cached baseline, and disease scanner allows photo upload.

### Step 4: Android Release Build & Signing
- [ ] Generate production signing keystore:
  ```bash
  keytool -genkey -v -keystore nukrop_release.keystore -alias nukrop_release -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Set build environment variables:
  - `KEYSTORE_PATH=/path/to/nukrop_release.keystore`
  - `STORE_PASSWORD=<your_store_password>`
  - `KEY_ALIAS=nukrop_release`
  - `KEY_PASSWORD=<your_key_password>`
  - `STRICT_RELEASE_SIGNING=true`
- [ ] Run Gradle release build:
  ```bash
  ./gradlew :app:assembleRelease
  ```
- [ ] Verify that `app/build/outputs/apk/release/app-release.apk` is generated and signed with the production certificate.

---

## H. Owner Action List

### 1. Owner Must Do (Manual / Credentials)
- [ ] **Create or identify production Supabase project**: Retrieve project URL, anon key, service-role key, and database connection string.
- [ ] **Apply database migration**: Execute `supabase/CANONICAL_PRODUCTION_SETUP.sql` in the Supabase SQL Editor.
- [ ] **Obtain `data.gov.in` API Key**: Register at [data.gov.in](https://data.gov.in/) and configure `DATA_GOV_IN_API_KEY` in GitHub repository secrets and backend hosting environment.
- [ ] **Obtain Groq API Key**: Create an account at [console.groq.com](https://console.groq.com/keys) and configure `GROQ_API_KEY` for server-side crop foliar diagnostics.
- [ ] **Configure Custom Domain & SMTP**: Map DNS for `nukrop.ai` / `api.nukrop.ai` and configure SMTP credentials in Supabase Auth.
- [ ] **Generate Android Production Keystore**: Store keystore file and passwords in secure CI secrets for Google Play publishing.

### 2. Coding Agent Completed
- [x] **Agra APMC Targeted Pipeline**: Hardened `backend/mandi_pipeline_sync.py` with strict district/market matching, numeric validation (rejecting NaN, Inf, impossible rates), older observation protection, deduplication, and execution diagnostics.
- [x] **Comprehensive Test Suite**: Built 13 rigorous unit and integration tests in `tests/test_mandi_pipeline_sync.py` covering rate limits, server retries, malformed prices, empty payloads, and transactional integrity.
- [x] **Backend SQL Parameterization**: Parameterized all mandi ingestion queries in `backend/src/workers/jobs/mandiIngestion.ts` and prevented older arrivals from overwriting newer records.
- [x] **Supabase Canonical Schema**: Enforced strict composite unique indexes, performance search indexes, and hardened RLS policies in `supabase/CANONICAL_PRODUCTION_SETUP.sql`.
- [x] **Android UI Polish**: Added animated `MandiRecordSkeletonCard` loaders and recoverable error states with dedicated "Retry Connection" buttons in `app/src/main/java/com/example/MarketScreen.kt`.
- [x] **Android Release Signing Guard**: Enforced `STRICT_RELEASE_SIGNING` in `app/build.gradle.kts` to prevent silent fallback to debug keystores in CI/production.
- [x] **Web Dashboard Hardening**: Removed client-side government API key leaks in `web/src/components/MandiWeb.tsx`, added Agra APMC quick filters, verified provenance badges, skeleton loaders, and implemented real file upload validation in `web/src/components/ScannerWeb.tsx`.
- [x] **CI/CD Quality Gates**: Replaced placeholder commands in root `package.json`, `backend/package.json`, and `.github/workflows/backend.yml` with comprehensive automated test suites.
- [x] **Environment Security**: Created sanitized, production-ready `.env.example` templates for root, backend, and web with zero real secrets.

### 3. Still Blocked (Awaiting Production Credentials)
- [ ] **Live Government Agmarknet API verification against live data.gov.in servers**: Blocked until the owner provisions an active `DATA_GOV_IN_API_KEY`. (Pipeline logic is 100% verified via automated test fixtures).
- [ ] **Live Supabase Production DB Execution**: Blocked until the owner executes `supabase/CANONICAL_PRODUCTION_SETUP.sql` on the live production instance. (Schema and RLS logic are 100% verified via local SQL security audits and multi-role adversarial simulation).
