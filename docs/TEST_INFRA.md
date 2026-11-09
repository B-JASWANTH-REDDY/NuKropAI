# NuKropAI Agrarian OS — End-to-End Test Infrastructure (TEST_INFRA.md)

## 1. Overview & Architectural Scope

NuKropAI Agrarian OS is an enterprise-grade agricultural intelligence platform built with a dual-surface architecture:
1. **Android Native Surface**: Kotlin, Jetpack Compose, CameraX, Supabase-kt, ExoPlayer/WebView, Retrofit/OkHttp, and on-device TFLite inference (`DiseaseDetector.kt`).
2. **Web Emulator & WebView Runtime**: `app/src/main/assets/index.html` (Android embedded asset) and `nukrop_emulator.html` (Desktop/PWA preview) powered by vanilla ES6+, HTML5 Canvas/Video, and REST client libraries.
3. **Cloud Infrastructure**: Supabase Cloud (`https://yxjqseiegwjdfnccdchk.supabase.co`) with GoTrue v2.196.0, PostgREST tables (`user_profiles`, `community_posts`, `mandi_live_rates`, `disease_scans`), and Cloud Storage (`community-media`).
4. **Multimodal Vision AI**: Google Generative Language API (`gemini-1.5-flash:generateContent`) with `inlineData` image payload and structured JSON output grammar.
5. **National Market Engine**: Live Agmarknet APMC price engine (`api.data.gov.in`) + Supabase Tier-1 cache + GPS reverse-geocoding binding.

This test infrastructure implements a rigorous, opaque-box, requirement-driven verification methodology designed to guarantee zero mock regressions, full protocol compliance, and rock-solid production readiness across all four core pillars:
- **R1: Live Supabase Authentication & Persistent Session Rehydration**
- **R2: Gemini Vision AI Integration & Resilient Scanner Engine**
- **R3: Kisan Community Media Feed (Photo/Video Upload & Playback)**
- **R4: Real Agmarknet Market Data & Mandi Location Integration**

---

## 2. 4-Tier Testing Methodology

The test suite is structured into four distinct, progressive verification tiers:

```
┌─────────────────────────────────────────────────────────────┐
│             Tier 4: Real-World Scenarios                    │
│   (End-to-End Farmer Journey: Login -> Weather -> Scan ->  │
│          Remedy -> Mandi Rates -> Community Share)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│          Tier 3: Cross-Feature Combinations                 │
│      (Auth ↔ Community, Auth ↔ Mandi, Vision ↔ BioRx,       │
│                Restart ↔ Feed Persistence)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│          Tier 2: Boundary & Corner Cases                    │
│    (Token Expiry, Cold Start, API 429 Backoff, Corrupt      │
│      Bytes, Unicode Names, Offline Fallbacks, MSP Floor)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│              Tier 1: Feature Coverage                       │
│    (>=5 Tests per Feature: R1 Auth, R2 Vision AI,           │
│       R3 Community Media, R4 Real Mandi Rates)              │
└─────────────────────────────────────────────────────────────┘
```

### Tier 1: Feature Coverage (Nominal / Happy Path)
Verifies that each individual requirement functions according to its core functional specification under normal operating conditions.
- **Minimum Requirement**: $\ge 5$ distinct test cases per feature (Total $\ge 20$ tests).
- **Target Areas**:
  - R1: GoTrue Sign Up payload, Email Login, Google OAuth redirect, Persistent session storage, Header/Profile name rendering.
  - R2: Gemini Vision API payload (`inlineData`), Key resolution hierarchy, JSON grammar enforcement (`responseMimeType`), Diagnostic JSON parsing (`CropScanData`), On-device fallback activation.
  - R3: Photo file selection, Video file selection, Media preview rendering, HTML5 `<video controls playsinline>` attributes, Responsive `<img>` feed cards.
  - R4: Agmarknet API endpoint binding, Supabase cache lookup, GPS reverse-geocoding, Zero-synthetic price verification (`Math.random` eradication), Regional benchmark fallback.

