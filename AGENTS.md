# AGENTS.md — Permanent Engineering Instructions for NuKropAI

Welcome, coding agent. This file is the permanent, persistent source of truth for all autonomous and pair-programming agents working on the NuKropAI repository.

---

## 1. MANDATORY READING BEFORE ANY TASK

Before writing or modifying a single line of code, you MUST read:
1. `docs/APP_FLOW_MASTER.md` — The canonical 10-stage application lifecycle and flow preservation directives.
2. `docs/SCREEN_NAVIGATION_MAP.md` — Authoritative routing, 18 `APP_VIEWS`, and back-navigation stack.
3. `docs/ENGINEERING_QUALITY_STANDARD.md` — The authoritative 20 UI/UX and 20 Security standards.
4. `docs/FEATURE_DEFINITION_OF_DONE.md` — The mandatory quality checklist required for every completed task.
5. `docs/REGRESSION_TEST_MATRIX.md` — The master zero-regression test matrix.

Do not wait for the user to remind you. If you are starting a new session or subagent, these standards apply unconditionally.

---

## 2. NON-NEGOTIABLE SAFETY & OPERATIONAL RULES

1. **Pull Request #2 Must Remain OPEN and UNMERGED**:
   - The active working branch is strictly `feature/nukropai-complete-production-remediation`.
   - Never push directly to `main` or merge PR #2.
2. **Production Database Isolation (`yxjqseiegwjdfnccdchk`)**:
   - The production Supabase project (`yxjqseiegwjdfnccdchk.supabase.co`) is strictly protected.
   - Never send test traffic, load tests, or synthetic users to this reference.
   - All tests and simulation adapters must validate targets using `simulations/mirofish_adapter/target_validator.py`.
3. **100% Asset Parity Enforcement**:
   - The primary application engine is located at `app/src/main/assets/index.html`.
   - The browser test runner is located at `nukrop_emulator.html`.
   - Any modification to `index.html` MUST be copied byte-for-byte to `nukrop_emulator.html`. Parity is enforced by automated tests (`test_onboarding_and_splash_flows.js: OS.1` and `run_e2e_tests.js: R.S.1`).
4. **No Facades or Simulated Movement**:
   - Never use fake driver accounts, simulated GPS movement intervals (`setInterval`), or hardcoded market tickers pretending to be live.
   - If an external dependency or hardware sensor is unavailable, honestly report it as `BLOCKED BY EXTERNAL DEPENDENCY` or use clearly labeled fallback data.
5. **No Secret Leaks**:
   - Never commit `.env`, service-role keys, or private tokens.
6. **Zero-Regression & App Flow Preservation**:
   - Never remove existing screens, break navigation, skip onboarding steps, or replace working backend APIs with mocks.
   - All 8 Mandatory User Journeys (`tests/test_mandatory_user_journeys.js`) must pass 100% on every commit.

---

## 3. MULTI-SURFACE ARCHITECTURAL ROLES

| Surface | Path | Role & Authority |
| :--- | :--- | :--- |
| **Android Native Engine** | `app/src/main/java/` | Kotlin activities, `DriverLocationService` foreground GPS tracking, and `AndroidBridge` interface. |
| **Full Agricultural OS** | `app/src/main/assets/index.html` | Authoritative single-page application hosting all 18 agrarian views, Leaflet maps, and responsive layouts. |
| **Browser Test Mirror** | `nukrop_emulator.html` | Headless Playwright & Node VM test target. Must match `index.html` with 100% SHA-256 identity. |
| **Web Marketing & APK** | `web/src/` | Vite + React 18 web landing, DPDP compliance modals, Command Menu (`Ctrl+K`), and APK sync. |
| **Enterprise Backend** | `backend/src/` | Fastify + TypeScript API with fail-closed JWT auth, Agmarknet ingestion, and resilient DB fallback. |
| **Database & PostGIS** | `supabase/migrations/` | PostgreSQL migrations, PostGIS spatial functions, and Row Level Security (RLS) policies. |

---

## 4. MANDATORY TASK WORKFLOW

For EVERY task (feature, bugfix, UI change, refactor, API endpoint, migration):

### Step 1: Pre-Flight Audit
- Review `docs/APP_FLOW_MASTER.md` and `docs/ENGINEERING_QUALITY_STANDARD.md`.
- Identify which of the 20 UI/UX standards and 20 Security standards apply.
- Check existing unit and E2E tests for the affected feature.

### Step 2: Implementation
- Reuse established design tokens from `docs/PHASE13_UI_UX_SYSTEM.md`.
- Implement content-shaped shimmer skeletons for all asynchronous states.
- Connect real backend operations; enforce RLS and server-side authorization.
- If modifying `app/src/main/assets/index.html`, immediately sync `nukrop_emulator.html`.

### Step 3: Verification Suites
Run the relevant automated verification commands before reporting completion:
- **Mandatory User Journeys**: `node tests/test_mandatory_user_journeys.js` (8 journeys A-H)
- **Backend Tests**: `npm --prefix backend test` (13 JWT + 12 Controller + 9 Fallback + 15 Mandi sync = 49 tests)
- **Android Tests**: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; .\gradlew testDebugUnitTest`
- **Web Build**: `npm --prefix web run build`
- **E2E Test Runner**: `node tests/run_e2e_tests.js` (203 tests)
- **Onboarding / Splash**: `node tests/test_onboarding_and_splash_flows.js` (10 tests)
- **Modals & Dialogs**: `python tests/test_inspect_modals.py` (18 modal tests)
- **Target Safety**: `python -m unittest tests/test_simulation_safety_guards.py` (15 safety tests)

### Step 4: Quality Checklist Reporting
Include the standardized Per-Feature Quality Report table in your final response as specified in `docs/FEATURE_DEFINITION_OF_DONE.md`.
