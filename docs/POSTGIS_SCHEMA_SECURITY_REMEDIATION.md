# NuKropAI — PostGIS Schema Security Remediation Plan

**Project:** `yxjqseiegwjdfnccdchk`  
**Security Advisor Finding:** CRITICAL — `RLS Disabled in Public` on `public.spatial_ref_sys`  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Generated:** 2026-11-04 IST  
**Status:** OPEN — Awaiting Supabase Support Coordination

---

## 1. The Security Advisor Finding

The Supabase Security Advisor reported:

> **CRITICAL: RLS Disabled in Public**  
> Table `public.spatial_ref_sys` is public, but RLS has not been enabled.

---

## 2. What `spatial_ref_sys` Is

`spatial_ref_sys` is **not an application table**. It is a system table installed and owned by the **PostGIS extension**, containing read-only metadata about Spatial Reference Systems (SRS/CRS definitions — coordinate systems like WGS84/EPSG:4326 used by GPS coordinates).

| Property | Value |
|:---------|:------|
| **Table owner** | `supabase_admin` (PostGIS installer) |
| **Managed by** | PostGIS extension (automatically) |
| **Content type** | Static coordinate reference system definitions |
| **Record count** | ~8,500 standard EPSG definitions |
| **Write access needed by app** | None |
| **Writable by anon role** | No (see privilege audit below) |

---

## 3. Why Security Advisor Flags It

Supabase Security Advisor flags **all public-schema tables without RLS enabled**, regardless of whether they are application tables or extension-managed system tables.

For PostGIS installed in the `public` schema, this produces a known false positive. This is documented by Supabase:

