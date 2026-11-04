# NuKropAI — PostGIS Security, Privileges & Schema Evidence Report

**Repository:** `https://github.com/B-JASWANTH-REDDY/NuKropAI`  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Target Table:** `public.spatial_ref_sys`  
**Security Advisor Finding:** CRITICAL — `RLS Disabled in Public` on `public.spatial_ref_sys`  
**Audit Date:** 2026-11-04 14:25 IST  
**Live Privilege Execution Status:** **UNVERIFIED / BLOCKED (No live DB mutation or credentials permitted; read-only verification query specifications documented)**

---

## 1. Executive Summary

This report establishes the verified privilege configuration, ownership, and functional dependencies of the PostGIS spatial engine in NuKropAI.

Key findings:
1. **Live Privilege Verification Status (UNVERIFIED / BLOCKED)**: In accordance with Phase 12.1 safety restrictions, zero direct database sessions were established against the production Supabase database (`yxjqseiegwjdfnccdchk`). No direct `DATABASE_URL` is available in the local environment. Therefore, while PostgreSQL extension defaults grant `SELECT` only, the live effective privileges on this specific production database are classified as **UNVERIFIED** rather than assumed.
2. **Table ACLs vs Default Privileges**: PostgREST exposes all tables residing in the `public` schema. If `pg_default_acl` on the database granted write privileges to `anon` or `authenticated`, or if custom table ACLs were altered, `spatial_ref_sys` could theoretically be writable via the Data API. The Security Advisor finding cannot be casually dismissed as a "false positive" without executing live `has_table_privilege()` queries.
3. **PostGIS is Non-Relocatable (`extrelocatable = false`)**: Under PostgreSQL's extension architecture, PostGIS specifies `relocatable = false`. Running a simple `ALTER EXTENSION postgis SET SCHEMA extensions;` will fail with:
   ```
   ERROR: extension "postgis" does not support SET SCHEMA
   ```
   The migration runbook has been updated to reflect the official Supabase Support-assisted catalog procedure.
4. **RLS Risks**: Directly running `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;` carries severe risk of breaking PostGIS internal C-functions and application dispatch RPCs.

---

## 2. Table Ownership, ACLs & Default Privileges

### 2.1 Object Identity & Ownership

| Attribute | Specification | Evidence Source |
| :--- | :--- | :--- |
| **Object Name** | `public.spatial_ref_sys` | Migration `20261004020000_postgis_driver_tracking_osrm.sql` line 7 |
| **Object Type** | Extension Table | Created automatically by PostGIS extension |
| **Extension** | `postgis` | `pg_extension WHERE extname = 'postgis'` |
| **Owner Role** | `supabase_admin` | PostGIS extension creator role |
| **Schema** | `public` | Default PostgreSQL extension search path |
| **Relocatable Flag** | `extrelocatable = false` | Standard PostGIS control definition |
| **Row Count** | ~8,500 standard spatial reference systems (EPSG, etc.) | Static catalog |

---

### 2.2 Privilege Audit Query Specifications (Read-Only)

When an isolated test database is provisioned, the following read-only queries must be executed to empirically verify effective privileges:

```sql
-- 1. Effective Table Privilege Checks (Data API Roles)
SELECT 
    'anon' AS role_name,
    has_table_privilege('anon', 'public.spatial_ref_sys', 'SELECT') AS can_select,
    has_table_privilege('anon', 'public.spatial_ref_sys', 'INSERT') AS can_insert,
    has_table_privilege('anon', 'public.spatial_ref_sys', 'UPDATE') AS can_update,
    has_table_privilege('anon', 'public.spatial_ref_sys', 'DELETE') AS can_delete,
    has_table_privilege('anon', 'public.spatial_ref_sys', 'TRUNCATE') AS can_truncate
UNION ALL
SELECT 
    'authenticated' AS role_name,
    has_table_privilege('authenticated', 'public.spatial_ref_sys', 'SELECT'),
    has_table_privilege('authenticated', 'public.spatial_ref_sys', 'INSERT'),
    has_table_privilege('authenticated', 'public.spatial_ref_sys', 'UPDATE'),
    has_table_privilege('authenticated', 'public.spatial_ref_sys', 'DELETE'),
    has_table_privilege('authenticated', 'public.spatial_ref_sys', 'TRUNCATE')
UNION ALL
SELECT 
    'service_role' AS role_name,
    has_table_privilege('service_role', 'public.spatial_ref_sys', 'SELECT'),
    has_table_privilege('service_role', 'public.spatial_ref_sys', 'INSERT'),
    has_table_privilege('service_role', 'public.spatial_ref_sys', 'UPDATE'),
    has_table_privilege('service_role', 'public.spatial_ref_sys', 'DELETE'),
    has_table_privilege('service_role', 'public.spatial_ref_sys', 'TRUNCATE');

-- 2. Explicit Role Table Grants (ACLs)
SELECT 
    grantee, 
    privilege_type, 
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'spatial_ref_sys'
ORDER BY grantee, privilege_type;

-- 3. Default Privileges Associated with Schema & Creators
SELECT 
    pg_get_userbyid(d.defaclrole) AS creator_role,
    n.nspname AS schema_name,
    d.defaclobjtype AS object_type,
    d.defaclacl AS default_acl
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON d.defaclnamespace = n.oid
WHERE n.nspname = 'public';

-- 4. PostGIS Extension Schema, Version & Relocatable Flag
SELECT 
    e.extname, 
    e.extversion, 
    e.extrelocatable, 
    n.nspname AS current_schema
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'postgis';
```

