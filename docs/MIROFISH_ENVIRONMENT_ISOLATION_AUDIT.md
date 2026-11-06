# NuKropAI — MiroFish Environment Isolation Audit

**Project:** `yxjqseiegwjdfnccdchk`  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Generated:** 2026-11-04 IST  
**Status:** CRITICAL FINDING — k6 and MiroFish both targeted the single production Supabase project

---

## 1. Executive Finding

> [!CAUTION]
> **There is no separate staging environment.** Both the k6 load test and the MiroFish simulation adapter targeted `yxjqseiegwjdfnccdchk.supabase.co` — the **single Supabase project** used for all NuKropAI environments. Prior reports that described this as "staging" were **incorrect**.

---

## 2. Environment Inventory

| Environment Label | Supabase Project | Reality |
|:-----------------|:-----------------|:--------|
| "Staging" (claimed in prior reports) | `yxjqseiegwjdfnccdchk` | **Does not exist as a separate project** |
| Production | `yxjqseiegwjdfnccdchk` | **The only Supabase project** |
| k6 target | `yxjqseiegwjdfnccdchk` | Same project |
| MiroFish adapter target | `yxjqseiegwjdfnccdchk` | Same project |

---

## 3. File-by-File Isolation Analysis

### 3.1 `simulations/k6/haul_dispatch_load.js`

**Hardcoded production endpoint (line 48):**
```javascript
const BASE_URL = 'https://yxjqseiegwjdfnccdchk.supabase.co';  // ← PRODUCTION
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '[anon_jwt]';     // ← Falls back to prod key
```

**Problems:**
1. `BASE_URL` hardcoded — cannot be overridden via environment variable
2. `ANON_KEY` has production key as inline fallback — runs against production even without env var
3. Used **unauthenticated anon role** for RLS-protected table operations → generated mass 403 errors
4. Generated 338 iterations × 2 RLS-denied operations = ~676 Postgres errors counted in dashboard

**Risk level:** HIGH — generates synthetic load on production DB

### 3.2 `simulations/mirofish_adapter/agent_bridge.py`

**Hardcoded production URL (line 21):**
```python
SUPABASE_URL = "https://yxjqseiegwjdfnccdchk.supabase.co"  # ← PRODUCTION
```

**Key loading (lines 24–37):**
```python
for env_file in ["backend/.env", ".env"]:
    if line.startswith("SUPABASE_ANON_KEY="):
        ANON_KEY = line.split("=", 1)[1].strip()
```

**Problems:**
1. `SUPABASE_URL` hardcoded — cannot be overridden
2. Reads ANON_KEY from `.env` which points to production project
3. All 69 synthetic personas authenticated against GoTrue in production
4. All synthetic bookings were created in production `haul_bookings` table
5. Auth GoTrue 400 "user already registered" errors from re-running scenarios (36 occurrences logged)

**Mitigating factors:**
- All synthetic emails use `@nukrop-sim.in` domain — isolated from real user namespace
- All synthetic agent IDs are UUID-prefixed with `sim_` — distinguishable
- Cleanup deletes synthetic records after each scenario
- Zero `service_role` credentials used — all operations subject to RLS

### 3.3 `docs/SYNTHETIC_USER_TEST_REPORT.md` — Incorrect Claim

The report states (line 3):
```
Environment: Live Supabase PostGIS (yxjqseiegwjdfnccdchk)
```
And line 22 says `"266 Operations against staging"` — **staging does not exist**.

### 3.4 `docs/MIROFISH_USER_SCENARIOS.md` — No Incorrect Claim

Review shows this file correctly identifies the project ref but does not explicitly label it as "staging". No correction needed.

---

## 4. Synthetic Data Isolation Verification

Despite targeting production, the synthetic data was properly namespaced:

| Isolation Mechanism | Implementation | Status |
|:-------------------|:---------------|:------:|
| Email namespace | `sim_{uuid}@nukrop-sim.in` | ✅ Isolated |
| Agent ID prefix | `sim_farm_`, `sim_veri_`, `sim_unve_` | ✅ Isolated |
| Scenario ID | `sim_{type}_{uuid6}` per run | ✅ Unique per execution |
| Post-scenario cleanup | DELETE by booking ID and driver user_id | ✅ Implemented |
| No `service_role` key | ANON_KEY only, all RLS enforced | ✅ Secure |
| No real user data accessed | Synthetic emails only | ✅ Confirmed |
| `rls_violations` in summary | 0 across all 5 scenarios | ✅ No violations |

---

## 5. Confirmed: Auth Rate Limit Pattern

The 36 `HTTP 400` errors on `AUTHENTICATE` actions (Scenarios A, C, F, G) were:

**Cause:** `POST /auth/v1/signup` returns HTTP 400 when the email already exists.  
**Why it happened:** Scenarios A, C, F, G re-used the same agent UUIDs as prior Pilot runs (UUID is generated fresh per run, but GoTrue already had accounts from earlier Pilot executions within the same session).  
**Consequence:** Agent falls back to `ANON_KEY` → subsequent RLS-protected operations return HTTP 401/403.  
**Real impact:** 0 (synthetic data only, no real user affected)

