# NuKropAI — Master Application Lifecycle & Flow Specification

**Project:** NuKropAI — Agricultural Operating System  
**Document ID:** `DOC-FLOW-001`  
**Classification:** Core Engineering Specification (Permanent Architecture Rule)  
**Status:** Canonical & Active  
**Last Updated:** November 4, 2026  

---

## 1. Core Principle: Zero-Regression & Flow Preservation

NuKropAI is an integrated agricultural operating system serving Indian farmers and rural logistics haulers. It is not an arbitrary collection of isolated screens. 

### Permanent Non-Negotiable Rule
1. **Never break existing user journeys** to deliver a new screen or sub-feature.
2. **Every screen transition, API call, and state mutation** must respect the 10-stage lifecycle below.
3. Any code change that introduces blank screens, skipped onboarding steps, or broken back navigation is a **critical release blocker**.

```mermaid
flowchart TD
    S1["Stage 1: Native Splash Screen"] --> S2["Stage 2: App Initialization"]
    S2 --> S3{"Session Restored?"}
    S3 -- No --> S4["Stage 3: Agrarian Onboarding"]
    S4 --> S5["Stage 4: Multi-Channel Authentication"]
    S5 --> S6["Stage 5: Role Guard & Profile Setup"]
    S3 -- Yes --> S6
    S6 --> S7["Stage 6: Role Dashboard (Farmer / Driver)"]
    S7 --> S8["Stage 7: Complete Application Modules (18 Views)"]
    S8 --> S9["Stage 8: Interactive Navigation & Touch State"]
    S9 --> S10["Stage 9: Lifecycle & Background Resilience"]
    S10 --> S11["Stage 10: Clean Logout & Multi-Tenant Isolation"]
    S11 --> S5
```

---

## 2. The 10 Lifecycle Stages

### Stage 1 — Native Splash Screen
- **Visuals**: Centered NuKropAI SVG leaf crest, laser scanner bar animation, and agrarian telemetry steps.
- **Timing**: 1,200ms–2,400ms duration on cold launch; dismisses immediately upon initial resource readiness.
- **Resilience**: Zero white/black blank frames. Replay capability supported from Settings (`openSettingsModal` -> Replay Splash).
- **Parity**: Emulated in WebView via `renderSplashScreen(container)` and mirrored natively in Android `MainActivity`.

### Stage 2 — App Initialization
- **Config & Client Init**: Supabase client (`supabaseClient`), Fastify backend proxy, and local storage rehydration.
- **Hardware Sensors**: Geolocation query initiated (`navigator.geolocation` or native `AndroidBridge.getGpsLocation()`).
- **Data Preloading**: Precomputes BioRx dosage tables, N-P-K matrices, and reads SWR persistent cache.
- **Error Shielding**: Network timeouts drop into cached mode gracefully; never abort UI initialization.

### Stage 3 — Onboarding (Plantix-Style)
- **First-Time Detection**: Driven by `localStorage.getItem('nukrop_onboarding_plantix_completed')`.
- **Steps**:
  1. Language Selection (English, Telugu, Hindi, Tamil, Kannada, Marathi, Punjabi, Gujarati).
  2. Multi-Crop Selection (Cotton, Chilli, Paddy, Maize, Tomato, Groundnut, Soybean, Wheat).
  3. Farm Size Configuration (Acres).
  4. Permission Primer (Location & Camera access justification under DPDP Act 2023).
- **Completion**: `finishPlantixOnboarding()` saves active crops to `nukrop_user_active_crops` and advances to login.

### Stage 4 — Multi-Channel Authentication
- **Methods**:
  - Phone OTP (6-digit PIN with `inputmode="numeric"` and `autocomplete="one-time-code"`).
  - Email & Password with visible show/hide toggles.
  - Google OAuth deep-link (`nukrop://auth-callback`).
  - Guest Mode fallback for immediate offline access.