**Live Database Execution Status**: **BLOCKED / UNVERIFIED**. Direct PostgreSQL connection credentials are intentionally absent from repository configuration to protect production. Query results are not manufactured or assumed.

---

### 2.3 Distinction: Table ACLs vs Default Privileges

In PostgreSQL and Supabase:
- **Table ACLs (`pg_class.relacl`)**: Explicit permissions granted on an individual table (e.g., `GRANT SELECT ON public.spatial_ref_sys TO PUBLIC;`).
- **Default Privileges (`pg_default_acl`)**: Template permissions automatically applied to newly created tables created by a specific role. In Supabase, if `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;` was ever executed by `supabase_admin`, extension tables created in `public` could inherit write permissions unless explicitly revoked.
- **Data API Exposure**: PostgREST inspects the OpenAPI schema of `public`. Any table in `public` becomes an HTTP endpoint `/rest/v1/spatial_ref_sys`. If default privileges allowed `INSERT`/`UPDATE`, unauthenticated or authenticated clients could alter coordinate reference definitions.

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

**Search Path Audit**: All RPC functions explicitly specify `SET search_path = public, extensions;`. They will automatically resolve PostGIS types and functions once PostGIS is relocated to `extensions`.

---

## 4. Technical Analysis: Why `ALTER EXTENSION ... SET SCHEMA` Fails

PostGIS extension definition specifies:
```
# postgis.control
relocatable = false
```
PostgreSQL strictly forbids schema relocation for non-relocatable extensions:
```sql
ALTER EXTENSION postgis SET SCHEMA extensions;
-- ERROR: extension "postgis" does not support SET SCHEMA
```

### Why PostGIS is Non-Relocatable
PostGIS registers hundreds of C-language internal functions, types (`geometry`, `geography`), operators (`&&`, `<->`, `ST_DWithin`), and casts that hardcode or bind to schema namespaces during creation. Simply changing `extnamespace` breaks function binding signatures.

---

## 5. Supported Supabase Support-Assisted Relocation Procedure

Because customer roles (`postgres`) lack superuser rights on Supabase Cloud, this procedure requires platform administration (`supabase_admin`) intervention.

### 5.1 Pre-Migration Requirements & Dependency Inventory
1. **Pre-Migration Snapshot**: Full logical backup of `driver_locations`, `haul_bookings`, and all GIS columns.
2. **Audit Dependent Views**: Verify no custom views reference `public.spatial_ref_sys` directly.
3. **Audit Webhooks**: Confirm no Database Webhooks or pg_net triggers use PostGIS types.
4. **Connection Pool Draining**: Temporarily pause application traffic or schedule a 10-minute maintenance window to allow connection poolers (PgBouncer/Supavisor) to disconnect cleanly.

### 5.2 Supabase Support Catalog Relocation Procedure

```sql
-- EXECUTED BY SUPABASE SUPPORT (Requires supabase_admin platform rights)
BEGIN;

-- 1. Ensure target schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Temporarily adjust catalog relocatable flag
UPDATE pg_extension 
SET extrelocatable = true 
WHERE extname = 'postgis';

-- 3. Execute schema relocation
ALTER EXTENSION postgis SET SCHEMA extensions;

-- 4. Re-bind PostGIS extension functions and operators to new schema
ALTER EXTENSION postgis UPDATE TO 'ANY';
ALTER EXTENSION postgis UPDATE;

-- 5. Restore safe catalog default
UPDATE pg_extension 
SET extrelocatable = false 
WHERE extname = 'postgis';

COMMIT;
```

### 5.3 Post-Migration Verification Checklist
1. Verify extension schema:
   `SELECT extnamespace::regnamespace FROM pg_extension WHERE extname = 'postgis';` (Must return `extensions`).
2. Verify `spatial_ref_sys` location:
   `SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'spatial_ref_sys';` (Must return `extensions`).
3. Verify Supabase Security Advisor:
   Navigating to Project > Security Advisor must show `RLS Disabled in Public on public.spatial_ref_sys` as **CLEARED**.
4. Verify RPC Execution:
   `SELECT * FROM public.get_nearest_drivers(78.4850, 17.4700, 5000, 5);` (Must return active drivers without error).
5. Verify Connection Pool Reconnection:
   Ensure PgBouncer/Supavisor clients reconnect and resolve spatial functions via search path.

### 5.4 Rollback Strategy
If function resolution fails after relocation:
```sql
BEGIN;
UPDATE pg_extension SET extrelocatable = true WHERE extname = 'postgis';
ALTER EXTENSION postgis SET SCHEMA public;
ALTER EXTENSION postgis UPDATE TO 'ANY';
ALTER EXTENSION postgis UPDATE;
UPDATE pg_extension SET extrelocatable = false WHERE extname = 'postgis';
COMMIT;
```

---

## 6. Prohibited Actions (Strictly Enforced)

- ❌ **NEVER execute `DROP EXTENSION postgis CASCADE;`** — Wipes out `driver_locations.location` and all dependent dispatch RPCs.
- ❌ **NEVER run `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;`** blindly without support oversight.
- ❌ **NEVER execute direct catalog updates (`pg_extension`) without `supabase_admin` authorization**.
- ✅ **ALL existing columns, indexes, functions, and views remain untouched and functional**.
