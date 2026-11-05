# NuKropAI Provider and Data Provenance Registry

**Repository**: `feature/nukropai-complete-production-remediation`  
**PR #2 Status**: OPEN and UNMERGED  
**Environment**: Staging / Preview Only  
**Audit Standard**: Zero-Facade, Truth-in-Data Architecture  

---

## 1. Provenance Architecture Principles

In compliance with the permanent engineering directives (`AGENTS.md`, `GEMINI.md`, and `ENGINEERING_QUALITY_STANDARD.md`), NuKropAI enforces strict data provenance:
1. **Never Label Static/Cached Data as Live**: A "Live" badge is displayed only when a real, successful external provider call has occurred within the active freshness window.
2. **Transparent Cache & Offline Status**: If data is cached or an external provider fails, the interface explicitly displays `CACHED`, `OFFLINE`, or `DATA PENDING` along with the authentic observation/trade date.
3. **No Fabricated Data**: No fake drivers, no fake crops, no fake weather metrics, and no invented cadastral boundaries.
4. **Tenant Isolation**: User-uploaded documents, personal crop notes, and live telemetry are isolated through PostgreSQL Row Level Security (RLS) and cryptographic hashes.

---

## 2. External Provider & Data Integration Registry

| Domain | Provider Name | Official Endpoint / Protocol | Auth Requirement | Freshness Policy | Provenance Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Weather Intelligence** | **Open-Meteo Agricultural API** | `https://api.open-meteo.com/v1/forecast` | Public WMO / ECMWF | 30 minutes | `Tier 1: Live Meteorological Observation` |
| **Geocoding** | **OpenStreetMap Nominatim** | `https://nominatim.openstreetmap.org/reverse` | User-Agent attribution | On-demand GPS fix | `Tier 1: Live Cadastral Reverse Geocode` |
| **Mandi Bhav** | **Agmarknet / DMI (Govt of India)** | `https://api.data.gov.in/resource/...` | `GOVT_API_KEY` (Bearer) | 2 hours (trading day) | `Tier 1: Official APMC Market Arrival` |
| **Mandi Bhav (Fallback)** | **Verified Historical DMI Catalog** | `data/mandi_historical_catalog.json` | None (Local signed asset) | Daily reference | `Tier 2: Authenticated Historical Baseline` |
| **Land Survey (Telangana)** | **Bhu Bharati (formerly Dharani)** | `https://bhubharati.telangana.gov.in` | Official Portal Handoff | Direct Government View | `Tier 1: Official State Cadastral Portal` |
| **Land Survey (Andhra Pradesh)** | **Meebhoomi AP** | `https://meebhoomi.ap.gov.in` | Official Portal Handoff | Direct Government View | `Tier 1: Official State Cadastral Portal` |
| **Land Survey (Uttar Pradesh)** | **UP Bhulekh** | `https://upbhulekh.gov.in` | Official Portal Handoff | Direct Government View | `Tier 1: Official State Cadastral Portal` |
| **Land Survey (Karnataka)** | **Bhoomi Karnataka** | `https://landrecords.karnataka.gov.in` | Official Portal Handoff | Direct Government View | `Tier 1: Official State Cadastral Portal` |
| **Land Survey (Maharashtra)** | **Mahabhumi / Bhulekh** | `https://bhulekh.mahabhumi.gov.in` | Official Portal Handoff | Direct Government View | `Tier 1: Official State Cadastral Portal` |
| **Database & Spatial** | **Supabase PostgreSQL + PostGIS** | `https://yxjqseiegwjdfnccdchk.supabase.co` | Fail-closed JWT Auth | Realtime / ACID | `Authoritative Enterprise Ledger` |
| **Private Document Storage** | **Supabase Storage (land-documents)** | S3-compatible private bucket | User RLS token | Durable encrypted | `Authoritative User Vault` |
| **Driver GPS Telemetry** | **Android LocationManager** | Foreground GPS service | `ACCESS_FINE_LOCATION` | Realtime (<5s interval) | `Tier 1: Hardware GPS Telemetry Fix` |
| **Telemetry Dispatch** | **Fastify WebSockets** | `ws://host:port/api/v1/dispatch/tracking`| Bearer JWT Token | Realtime monotonic seq | `Tier 1: Authenticated Stream` |
| **SMS Delivery Gateway** | **National SMS Gateway (NIC/TRAI)** | REST Gateway API | Requires Carrier Whitelist | Pending Integration | `BLOCKED BY EXTERNAL DEPENDENCY` (Delivered via In-App Secure Screen) |
| **Payment Gateway** | **UPI 2.0 / BharatQR** | Dynamic UPI deep-link | Merchant VPA | Transaction-based | `Ledger Settlement (Pending Gateway)` |

---

## 3. Provenance Tiers & Badge Specification

| Provenance Tier | Visual Badge | Criteria | Screen Display |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Live Provider)** | `⚡ LIVE` or `🏛️ Agmarknet (DD/MM/YYYY)` | Real government API or hardware sensor responded within last 60 minutes. | Green pill badge with observation timestamp. |
| **Tier 2 (Cached Asset)** | `📁 CACHED · DD/MM/YYYY` | Live fetch was previously successful, but current session is operating offline or provider timed out. | Amber pill badge with original capture date. |
| **Tier 3 (Historical Baseline)** | `📅 Historical DMI Reference` | Baseline APMC statistics for reference during market holidays or off-hours. | Slate pill badge clearly stating historical date. |
| **Tier 4 (Claimed / Pending)** | `📝 FARMER CLAIMED` | Land survey records or documents uploaded by farmer prior to revenue officer verification. | Amber warning badge: "User-Provided Document · Geometry Unavailable". |

---

## 4. HTTPS Hostname Security Boundary

To protect farmers and drivers from phishing or untrusted redirects, `MainActivity.kt` and `index.html` enforce strict hostname validation before allowing external URL navigation:
- `bhubharati.telangana.gov.in`
- `dharani.telangana.gov.in`
- `ccla.telangana.gov.in`
- `meebhoomi.ap.gov.in`
- `bhulekh.mahabhumi.gov.in`
- `mahabhumi.gov.in`
- `landrecords.karnataka.gov.in`
- `bhoomi.karnataka.gov.in`
- `upbhulekh.gov.in`
- `agristack.gov.in`
- `agmarknet.gov.in`
- `pmkisan.gov.in`
- `data.gov.in`
- `accounts.google.com`
- Any valid government domain matching `*.gov.in` or `*.nic.in` without embedded credentials.

