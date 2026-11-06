# NuKropAI — Phase 13 External Dependencies & Service Integration

**Project:** NuKropAI Sovereign Agrarian Operating System  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Base Commit:** `ce7fe1c`  
**Pull Request #2:** OPEN & UNMERGED  
**Date:** November 2026  

---

## 1. External Dependencies & Environment Configuration

| Service / Provider | Capability / Feature | Environment Variable | Status in Code | Fallback Mechanism When Key / Network Absent |
| :--- | :--- | :--- | :--- | :--- |
| **Agmarknet (data.gov.in)** | Daily APMC mandi commodity trade rates | `DATA_GOV_IN_API_KEY` or `GOVT_API_KEY` | **Fully Connected** | Automatically falls back to Supabase cloud cache, then local twice-daily authentic snapshot (`data/mandi_daily_real_rates.json`). |
| **Google Gemini Vision API** | Crop leaf & foliar disease visual diagnosis | `GEMINI_API_KEY` | **Supported & Optional** | Falls back to comprehensive ICAR botanical pathology database with 120+ Indian crop profiles. |
| **Groq / Llama 3 API** | 24/7 AI Kisan Copilot agronomy advice | `GROQ_API_KEY` | **Supported & Optional** | Falls back to PJTSAU / ICAR scientific agronomic rule engine with multilingual support. |
| **Supabase Cloud** | Database, Auth, Storage, Realtime | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | **Production Connected** | State-preserving in-memory fallback tables in backend (`test_db_fallback_reliability.js`). |
| **OpenStreetMap & Leaflet**| Satellite & street map tiles for GramHaul | *No Key Required* (Open Source) | **Fully Connected** | Graceful tile loading error handler with offline SVG map placeholder. |
| **Nominatim / OpenStreetMap**| Reverse geocoding for GPS fixes | *No Key Required* (Open Source) | **Fully Connected** | Falls back to cached farm village coordinates from farmer profile. |
| **Android GPS Hardware** | Real-time driver GPS dispatch & tracking | *Native OS Permission* | **Fully Connected** | Android Foreground Service `DriverLocationService` with coarse network fallback. |
| **Firebase Cloud Messaging** | Remote cloud push notifications | `GOOGLE_SERVICES_JSON` / FCM Server | **Documented Blocker** | Android native system notification channel (`nukrop_farmer_alerts`) handles in-app alerts. |

---

## 2. API Key Security & Client Code Audit

In strict adherence to Safety Rule 9:
- **No Private Keys Committed**: `.env` and backend private keys are excluded from git tracking.
- **Service Role Key Isolation**: Backend tests (`test_jwt_auth_security.js: SEC-JWT-1`) verify zero occurrences of hardcoded secrets or service-role keys in frontend source files.
- **Client Anon Key**: The Supabase anon key used in `app/src/main/assets/index.html` is a public JWT with client permissions strictly bounded by PostgreSQL Row-Level Security (RLS).

---

## 3. Provenance & Data Freshness Indicators

When external live APIs are temporarily unavailable, NuKropAI clearly discloses data provenance:
- **Live Mandi Rates**: Displays `Live Agmarknet / DMI (Govt of India)` when fetched directly, `Supabase PostGIS Cache` when served from the database, or `<span class="stale-cache-pill">📦 Cached APMC Snapshot · Refreshed Today</span>` when using local cached records.
- **AI Diagnostics**: Clearly states `🤖 Gemini Vision AI Analysis` when live neural inference succeeds, or `🌿 ICAR Botanical Pathology Match` when using the embedded botanical database.
- **Soil Analysis**: Includes mandatory disclaimer: `[Notice: Visual soil assessment only. For certified NPK and pH values, submit a sample to an authorized Soil Testing Laboratory under the Soil Health Card scheme.]`

---

## 4. Blockers & Prerequisites for Staging Acceptance

1. **Push Notifications**: Remote cloud messaging requires a configured Google Firebase Cloud Messaging (FCM) project. Local notifications function normally via Android `NotificationManagerCompat`.
2. **Dual-Device Live Dispatch**: Real-time acceptance between two distinct physical devices requires an isolated test Supabase project (see `docs/SUPABASE_ISOLATED_TEST_ENVIRONMENT_PLAN.md`). Test scripts are fail-closed to prevent touching production.
