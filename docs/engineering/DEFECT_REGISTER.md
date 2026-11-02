# NuKropAI Defect Register & Resolution Tracking

**Branch:** `feature/nukropai-complete-production-remediation`  
**Status:** ALL DOCUMENTED DEFECTS REMEDIATED & VERIFIED VIA AUTOMATED TESTS  

---

## Exhaustive Defect Register

### DEF-001: PostgreSQL Realtime Publication Concurrency Abort (P0)
* **Symptom:** `ERROR: 42710: relation "driver_telemetry" is already member of publication "supabase_realtime"`.
* **Component:** `supabase/CANONICAL_PRODUCTION_SETUP.sql`, `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`.
* **Root Cause:** Executing `ALTER PUBLICATION ... ADD TABLE` on an existing publication member aborts the transaction in PostgreSQL.
* **Remediation:** Inspect `pg_publication_tables` prior to execution and catch only `duplicate_object`.
* **Status:** **RESOLVED** (`tests/test_sql_security_audit.py`).

---

### DEF-002: Hardcoded JWT Verification Secret & Fail-Open Fallback (P0)
* **Symptom:** JWT authentication fell back to `'SUPER_SECURE_JWT_SECRET_KEY_12345'` when environment variables were absent.
* **Component:** `backend/src/middleware/auth.ts`, `backend/src/controllers/auth.controller.ts`.
* **Root Cause:** Prototype fallback strings left in backend authentication middleware.
* **Remediation:** Removed all hardcoded fallbacks. Enforced fail-closed behavior: missing `SUPABASE_JWT_SECRET` / `JWT_SECRET` returns HTTP 401. Enforced algorithm whitelisting (`HS256`) and audience verification. Sanitized error messages to avoid secret or stack trace disclosure.
* **Status:** **RESOLVED** (`tests/test_jwt_auth_security.js`, tests SEC-JWT-1 to SEC-JWT-5).

---

### DEF-003: Client-Controlled Role Escalation to Administrator (P0)
* **Symptom:** Attackers could set `user_metadata: { role: 'admin' }` in client signup or token payload to gain administrator privileges.
* **Component:** `backend/src/middleware/auth.ts`, `backend/src/controllers/auth.controller.ts`.
* **Root Cause:** Middleware blindly trusted `decoded.user_metadata?.role`.
* **Remediation:** Extracted authoritative roles exclusively from server-controlled `app_metadata.role` or `service_role`. Untrusted `user_metadata` claims default to unprivileged `'farmer'`. Self-registration as `'admin'` in `auth.controller.ts` is rejected with HTTP 403.
* **Status:** **RESOLVED** (`tests/test_jwt_auth_security.js`, tests SEC-JWT-6 to SEC-JWT-9).

---

### DEF-004: Insecure Permissive Community Stories RLS Policies (P0)
* **Symptom:** `community_stories` read policy contained `OR true`, and write/delete policies permitted `auth.role() = 'anon'`.
* **Component:** `supabase/CANONICAL_PRODUCTION_SETUP.sql`, `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`.
* **Root Cause:** Overly permissive policies introduced during early prototyping.
* **Remediation:** Removed `OR true`. Public SELECT is restricted to unexpired stories (`expires_at > now()`) while creators can view their own stories. Anonymous INSERT and DELETE are completely removed. Enforced caller ownership (`auth.uid()::text = user_id OR auth.uid()::text = author_id`).
* **Status:** **RESOLVED** (`tests/test_rls_multi_role_adversarial.py`, Phase 7).

---

### DEF-005: Sensitive Identifier & Location Exposure in Public Profile View (P0)
* **Symptom:** `public.public_profiles` view exposed internal auth `user_id` and private location `village`.
* **Component:** `public.public_profiles` view in SQL setup scripts.
* **Root Cause:** Broad column selection without strict DPDP Act 2023 data minimization.
* **Remediation:** Removed `user_id` and `village` from the view projection. View now exposes only non-sensitive public metadata (`id`, `farmer_id`, `full_name`, `avatar_url`, `district`, `state`, `role`, `agristack_verified`, `preferred_language`, `created_at`). Explicitly revoked `INSERT, UPDATE, DELETE` from public roles.
* **Status:** **RESOLVED** (`tests/test_rls_multi_role_adversarial.py`, Phase 6).

---

### DEF-006: Destructive Financial Transaction Ownership Overwrite (P0)
* **Symptom:** Migration Step 4 executed `UPDATE public.khata_transactions SET user_id = NULL` for orphaned records.
* **Component:** Step 4 in `CANONICAL_PRODUCTION_SETUP.sql` and `COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`.
* **Root Cause:** Heavy-handed orphan cleanup that wiped transaction ownership.
* **Remediation:** Replaced destructive NULLing with safe profile stub insertion (`INSERT INTO public.profiles ... ON CONFLICT DO NOTHING`), preserving historical ledger records and owner links.
* **Status:** **RESOLVED** (`tests/test_rls_multi_role_adversarial.py`, Phase 8).

---

### DEF-007: PostgreSQL 0A000 View Dependency on Column Type Cast (P0)
* **Symptom:** `ERROR: 0A000: cannot alter type of a column used by a view or rule DETAIL: rule _RETURN on view public_profiles depends on column "id"`.
* **Component:** Step 4 in SQL setup scripts.
* **Root Cause:** Attempting to alter `profiles.id` type while dependent view `public_profiles` existed.
* **Remediation:** Dropped view without cascade prior to migration, conditioned type casts on `data_type != 'text'`, and recreated view in Step 4B.
* **Status:** **RESOLVED** (`scripts/fix_view_dependency_and_cast.py`).

---

### DEF-008: Blanket Exception Swallowing in Database Migrations (P1)
* **Symptom:** Multiple DO blocks used `WHEN OTHERS THEN NULL`, masking genuine DDL errors.
* **Component:** Step 4 and Realtime publication loop.
* **Root Cause:** Defensive anti-crash coding without precise exception targeting.
* **Remediation:** Removed blanket `WHEN OTHERS THEN NULL`. Only expected idempotent conditions (`WHEN duplicate_object THEN NULL`) are trapped.
* **Status:** **RESOLVED** (`supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`).

---

### DEF-009: Dual Role Identity Collision (Farmer vs Driver) (P1)
* **Symptom:** Users could register both as a Farmer and as a Transporter using identical credentials.
* **Component:** `NuKropRoleGuard`, `app/src/main/assets/index.html`.
* **Root Cause:** Absence of pre-existing role lookup during authentication.
* **Remediation:** Implemented `checkRoleConflict` in role guard to reject conflicting role registrations.
* **Status:** **RESOLVED** (`tests/run_e2e_tests.js`, tests R.F.1–R.F.6).

---

### DEF-010: Splash Engine Timer Leak on Early Advance (P1)
* **Symptom:** Tapping to skip splash left background interval running.
* **Component:** `advanceSlide` in `app/src/main/assets/index.html`.
* **Root Cause:** Missing `clearInterval(splashTimer)` on manual advance.
* **Remediation:** Attached timer to `window.splashTimer` and cleared explicitly on touch advance.
* **Status:** **RESOLVED** (`tests/test_onboarding_and_splash_flows.js`, test OS.3).
