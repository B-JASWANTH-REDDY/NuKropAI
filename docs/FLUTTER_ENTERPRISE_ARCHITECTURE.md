# NuKropAI — Flutter Enterprise Mobile Architecture Specification

**Document ID:** `DOC-ARCH-FLUTTER-001`  
**Classification:** Enterprise Engineering Specification  
**Status:** Authoritative & Active  
**Platform Version:** NuKropAI Mobile 2.0 (Flutter 3.44.4 / Dart 3.12.2)  

---

## 1. Executive Summary & Migration Paradigm

NuKropAI Mobile has transitioned from a hybrid WebView shell to a **100% Pure Flutter-Native Architecture**. All mobile application rendering, navigation, state management, animations, and sensor coordination are authored in typed Dart, eliminating WebView memory overhead, DOM layout shifts, and cross-context bridge latency.

```
                  +-----------------------------------+
                  |         NUKROPAI MOBILE           |
                  |     Flutter 3.44 / Dart 3.12      |
                  +-----------------+-----------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
+---------v---------+     +---------v---------+     +---------v---------+
|   PRESENTATION    |     |    APPLICATION    |     | PLATFORM ADAPTERS |
| • Plantix 5-Tab   |     | • Pure Dart State |     | • Android Keystore|
| • 18 Agrarian UIs |     | • UserSession     |     | • GPS / Sensors   |
| • Material 3      |     | • Repository Layer|     | • Push Service    |
+---------+---------+     +---------+---------+     +---------+---------+
          |                         |                         |
          +-------------------------+-------------------------+
                                    |
                    +---------------v---------------+
                    |     TYPED API CLIENT (HTTP)   |
                    | • Bearer JWT Interceptor      |
                    | • Idempotency Headers (X-Idem)|
                    | • SWR Offline Cache           |
                    +---------------+---------------+
                                    |
                        HTTPS / TLS 1.3 / WSS
                                    |
                    +---------------v---------------+
                    |     FASTIFY + SUPABASE OS     |
                    | • PostGIS Spatial Engine      |
                    | • Fail-Closed JWT Auth        |
                    | • Row Level Security (RLS)    |
                    +-------------------------------+
```

---

## 2. Directory Hierarchy & Architectural Boundaries

```
flutter_app/
├── lib/
│   ├── main.dart                       # Entry point & system UI overlay configuration
│   ├── app/
│   │   ├── app.dart                    # NuKropFlutterApp root widget & navigation lifecycle
│   │   ├── router/                     # NuKropRoleGuard & declarative navigation stack
│   │   └── theme/
│   │       └── app_theme.dart          # Agrarian Material 3 design tokens & themes
│   ├── core/
│   │   ├── constants/
│   │   │   └── app_constants.dart      # Brand colors, endpoints, and view constants
│   │   ├── localization/
│   │   │   └── app_localizations.dart  # 10 Indian agrarian languages dictionary
│   │   ├── models/
│   │   │   ├── user_session.dart       # UserSession & Role model
│   │   │   ├── mandi_rate.dart         # APMC Mandi rates model
│   │   │   ├── weather_info.dart       # Microclimate & spray window model
│   │   │   ├── crop_disease.dart       # ICAR crop disease model
│   │   │   ├── farm_entry.dart         # Khata ledger model
│   │   │   ├── community_post.dart     # Kisan social feed model
│   │   │   └── gramhaul_trip.dart      # Freight dispatch model
│   │   ├── networking/
│   │   │   └── api_client.dart         # HTTP client with auth interceptor & retry
│   │   └── storage/
│   │       └── secure_storage.dart     # Keystore/Keychain secure session storage
│   ├── features/
│   │   ├── splash/                     # Laser scanning telemetry splash
│   │   ├── onboarding/                 # 8-step crop selection walkthrough
│   │   ├── auth/                       # Farmer & Driver login & registration
│   │   ├── home/                       # Kisan dashboard & operations grid
│   │   ├── mandi/                      # APMC market rates & price alerts
│   │   ├── scanner/                    # AI Crop Doctor viewfinder & ICAR treatments
│   │   ├── community/                  # Kisan network, like/unlike, follow/unfollow
│   │   ├── profile/                    # Profile, DPDP 2023 rights, and sign out
│   │   ├── gramhaul/                   # Rural freight booking & driver dispatch
│   │   ├── khata/                      # Bookkeeping ledger with 5-second undo
│   │   ├── biorx/                      # Acreage knapsack sprayer tank mix
│   │   ├── bioshield/                  # Regional pest outbreak surveillance radar
│   │   ├── agristack/                  # Cadastral land & soil health card
│   │   ├── machinery/                  # CHC machinery & drone rentals
│   │   ├── loan/                       # KCC credit limit & interest subvention
│   │   ├── chat/                       # Realtime AI agronomist specialist chat
│   │   ├── driver/                     # GramHaul driver cockpit & load feed
│   │   └── language/                   # Multilingual bottom sheet picker
│   └── shared/
│       └── widgets/
│           ├── plantix_nav_bar.dart    # 5-tab dock with elevated center scan FAB
│           ├── shimmer_skeleton.dart   # Content-shaped shimmering skeletons
│           └── luxury_toast.dart       # Reversible action toast with countdown
└── test/
    └── widget_test.dart                # Comprehensive widget and logic test suite
```