- **Anti-Conflict Role Guard**: Accounts registered as Farmer cannot login as Driver without role transition; Prevents cross-role collision (`NuKropRoleGuard`).
- **Session Persistence**: JWT access & refresh tokens securely stored; automatic background token rotation.

### Stage 5 — Role Selection & Profile Setup
- **Role Verification**: Server-authoritative `app_metadata.role` enforced over client claims.
- **Farmer Routing**: Routes to `openScreen('home')`.
- **Driver Routing**: Routes to `openScreen('driver_dashboard')`.
- **Profile Binding**: Dharani passbook number, KCC credit limits, and farm coordinates bound to session.

### Stage 6 — Role Dashboards
- **Farmer Dashboard (`home`)**:
  - Live APMC Mandi rates with MSP benchmark tags.
  - 3-hour micro-climate spray window advisory.
  - Active crop switcher pill with localized pest alerts.
  - Quick action floating command dock (`Ctrl+K`).
- **Driver Cockpit (`driver_dashboard`)**:
  - Haul request radar and available load feeds.
  - Online/Offline availability toggle.
  - Earnings ledger and active trip card.

### Stage 7 — 18 Agrarian Modules
Every module is connected to real backend endpoints and local fallback caches:
1. `home` — Agro-meteorology and Mandi ticker.
2. `scanner` — Dual foliar camera capture with Gemini Vision AI diagnosis.
3. `market` — Agmarknet real-time prices across Indian APMC yards.
4. `gramhaul` — Freight logistics Leaflet map with 10km hauler proximity.
5. `gramhaul_tracking` — Live route telemetry, 4-digit OTP PIN verification, dynamic UPI QR.
6. `agristack` — Farm parcel boundary mapping and Soil Health Card index.
7. `equipment` — CHC machinery rental marketplace.
8. `loan` — KCC credit limit calculator and interest subvention.
9. `khata` — Income/Expense ledger with optimistic deletion and undo toasts.
10. `chat` — Localized agronomy chat assistant.
11. `bioshield` — Multi-state pest outbreak surveillance engine.
12. `biorx` — Knapsack sprayer dosage calculator and tank mix planner.
13. `calc_fert` — Soil-test N-P-K recommendation engine.
14. `calc_pest` — Chemical active ingredient dilution calculator.
15. `calc_budget` — Cost of cultivation and harvest profit forecaster.
16. `community` — Interactive Kisan social network (likes, follows, posts, edits, deletions).
17. `driver_dashboard` — Driver cockpit and load dispatcher.
18. `profile` — Profile settings, crop management, splash replay, language switch.

### Stage 8 — Navigation & Interactive Touch State
- **Hardware Back**: `handleMobileBackPress()` intercepts open bottom-sheets, modals, and drawers before allowing application exit.
- **Touch Ergonomics**: All interactable buttons enforce `>=44px` height and `touch-action: manipulation`.
- **Optimistic State**: Immediate UI updates for likes and ledger items with 5-second reversible undo toasts (`showLuxuryToastWithUndo`).

### Stage 9 — Background & Android Lifecycle
- **Backgrounding**: Session tokens preserved in persistent storage; `DriverLocationService` foreground notification keeps GPS tracking active during hauling.
- **Reopening**: Cold boots re-check token validity and boot directly to the user's active view without splash repetition.
- **Crash Immunity**: Unhandled exceptions caught by global error boundaries; zero unhandled promise rejections.

### Stage 10 — Clean Logout & Multi-Tenant Isolation
- **Purge**: `executeSignOutToLogin()` invalidates session tokens, purges user-partitioned SWR cache (`NuKropSWR.invalidateUserCache()`), and resets active screens.
- **Cross-Account Safety**: Sensitive farm records and private chats are never exposed to subsequent users on the same physical handset.
- **Shared Retention**: Public APMC mandi benchmarks and regional pest matrices remain cached for offline access.
