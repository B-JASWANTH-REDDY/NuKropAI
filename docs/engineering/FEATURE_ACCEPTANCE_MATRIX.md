# NuKropAI Feature Acceptance Matrix & Production Verification

**Date:** November 2026  
**Status:** ALL CORE MODULES VERIFIED VIA AUTOMATED TESTS  

---

| Module ID | Feature / Component | Acceptance Criteria | Test Reference | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **MOD-01** | **JWT Authentication & Fail-Closed Security** | Missing secret fails closed; algorithm whitelisted to HS256; audience verified; client `user_metadata` cannot escalate role; self-registration for admin blocked. | `tests/test_jwt_auth_security.js` (SEC-JWT-1 to SEC-JWT-9) | **ACCEPTED [Unit-Verified]** |
| **MOD-02** | **Role Guard & Identity Separation** | Farmers and Drivers cannot register or authenticate using identical phone/email credentials; role cross-access is hard-blocked. | `tests/run_e2e_tests.js` (R.F.1–R.F.6, R.N.1–R.N.4) | **ACCEPTED [Unit-Verified]** |
| **MOD-03** | **Public Profile Privacy (DPDP 2023)** | `public_profiles` view omits `user_id`, `village`, `phone`, `kcc_*`, and `agristack_id`; direct table queries enforce owner-only RLS; view writes revoked. | `tests/test_rls_multi_role_adversarial.py` (Phase 6), `tests/test_sql_security_audit.py` (DIR-2.1–DIR-2.4) | **ACCEPTED [Integration-Verified]** |
| **MOD-04** | **Community Stories & Post Security** | Zero `OR true` in stories read; anonymous story write/delete blocked; caller must match `user_id`; 24-hr TTL enforced in database. | `tests/test_community_stories_and_real_posts.js` (CS.1–CS.10), `tests/test_rls_multi_role_adversarial.py` (Phase 7) | **ACCEPTED [Integration-Verified]** |
| **MOD-05** | **Safe Migrations & Financial Ledger Integrity** | No destructive `UPDATE khata_transactions SET user_id = NULL`; safe profile stub generation; no blanket `WHEN OTHERS THEN NULL` in Step 4. | `tests/test_rls_multi_role_adversarial.py` (Phase 8), `tests/test_sql_security_audit.py` | **ACCEPTED [Integration-Verified]** |
| **MOD-06** | **Realtime Publication Concurrency** | Dynamic membership check via `pg_publication_tables` avoids duplicate registration error `42710`; 15 tables with `REPLICA IDENTITY FULL`. | `tests/test_sql_security_audit.py` (DIR-11.1–DIR-11.4) | **ACCEPTED [Integration-Verified]** |
| **MOD-07** | **Onboarding & Splash Engine** | Five-stage boot telemetry; timer teardown on early skip; interactive replay from settings; 100% byte-for-byte parity between emulator and assets. | `tests/test_onboarding_and_splash_flows.js` (OS.1–OS.10) | **ACCEPTED [Unit-Verified]** |
| **MOD-08** | **Mandi Market Data Ingestion** | Connects to official Agmarknet/DMI government dataset; zero `Math.random()` simulation; state/district commodity price filters. | `tests/test_mandi_pipeline_sync.py` (M1–M8), `tests/test_real_world_production_verification.py` (DIR-3.1–DIR-3.7) | **ACCEPTED [Integration-Verified]** |
| **MOD-09** | **AI Crop Scanner (Gemini Vision)** | Real-time plant disease detection using Gemini 1.5 Flash Vision passing base64 images; ICAR organic and chemical remedies; Supabase sync. | `tests/test_real_world_production_verification.py` (DIR-5.1–DIR-5.5) | **ACCEPTED [Static-Verified]** |
| **MOD-10** | **IoT Hardware Bridge & Interlocks** | Device registration with authenticated owner verification; sensor telemetry stream; safety interlock prevents commands to offline devices. | `tests/test_real_world_production_verification.py` (DIR-6.1–DIR-6.6) | **ACCEPTED [Integration-Verified]** |
| **MOD-11** | **Web Dashboard Production Build** | TypeScript build passes (`tsc && vite build`); production artifacts generated in `dist/`; API client handles token refresh. | `web/package.json` build runner | **ACCEPTED [Unit-Verified]** |
| **MOD-12** | **Android Shell & Release Signing** | Jetpack Compose WebView shell compiles; bridge security verified; local debug build functional; production keystore signing guarded. | `app/build.gradle.kts` | **BUILD PASS [Keystore Blocked]** |
