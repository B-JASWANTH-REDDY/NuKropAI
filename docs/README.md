# NuKropAI Master Engineering Documentation Portal

Welcome to the central documentation index for **NuKropAI** — an enterprise-grade agricultural AI operating system built for smallholder farmers and agrarian logistics across India.

This portal provides an authoritative roadmap to all architectural specifications, engineering standards, security audits, and domain runbooks across the repository.

---

## 📌 1. Mandatory Core Specifications (The Canonical Standards)

Before authoring code or reviewing pull requests, all engineers and automated agents must adhere to these five foundational standards:

| Document | Purpose & Authority | Enforcement Suite |
| :--- | :--- | :--- |
| [**APP_FLOW_MASTER.md**](APP_FLOW_MASTER.md) | Authoritative 10-stage application lifecycle, state transitions, and zero-regression rules. | `tests/test_mandatory_user_journeys.js` |
| [**SCREEN_NAVIGATION_MAP.md**](SCREEN_NAVIGATION_MAP.md) | Canonical routing map across all 18 `APP_VIEWS` and deterministic backstack history. | `tests/test_role_integrity_anti_loophole.js` |
| [**ENGINEERING_QUALITY_STANDARD.md**](ENGINEERING_QUALITY_STANDARD.md) | The 20 UI/UX and 20 Security production standards required for every screen. | `tests/test_mobile_permanent_standards.js` |
| [**FEATURE_DEFINITION_OF_DONE.md**](FEATURE_DEFINITION_OF_DONE.md) | Mandatory multi-stage quality checklist required before any task is declared complete. | All Suites |
| [**REGRESSION_TEST_MATRIX.md**](REGRESSION_TEST_MATRIX.md) | Master zero-regression matrix mapping features to automated test scripts. | `tests/run_e2e_tests.js` (208 tests) |

---

## 🏗️ 2. Architectural & System Design

| Document | Focus Area |
| :--- | :--- |
| [**PROJECT.md**](../PROJECT.md) | High-level product vision, mission statement, and core value proposition. |
| [**NUKROPAI_BACKEND_ARCHITECTURE.md**](NUKROPAI_BACKEND_ARCHITECTURE.md) | Fastify + TypeScript microservices, fail-closed JWT authentication, and PostGIS queries. |
| [**NUKROPAI_RELEASE_ARCHITECTURE.md**](NUKROPAI_RELEASE_ARCHITECTURE.md) | Dual-Engine orchestration (Pure Native Jetpack Compose + Production Hybrid WebView). |
| [**MODULE_INTEGRATION_MAP.md**](MODULE_INTEGRATION_MAP.md) | Cross-module contract definitions (Logistics ↔ Pricing ↔ Agronomy). |
| [**AUTHENTICATION_FLOW.md**](AUTHENTICATION_FLOW.md) | Role-guarded authentication, phone OTP normalization, and Google OAuth bridge. |
| [**ONBOARDING_FLOW.md**](ONBOARDING_FLOW.md) | Step-by-step splash, crop selection carousel, and initial farm profile setup. |
| [**ANDROID_WIDGET_IMPLEMENTATION.md**](ANDROID_WIDGET_IMPLEMENTATION.md) | Native home screen widgets for live Mandi rates and weather advisories. |
| [**PHASE13_UI_UX_SYSTEM.md**](PHASE13_UI_UX_SYSTEM.md) | M3 design tokens, typography scales, glassmorphism containers, and color primitives. |

---

## 🔒 3. Security, Privacy & DPDP Compliance

| Document | Scope |
| :--- | :--- |
| [**NUKROPAI_SECURITY_AUDIT.md**](NUKROPAI_SECURITY_AUDIT.md) | Comprehensive vulnerability assessment, secret leak prevention, and mitigation report. |
| [**POSTGIS_SCHEMA_SECURITY_REMEDIATION.md**](POSTGIS_SCHEMA_SECURITY_REMEDIATION.md) | Spatial index hardening, search_path isolation, and privilege revocations. |
| [**POSTGIS_PRIVILEGE_EVIDENCE.md**](POSTGIS_PRIVILEGE_EVIDENCE.md) | Proof of least-privilege enforcement across public and authenticated roles. |
| [**DRIVER_TRACKING_SECURITY_AUDIT.md**](DRIVER_TRACKING_SECURITY_AUDIT.md) | Telemetry encryption, geofencing privacy, and driver location data retention. |
| [**PHASE12_PRODUCTION_SAFETY_AUDIT.md**](PHASE12_PRODUCTION_SAFETY_AUDIT.md) | Multi-tenant isolation and destructive query prevention. |

---

## 🌾 4. Domain Engines & Agrarian Subsystems

### A. GramHaul Agrarian Logistics
- [**REALTIME_DRIVER_MARKETPLACE.md**](REALTIME_DRIVER_MARKETPLACE.md) — Dynamic driver matchmaking, distance-based pricing, and OTP trip authorization.
- [**DRIVER_MARKETPLACE_TEST_REPORT.md**](DRIVER_MARKETPLACE_TEST_REPORT.md) — Two-device trip lifecycle simulation, network drop recovery, and UPI settlement.

