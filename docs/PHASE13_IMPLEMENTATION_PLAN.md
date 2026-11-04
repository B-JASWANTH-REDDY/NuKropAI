# NuKropAI — Phase 13 Implementation Plan & Engineering Roadmap

**Project:** NuKropAI Sovereign Agrarian Operating System  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Base Commit:** `ce7fe1c`  
**Target Pull Request:** PR #2 (MUST remain OPEN & UNMERGED)  
**Author:** Lead Software Architect & Production Reliability Engineer  
**Date:** November 2026  

---

## 1. Safety Rules & Operational Boundaries

Every engineering batch in Phase 13 adheres strictly to the non-negotiable rules:
1. **Production Isolation**: The production Supabase project (`yxjqseiegwjdfnccdchk`) is strictly protected. No simulations, load tests, or automated exploratory writes shall target this reference.
2. **Fail-Closed Validation**: All integration suites and simulation adapters must validate targets using `simulations/mirofish_adapter/target_validator.py`.
3. **No Fabricated Data / No Facades**:
   - No mock booking acceptances or simulated moving vehicle intervals (`setInterval`).
   - No invented Mandi prices or false live tickers.
   - If a cloud model API key (`GEMINI_API_KEY`, `GROQ_API_KEY`) is unset, the feature must transparently execute scientific botanical fallback rules (ICAR / PJTSAU) and report provenance clearly.
4. **Parity Preservation**: Every UI, CSS, and JS change in `app/src/main/assets/index.html` must be synchronized byte-for-byte to `nukrop_emulator.html` to guarantee parity across Android and Web.
5. **PR #2 Integrity**: PR #2 remains OPEN and UNMERGED against `main`. All delivery occurs on `feature/nukropai-complete-production-remediation`.

---

## 2. Iterative Implementation Batches

### Batch 1: Design Tokens, Typography & App-Wide UI/UX System
- Unify color palette, typography (`Plus Jakarta Sans`), spacing scales, elevation shadows, and corner radii.
- Add `@media (prefers-reduced-motion: reduce)` accessibility rules to all keyframe animations.
- Implement reusable design tokens and deliver `docs/PHASE13_UI_UX_SYSTEM.md`.

### Batch 2: Skeleton Loader Suite & Async State Infrastructure
- Create 10+ modular shimmer skeleton generators matching actual view dimensions:
  - `renderMandiPricesSkeleton()`
  - `renderScannerEvaluatingSkeleton()`
  - `renderEquipmentMarketplaceSkeleton()`
  - `renderCommunityFeedSkeleton()`
  - `renderFarmKhataSkeleton()`
  - `renderOutbreakAlertsSkeleton()`
  - `renderNearbyDriversSkeleton()`
  - `renderWeatherDashboardSkeleton()`
  - `renderGovtSchemesSkeleton()`
  - `renderNotificationsSkeleton()`
- Integrate skeletons into `openScreen()` transitions so users never encounter blank layouts or content popping.
- Add explicit stale-cache badges (`<span class="stale-cache-pill">`) where cached or offline data is displayed.

### Batch 3: Feature Connection & Modals Verification
- Audit and harden all 54 modals and interactive dialogs across the 18 screens:
  - GramHaul booking creation, driver 4-digit OTP modal, and live trip status updates.
  - Crop scanner foliar diagnosis, save-to-khata, and registered CIB&RC medicine recommendations.
  - Equipment rental booking validation (10-digit mobile number) and CHC official allotment pass.
  - Farm Khata income/expense transactions, season P&L, and crop tagging.
  - Community feed post creation with image/video attachments, likes, comments, and ownership deletion.
  - Government scheme eligibility checklist and KCC pre-approved limit.

### Batch 4: Verification, Building & Multi-Suite Testing
- Run Fastify backend test suite (`npm --prefix backend test`): verify JWT security, controller integration, db fallback, and mandi sync.
- Run Android unit tests (`.\gradlew testDebugUnitTest` with JBR 21): verify 15 Robolectric and unit test classes.
- Run Web build (`npm --prefix web run build`): verify TypeScript and Vite bundling.
- Run E2E suites (`tests/run_e2e_tests.js`, `test_onboarding_and_splash_flows.js`, `test_inspect_modals.py`).
- Run safety guard tests (`python -m unittest tests/test_simulation_safety_guards.py`).

### Batch 5: Documentation & Git Checkpoint
- Deliver all 7 required Phase 13 engineering documents:
  1. `docs/PHASE13_FULL_PRODUCT_AUDIT.md`
  2. `docs/PHASE13_IMPLEMENTATION_PLAN.md`
  3. `docs/PHASE13_UI_UX_SYSTEM.md`
  4. `docs/PHASE13_FEATURE_ACCEPTANCE_MATRIX.md`
  5. `docs/PHASE13_TEST_RESULTS.md`
  6. `docs/PHASE13_EXTERNAL_DEPENDENCIES.md`
  7. `docs/PHASE13_RELEASE_READINESS.md`
- Stage and commit changes in logical reviewable batches, push to origin, verify PR #2 status.
