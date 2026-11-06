# NuKropAI — Mandatory Feature Definition of Done (DoD)

**Document Version:** 1.0.0 (Authoritative Verification Manual)  
**Governing Standard:** `docs/ENGINEERING_QUALITY_STANDARD.md`  
**Permanent Instructions:** `AGENTS.md` & `GEMINI.md`  
**Active Working Branch:** `feature/nukropai-complete-production-remediation`  
**Target Pull Request:** PR #2 (Must remain OPEN and UNMERGED against `main`)

---

## 1. Overview & Purpose

This document provides the mandatory Definition of Done (DoD) checklist that MUST be executed and documented for every feature, bugfix, screen addition, API modification, and architectural refactor in the NuKropAI repository.

No code change may be considered complete, merged, or signed off without satisfying the criteria below.

---

## 2. Standard Status Classifications

When assessing a feature against the 20 UI/UX and 20 Security standards, each item MUST be categorized using exactly one of the following five statuses:

| Status | Definition | Requirement |
| :--- | :--- | :--- |
| `IMPLEMENTED` | Standard was created, modified, or enhanced during this task. | Must provide file path, symbol, and behavior description. |
| `ALREADY PRESENT AND VERIFIED` | Standard was previously implemented and verified intact. | Must cite existing code reference and automated test. |
| `NOT APPLICABLE` | Standard does not apply to this specific feature or surface. | Must provide explicit technical justification. |
| `BLOCKED` | Standard cannot function due to an external live service or hardware dependency. | Must identify missing credential, hardware, or API with error signature. |
| `DEFERRED` | Standard is intentionally scheduled for a future architectural milestone. | Must specify tracking issue, target phase, and fallback behavior. |

---

## 3. Mandatory Per-Feature DoD Checklist

Every pull request or task completion report must include this completed evaluation table.

### 3.1 The 20 UI/UX Interaction Standards

