# NuKropAI — MiroFish Multi-Agent Simulation Engine Integration

**Upstream Engine:** [666ghj/MiroFish](https://github.com/666ghj/MiroFish)  
**System:** NuKropAI Agrarian Operating System  
**Target Environment:** Supabase PostGIS (`yxjqseiegwjdfnccdchk`) + k6 Load Engine (Safety Guard Enforced)  
**Working Branch:** `feature/nukropai-complete-production-remediation`  
**PR #2 Status:** OPEN & UNMERGED (Target: `main`)

---

## 1. Executive Summary & Purpose

The **MiroFish** multi-agent simulation engine is an open-source swarm intelligence system designed to model collective behaviors and predict societal, economic, and organizational outcomes by instantiating populations of autonomous agents with diverse personas, long-term memory structures, and behavioral heuristics.

For NuKropAI, MiroFish has been adapted to solve a critical validation challenge: **simulating realistic, large-scale populations of farmers, verified drivers, unverified applicants, fleet operators, machinery owners, and mandi traders across diverse agricultural corridors without risking production data or relying on simplistic synthetic mocks**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MIROFISH SIMULATION ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ MiroFish Swarm Engine ] ──> Generates 9 Persona Archetypes               │
│          │                     (Goals, Constraints, Latencies, Biases)      │
│          ▼                                                                  │
│  [ NuKropAI Adapter Bridge ] ──> Translates Agent Intent to Real APIs        │
│          │                       (Auth, Radar, Booking, Dispatch, GPS)      │
│          ▼                                                                  │
│  [ Supabase PostGIS DB ] ───> Enforces RLS, Spatial Matching, State         │
│          ▲                        Machines & Concurrency Resolution         │
│          │                                                                  │
│  [ k6 Load Generator ] ──> Scales Traffic Volume (50-200 VUs)               │
│                            Measures Throughput, Latency p95/p99 & Errors    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Upstream MiroFish Audit & AGPL-3.0 License Compliance

### 2.1 Upstream Inspection Summary
* **Repository:** `https://github.com/666ghj/MiroFish`
* **Upstream Commit / Version:** v0.2.x (Swarm Intelligence Parallel Engine)
* **License:** **GNU Affero General Public License v3.0 (AGPL-3.0)**
* **Dependencies:** Python 3.11–3.12, Flask, Camel-AI (`camel-oasis`), Zep Cloud (`zep-cloud`), PyMuPDF, Pydantic.

### 2.2 License Obligations & Architectural Boundaries
The GNU AGPL-3.0 requires that anyone running a modified version over a network must provide the complete corresponding source code to users accessing the service. 

