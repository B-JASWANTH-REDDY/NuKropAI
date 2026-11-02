# NuKropAI Feature Acceptance Matrix

**Audit Date:** November 2026  
**Status:** 100% AUDITED AND PASSING ALL QUALITY GATES  

---

| Module ID | Module & Feature | Acceptance Criteria | Test Reference | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **MOD-01** | **Role Guard & Identity Separation** | Farmers and Drivers cannot register or authenticate using identical phone/email credentials; role cross-access is hard-blocked. | `tests/run_e2e_tests.js` (R.F.1–R.F.6, R.N.1–R.N.4) | **ACCEPTED (PASS)** |
| **MOD-02** | **Onboarding & Splash Engine** | Five-stage boot telemetry, botanical emblem animation, DPDP Act consent badge, safe early-skip teardown without background interval leaks, interactive replay from settings. | `tests/test_onboarding_and_splash_flows.js` (OS.1–OS.10) | **ACCEPTED (PASS)** |
| **MOD-03** | **AI Crop Scanner (Gemini Vision)** | Real-time plant disease detection using Gemini 1.5 Flash Vision, zero fabricated mock results, ICAR-aligned organic and chemical remedies, Supabase sync to `disease_scans`. | `tests/run_e2e_tests.js` (T0.1.3, T0.1.4), `tests/test_real_world_production_verification.py` (DIR-5.1–DIR-5.5) | **ACCEPTED (PASS)** |
| **MOD-04** | **Live Mandi Rates & Price Alerts** | Real government prices from Agmarknet / DMI, no `Math.random()` simulation, state and district filtering, historical price trend rendering, real-time alert triggers. | `tests/test_mandi_pipeline_sync.py` (M1–M8), `tests/test_real_world_production_verification.py` (DIR-3.1–DIR-3.7) | **ACCEPTED (PASS)** |
| **MOD-05** | **GramHaul Logistics & Fleet Radar** | Live truck search, authentic distance and price calculation, real-time GPS telemetry updates, driver trip state machine. | `tests/test_real_world_production_verification.py` (DIR-7.1–DIR-7.2), `tests/test_rls_multi_role_adversarial.py` (Phase 3) | **ACCEPTED (PASS)** |
| **MOD-06** | **Community Forum & Ephemeral Stories** | Real user posts, 24-hour expiring story engine (`public.community_stories`), verified farmer badges, live comments, optimistic like toggling. | `tests/test_community_stories_and_real_posts.js` (CS.1–CS.10) | **ACCEPTED (PASS)** |
| **MOD-07** | **Weather & Agronomic Advisory** | Live weather from Open-Meteo API, hourly precipitation probability, agricultural spray-window indicators, clear provenance tagging. | `tests/test_real_world_production_verification.py` (DIR-2.1–DIR-2.9) | **ACCEPTED (PASS)** |
| **MOD-08** | **Krishi Khata & Financial Ledger** | KCC balance tracking, loan amortization calculator, expense ledger, government subsidy discovery engine (`public.subsidies`). | `tests/test_rls_multi_role_adversarial.py` (Phase 2), `tests/test_sql_security_audit.py` (DIR-1.1–DIR-1.3) | **ACCEPTED (PASS)** |
| **MOD-09** | **IoT Hardware Bridge & Interlocks** | Device registration with authenticated owner verification, sensor telemetry stream, safety interlock against commanding offline pumps/relays. | `tests/test_real_world_production_verification.py` (DIR-6.1–DIR-6.6) | **ACCEPTED (PASS)** |
| **MOD-10** | **Database Security & RLS** | All 30 tables enforce RLS, publication loop is immune to PostgreSQL error 42710, private storage bucket configuration, role whitelisting trigger. | `tests/test_sql_security_audit.py` (32 tests), `tests/test_rls_multi_role_adversarial.py` (19 tests) | **ACCEPTED (PASS)** |
