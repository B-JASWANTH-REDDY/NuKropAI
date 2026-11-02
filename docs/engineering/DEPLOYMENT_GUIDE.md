# NuKropAI Production Deployment & Operations Runbook

**Target:** Supabase, Vercel / Web Hosting, Android Play Store Release  

---

## 1. Supabase Database Deployment

Execute the complete, self-contained, 100% idempotent SQL master script in the Supabase SQL Editor:

1. Open your **Supabase Dashboard** -> Select your Project.
2. In the left navigation, click on **SQL Editor**.
3. Create a **New query**.
4. Copy the entire contents of:
   ```
   supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql
   ```
5. Paste into the SQL Editor and click **Run**.
6. **Expected Result:** "Success. No rows returned." 
   * Zero errors.
   * Completely immune to `ERROR: 42710: relation "driver_telemetry" is already member of publication "supabase_realtime"`.
   * Automatically sets up all 30 tables, columns, constraints, triggers, storage buckets, RLS policies, and authentic agricultural seed data.

---

## 2. Supabase Storage & Realtime Verification

* **Storage Buckets:** Verify that under **Storage**:
  * `community-media` is present and set to **Public**.
  * `crop-scans` is present and set to **Private** (authenticated read/write).
* **Realtime:** Verify that under **Database -> Publications -> supabase_realtime**:
  * Tables `driver_telemetry`, `driver_locations`, `haul_bookings`, `truck_listings`, `community_posts`, `community_stories`, `community_comments`, `price_alerts` are active.

---

## 3. Environment Variables Configuration

In `.env` or your hosting platform (Vercel, Render, Railway), set:

```ini
# Supabase Core Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-backend-only>

# AI Diagnostic Engine
GEMINI_API_KEY=<your-google-gemini-api-key>

# Government Mandi Intelligence
AGMARKNET_API_KEY=<your-data-gov-in-api-key>

# Weather Service (Open-Meteo works without key; enterprise key optional)
OPEN_METEO_API_URL=https://api.open-meteo.com/v1/forecast
```

---

## 4. Mandi Daily Ingestion Cron Setup

To populate genuine daily mandi market prices automatically:

* Run the ingestion pipeline locally or via a scheduled GitHub Action / Cloud Function:
  ```bash
  python src/services/mandi_ingest_service.py
  ```
* This service fetches live prices from data.gov.in / Agmarknet, normalizes commodity names and dates, and upserts them into `public.mandi_live_rates`.

---

## 5. Android APK Build & Release

1. Verify asset synchronization between web and Android:
   ```bash
   node tests/run_e2e_tests.js
   ```
2. Build Android production release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
3. The signed APK will be output to:
   ```
   app/build/outputs/apk/release/app-release.apk
   ```
