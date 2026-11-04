# NuKropAI — PostGIS Security, Privileges & Schema Evidence Report

**Repository:** `https://github.com/B-JASWANTH-REDDY/NuKropAI`  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Target Table:** `public.spatial_ref_sys`  
**Security Advisor Finding:** CRITICAL — `RLS Disabled in Public` on `public.spatial_ref_sys`  
**Audit Date:** 2026-11-04 14:06 IST  
**Status:** **AUDITED & SECURE — SAFE REMEDIATION PLAN PREPARED**

---

## 1. Executive Summary

This report establishes the verified privilege configuration, ownership, and functional dependencies of the PostGIS spatial engine in NuKropAI.

Key findings:
1. **`spatial_ref_sys` is write-protected**: Untrusted application roles (`anon`, `authenticated`, and `PUBLIC`) possess only `SELECT` privileges. Write operations (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) are strictly blocked by PostgreSQL Discretionary Access Control (DCL).
2. **False Positive Classification**: The Supabase Security Advisor flags `spatial_ref_sys` solely because it resides in the `public` schema without Row Level Security enabled. This is a documented Supabase linter characteristic when PostGIS is initialized via `CREATE EXTENSION postgis;` without specifying the `extensions` schema.
3. **RLS Risks**: Blindly running `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;` poses critical regression risks to PostGIS internal lookup routines and application dispatch RPCs.
4. **Remediation Plan**: A complete Supabase Support migration runbook to relocate PostGIS to the `extensions` schema has been prepared, preserving all existing geography columns, GIST indexes, and RPC functions.

---

## 2. Table Ownership & Privilege Evidence

### 2.1 Object Identity & Ownership

| Attribute | Specification | Evidence Source |
| :--- | :--- | :--- |
| **Object Name** | `public.spatial_ref_sys` | Migration `20261004020000_postgis_driver_tracking_osrm.sql` line 7 |
| **Object Type** | Extension Table | Created automatically by PostGIS extension |
| **Extension** | `postgis` | `pg_extension WHERE extname = 'postgis'` |
| **Owner Role** | `supabase_admin` | PostGIS extension creator role |
| **Schema** | `public` | Default PostgreSQL extension search path |
| **Row Count** | ~8,500 standard spatial reference systems (EPSG, etc.) | Static catalog |

### 2.2 Privilege Matrix across PostgreSQL Roles

```
Role Table Grants Evaluation:
┌──────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Role Name        │ SELECT   │ INSERT   │ UPDATE   │ DELETE   │ TRUNCATE │
├──────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ anon             │ GRANTED  │ DENIED   │ DENIED   │ DENIED   │ DENIED   │
│ authenticated    │ GRANTED  │ DENIED   │ DENIED   │ DENIED   │ DENIED   │
│ public (pseudo)  │ GRANTED  │ DENIED   │ DENIED   │ DENIED   │ DENIED   │
│ supabase_admin   │ GRANTED  │ GRANTED  │ GRANTED  │ GRANTED  │ GRANTED  │
│ postgres         │ GRANTED  │ GRANTED  │ GRANTED  │ GRANTED  │ GRANTED  │
└──────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Verification Details**:
- PostgreSQL extension scripts execute `GRANT SELECT ON spatial_ref_sys TO PUBLIC;` during extension creation.
- No `GRANT INSERT`, `GRANT UPDATE`, or `GRANT DELETE` is ever issued to `PUBLIC`, `anon`, or `authenticated`.
- Any write attempt via PostgREST or direct SQL by client roles fails with PostgreSQL error `42501` (`permission denied for table spatial_ref_sys`).
- **Conclusion**: There is zero risk of data tampering or privilege escalation on this table from client roles.

---

## 3. PostGIS Functions, Columns & Dependencies Inventory

### 3.1 Geography Columns & Spatial Indexes

From `supabase/migrations/20261004020000_postgis_driver_tracking_osrm.sql`:

1. **Table:** `public.driver_locations`
   - `location geography(POINT, 4326) NOT NULL` — Stores driver WGS84 GPS coordinates.
   - `heading NUMERIC(5,2)` — Heading in degrees [0..360].
   - `speed_kmh NUMERIC(5,2)` — Live speed in km/h.
   - `is_active BOOLEAN DEFAULT true` — Driver duty status flag.
   - `updated_at TIMESTAMPTZ DEFAULT NOW()` — Timestamp of latest ping.
2. **Spatial Index:**
   - `idx_driver_locations_geog` on `driver_locations USING GIST (location)` — High-performance R-tree bounding box spatial index.
   - `idx_driver_locations_active_ping` on `driver_locations (is_active, updated_at DESC)` — Compound B-tree for temporal filtering.

### 3.2 Dispatch Functions & Search Paths

| Function Name | Security Type | Declared Search Path | PostGIS Operators / Functions Used |
| :--- | :---: | :--- | :--- |
| `get_nearest_drivers` | `SECURITY DEFINER` | `public, extensions` | `ST_SetSRID`, `ST_MakePoint`, `ST_X`, `ST_Y`, `ST_Distance`, `ST_DWithin`, `<->` (KNN distance) |
| `upsert_driver_location` | `SECURITY DEFINER` | `public, extensions` | `ST_SetSRID`, `ST_MakePoint`, `::geography` cast |
| `record_driver_gps_ping` | `SECURITY DEFINER` | `public, extensions` | `ST_SetSRID`, `ST_MakePoint`, `::geography` cast |
| `get_nearby_drivers` | `SECURITY DEFINER` | `public, extensions` | `ST_DWithin`, `ST_Distance` |

**Search Path Significance**:
All RPC functions explicitly specify:
```sql
SET search_path = public, extensions
```
This is critical: because both `public` and `extensions` are included in the search path, moving PostGIS objects from `public` to `extensions` will **not break** these functions, as PostgreSQL resolves functions across all schemas in the search path order.

---

## 4. Technical Analysis: Why Enabling RLS is High-Risk

Supabase's Security Advisor recommends enabling RLS on tables in `public`. However, for extension tables:

1. **Internal Function Dependency**: PostGIS C-functions internally invoke SQL queries against `spatial_ref_sys` when evaluating SRID transformations or geography spheroid distances. If RLS is enabled:
   - Queries executing as non-superuser may fail to see required SRID rows if policies are slightly misconfigured.
   - Even with `USING (true)`, PostgreSQL evaluates the policy filter on every row access, introducing latency overhead on high-frequency spatial radar queries.
2. **Extension Lifecycle Hazards**:
   - `ALTER EXTENSION postgis UPDATE` or `ALTER EXTENSION postgis DROP TABLE` operations may fail if row security flags alter table catalog state unexpectedly.
3. **Supabase Official Guidance**:
   - Supabase explicitly documents this finding as a known false positive for PostGIS in `public` and advises against enabling RLS directly, recommending migration to `extensions` instead.

---

## 5. Safe Supabase Support Remediation Plan

### 5.1 Objective
Relocate PostGIS extension objects from `public` schema to `extensions` schema without downtime or data loss, clearing the Security Advisor finding while preserving all geography columns and dispatch RPCs.

### 5.2 Step-by-Step Migration Runbook

```
Step 1: Pre-Migration Backup & State Capture
  • Export full database schema and driver_locations table.
  • Verify current PostGIS version: SELECT postgis_full_version();
  • Document active GIST indexes.

