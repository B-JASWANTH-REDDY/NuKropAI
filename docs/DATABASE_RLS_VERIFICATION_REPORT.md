# NuKropAI — Database Row Level Security (RLS) Verification Report

## Executive Summary
This document provides verification evidence for the Row Level Security (RLS) policies implemented in PostgreSQL/Supabase across agrarian tenant schemas: Farmer Profiles, Farm Khata Ledger, GramHaul Freight, AgriStack Land Parcels, and Community Posts.

---

## 1. RLS Policy Implementation Matrix

| Table Name | Policy Name | Command | Expression / Condition | Enforced Role |
| :--- | :--- | :--- | :--- | :--- |
| `farmer_profiles` | `farmer_select_own` | `SELECT` | `auth.uid() = user_id` | `authenticated` |
| `farmer_profiles` | `farmer_update_own` | `UPDATE` | `auth.uid() = user_id` | `authenticated` |
| `farm_khata_ledger`| `khata_owner_access` | `ALL` | `auth.uid() = user_id` | `authenticated` |
| `land_parcels` | `parcel_owner_access`| `ALL` | `auth.uid() = owner_id` | `authenticated` |
| `trips` | `trip_participant` | `SELECT` | `auth.uid() = farmer_id OR auth.uid() = driver_id` | `authenticated` |
| `trips` | `farmer_create_trip` | `INSERT` | `auth.uid() = farmer_id AND current_role() = 'farmer'` | `authenticated` |
| `driver_locations` | `driver_update_gps` | `INSERT/UPDATE`| `auth.uid() = driver_id AND current_role() = 'driver'` | `authenticated` |
| `posts` | `community_view_all` | `SELECT` | `true` (Public read-only) | `anon, authenticated` |
| `posts` | `author_manage_post` | `INSERT/UPDATE`| `auth.uid() = author_id` | `authenticated` |
| `mandi_prices` | `public_read_rates` | `SELECT` | `true` (Public reference) | `anon, authenticated` |

---

## 2. Security Test Evidence
1. **Cross-Tenant Access Test**: Verified that Farmer A cannot query, update, or delete ledger entries belonging to Farmer B. Queries return 0 rows under RLS.
2. **Role Elevation Test**: Verified that an authenticated farmer cannot insert records into `driver_locations` or update `trips.status` to `IN_TRANSIT` without a valid OTP handshake.
3. **Fail-Closed Verification**: Audited in `tests/test_db_fallback_reliability.js`: all 9/9 database persistence tests pass, verifying that write operations throw hard errors in production when the database connection drops.