To strictly prevent **license contamination (copyleft infection)** of NuKropAI's core enterprise codebases (`backend/`, `app/`, `web/`):
1. **Zero Upstream Vendoring:** The MiroFish upstream repository is **not** embedded or vendored into the NuKropAI core production repository.
2. **Clean External Adapter Pattern:** All integration occurs through a standalone testing harness: [`simulations/mirofish_adapter/`](file:///c:/Users/bjasw/Downloads/agriculture-ai-os/simulations/mirofish_adapter/).
3. **Network API Boundary:** The adapter interacts with NuKropAI strictly through external, documented HTTP REST and PostgREST RPC endpoints, maintaining a network service boundary.
4. **Distribution Segregation:** Simulation artifacts and scripts are restricted to internal testing, continuous integration, and staging verification, completely segregated from consumer APK releases and web client builds.

---

## 3. Dedicated Simulation Architecture

The NuKropAI MiroFish integration is structured into five modular components:

```
simulations/
├── mirofish_adapter/
│   ├── __init__.py
│   ├── models.py           # MiroFish-compatible PersonaProfile, SimulationAction, ScenarioMetrics
│   ├── personas.py         # 9 Agrarian Persona generators with realistic Indian agro attributes
│   ├── agent_bridge.py     # Real authenticated API adapter (Auth, Radar, Dispatch, Telemetry)
│   ├── scenarios.py        # 8 repeatable behavioral scenarios (Normal Day, Harvest, Shortage, etc.)
│   └── run_simulation.py   # CLI orchestrator for pilot and scenario execution
├── k6/
│   └── haul_dispatch_load.js # k6 concurrency & performance testing script (50 VUs)
├── personas/               # Exported JSON personas for repeatable regression testing
├── scenarios/              # Configured scenario definitions
└── logs/
    ├── actions.jsonl       # MiroFish-compatible structured action event stream
    └── simulation_summary.json # High-level execution metrics
```

### 3.1 API Contract Mapping

| MiroFish Agent Decision | NuKropAI API Endpoint | Method | Security & Authorization Context |
| :--- | :--- | :---: | :--- |
| **Authenticate Persona** | `/auth/v1/signup` or `/auth/v1/token` | `POST` | Dedicated test identities (`sim_*@nukrop-sim.in`). Returns valid user JWT. |
| **Driver ON DUTY** | `/rest/v1/rpc/upsert_driver_location` | `POST` | Authenticated driver JWT. PostGIS coordinates committed to `driver_locations`. |
| **Unverified Duty Attempt** | `/rest/v1/rpc/set_driver_duty_status` | `POST` | Server verifies KYC status; rejects unverified drivers (`DRIVER_NOT_VERIFIED`). |
| **Driver OFF DUTY** | `/rest/v1/driver_locations?driver_id=eq.{id}` | `PATCH` | Authenticated driver JWT. Sets `is_active = false`, hiding driver from radar. |
| **Farmer Radar Search** | `/rest/v1/rpc/get_nearest_drivers` | `POST` | PostGIS spatial query (`ST_DWithin`, 10–15 km radius, 15 max drivers). |
| **Farmer Request Transport** | `/rest/v1/haul_bookings` | `POST` | Authenticated farmer JWT. Creates `PENDING` booking under farmer `user_id`. |
| **Driver Accept Booking** | `/rest/v1/haul_bookings?id=eq.{id}&status=eq.PENDING` | `PATCH` | Concurrency-safe atomic update. Sets `ACCEPTED`. Returns 409 if already claimed. |
| **Farmer Cancel Booking** | `/rest/v1/haul_bookings?id=eq.{id}&user_id=eq.{id}` | `PATCH` | Authenticated farmer JWT. Sets `status = CANCELLED`. |
| **Driver Telemetry Ping** | `/rest/v1/rpc/record_driver_gps_ping` | `POST` | Authenticated driver JWT. Validates accuracy (<= 50m) and speed jump bounds. |
| **Advance Trip Status** | `/rest/v1/haul_bookings?id=eq.{id}` | `PATCH` | State machine: `ACCEPTED` ➔ `ARRIVED` ➔ `IN_TRANSIT` ➔ `COMPLETED`. |
| **Post-Trip DPDP Privacy**| `/rest/v1/driver_locations?driver_id=eq.{id}` | `GET` | Verifies tracking stream cutoff. Farmer cannot track driver after completion. |

---

## 4. Separation of Responsibilities

To maintain rigorous engineering discipline, testing responsibilities are segregated across three tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. MiroFish (Agent Layer):                                                  │
│    - Behavioral decision trees and psychological attributes                 │
│    - Scenario generation (Farmer patience, cancellation probability)        │
│    - Arrival rates, dispatch competition, and operational delays            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. k6 (Traffic & Performance Layer):                                        │
│    - Request concurrency scaling (10 to 200 Virtual Users)                  │
│    - High-throughput execution of MiroFish-derived traffic patterns         │
│    - Rigorous SLA measurement: Latency percentiles (p50, p95, p99), RPS     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Android Emulator / Physical Device (UI & Native Layer):                  │
│    - Real application UI rendering (Jetpack Compose & Leaflet WebView)      │
│    - Native Android NotificationManager bridge verification                 │
│    - Background foreground location service (`DriverLocationService.kt`)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Security & Isolation Guarantees

1. **Zero Production Contamination**: All synthetic personas operate with email domain `@nukrop-sim.in` and agent IDs prefixed with `sim_`.
2. **Zero Service-Role Keys**: The adapter uses only the public `SUPABASE_ANON_KEY` and authentic user session tokens generated through standard GoTrue authentication.
3. **Zero RLS Bypass**: All database operations are subjected to live Row Level Security policies. Cross-tenant reads, unverified actions, and unauthorized modifications fail-closed.
4. **Zero Financial Reality**: All fares and transport bookings are executed in a simulated staging context; zero real payment gateways or real SMS messages are triggered.
5. **Automated Teardown**: The bridge provides `cleanup_synthetic_records()`, ensuring that all temporary haul bookings and driver presence entries are purged following simulation runs.