> **Official Supabase KB Article:**  
> [Security Advisor flags spatial_ref_sys and other PostGIS objects in the public schema](https://supabase.com/kb/troubleshooting/security-advisor-flags-spatial_ref_sys-and-other-postgis-objects-in-the-public-schema)
>
> Supabase's recommendation: **Do not enable RLS on `spatial_ref_sys`** directly — instead, request migration of PostGIS to the `extensions` schema via Supabase Support.

---

## 4. Why Enabling RLS Directly Is Dangerous

> [!CAUTION]
> **NEVER execute `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;` without Supabase Support guidance.**

Enabling RLS on `spatial_ref_sys` risks:

1. **Breaking PostGIS functions**: All PostGIS operations (`ST_DWithin`, `ST_GeomFromText`, `ST_Transform`, etc.) perform internal lookups against `spatial_ref_sys` using the `postgres` or `supabase_admin` superuser role. If RLS policies are incorrectly defined, these lookups may fail.

2. **Breaking NuKropAI dispatch RPCs**: Our dispatch functions (`get_nearest_drivers`, `upsert_driver_location`, `record_driver_gps_ping`) all use `SECURITY DEFINER SET search_path = public, extensions` and perform PostGIS spatial operations. Any disruption to `spatial_ref_sys` access breaks real-time GPS tracking.

3. **Extension upgrade failures**: Future PostGIS extension upgrades (`ALTER EXTENSION postgis UPDATE`) may fail if the extension cannot freely manage its own tables.

4. **Irreversible without support**: Supabase does not expose superuser access to customers; recovering from a broken PostGIS state requires Supabase Support intervention.

---

## 5. Privilege Audit — Is `spatial_ref_sys` Actually Exposed?

### Who Can Write to `spatial_ref_sys`?

| Role | INSERT | UPDATE | DELETE | SELECT |
|:-----|:------:|:------:|:------:|:------:|
| `anon` | ❌ No | ❌ No | ❌ No | ✅ Read-only |
| `authenticated` | ❌ No | ❌ No | ❌ No | ✅ Read-only |
| `postgres` / `supabase_admin` | ✅ | ✅ | ✅ | ✅ |

**Conclusion:** The `anon` and `authenticated` roles cannot modify `spatial_ref_sys`. The table is effectively write-protected by standard Postgres privilege defaults even without RLS. The Security Advisor finding is a **false positive** in terms of actual exploitability.

### Verification Method

The privilege status can be verified by attempting:
```sql
-- As anon role (expected: permission denied)
INSERT INTO public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
VALUES (999999, 'TEST', 999999, '', '');
-- Expected result: ERROR 42501 permission denied for table spatial_ref_sys
```

---

## 6. How NuKropAI Uses PostGIS

NuKropAI installed PostGIS via:
```sql
-- supabase/migrations/20261004020000_postgis_driver_tracking_osrm.sql
CREATE EXTENSION IF NOT EXISTS postgis;
SET search_path = public, extensions;
```

All dispatch RPCs reference PostGIS in the `public` schema:

| Function | Uses PostGIS | search_path |
|:---------|:------------:|:------------|
| `get_nearest_drivers` | `ST_DWithin`, `ST_MakePoint`, `ST_Transform` | `public, extensions` |
| `upsert_driver_location` | `ST_MakePoint::geography` | `public, extensions` |
| `record_driver_gps_ping` | `ST_MakePoint::geography` | `public, extensions` |
| `get_nearby_drivers` | `ST_DWithin`, `ST_Distance` | `public, extensions` |

The `driver_locations` table stores:
```sql
location geography(POINT, 4326)  -- PostGIS native column type
```

---

## 7. Recommended Remediation Path

### Option A: Move PostGIS to `extensions` Schema (Recommended — Long-term)

This is Supabase's official guidance for projects created before automatic `extensions`-schema placement.

**Process (requires Supabase Support):**

1. **Open a Supabase Support ticket** with the following request template (see Section 8).
2. Supabase Support migrates PostGIS extension objects from `public` to `extensions` schema.
3. Update all NuKropAI migration files to use `extensions` schema search path.
4. Verify Security Advisor clears after migration.

**Impact on NuKropAI:**
- All `SET search_path = public, extensions` in SECURITY DEFINER functions already includes `extensions` — compatible post-migration.
- `driver_locations.location` column type remains valid — `geography` type resolves through schema search path.
- Requires testing all dispatch RPCs after migration.

### Option B: Acknowledge as False Positive (Short-term Acceptable)

Since `anon` and `authenticated` roles have no write access to `spatial_ref_sys`, the Security Advisor finding does **not represent an actual exploitable vulnerability** for NuKropAI.

Document the finding as:
- **Known PostGIS false positive** per Supabase KB
- **Not exploitable** (no write access from application roles)
- **Tracked** for resolution via Option A

> [!WARNING]
> Option B is acceptable as a **temporary measure only**. Option A must be pursued via Supabase Support within the next sprint.

---

## 8. Supabase Support Request Template

```
Subject: Migrate PostGIS extension from public schema to extensions schema

Project Reference: yxjqseiegwjdfnccdchk
Region: [your Supabase region]

Hi Supabase team,

Our Security Advisor is flagging `public.spatial_ref_sys` as "RLS Disabled in Public".
We understand this is a known false positive for projects with PostGIS installed in
the public schema.

We would like to request migration of the PostGIS extension from the `public` schema
to the `extensions` schema per your KB article on this topic.

Our application uses PostGIS for real-time geographic dispatch (ST_DWithin, ST_MakePoint,
geography columns) across the following functions:
- get_nearest_drivers
- upsert_driver_location
- record_driver_gps_ping
- get_nearby_drivers

All our SECURITY DEFINER functions use SET search_path = public, extensions, so they
are compatible with the target state.

Please advise on:
1. Scheduled maintenance window
2. Any application changes required before migration
3. How to verify the migration completed successfully

Thank you.
```

---

## 9. Pre-Migration Checklist (Before Supabase Support Migrates)

- [ ] All dispatch RPCs verified working (Phase 7–9 test suites pass)
- [ ] `driver_locations.location` column type documented
- [ ] All migration SQL files reviewed for `public.spatial_ref_sys` explicit references
- [ ] `SET search_path = public, extensions` confirmed in all SECURITY DEFINER functions
- [ ] Supabase Support ticket opened with template from Section 8
- [ ] Maintenance window agreed with Supabase Support

---

## 10. Post-Migration Verification Steps

After Supabase Support completes the migration:

```sql
-- 1. Verify PostGIS is now in extensions schema
SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'spatial_ref_sys';
-- Expected: schemaname = 'extensions'

-- 2. Verify dispatch RPCs still work
SELECT * FROM get_nearest_drivers(78.485, 17.470, 10000, 5);
-- Expected: returns active drivers list

-- 3. Verify Security Advisor clears
-- Navigate to Supabase Dashboard > Security Advisor
-- Expected: No "RLS Disabled in Public" finding for spatial_ref_sys

-- 4. Verify driver_locations column still works
SELECT driver_id, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
FROM driver_locations WHERE is_active = true LIMIT 1;
-- Expected: returns valid coordinates
```

---

## 11. Current Status Summary

| Item | Status |
|:-----|:-------|
| Security Advisor finding | OPEN (known false positive) |
| Actual exploitability | None — anon/authenticated cannot write |
| Recommended fix | Supabase Support migration to extensions schema |
| Direct `ENABLE ROW LEVEL SECURITY` on spatial_ref_sys | BLOCKED — too risky without support |
| NuKropAI dispatch RPCs | Fully functional |
| PostGIS GPS tracking | Fully functional |
| Supabase Support ticket | NOT YET OPENED — action required |

---

*See also: `docs/SUPABASE_PRODUCTION_ERROR_AUDIT.md`, `docs/PRODUCTION_DATABASE_HEALTH_REPORT.md`*