---

## 3. The 18 Agrarian Views Parity Mapping

| # | View Key | Screen Component | Route Role | Features & Native Parity |
|---|---|---|---|---|
| 1 | `home` | `HomeScreen.dart` | Farmer | Greeting, crop selector, live mandi ticker, spray window card, 9-module operations grid. |
| 2 | `scanner` | `DiseaseScannerScreen.dart` | Farmer | Camera viewfinder, laser sweep animation, ICAR treatment prescriptions, community sharing. |
| 3 | `market` | `MandiScreen.dart` | Farmer | District choice chips, commodity search, modal/min/max prices, 7-day trend dialog, alerts. |
| 4 | `community` | `CommunityScreen.dart` | Farmer | Normalized deduplicated feed, optimistic like toggles, author follow/unfollow with undo, post creation. |
| 5 | `profile` | `ProfileScreen.dart` | Farmer | Farm land overview, DPDP 2023 data rights notice, app language sheet, splash tour replay, logout. |
| 6 | `gramhaul` | `GramHaulScreen.dart` | Both | Freight load request, GPS-locked local hauler discovery, booking PIN generation, trip progress. |
| 7 | `khata` | `FarmKhataScreen.dart` | Both | Income & expense bookkeeping, cash flow totals, swipe-to-delete with 5-second undo toast recovery. |
| 8 | `biorx` | `BioRxScreen.dart` | Farmer | Knapsack sprayer tank mix dosage engine, acreage water calculation, pre-harvest interval (PHI). |
| 9 | `bioshield` | `BioShieldRadarScreen.dart` | Farmer | 25 km outbreak radar, ICAR-CRIDA early warnings, severity badges, vector containment advisory. |
| 10 | `agristack` | `AgriStackPassportScreen.dart` | Farmer | Cadastral parcel sub-division, soil health card telemetry (pH, OC, EC, N-P-K), PDF download. |
| 11 | `equipment` | `EquipmentRentalScreen.dart` | Farmer | Custom Hiring Center (CHC) machinery, tractors, drones, implement booking, hourly/acreage rates. |
| 12 | `loan` | `KccLoanScreen.dart` | Farmer | NABARD Scale of Finance calculator, 10% post-harvest, 20% maintenance, 4.0% interest subvention. |
| 13 | `chat` | `AgronomyChatScreen.dart` | Farmer | Interactive AI agronomy specialist chat, vertisol soil advice, IPM pesticide guidance. |
| 14 | `driver_dashboard` | `DriverDashboardScreen.dart` | Driver | Driver cockpit, online dispatch toggle, available loads feed, today's trips & earnings. |
| 15 | `weather` | `HomeScreen.dart` (Card) | Farmer | 3-hour microclimate spray advisory window, temperature, humidity, wind velocity, rain probability. |
| 16 | `settings` | `ProfileScreen.dart` | Both | Multilingual language switch, privacy consent, account deletion, splash replay. |
| 17 | `onboarding` | `OnboardingScreen.dart` | Public | 8-step walkthrough with crop selection pills, persistent completion storage. |
| 18 | `splash` | `SplashScreen.dart` | Public | 4K agrarian pulse animation, neural core telemetry steps, auto-transition lifecycle. |

---

## 4. Lifecycle & Role Collision Guard (`NuKropRoleGuard`)

1. **Unauthenticated States**:
   - On cold boot without stored credentials, the app presents `SplashScreen` -> `OnboardingScreen` -> `LoginScreen` / `RegisterScreen`.
2. **Session Restoration**:
   - `SecureStorage.getSession()` decrypts session credentials from Keystore/Keychain.
   - If user has `UserRole.driver`, the UI immediately rehydrates into `DriverDashboardScreen`.
   - If user has `UserRole.farmer`, the UI rehydrates into the 5-tab Plantix dock and `HomeScreen`.
3. **Role Collision Defense**:
   - Drivers attempting to enter farmer-only views are intercepted and redirected to `DriverDashboardScreen`.
   - Farmers attempting to enter driver cockpits are redirected to `GramHaulScreen`.
   - Role switching requires an explicit sign-out via `SecureStorage.clearSession()`.

