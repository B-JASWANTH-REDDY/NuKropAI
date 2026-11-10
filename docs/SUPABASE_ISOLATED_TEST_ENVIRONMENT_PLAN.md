# NuKropAI — Isolated Supabase Test Environment Plan

**Repository:** `https://github.com/B-JASWANTH-REDDY/NuKropAI`  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Purpose:** Architecture, Provisioning & Execution Plan for Isolated Simulation & Load Testing  
**Date:** 2026-11-04 14:08 IST  
**Status:** **READY FOR PROVISIONING (Awaiting Explicit User Authorization)**

---

## 1. Context & Isolation Mandate

Currently, NuKropAI has **only one confirmed Supabase project**: `yxjqseiegwjdfnccdchk` (Production).

Under Phase 12 safety hardening:
- The production project reference `yxjqseiegwjdfnccdchk` is **permanently blocked** by fail-closed code guards in both `simulations/mirofish_adapter/target_validator.py` and `simulations/k6/haul_dispatch_load.js`.
- Simulations and load tests **cannot execute** until an isolated test environment is provisioned and configured via `TEST_SUPABASE_URL` and `TEST_SUPABASE_ANON_KEY`.
- In accordance with production safety rules, **no cloud project will be created or modified automatically without explicit user authorization**.

---

## 2. Recommended Deployment Options

### Option A: Local Supabase CLI with Docker (Recommended for Zero Cost & Complete Data Isolation)

Running a local Supabase instance on the local workstation via the official Supabase CLI provides:
- True zero cost (no cloud resource limits).
- Complete network isolation from the internet.
- Instant reset capability via `supabase db reset`.
- Full PostGIS extension support running in PostgreSQL 15/16.

### Option B: Dedicated Supabase Cloud Free-Tier Project

Creating a separate Supabase cloud project (e.g. `nukrop-sim-test-xx`) provides:
- Identical cloud latency characteristics to production.
- Realtime WebSocket testing across distributed clients.
- Separate dashboard and monitoring graphs.

---

## 3. Step-by-Step Provisioning Runbook

### Option A: Local Supabase Setup

```bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Initialize local Supabase in agriculture-ai-os root
cd c:\Users\bjasw\Downloads\agriculture-ai-os
supabase init

# 3. Start local Supabase stack (requires Docker Desktop running)
supabase start

# Expected Output:
# API URL:        http://127.0.0.1:54321
# GraphQL URL:    http://127.0.0.1:54321/graphql/v1
# DB URL:         postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Studio URL:     http://127.0.0.1:54323
# Inbucket URL:   http://127.0.0.1:54324
# anon key:       eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (local test key)
# service_role:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (local test key)

# 4. Apply all 11 canonical migration files in chronological order
supabase db reset
```

---

### Option B: Dedicated Cloud Project Setup

```bash
# 1. Login to Supabase via CLI or Dashboard
supabase login

# 2. Create a new test project (REQUIRES EXPLICIT USER CONSENT)
# Navigate to https://database.new
# Project Name:   NuKropAI-Simulation-Sandbox
# Database Pwd:   [SECURE_EPHEMERAL_PASSWORD]
# Region:         ap-south-1 (Mumbai)

# 3. Retrieve isolated test credentials
# Project URL:    https://<NEW_TEST_REF>.supabase.co
# Anon Key:       eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Isolated Anon Key)
# NOTE: DO NOT copy or use the production service_role key!
```

---

## 4. Canonical Migration Application Order

To ensure 100% schema parity with production, the test database must execute the exact 11 migration files in chronological order:

```sql
-- 1. Core Profile & Initial RLS
\i supabase/migrations/20260901000001_initial_schema_and_rls.sql

-- 2. Haul Bookings & Logistics
\i supabase/migrations/20261003000001_haul_logistics_and_realtime.sql

-- 3. Production Mandi Tables & Views
\i supabase/migrations/20261003010000_production_mandi_and_rls.sql

-- 4. PostGIS Spatial Engine (Best Practice: specify extensions schema!)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
\i supabase/migrations/20261004020000_postgis_driver_tracking_osrm.sql

-- 5. AgriStack Cadastral DCS Integration
\i supabase/migrations/20261004030000_agristack_cadastral_dcs.sql

-- 6. AgriStack Relational Search
\i supabase/migrations/20261004040000_agristack_relational_search.sql

-- 7. Authentic AgriStack Registry
\i supabase/migrations/20261004050000_authentic_agristack_registry.sql

-- 8. Production Schema Alignment (Foreign Keys & Constraints)
\i supabase/migrations/20261103000001_production_schema_alignment.sql

-- 9. Production RLS Alignment (Strict Policies)
\i supabase/migrations/20261103000002_production_rls_alignment.sql

-- 10. Realtime Driver Dispatch & OSRM Routing Functions
\i supabase/migrations/20261104000001_realtime_driver_dispatch.sql

-- 11. Dispatch RPC Parameter Reconciliations
\i supabase/migrations/20261104000002_reconcile_driver_dispatch_rpcs.sql
```

---

## 5. Environment Configuration for Safe Testing

Once the isolated test environment is running, set the following environment variables (in local session or `.env.test` file):

```powershell
# PowerShell Session Example:
$env:TEST_SUPABASE_URL = "http://127.0.0.1:54321"       # or https://<NEW_TEST_REF>.supabase.co
$env:TEST_SUPABASE_ANON_KEY = "<ISOLATED_TEST_ANON_KEY>" # Isolated test key ONLY
```

> [!CAUTION]
> **NEVER** set `TEST_SUPABASE_URL` to `https://yxjqseiegwjdfnccdchk.supabase.co`.
> **NEVER** use the production `service_role` key in any simulation or test environment.

---

## 6. Safe Execution Commands

### 6.1 Running MiroFish Simulation Scenarios

Once `TEST_SUPABASE_URL` is set, execute the scenarios safely:

```powershell
# 1. Run Pilot Scenario (5 Farmers, 2 Drivers, 1 Unverified Driver)
python -m simulations.mirofish_adapter.run_simulation --pilot

# 2. Run Scenario B (Mass Farmer Day: 20 Farmers, 4 Drivers at 0.2 scale)
python -m simulations.mirofish_adapter.run_simulation --scenario B --scale 0.2

# 3. Run Scenario D (Full Scale Corridors: 40 Farmers, 6 Drivers at 0.2 scale)
python -m simulations.mirofish_adapter.run_simulation --scenario D --scale 0.2

# 4. Run Scenario F (Booking Competition Race: 5 Concurrent Drivers)
python -m simulations.mirofish_adapter.run_simulation --scenario F

# 5. Run All Scenarios in Sequence
python -m simulations.mirofish_adapter.run_simulation --all --scale 0.2
```

### 6.2 Running k6 High-Concurrency Load Tests

```powershell
# Run k6 load test against isolated test instance
& "C:\Program Files\k6\k6.exe" run simulations/k6/haul_dispatch_load.js
```

The safety guard will print:
```
----------------------------------------------------------------------
🛡️  k6 TARGET SAFETY VALIDATION: PASSED
  • Target URL:     http://127.0.0.1:54321
  • Production Ref: yxjqseiegwjdfnccdchk (PROTECTED / BLOCKED)
----------------------------------------------------------------------
```

---

## 7. Teardown & Reset Procedure

After completing simulations:
- Local: Run `supabase db reset` to restore database to pristine state.
- Cloud: Truncate or delete all records where `email LIKE '%@nukrop-sim.in'`.
- Clean log artifacts: `simulations/logs/actions.jsonl` can be archived or cleared.

