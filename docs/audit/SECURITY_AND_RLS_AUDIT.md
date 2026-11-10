# NuKropAI — Security & Row Level Security (RLS) Audit Report
**Document ID**: `docs/audit/SECURITY_AND_RLS_AUDIT.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Audit Date**: 2026-10-16  
**Auditor**: Cybersecurity Specialist & Supabase Security Architect  

---

## 1. Authentication, Identity & Session Audit

### 1.1 Supabase Auth & Session Restoration
- **Authentication Provider**: Supabase GoTrue Auth (Email/Password, Phone OTP, Google OAuth via Supabase token exchange).
- **Session Restoration Mechanism**: Native client queries `sbClient.auth.getSession()` on app startup. If the JWT is valid and unexpired, session state is rehydrated into `farmerProfile`.
- **Anti-Bypass Guard**: Local storage keys (`'guest'`, `'local_offline'`) no longer grant authenticated privileges to private Supabase tables. Unauthenticated users are directed to the login screen.
- **Logout Storage Purge**: Executing `executeSignOutToLogin()` or `executeUserLogout()` calls `sbClient.auth.signOut()` and purges all credentials from `localStorage`:
  - `nukrop_supabase_token`
  - `nukrop_supabase_uid`
  - `nukrop_user_email`
  - `nukrop_user_name`
  - `nukrop_farmer_name`
  - `nukrop_user_uuid`
  - `nukrop_auth_method`

### 1.2 DPDP Act 2023 & Farmer Privacy
- Consent is collected explicitly via user agreement at onboarding, with explicit consent timestamp (`dpdp_consent_timestamp`).
- Database defaults no longer assume `dpdp_consent_given = true` without user action.
- Telemetry streams (GPS and IoT) are transmitted only after explicit permission is granted and device coordinates are strictly isolated to the user's registered farm boundaries.

---

## 2. Row Level Security (RLS) & Multi-Tenant Isolation

### 2.1 Table Isolation Specifications

| Table | Access Level | SELECT Policy | INSERT / UPDATE / DELETE Policy | Isolation Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| `public.profiles` | Public Bio / Owner Update | `true` (public profiles visible to community/drivers) | `auth.uid()::text = id OR auth.uid()::text = user_id` | Users can only modify their own profile details. |
| `public.khata_transactions` | Private Financial | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | Farmer A cannot view or tamper with Farmer B's revenue/expense ledger. |
| `public.land_parcels` | Private Land Ownership | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | Cadastral parcels and geo-fenced coordinates isolated to farm owner. |
| `public.soil_health_cards` | Private Soil Health | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | NPK lab values and soil chemistry private to farm owner. |
| `public.disease_scans` | Private Diagnostic History | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | Historical foliar scan images and diagnoses restricted to author. |
| `public.kcc_applications` | Private Financial Loan | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | Credit limits, Aadhaar tokens, and loan disbursement private to applicant. |
| `public.chat_messages` | Private Conversational | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | Agricultural AI chat history strictly isolated. |
| `public.mandi_alerts` | Private Notification | `auth.uid()::text = user_id` | `auth.uid()::text = user_id` | Threshold target prices private to user. |
| `public.community_posts` | Public Read / Author Write | `true` | INSERT: `auth.uid()::text = user_id`; UPDATE/DELETE: `auth.uid()::text = user_id` | Anyone can browse the feed; only post author can edit or delete their post. |
| `public.community_comments`| Public Read / Author Write | `true` | INSERT/DELETE: `auth.uid()::text = user_id` | Users can only delete comments they authored. |
| `public.community_likes` | Public Read / User Write | `true` | ALL: `auth.uid()::text = user_id` | Likes recorded exclusively under authenticated voter ID. |
| `public.haul_bookings` | Multi-Party Trip Access | Farmer (`farmer_user_id = auth.uid()`), Driver (`driver_user_id = auth.uid()`) | Farmer or assigned Driver only | Prevents unauthorized drivers from hijacking or altering booking state. |
| `public.trip_waypoints` | In-Transit GPS Telemetry | Driver (`driver_id = auth.uid()`) or associated Booking Farmer | Driver only (`driver_id = auth.uid()`) | Live breadcrumbs visible only to farmer and driver involved in trip. |
| `public.mandi_live_rates` | Public Reference Data | `true` | Service Role Only (Backend / CI) | Public open read; modifications blocked for client anon roles. |
| `public.biorx_recipes` | Public Reference Data | `true` | Service Role Only | Master bio-formulation recipes publicly accessible. |

---

## 3. Secrets & Credential Audit

### 3.1 Static Codebase Secret Audit
- **Android APK Bundle**: Scanned `app/src/main/` for embedded private keys. The private Government Agmarknet API key previously hardcoded in `MandiApiService.kt` has been completely eliminated. The client now accesses market data via authenticated Supabase queries.
- **Web Production Bundle**: Scanned `web/dist/assets/*.js`. No database connection strings, service role keys, or government API tokens are present. Only the public Supabase Anon key and URL are bundled into client code.
- **Backend Environment**: `backend/` requires `DATABASE_URL`, `GOVT_API_KEY`, and `REDIS_URL` as server-side environment variables. Fallback hardcoded connection strings were removed from `mandi_pipeline_sync.py` and `MandiSyncService.ts`.
- **CI Secrets**: `GOVT_API_KEY` and `DB_CONNECTION_STRING` are accessed strictly via GitHub Repository Secrets in `.github/workflows/mandi_scheduler.yml`.

---

## 4. Zero-Firebase & Dependency Compliance

- **Firebase Status**: `firebase-admin` was identified in `backend/package.json` and immediately removed.
- **Auditing References**: A recursive search across `backend/src/` revealed 0 references to Firebase. Supabase is the sole backend infrastructure provider.
- **License Verification**: All project dependencies in `backend/package.json` and `web/package.json` are licensed under permissive open-source licenses (MIT, Apache 2.0, BSD-3-Clause). No copyleft or viral GPL licenses exist in runtime dependencies.