| # | UI/UX Standard | Permitted Status | Verification Criteria & Evidence Requirement |
| :- | :--- | :--- | :--- |
| **UX-01** | **Skeleton Loaders** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Dimension-matching shimmer (`.skeleton-shimmer`) rendered during async fetches. Zero blank containers or generic spinners. Empty, error, and retry states provided. |
| **UX-02** | **Optimistic Updates** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Reversible actions (likes, bookmarks, draft additions) reflect instantly with automatic rollback on error. Irreversible actions require confirmation and server verification. |
| **UX-03** | **Command Menu (Ctrl+K)** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Searchable modal palette on web desktop routes to all major modules. Quick search actions accessible on mobile headers. |
| **UX-04** | **Shortcut Hints** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Desktop keyboard hints (`Esc`, `Enter`, `Ctrl+K`) visible on desktop; cleanly suppressed on touch-only mobile viewports. |
| **UX-05** | **Undo Toasts** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Actionable "Undo" pill provided for reversible removals (deleting drafts, removing items). Accurate rollback state restored. |
| **UX-06** | **Stale-While-Revalidate** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Cached local data displayed instantly on view open; background fetch updates view. `<span class="stale-cache-pill">` displays timestamp transparency. |
| **UX-07** | **Pre-Rendering & Fast Paint** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Static web assets pre-compiled (`tsc && vite build`). No private farmer credentials or survey numbers leaked in pre-rendered bundles. |
| **UX-08** | **BlurHash / Placeholder** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Low-resolution image placeholder or CSS gradient displayed while media loads. Zero cumulative layout shift (CLS = 0). |
| **UX-09** | **View Transitions** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Smooth hardware-accelerated transitions (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`). Respects `prefers-reduced-motion`. |
| **UX-10** | **Swipe-to-Dismiss Sheets** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Modal sheets and bottom sheets support drag/touch dismissal without triggering while scrolling inner content. |
| **UX-11** | **Interruptible Animations** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Animations never lock user input or delay urgent user actions. Splash screen and scanner animations dismiss immediately on tap. |
| **UX-12** | **Predictive Back Navigation** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Android hardware back button hierarchically closes fullscreen video, modals, camera streams, and nested views before exiting. |
| **UX-13** | **Accessible Hit Slop** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | All interactive buttons, chips, and icons have a minimum physical hit area of 44×44 dp (ideally 48×48 dp). |
| **UX-14** | **Safe Area Insets** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Accommodates notches, camera cutouts, and Android navigation bars using `--sat` and `--sab` CSS environment variables. |
| **UX-15** | **One-Time Code (OTP) Autofill**| `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | 4-digit PIN/OTP inputs declare `autocomplete="one-time-code"`, support numeric keypad, and never leak plaintext to logs. |
| **UX-16** | **Tabular Numerical Typography**| `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Financial amounts, Mandi rates, GPS telemetry, and booking codes use `font-variant-numeric: tabular-nums` to prevent jitter. |
| **UX-17** | **Balanced Headlines** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Hero headers and alert titles utilize `text-wrap: balance` to prevent awkward typographic orphans. |
| **UX-18** | **Continuous / Squircle Corners**| `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Consistent corner radii applied across cards (16-20px), buttons (12-14px), pills (999px), and modals (28-48px). |
| **UX-19** | **Idempotency Keys on Mutations**| `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Haul bookings, loan requests, and ledger transactions send unique idempotency tokens (`GH-BK-...` or UUIDs) to prevent double-charging. |
| **UX-20** | **Safe Triangle Menus** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Desktop hover submenus implement triangular cursor paths; touch mobile interfaces utilize direct tap triggers. |

---

### 3.2 The 20 Permanent Security Standards

| # | Security Standard | Permitted Status | Verification Criteria & Evidence Requirement |
| :- | :--- | :--- | :--- |
| **SEC-01** | **Hide Private API Keys** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | No service-role keys, private secrets, or database passwords in frontend code, Android assets, or web bundles. |
| **SEC-02** | **Purge Git Secrets** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Sensitive `.env` files untracked. No historical credentials in commits. Zero secrets committed. |
| **SEC-03** | **Public DB Keys Solely with RLS** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Public `SUPABASE_ANON_KEY` used strictly with PostgreSQL Row Level Security (RLS). Not an authorization bypass. |
| **SEC-04** | **Enable RLS on All Tables** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | All tables in `public` schema have RLS enabled. Explicit SELECT, INSERT, UPDATE, DELETE policies defined. |
| **SEC-05** | **Encrypt Data in Transit & Rest** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | HTTPS/TLS 1.3 enforced for all network calls. Encrypted Supabase storage buckets for sensitive user media. |
| **SEC-06** | **Server-Side Authentication** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Operations verify identity via cryptographically signed JWT (`auth.uid()`). UI route guards treated as convenience only. |
| **SEC-07** | **Lock Record Access (Isolation)** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Tenant isolation verified: farmers only access their own records; drivers only access their assigned trips and vehicles. |
| **SEC-08** | **Block Field Tampering** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Writable column allowlists prevent unauthorized updates to `user_id`, `role`, `is_verified`, or `payment_status`. |
| **SEC-09** | **Secure Session Storage** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Tokens stored in isolated localStorage or Android Keystore private storage. Cookies use `HttpOnly; Secure; SameSite`. |
| **SEC-10** | **Cryptographic Password Hashing**| `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Managed Argon2/Bcrypt via Supabase GoTrue. Zero custom or plaintext password handling. |
| **SEC-11** | **Rate-Limit Auth Endpoints** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Sensitive auth, OTP, and dispatch endpoints throttled against credential stuffing and brute-force attacks. |
| **SEC-12** | **Bot Protection on Public Forms**| `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Public contact and onboarding inputs protected by rate limiting and input structure validation. |
| **SEC-13** | **Parameterize All Queries** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | 0 raw SQL string concatenations. All queries use PostgREST query builders or parameterized prepared statements. |
| **SEC-14** | **Validate All Input Server-Side** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Strict validation on data types, bounds, string lengths, coordinates (-90..90, -180..180), and allowed enum values. |
| **SEC-15** | **Escape User Content (XSS)** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | All user input escaped prior to DOM injection. No unsanitized `innerHTML` with user-controlled strings. |
| **SEC-16** | **Restrict File Uploads** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | File uploads restricted to approved MIME types (JPEG, PNG, MP4), size limits (<= 10MB), stored in private buckets. |
| **SEC-17** | **Trim API Responses** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Endpoints select only required columns. Zero exposure of other users' confidential phone numbers or land records. |
| **SEC-18** | **Configure Security Headers** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Production web bundle declares CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`. |
| **SEC-19** | **Force HTTPS Everywhere** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Insecure `http://` blocked in `AndroidManifest.xml` (`android:usesCleartextTraffic="false"`). All APIs load over HTTPS. |
| **SEC-20** | **Dependency Vulnerabilities** | `IMPLEMENTED` \| `ALREADY PRESENT` \| `N/A` | Zero high or critical vulnerabilities in production dependencies (`npm audit`, `pip check`). |

---

## 4. Multi-Surface Synchronization Gate

Whenever any code change affects UI views, assets, or Android bridges, the following synchronization gate MUST be satisfied:

```
[ ] 1. SHA-256 Parity Gate:
       - app/src/main/assets/index.html and nukrop_emulator.html have 100% IDENTICAL SHA-256 hashes.
       - Verified by: node tests/test_onboarding_and_splash_flows.js (Test OS.1)

[ ] 2. Android Bridge Consistency:
       - JavaScript calls to window.AndroidBridge are guarded with:
         if (window.AndroidBridge && typeof window.AndroidBridge.<method> === 'function')
       - Native methods in MainActivity.kt or DriverLocationService.kt exist and handle errors gracefully.

[ ] 3. Web Portal Build Gate:
       - npm --prefix web run build completes with exit code 0.
       - Built assets in web/dist/ remain completely free of leaked private environment variables.
```

---

## 5. Non-Negotiable Operational & Safety Boundaries

```
[ ] 1. Target Safety Validation:
       - All tests, simulation adapters, and scripts validate targets with simulations/mirofish_adapter/target_validator.py.
       - NEVER execute load tests, k6 runs, or synthetic user loops against yxjqseiegwjdfnccdchk.supabase.co.

[ ] 2. Zero Facades:
       - No setInterval timers simulating moving vehicles.
       - No fake driver accounts presented as real verified drivers.
       - No hardcoded market rates claiming to be live realtime feeds.
       - Honest fallback or BLOCKED reporting when sensors or live services are absent.

[ ] 3. Pull Request Hygiene:
       - Target branch is feature/nukropai-complete-production-remediation.
       - Pull Request #2 remains OPEN and UNMERGED against main.
```

---

## 6. Mandatory Verification Suite Checklist

Before committing or reporting completion of any task, run and record the results of the following verification commands:

| Suite | Command | Expected Outcome |
| :--- | :--- | :--- |
| **Safety Guardrails** | `python -m unittest tests/test_simulation_safety_guards.py` | 15/15 tests PASS |
| **Onboarding & Parity** | `node tests/test_onboarding_and_splash_flows.js` | 10/10 tests PASS (including OS.1 byte parity) |
| **Full E2E Runner** | `node tests/run_e2e_tests.js` | 203/203 tests PASS |
| **Modals & Dialogs** | `python tests/test_inspect_modals.py` | 18/18 modal tests PASS |
| **Backend Integration** | `npm --prefix backend test` | 49/49 tests PASS (JWT, Controllers, Mandi) |
| **Web Marketing Build** | `npm --prefix web run build` | Vite build succeeds (exit code 0) |
| **Android Unit Tests** | `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; .\gradlew testDebugUnitTest` | Gradle testDebugUnitTest passes |

---

## 7. Sign-Off Approval Gate

A feature is considered **OFFICIALLY COMPLETE** only when all applicable boxes are checked and recorded in the task summary.
