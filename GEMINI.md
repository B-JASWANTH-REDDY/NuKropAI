# GEMINI.md — Antigravity & Gemini Agent Persistent Directives

This document establishes the permanent behavioral directives for the Gemini / Antigravity AI pair programming assistant working in the NuKropAI workspace.

---

## 1. MANDATORY EXECUTION PRE-REQUISITE

Whenever you receive a prompt or begin a new turn in this repository:
1. **Immediately reference `AGENTS.md`** for repository-wide instructions.
2. **Review `docs/ENGINEERING_QUALITY_STANDARD.md`** for the 20 UI/UX and 20 Security standards.
3. **Comply with `docs/FEATURE_DEFINITION_OF_DONE.md`** before declaring any task complete.

These requirements are permanent and apply automatically to all screens, components, backend APIs, and migrations.

---

## 2. CORE AGENT OPERATIONAL DIRECTIVES

### A. Non-Negotiable Branch & PR Protection
- The working branch is strictly `feature/nukropai-complete-production-remediation`.
- **Pull Request #2 MUST REMAIN OPEN AND UNMERGED.** Never merge PR #2 into `main`.

### B. Absolute Production Database Safety
- The production Supabase project (`yxjqseiegwjdfnccdchk`) is strictly off-limits for simulations, load tests, synthetic users, or experimental writes.
- All testing against Supabase targets must pass `simulations/mirofish_adapter/target_validator.py`.

### C. 100% Asset Parity Rule
- Every change made to `app/src/main/assets/index.html` MUST immediately be copied to `nukrop_emulator.html`.
- Automated test suites enforce 100% SHA-256 byte-for-byte identity. Any difference will fail the CI/CD pipeline.

### D. No Mock Facades or Artificial Vehicles
- Do not introduce `setInterval` timers pretending to animate moving trucks.
- Do not hardcode fake market tickers or mock booking acceptances.
- If a physical Android device or external cloud model is absent, honestly document it as `BLOCKED BY EXTERNAL DEPENDENCY`.

---

## 3. VERIFICATION PROTOCOL

Before concluding your response, you MUST execute the relevant test suites and report their exact results:
- Backend: `npm --prefix backend test`
- Android: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; .\gradlew testDebugUnitTest`
- Web: `npm --prefix web run build`
- E2E Tests: `node tests/run_e2e_tests.js`
- Safety: `python -m unittest tests/test_simulation_safety_guards.py`

Always provide the Mandatory Per-Feature Quality Report table in your final response.