### B. MandiPilot & Market Intelligence
- [**REAL_GOVERNMENT_MANDI_DATA_VERIFICATION.md**](REAL_GOVERNMENT_MANDI_DATA_VERIFICATION.md) — Daily Agmarknet ETL pipelines, commodity price normalization, and regional state fallback.

### C. Simulation & Mirofish Adapter
- [**MIROFISH_INTEGRATION.md**](MIROFISH_INTEGRATION.md) — Architectural overview of the multi-agent market simulation adapter.
- [**MIROFISH_USER_SCENARIOS.md**](MIROFISH_USER_SCENARIOS.md) — Behavioral scenario testing for simulated market supply and demand curves.
- [**MIROFISH_ENVIRONMENT_ISOLATION_AUDIT.md**](MIROFISH_ENVIRONMENT_ISOLATION_AUDIT.md) — Target validator proof isolating production DB (`yxjqseiegwjdfnccdchk`).
- [**K6_MIROFISH_GUARD_VERIFICATION.md**](K6_MIROFISH_GUARD_VERIFICATION.md) — High-throughput safety interlock verification.

---

## 🗄️ 5. Database, Cloud & Infrastructure

| Document | Description |
| :--- | :--- |
| [**SUPABASE_PRODUCTION_SETUP.md**](SUPABASE_PRODUCTION_SETUP.md) | Production database architecture, Row Level Security (RLS) policies, and indexing. |
| [**DATABASE_RELATIONSHIPS.md**](DATABASE_RELATIONSHIPS.md) | Entity relationship diagrams (ERD) and foreign key integrity. |
| [**DATABASE_SCHEMA_DIFFERENCES.md**](DATABASE_SCHEMA_DIFFERENCES.md) | Migration delta tracking between local Postgres, staging, and production. |
| [**PRODUCTION_DATABASE_HEALTH_REPORT.md**](PRODUCTION_DATABASE_HEALTH_REPORT.md) | Connection pool metrics, query latency benchmarks, and index hit rates. |
| [**VERCEL_PRODUCTION_SETUP.md**](VERCEL_PRODUCTION_SETUP.md) | Web deployment configurations, edge rewrite rules, and APK download routes. |

---

## 🧪 6. Verification, Testing & Quality Reports

| Document | Focus |
| :--- | :--- |
| [**TEST_INFRA.md**](TEST_INFRA.md) | Complete end-to-end test infrastructure architecture and runner documentation. |
| [**TEST_READY.md**](TEST_READY.md) | Production readiness checklist and automated certification logs. |
| [**MOBILE_PERMANENT_ENGINEERING_STANDARDS_AUDIT.md**](MOBILE_PERMANENT_ENGINEERING_STANDARDS_AUDIT.md) | Audit results for the 40 permanent mobile engineering standards. |
| [**FINAL_PRODUCTION_ACCEPTANCE_AUDIT.md**](FINAL_PRODUCTION_ACCEPTANCE_AUDIT.md) | Cross-functional production acceptance sign-off. |
| [**MASTER_PRODUCTION_ACCEPTANCE_REPORT.md**](MASTER_PRODUCTION_ACCEPTANCE_REPORT.md) | System-wide automated testing pass matrix and stability evidence. |
| [**PHYSICAL_DEVICE_VALIDATION_REPORT.md**](PHYSICAL_DEVICE_VALIDATION_REPORT.md) | Hardware sensor integration status and external dependency declarations. |
| [**CHANGELOG_SUPERBASE_AND_UI_UPGRADES.md**](CHANGELOG_SUPERBASE_AND_UI_UPGRADES.md) | Chronological log of schema migrations and UI/UX design token upgrades. |

---

## 📁 7. Repository Directory Map

```
agriculture-ai-os/
├── .agents/                 # AI assistant configuration and persistent project rules
├── .github/                 # GitHub Actions workflows and CI/CD automation
├── app/                     # Android native engine (Jetpack Compose & Hardware WebView)
│   ├── src/main/java/       # Kotlin activities, Compose screens, services & viewmodels
│   ├── src/main/assets/     # Authoritative production single-page application (index.html)
│   └── src/test/            # Native Android JUnit & Robolectric unit test suites
├── backend/                 # Enterprise Fastify + TypeScript API backend
│   ├── src/controllers/     # REST controllers (auth, mandi, land survey, AI vision)
│   ├── src/routes/          # Route definitions & fail-closed JWT middlewares
│   └── src/services/        # Database pool, Agmarknet sync & Groq/Gemini AI services
├── data/                    # Static offline agronomy, mandi catalogs, and seed data
├── docs/                    # Master documentation portal, specs, and audits
├── nukrop_emulator.html     # Byte-for-byte browser test mirror of app/src/main/assets/index.html
├── scripts/                 # Operational maintenance, remediation, and migration scripts
├── simulations/             # Mirofish agentic simulation adapter and target validators
├── supabase/                # PostgreSQL schema migrations, PostGIS functions, and RLS
├── tests/                   # Master test suites (E2E, journeys, security, permanent standards)
└── web/                     # Vite + React 18 marketing platform & secure APK gateway
```