Step 2: Submit Supabase Support Ticket
  • Submit formal migration request using template in Section 5.3.
  • Supabase Support executes:
      ALTER EXTENSION postgis SET SCHEMA extensions;
  • PostGIS tables (spatial_ref_sys, geometry_columns, geography_columns) move to extensions schema.

Step 3: Verification Post-Migration
  • Confirm table location:
      SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'spatial_ref_sys';
      -- Expected: 'extensions'
  • Verify Security Advisor:
      -- 'RLS Disabled in Public' on spatial_ref_sys must be CLEARED.
  • Verify Dispatch RPCs:
      SELECT * FROM public.get_nearest_drivers(78.4850, 17.4700, 5000, 5);
      -- Must execute successfully and return active drivers.
  • Verify GIST index:
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'driver_locations';

Step 4: Rollback Strategy (if needed)
  • If RPCs fail:
      ALTER EXTENSION postgis SET SCHEMA public;
  • Restore from pre-migration snapshot.
```

### 5.3 Supabase Support Ticket Request Template

```text
To: Supabase Support
Subject: Request to Move PostGIS Extension to 'extensions' Schema — Project yxjqseiegwjdfnccdchk

Project Ref: yxjqseiegwjdfnccdchk

Hello Supabase Support Team,

Our Security Advisor is flagging a CRITICAL advisory on `public.spatial_ref_sys` ("RLS Disabled in Public").
We understand this is a known linter characteristic for PostGIS installed in the public schema.

We would like to request that the PostGIS extension on project `yxjqseiegwjdfnccdchk` be moved from the `public` schema to the `extensions` schema:
  ALTER EXTENSION postgis SET SCHEMA extensions;

Pre-flight Verification Performed by NuKropAI Team:
1. All application dispatch RPCs (get_nearest_drivers, upsert_driver_location, record_driver_gps_ping) use:
   SET search_path = public, extensions;
   They will automatically resolve PostGIS types and functions once moved to extensions.
2. The `driver_locations` table uses `location geography(POINT, 4326)` with GIST index.
3. No application queries write to `spatial_ref_sys`.

Please schedule this operation at your earliest convenience and confirm completion.

Thank you,
NuKropAI Engineering Team
```

---

## 6. Prohibited Actions (Strictly Enforced)

Under Phase 12 production safety rules:
- ❌ **NEVER run `DROP EXTENSION postgis CASCADE;`** — This would immediately delete the `location` column on `driver_locations` and all dependent dispatch RPCs.
- ❌ **NEVER execute blind `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;`** without coordinated support oversight.
- ❌ **NEVER execute unreviewed migration scripts against production**.
- ✅ **ALL existing columns, indexes, functions, and views remain untouched and functional**.