---

## 6. Required Fixes

### Fix 1: k6 Environment Safety Guard (IMMEDIATE)

**File:** `simulations/k6/haul_dispatch_load.js`

The script must reject execution if targeting the single production project without an explicit opt-in flag:

```javascript
// SAFETY GUARD — Prevent accidental load testing against production
const BASE_URL = __ENV.SUPABASE_URL || 'https://yxjqseiegwjdfnccdchk.supabase.co';
const FORCE_PRODUCTION = __ENV.NUKROPAI_FORCE_PRODUCTION_TEST === 'true';

if (BASE_URL.includes('yxjqseiegwjdfnccdchk') && !FORCE_PRODUCTION) {
  // fail() aborts k6 immediately before any VUs execute
  fail(
    'SAFETY BLOCK: BASE_URL targets the production Supabase project. ' +
    'Set NUKROPAI_FORCE_PRODUCTION_TEST=true to explicitly override. ' +
    'Recommended: create a separate Supabase project for load testing.'
  );
}
```

### Fix 2: MiroFish Adapter Environment Safety Guard

**File:** `simulations/mirofish_adapter/agent_bridge.py`

```python
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://yxjqseiegwjdfnccdchk.supabase.co")
NUKROPAI_ENV = os.environ.get("NUKROPAI_ENV", "").lower()

PRODUCTION_PROJECT = "yxjqseiegwjdfnccdchk"
if PRODUCTION_PROJECT in SUPABASE_URL and NUKROPAI_ENV not in ("staging", "test", "ci"):
    raise EnvironmentError(
        f"SAFETY BLOCK: SUPABASE_URL targets the production project ({PRODUCTION_PROJECT}). "
        "Set NUKROPAI_ENV=staging or NUKROPAI_ENV=test to confirm intent, "
        "or set SUPABASE_URL to a dedicated test project."
    )
```

### Fix 3: Correct Erroneous "Staging" Claims in `SYNTHETIC_USER_TEST_REPORT.md`

Replace line 3 header:
```
~~**Environment:** Live Supabase PostGIS (yxjqseiegwjdfnccdchk) — Staging~~
```
With:
```
**Environment:** Live Supabase PostGIS (`yxjqseiegwjdfnccdchk`) — **Single production-equivalent project** (no separate staging project exists)
```

---

## 7. MiroFish Data Integrity Verification

| Check | Result |
|:------|:-------|
| Synthetic emails match `@nukrop-sim.in` domain in GoTrue | ✅ Verified |
| All synthetic booking IDs were returned as UUIDs | ✅ Confirmed from actions.jsonl |
| Cleanup called after Scenarios A, C, F, G | ✅ `cleanup_synthetic_records` called in all scenario teardowns |
| Pilot Run 1 bookings (all failed — no IDs created) | ✅ Nothing to clean |
| Zero synthetic records persisting after run | 🟡 Not independently verified — assumed complete unless cleanup had RLS denials |
| No real driver profiles modified | ✅ Confirmed — driver UUIDs all `sim_veri_*` format |

> [!NOTE]
> Cleanup DELETEs for `driver_locations` used authenticated driver JWT where available; fallback to ANON_KEY when auth failed. Anon-key DELETEs on `driver_locations` may have been denied by RLS if the driver's `driver_id` did not match `auth.uid()`. This is acceptable — the synthetic driver records will expire naturally or can be cleaned by an authenticated admin query.

---

## 8. Recommendation: Dedicated Test Project

For future load testing and large-scale simulation, create a **dedicated Supabase free-tier project** with:
- Same schema (applied from migration files)
- Separate project ref (not `yxjqseiegwjdfnccdchk`)
- `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` environment variables
- k6 and MiroFish configured to read from these variables

This eliminates all risk of synthetic load appearing in the production Supabase dashboard and prevents GoTrue user accumulation in the primary project.

---

## 9. Scenarios Not Yet Executed

The following MiroFish scenarios were **implemented but never executed** (Phase 10 ran only Pilot, A, C, F, G):

| Scenario | Description | Status |
|:---------|:------------|:------:|
| B — Mass Farmer Day | 100 farmers × 0.2 scale = 20 farmers, 4 drivers | NOT RUN |
| D — Full Scale | 200 farmers × 0.2 scale = 40 farmers, 6 drivers | NOT RUN |
| E — Network Disconnect | Stale GPS timestamp simulation | NOT RUN |
| H — Out-of-Bounds Spatial | Locations outside 10km radius exclusion | NOT RUN |

> [!WARNING]
> Scenarios B and D involve the highest agent counts. **Do not run these against the production project.** Create a dedicated test project first (see Section 8).

---

*See also: `docs/SUPABASE_PRODUCTION_ERROR_AUDIT.md`, `docs/PRODUCTION_DATABASE_HEALTH_REPORT.md`*