### Tier 2: Boundary & Corner Cases (Adversarial & Stress)
Subjects each feature to invalid inputs, network disruptions, quota exhaustion, corrupt data, and extreme boundary values.
- **Minimum Requirement**: $\ge 5$ distinct test cases per feature (Total $\ge 20$ tests).
- **Target Areas**:
  - R1: Cold start with zero cache, Expired token handling, Malformed session JSON, Multi-script / Telugu / Hindi unicode names, Rapid sequential login/logout churn.
  - R2: Missing API key failover, HTTP 500/503 timeout resilience, Corrupt image byte stream, Large payload (>5MB) compression, Non-JSON / markdown response recovery.
  - R3: Empty media upload (text-only post), Unsupported media formats, Offline video playback resilience, Long post text (>1000 chars) with emoji, Rapid media replacement.
  - R4: Agmarknet HTTP 429 rate-limit backoff, Unknown crop query, Unmapped GPS coordinates, Price anomaly filtering (₹0 or negative prices), MSP floor boundary validation.

### Tier 3: Cross-Feature Combinations (Pairwise Integration)
Evaluates interactions between decoupled modules to ensure contracts and shared state remain synchronized:
- **Pairwise 1 (Auth ↔ Community)**: Authenticated user session identity (`uid`, `full_name`) automatically attaches to community posts with real media uploads.
- **Pairwise 2 (Auth ↔ Mandi)**: Authenticated user's registered primary crops (e.g. Cotton & Chilli) and GPS location seamlessly seed the Mandi rate engine.
- **Pairwise 3 (Vision AI ↔ Mandi ↔ BioRx)**: Diagnostic leaf scan recommendations link to local APMC mandi market commodity prices and BioRx fertilizer/pesticide calculators.
- **Pairwise 4 (Auth ↔ Community ↔ Persistence)**: Cold restart while browsing community media preserves session tokens, active crop context, and feed state without prompting for re-login.

### Tier 4: Real-World Scenarios (End-to-End Simulation)
Simulates a complete, multi-stage farmer journey spanning the entire operational lifecycle:
1. **Farmer Authentication**: Cold start -> Login as Warangal farmer (B. Jaswanth Reddy) -> Rehydrate profile and 4.5-acre land holding.
2. **Micro-Weather & Spray Window**: Check local weather sensor -> Calculate 3-hour continuous spray advisory window.
3. **Leaf Disease Capture & AI Vision**: Capture foliar symptom image -> Dispatch to Gemini Vision API -> Validate JSON output.
4. **ICAR Treatment & Remedy**: Parse disease (Cotton Leaf Curl Virus) -> Review chemical spray dosage & CIB&RC buy links.
5. **Mandi Market Rate Check**: Query real APMC rates for Cotton in Warangal APMC Yard -> Compare against MSP floor.
6. **Kisan Community Sharing**: Create community post with leaf photo and diagnosis -> Post to Supabase `community_posts` -> Render in feed.
7. **Cold Restart & Verification**: Re-initialize application -> Verify zero data loss and persistent session.

---

## 3. Authoritative Sources of Expected Output

To prevent facade testing and self-fulfilling mocks, all expected outputs are derived from authoritative external specifications:

| Domain | Authoritative Reference Source | Validation Contract |
|:---|:---|:---|
| **R1: Supabase Auth** | Supabase GoTrue v2.196.0 API Specification & RFC 7519 (JWT) | Endpoints `/auth/v1/signup`, `/auth/v1/token?grant_type=password`, `/auth/v1/authorize?provider=google`. Response contains `access_token`, `user.id`, `user_metadata`. Storage keys: `nukrop_user_name`, `nukrop_supabase_token`. |
| **R2: Gemini Vision** | Google Generative Language API v1beta Specification | `POST /v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}`. Payload: `contents[].parts[{text}, {inlineData: {mimeType, data}}]`. Config: `responseMimeType: "application/json"`. Response text parsed from `candidates[0].content.parts[0].text`. Fallback: `DiseaseDetector.kt`. |
| **R3: Community Media** | W3C HTML5 Media Specification & Supabase Storage v1 | File chooser `accept="image/*,video/*"`. `<video controls playsinline preload="metadata">`. Supabase table `community_posts` with `media_url` and `media_type` ('image' \| 'video'). |
| **R4: Agmarknet Data** | Open Government Data (OGD) India Resource ID `9ef84268-d588-465a-a308-a864a43d0070` & Supabase `mandi_live_rates` | Fields: `state`, `district`, `market`, `commodity`, `modal_price`. Strictly zero synthetic Math.random deltas. Transparent benchmark fallback on HTTP 429. |

---

## 4. Test Harness Architecture

The test harness is implemented in Node.js for high-speed, headless, cross-platform execution with zero external runtime dependencies.

