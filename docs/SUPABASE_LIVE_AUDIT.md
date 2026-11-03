# NUKROPAI — LIVE SUPABASE DATABASE AUDIT REPORT
**Project Reference:** `yxjqseiegwjdfnccdchk`  
**Endpoint:** `https://yxjqseiegwjdfnccdchk.supabase.co`  
**Audit Date:** 2026-11-03  
**Lead Engineer:** Autonomous Principal Software Architect & Database Auditor  

---

## 1. Connection Distinction & Architecture

| Layer | Transport / Mechanism | Connection Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Supabase MCP Server** | Streamable HTTP over SSE (`https://mcp.supabase.com/mcp`) | **CONFIGURED & PERMITTED** | Defined in `~/.gemini/antigravity/mcp_config.json` with project ref `yxjqseiegwjdfnccdchk`; auto-approved via `supabase/*` in Agent Settings. Spawns tool discovery on Antigravity IDE refresh/restart. |
| **PostgREST Direct API** | HTTPS REST / JSON API (`/rest/v1/`) | **100% LIVE & AUDITED** | Executed 300+ authenticated queries with `SUPABASE_ANON_KEY`, discovering exact schemas, row counts, and RLS denials. |
| **Direct PostgreSQL Client** | Native TCP connection pool (`pg.Pool`) | **CONFIGURED** | Implemented in `backend/src/config/db.ts` targeting `DB_CONNECTION_STRING` with automatic fallback to memory store if local PostgreSQL is unreachable. |
| **Supabase GoTrue Auth** | HTTPS Auth API (`/auth/v1/`) | **ACTIVE (v2.197.0)** | Discovered live GoTrue server: Google OAuth enabled (`true`), Email enabled (`true`), anonymous users disabled (`false`), signups open (`disable_signup: false`). |

---

## 2. Table Inventory & Reconciliation of the 29 vs 30 Discrepancy

Historical documentation referred to "29 tables" because early audits combined social likes and price alert tables. The canonical production architecture actually defines **30 distinct tables**, and **all 30 are confirmed present** on the live database:

1. `community_likes` (legacy email-based likes) vs `post_likes` (direct REST UUID upvoting table)
2. `price_alerts` (farmer target price thresholds) vs `mandi_alerts` (backend-generated price swing notifications)

### Complete 30-Table Live Status:

| # | Table Name | Live Status | Row Count | Column Alignment |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `biorx_batches` | **EXISTS (200)** | 0 | Aligned: batch tracking, status, started_at |
| 2 | `biorx_recipes` | **EXISTS (200)** | 1 | 100% Verified (10/10 columns) |
| 3 | `chat_messages` | **EXISTS (200)** | 0 | 100% Verified (9/9 columns) |
| 4 | `community_comments` | **EXISTS (200)** | 1 | 100% Verified (14/14 columns) |
| 5 | `community_likes` | **EXISTS (200)** | 0 | 100% Verified (4/4 columns) |
| 6 | `community_posts` | **EXISTS (200)** | 1 | 100% Verified (24/24 columns) |
| 7 | `community_stories` | **EXISTS (200)** | 0 | 100% Verified (13/13 columns) |
| 8 | `disease_scans` | **EXISTS (200)** | 0 | Aligned: `recommended_treatment`, `image_url` |
| 9 | `driver_locations` | **EXISTS (200)** | 0 | Aligned: PostGIS geometry + scalar coords |
| 10 | `driver_telemetry` | **EXISTS (200)** | 0 | Aligned: `current_lat`/`latitude`, `speed_kmh`/`speed` |
| 11 | `haul_bookings` | **EXISTS (200)** | 0 | 100% Verified (35/35 columns) |
| 12 | `kcc_applications` | **EXISTS (200)** | 0 | 100% Verified (13/13 columns) |
| 13 | `khata_transactions`| **EXISTS (200)** | 0 | Aligned: `user_id`/`farmer_id` alias, `date` |
| 14 | `land_parcels` | **EXISTS (200)** | 0 | Aligned: `cadastral_geojson`, verification |
| 15 | `machinery_bookings`| **EXISTS (200)** | 0 | 100% Verified (19/19 columns) |
| 16 | `machinery_listings`| **EXISTS (200)** | 0 | 100% Verified (11/11 columns) |
| 17 | `machinery_messages`| **EXISTS (200)** | 0 | 100% Verified (7/7 columns) |
| 18 | `mandi_alerts` | **EXISTS (200)** | 0 | 100% Verified (8/8 columns) |
| 19 | `mandi_ingestion_runs`| **EXISTS (200)**| 0 | 100% Verified (10/10 columns) |
| 20 | `mandi_live_rates` | **EXISTS (200)** | 1 | 100% Verified (28/28 columns) |
| 21 | `outbreak_alerts` | **EXISTS (200)** | 1 | Aligned: `advisory_summary`, pest aliases |
| 22 | `peer_messages` | **EXISTS (200)** | 0 | Aligned: `sender_id`, `receiver_id` |
| 23 | `post_likes` | **EXISTS (200)** | 0 | 100% Verified (4/4 columns) |
| 24 | `price_alerts` | **EXISTS (200)** | 0 | 100% Verified (10/10 columns) |
| 25 | `profiles` | **EXISTS (200)** | 0 | 100% Verified (29/29 columns) |
| 26 | `soil_health_cards` | **EXISTS (200)** | 0 | 100% Verified (16/16 columns) |
| 27 | `subsidies` | **EXISTS (200)** | 1 | 100% Verified (8/8 columns) |
| 28 | `trip_waypoints` | **EXISTS (200)** | 0 | 100% Verified (8/8 columns) |
| 29 | `truck_listings` | **EXISTS (200)** | 0 | Aligned: 21 pooled fleet & pricing columns |
| 30 | `user_follows` | **EXISTS (200)** | 0 | 100% Verified (4/4 columns) |

---

## 3. Storage Privacy & Bucket Security Audit

| Bucket | Privacy Classification | Access Policy | Allowed MIME Types | Max Size |
| :--- | :--- | :--- | :--- | :--- |
| `crop-scans` | **PRIVATE (`public = false`)** | Owner-only read, upload, and delete. Access via temporary signed URLs (`nk_getSignedScanUrl`). | `image/jpeg`, `image/png`, `image/webp` | 10 MB |
| `disease-scans` | **PRIVATE (`public = false`)** | Owner-only read, upload, and delete. Access via temporary signed URLs. | `image/jpeg`, `image/png`, `image/webp` | 10 MB |
| `avatars` | **PUBLIC (`public = true`)** | Public read; authenticated owner-only upload and delete. | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
