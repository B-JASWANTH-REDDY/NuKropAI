# NuKropAI Production Deployment & Operations Runbook

**Target:** Supabase Database, Fastify API Engine, Vite Web Dashboard, Android Release Shell  

---

## 1. Supabase Database Setup

Execute the self-contained, 100% idempotent SQL master script in the Supabase SQL Editor:

1. Open your **Supabase Dashboard** -> Select your Project.
2. In the left navigation, click on **SQL Editor**.
3. Create a **New query**.
4. Copy the entire contents of:
   ```
   supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql
   ```
5. Paste into the SQL Editor and click **Run**.
6. **Expected Result:** `Success. No rows returned.`
   * Zero errors.
   * Completely immune to `ERROR: 42710` (publication duplicate) and `ERROR: 0A000` (view rewrite rule locks).
   * Safe column casts only execute if columns are not already `text`.
   * Historical `khata_transactions` user ownership is preserved via profile stub insertion.
   * Automatically sets up all 30 tables, columns, constraints, triggers, storage buckets, RLS policies, and authentic agricultural seed data.

---

## 2. Environment Variables Configuration

In `.env` or your hosting platform (Vercel, Render, Railway, Docker), configure the required environment variables:

```ini
# Supabase Core Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-backend-only>
SUPABASE_JWT_SECRET=<your-supabase-jwt-secret>

# Backend API Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-jwt-refresh-secret>

# AI Diagnostic Engine
GEMINI_API_KEY=<your-google-gemini-api-key>

# Government Mandi Intelligence
DATA_GOV_IN_API_KEY=<your-data-gov-in-api-key>

# Weather Service (Open-Meteo works without key; enterprise key optional)
OPEN_METEO_API_URL=https://api.open-meteo.com/v1/forecast

# Web Dashboard (Vite)
VITE_API_URL=https://<your-backend-api-domain>
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 3. Web Dashboard Build & Deployment

```bash
cd web
npm install
npm run build
```
The compiled static assets will be output to `web/dist/`, ready for hosting on Vercel, Netlify, or AWS S3/CloudFront.

---

## 4. Backend API Deployment

```bash
cd backend
npm install
npm run build
npm start
```
Starts the Fastify production API server listening on configured `PORT`.

---

## 5. Android APK Build & Release Signing

1. Verify asset synchronization between web and Android:
   ```bash
   npm test
   ```
2. Build Android release APK with production keystore:
   ```bash
   export KEYSTORE_PATH="/path/to/production.keystore"
   export STORE_PASSWORD="<store-password>"
   export KEY_ALIAS="<key-alias>"
   export KEY_PASSWORD="<key-password>"
   export STRICT_RELEASE_SIGNING="true"

   ./gradlew assembleRelease
   ```
   > **Note:** If `KEYSTORE_PATH` is not provided, the build system falls back to `debug.keystore` for local testing only and outputs a warning. Never upload debug-signed APKs to the Google Play Store.