### File Layout:
```
agriculture-ai-os/
├── TEST_INFRA.md                     # This document
├── TEST_READY.md                     # Test execution & readiness certification
├── test_production_readiness.js     # Top-level one-tap execution script
├── tests/
│   ├── test_harness.js               # Assertions, spies, and mock infrastructure
│   ├── tier1_feature_coverage.js     # Tier 1: Nominal feature tests (24 tests)
│   ├── tier2_boundary_cases.js       # Tier 2: Boundary & stress tests (20 tests)
│   ├── tier3_cross_feature.js        # Tier 3: Pairwise integration tests (4 tests)
│   ├── tier4_real_world.js           # Tier 4: E2E Farmer Journey scenario (1 scenario, 7 steps)
│   └── run_e2e_tests.js              # Master test runner with ANSI reporting
└── app/src/test/java/com/example/
    └── ProductionReadinessTest.kt    # Native Android Kotlin contract tests
```

---

## 5. Master Test Inventory

| # | Test ID | Tier | Feature | Description | Expected Output Source |
|:---|:---|:---|:---|:---|:---|
| 1 | `T1.1.1` | Tier 1 | R1 Auth | Supabase Sign Up payload format & user metadata | GoTrue API `/auth/v1/signup` |
| 2 | `T1.1.2` | Tier 1 | R1 Auth | Email/Password Login flow & access token extraction | GoTrue API `/auth/v1/token` |
| 3 | `T1.1.3` | Tier 1 | R1 Auth | Google OAuth redirect URL generation | GoTrue API `/auth/v1/authorize` |
| 4 | `T1.1.4` | Tier 1 | R1 Auth | Session rehydration on cold start from storage | `localStorage` / `SharedPreferences` |
| 5 | `T1.1.5` | Tier 1 | R1 Auth | Dynamic user name and greeting display | Header & Profile UI contracts |
| 6 | `T1.1.6` | Tier 1 | R1 Auth | Sign out clears session and restores login screen | Security session lifecycle |
| 7 | `T1.2.1` | Tier 1 | R2 Vision AI | Gemini Vision API payload format (`inlineData`) | Google Generative Language API v1beta |
| 8 | `T1.2.2` | Tier 1 | R2 Vision AI | Dynamic API key resolution hierarchy | `param` -> `BuildConfig` -> `process.env` |
| 9 | `T1.2.3` | Tier 1 | R2 Vision AI | JSON grammar enforcement via `generationConfig` | Gemini `responseMimeType: "application/json"` |
| 10 | `T1.2.4` | Tier 1 | R2 Vision AI | Diagnostic JSON parsing into `CropScanData` | NuKropAI Pathology Schema |
| 11 | `T1.2.5` | Tier 1 | R2 Vision AI | Resilient on-device TFLite fallback activation | `ml/DiseaseDetector.kt` |
| 12 | `T1.2.6` | Tier 1 | R2 Vision AI | Image byte preservation for leaf preview card | UI Viewfinder contract |
| 13 | `T1.3.1` | Tier 1 | R3 Community | Photo file selection & image preview rendering | HTML5 File API `accept="image/*"` |
| 14 | `T1.3.2` | Tier 1 | R3 Community | Video file selection & video preview rendering | HTML5 File API `accept="video/*"` |
| 15 | `T1.3.3` | Tier 1 | R3 Community | Post creation payload includes `media_url`/`type` | Supabase `community_posts` schema |
| 16 | `T1.3.4` | Tier 1 | R3 Community | HTML5 `<video controls playsinline>` rendering | W3C HTML5 Video Specification |
| 17 | `T1.3.5` | Tier 1 | R3 Community | Responsive `<img>` rendering with lazy loading | W3C HTML5 Image Specification |
| 18 | `T1.3.6` | Tier 1 | R3 Community | Attached media chips rendering in composer | Composer UI contract |
| 19 | `T1.4.1` | Tier 1 | R4 Mandi Data | Agmarknet Gov API invocation with query filters | OGD India `api.data.gov.in` |
| 20 | `T1.4.2` | Tier 1 | R4 Mandi Data | Supabase `mandi_live_rates` live cache lookup | Supabase PostgREST catalog |
| 21 | `T1.4.3` | Tier 1 | R4 Mandi Data | GPS reverse-geocoding binding to Mandi query | OpenStreetMap Nominatim reverse geocode |
| 22 | `T1.4.4` | Tier 1 | R4 Mandi Data | Zero synthetic price verification (`Math.random` audit) | Zero-mock audit invariant |
| 23 | `T1.4.5` | Tier 1 | R4 Mandi Data | Regional benchmark fallback with transparent UI badge | Rural resilience protocol |
| 24 | `T1.4.6` | Tier 1 | R4 Mandi Data | Live rate card refresh executes API query | Live market engine contract |
| 25 | `T2.1.1` | Tier 2 | R1 Auth | Cold start with empty cache / first-time user | Clean-slate recovery contract |
| 26 | `T2.1.2` | Tier 2 | R1 Auth | Expired token detection and refresh flow | JWT RFC 7519 expiry check |
| 27 | `T2.1.3` | Tier 2 | R1 Auth | Malformed session token recovery | Defensive JSON parsing |
| 28 | `T2.1.4` | Tier 2 | R1 Auth | Special characters & unicode in user names (Telugu/Hindi) | UTF-8 i18n specification |
| 29 | `T2.1.5` | Tier 2 | R1 Auth | Rapid sequential auth state transitions (race condition) | StateFlow / storage concurrency |
| 30 | `T2.2.1` | Tier 2 | R2 Vision AI | Missing API key graceful fallback | On-device TFLite contract |
| 31 | `T2.2.2` | Tier 2 | R2 Vision AI | Network 500 / 503 / timeout failover | Resilient failover contract |
| 32 | `T2.2.3` | Tier 2 | R2 Vision AI | Corrupt image bytes / invalid base64 | Defensive byte validation |
| 33 | `T2.2.4` | Tier 2 | R2 Vision AI | Large base64 payload (>5MB) compression | Memory safety & payload limits |
| 34 | `T2.2.5` | Tier 2 | R2 Vision AI | Non-JSON conversational LLM response resilience | Regex JSON extractor |
| 35 | `T2.3.1` | Tier 2 | R3 Community | Text-only post submission without media attachments | Optional media contract |
| 36 | `T2.3.2` | Tier 2 | R3 Community | Unsupported media format & 404 URL fallback | Error resilience contract |
| 37 | `T2.3.3` | Tier 2 | R3 Community | Video playback under offline network conditions | Offline media handling |
| 38 | `T2.3.4` | Tier 2 | R3 Community | Extreme length post text (>1000 chars) & emoji | Content length & encoding limit |
| 39 | `T2.3.5` | Tier 2 | R3 Community | Rapid consecutive media attachments replacement | Composer memory cleanup |
| 40 | `T2.4.1` | Tier 2 | R4 Mandi Data | Agmarknet HTTP 429 rate-limit backoff | Exponential backoff protocol |
| 41 | `T2.4.2` | Tier 2 | R4 Mandi Data | Unknown / exotic crop query fallback | Empty-state resilience |
| 42 | `T2.4.3` | Tier 2 | R4 Mandi Data | Unmapped GPS coordinates fallback | Geographic bounding box |
| 43 | `T2.4.4` | Tier 2 | R4 Mandi Data | Zero and negative price anomaly filtering | APMC data integrity rules |
| 44 | `T2.4.5` | Tier 2 | R4 Mandi Data | MSP floor price enforcement & boundary validation | Commission for Agricultural Costs & Prices |
| 45 | `T3.1` | Tier 3 | Cross-Feature | Authenticated User + Community Media Upload | Pairwise: Auth + Community |
| 46 | `T3.2` | Tier 3 | Cross-Feature | Authenticated User + Location-Driven Mandi Rates | Pairwise: Auth + Mandi + Location |
| 47 | `T3.3` | Tier 3 | Cross-Feature | Vision AI Scanner + Mandi Market + BioRx Calculator | Pairwise: Vision + Mandi + BioRx |
| 48 | `T3.4` | Tier 3 | Cross-Feature | App Restart while viewing Community Media Feed | Pairwise: Auth + Community + Persistence |
| 49 | `T4.1` | Tier 4 | Real-World | Complete E2E Farmer Journey (Warangal Cotton & Chilli) | 7-Step Full Operational Lifecycle |

**Total Test Inventory**: 49 comprehensive, opaque-box test cases across 4 tiers.

---

## 6. Execution Command & Continuous Integration

To execute the entire test suite:
```bash
node test_production_readiness.js
```
Or directly:
```bash
node tests/run_e2e_tests.js
```

### Exit Codes:
- `0`: All test cases passed with zero regressions.
- `1`: One or more test cases failed (detailed assertion failure and stack trace printed).
