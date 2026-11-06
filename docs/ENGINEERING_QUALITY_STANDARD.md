# NuKropAI — Permanent Engineering Quality Standard

**Document Version:** 1.0.0 (Authoritative Persistent Specification)  
**Applies to:** All future NuKropAI development, refactoring, bug fixes, and feature additions  
**Branch:** `feature/nukropai-complete-production-remediation`  
**Repository:** `https://github.com/B-JASWANTH-REDDY/NuKropAI`  

---

## 1. Purpose & Authority

This document defines the permanent, non-negotiable engineering standards for the NuKropAI Sovereign Agrarian Operating System.

Every coding agent, software engineer, and automated tool contributing to this codebase must review and enforce these standards before and after making code changes. No feature is complete merely because it compiles or renders visually; it must satisfy the 20 UI/UX Interaction Standards, the 20 Security Standards, and the Global Definition of Done established herein.

---

## 2. The 20 Permanent UI/UX & Interaction Standards

Every user interface component across Android Jetpack Compose, Android WebView (`index.html`), and the Web Portal (`web/`) must assess and adhere to these 20 interaction standards.

### 2.1 Skeleton Loaders
- **Standard**: Every asynchronous surface must display a dimension-matching shimmer skeleton during initial load and network fetches.
- **Rule**: Never leave a blank container, flashing layout, or generic spinner during async operations.
- **Surfaces Required**: Mandi prices, crop scanning foliar results, equipment listings, community feed, farm khata ledger, bioshield alerts, driver tracking map, weather dashboard, and notifications.
- **Behavior**: Match exact card and row geometries (`.skeleton-shimmer`). Provide explicit error, empty, offline, and retry states. Respect `@media (prefers-reduced-motion: reduce)` by halting shimmer animations.

### 2.2 Optimistic Updates
- **Standard**: Apply optimistic UI updates immediately to reversible user actions.
- **Rule**: Immediately reflect changes in the interface (e.g. social likes, following, bookmarking, local khata draft creation), then sync asynchronously with the backend.
- **Rollback Guarantee**: If the network request fails, automatically roll back the UI state and inform the user with a localized, polite luxury toast explaining the failure.
- **Safety Restriction**: Never optimistically confirm irreversible actions, financial debits/credits, haul trip completions, or security permission grants without explicit server authorization.

### 2.3 Command Menu (Palette)
- **Standard**: Provide a quick, searchable command menu (`Ctrl+K` / `Cmd+K`) for desktop/web interfaces.
- **Capabilities**: Instant search and routing to: Mandi rates, GramHaul truck booking, AI Crop Scanner, Farm Khata, Machinery Rental, and Legal / Privacy documentation.
- **Mobile Equivalent**: On touch mobile surfaces, provide accessible quick-action sheets and header search shortcuts.

### 2.4 Shortcut Hints
- **Standard**: Display clean keyboard shortcut badges on desktop/web interfaces (e.g., `Esc` to close modal, `Enter` to submit search, `Ctrl+K` to search).
- **Rule**: Suppress desktop shortcut badges when running on touch-only mobile viewports to prevent UI clutter.

### 2.5 Undo Toasts
- **Standard**: Provide an actionable "Undo" mechanism for reversible destructive or removal actions.
- **Examples**: Deleting a draft community post, deleting a khata transaction entry, or unfollowing a farmer.
- **Rule**: The undo button must genuinely restore the exact state. If an operation cannot safely be rolled back (e.g., an in-transit trip or bank payment), do not promise undo; require explicit confirmation instead.

### 2.6 Stale-While-Revalidate (SWR)
- **Standard**: Serve cached local data instantaneously on app boot or screen switch, then revalidate in the background against live APIs.
- **Surfaces**: Agmarknet Mandi rates, OpenWeather forecasts, BioShield regional pest alerts, and active crop configurations.
- **Transparency**: Clearly display a `<span class="stale-cache-pill">` indicating cached data and its timestamp (e.g., "Cached APMC Snapshot · Refreshed Today"). Never present cached or benchmark data as live.

### 2.7 Pre-Rendering & Fast First Paint
- **Standard**: Public landing pages and documentation in `web/` must be pre-rendered or statically compiled (`tsc && vite build`) for instant first-contentful paint.
- **Safety Boundary**: Never pre-render or leak authenticated farmer profiles, private land survey numbers, or financial ledgers into public bundles.

### 2.8 BlurHash / Low-Resolution Image Placeholders
- **Standard**: Display a subtle CSS gradient or BlurHash placeholder while high-resolution media is loading.
- **Surfaces**: Community photo posts, machinery photographs, and crop disease visual reference images. Avoid layout shifts (`cumulative layout shift = 0`) when images load.

### 2.9 View Transitions
- **Standard**: Use smooth, hardware-accelerated screen transitions between views (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Rule**: Screen transitions must be non-blocking. If a user taps back or another tab mid-transition, the app must transition immediately. Respect reduced-motion system settings.

### 2.10 Swipe-to-Dismiss Sheets
- **Standard**: Bottom sheets (e.g., driver contact sheet, machinery booking desk, vehicle selector) must support intuitive drag/swipe-to-dismiss gestures.
- **Rule**: Prevent accidental dismissal when interacting with scrollable content inside the sheet or when unsaved form inputs exist.

### 2.11 Interruptible Animations
- **Standard**: Animations must never lock user input or delay urgent user flows.
- **Rule**: Users must be able to tap through or dismiss the startup splash, transition animations, or scan loading meters without waiting for an animation queue to finish.

### 2.12 Predictive Back & Native Gesture Handling
- **Standard**: Fully support Android hardware/gesture back buttons across nested views, modals, and WebViews.
- **Rule**: OnBackPressedDispatcher in `MainActivity.kt` must hierarchically:
  1. Dismiss active fullscreen custom views (HTML5 video).
  2. Dismiss open modals and bottom sheets.
  3. Close active live camera streams.
  4. Navigate from nested views back to `home`.
  5. Exit application only from the root `home` screen with confirmation if unsaved data exists.

### 2.13 Accessible Hit Slop (Touch Targets)
- **Standard**: Every interactive control must provide at least a 44×44 dp (preferably 48×48 dp) clickable hit area on mobile devices.
- **Rule**: Even when an icon artwork is small (e.g., 20px SVG), wrap it in an accessible touch container with adequate padding.

### 2.14 Safe Area Insets (Edge-to-Edge)
- **Standard**: Accommodate hardware cutouts, status bars, display notches, and system navigation bars.
- **Implementation**: `MainActivity.kt` dynamically calculates and injects CSS variables `--sat` (safe-area-top) and `--sab` (safe-area-bottom) into the WebView:
  ```css
  padding-top: max(54px, var(--sat, 54px));
  padding-bottom: max(16px, var(--sab, 16px));
  ```

### 2.15 One-Time Code (OTP) Autofill
- **Standard**: Support seamless 4-digit PIN / OTP entry with platform autofill semantics (`autocomplete="one-time-code"`).
- **Security Rule**: Never log plaintext OTP values to browser console or crash logs. Provide clean manual input fallback with clear error highlighting.

### 2.16 Tabular Numerical Typography
- **Standard**: All financial amounts, Mandi prices, booking reference numbers, and GPS coordinates must use tabular figures (`font-variant-numeric: tabular-nums`).
- **Benefit**: Prevents numbers from jumping or shifting horizontally when rapidly updating during live auctions or real-time GPS pings.

### 2.17 Balanced Headlines
- **Standard**: Use `text-wrap: balance` on hero titles, card headings, and alert banners to eliminate awkward orphan words on narrow smartphone viewports.

### 2.18 Continuous / Squircle Corners
- **Standard**: Enforce consistent corner geometry throughout the application:
  - Buttons & Inputs: `12px` to `14px`
  - Bento Cards: `16px` to `20px`
  - Mobile Frames / Modals: `28px` to `48px`
  - Filter Chips: `999px` (Pill)
- **Rule**: Do not mix sharp 0px corners with organic rounded surfaces.

### 2.19 Idempotency Keys on Mutations
- **Standard**: Critical database mutations (creating a haul booking, renting equipment, adding a financial entry) must carry a unique idempotency key (e.g., UUID or structured reference `GH-BK-...`).
- **Enforcement**: Server and database constraints must enforce idempotency so that accidental double-taps or network retry replays do not create duplicate bookings or financial entries.

### 2.20 Amazon Safe Triangle (Desktop Hover Trajectory)
- **Standard**: For desktop hover flyout menus, implement a triangular safe trajectory pattern so diagonal mouse movement toward submenus does not prematurely close the dropdown.
- **Mobile Rule**: Suppress hover-only flyouts on mobile in favor of explicit tap targets.

---

## 3. The 20 Permanent Security Standards

Security is not an afterthought; it is verified for every commit, migration, API endpoint, and client script.

### 3.1 Hide API Keys & Private Secrets
- **Rule**: Never expose private API keys, service-role keys, database passwords, or signing secrets in frontend JavaScript, Android assets, or public client bundles.
- **Verification**: Client builds and commits are audited (`test_jwt_auth_security.js: SEC-JWT-1`) to guarantee zero occurrences of private secrets.

### 3.2 Purge Git Secrets & Secret Hygiene
- **Rule**: Sensitive configuration files (`.env`, `service-account.json`, private keystores) must be strictly `.gitignore`d. If a secret is ever accidentally committed, it must be considered compromised and rotated immediately—deleting it from a subsequent commit does not remediate the exposure.

### 3.3 Public DB Keys Used Solely with RLS
- **Rule**: Client-side code may only communicate with Supabase using the public anonymous publishable key (`SUPABASE_ANON_KEY`).
- **Principle**: The public key is an identity handle, NOT an authorization bypass. Every exposed table must be guarded by strict Row Level Security (RLS).

### 3.4 Enable Row Level Security (RLS) on All Public Tables
- **Rule**: Every table in the `public` schema must have RLS enabled:
  ```sql
  ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
  ```
- **Auditing**: SELECT, INSERT, UPDATE, and DELETE policies must be explicitly defined and verified. Never run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` to solve a permission error.

### 3.5 Encrypt Sensitive Data in Transit and at Rest
- **Rule**: All network traffic must use TLS 1.3/HTTPS. Sensitive database columns and storage objects (such as foliar scans and identity documents) must utilize PostgreSQL transparent encryption and encrypted cloud storage.

### 3.6 Enforce Server-Side Authentication & Authorization
- **Rule**: Never trust client-supplied identity claims. Protected operations must extract and verify the user's identity from the cryptographically verified JWT (`auth.uid()`).
- **Rule**: Client-side hidden buttons or route guards are cosmetic convenience only; server and RLS boundaries are authoritative.

### 3.7 Lock Record Access (Strict Tenant Isolation)
- **Rule**: Users must only access records they own or are party to:
  - Farmers access only their own khata, land parcels, disease scans, and booking history.
  - Drivers access only their own vehicles, telemetry, and accepted trips.
  - Cross-tenant queries must return 0 rows or throw 403 Forbidden.

### 3.8 Block Field Tampering & Mass Assignment
- **Rule**: Enforce strict allowlists on writable fields. Users must never be permitted to overwrite sensitive columns such as `user_id`, `role`, `is_verified`, `sanctioned_amount`, or `payment_status` during public update requests.

### 3.9 Secure Session Cookies & OS Keystore
- **Web**: Authentication cookies must carry `HttpOnly`, `Secure`, and `SameSite=Lax/Strict` attributes with anti-CSRF protections.
- **Android**: Tokens must be stored in secure private SharedPreferences or Android Keystore-backed encrypted storage.

### 3.10 Cryptographic Password Hashing via Supabase Auth
- **Rule**: Passwords must be hashed using Supabase Auth's managed Argon2/Bcrypt implementations. Never write custom password hashing algorithms or store plaintext passwords.

### 3.11 Rate-Limit Authentication & Sensitive Endpoints
- **Rule**: Public login, registration, password reset, and OTP verification endpoints must be rate-limited to throttle credential stuffing and SMS pumping attacks.

### 3.12 Bot Protection on Public Forms
- **Rule**: High-abuse public endpoints (such as public contact forms and account creation) must incorporate CAPTCHA or abuse-aware throttling without degrading low-bandwidth rural accessibility.

### 3.13 Parameterize All Database Queries
- **Rule**: Never concatenate untrusted user strings into raw SQL queries. Always utilize parameterized queries or Supabase/PostgREST query builders:
  ```typescript
  // Safe: Parameterized
  supabase.from('haul_bookings').select('*').eq('farmer_id', userId);
  ```

### 3.14 Validate All Input Server-Side
- **Rule**: Every input parameter must be validated for type, length, numerical range, regex pattern, and allowed state transitions. Client-side validation is for UX only; backend validation is mandatory.

### 3.15 Escape User Content (XSS Prevention)
- **Rule**: All user-generated content (community posts, farmer names, comments, feedback) must be escaped or sanitized before insertion into the DOM. Never use `innerHTML` with unsanitized user strings.

### 3.16 Restrict File Uploads & Private Storage
- **Rule**: File uploads must enforce strict MIME-type allowlists (JPEG, PNG, MP4), size limits (e.g. 10MB), and be placed in private storage buckets (such as `crop-scans`) with signed URL access.

### 3.17 Trim API Responses & Prevent Over-Fetching
- **Rule**: Endpoints must return only the specific columns needed by the view. Never expose internal database IDs, foreign keys, or other users' confidential contact details in public lists.

### 3.18 Configure Security Headers
- **Rule**: Web responses must declare standard defensive headers:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security`

### 3.19 Force HTTPS Everywhere
- **Rule**: Reject insecure `http://` endpoints in production. All API calls, tile servers, and CDN assets must load over HTTPS.

### 3.20 Dependency Vulnerability Scanning
- **Rule**: Regularly audit third-party dependencies (`npm audit`, `pip check`). Review CVE advisories and update packages without introducing unvetted breaking changes.

---

## 4. Mandatory Feature Development Workflow

Whenever a developer or agent works on NuKropAI, follow this exact six-step lifecycle:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE DEVELOPMENT CYCLE                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. INSPECT   → Read AGENTS.md & this Quality Standard.          │
│                Inspect existing code, dependencies, and tests.  │
│ 2. ASSESS    → Identify which of the 20 UI/UX and 20 Security   │
│                standards apply to this specific task.           │
│ 3. IMPLEMENT → Reuse design tokens, shared components, and      │
│                security utilities. Connect real backend APIs.   │
│ 4. TEST      → Run unit tests, backend tests, Android builds,   │
│                and Playwright E2E suites. Fix regressions.      │
│ 5. DOCUMENT  → Fill out the Mandatory Per-Feature Quality       │
│                Checklist in docs/FEATURE_DEFINITION_OF_DONE.md. │
│ 6. VERIFY    → Verify 100% SHA-256 parity between index.html    │
│                and nukrop_emulator.html. Commit cleanly.        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Mandatory Per-Feature Quality Report Format

Every completed task must output a quality compliance table using these exact five classifications:
- `IMPLEMENTED` — The standard was added or enhanced in this task.
- `ALREADY PRESENT AND VERIFIED` — The standard already existed and was verified operational.
- `NOT APPLICABLE` — The standard does not apply to this feature (with an explicit reason).
- `BLOCKED` — The standard cannot be tested due to external dependency (with explicit evidence).
- `DEFERRED` — Explicitly scheduled for a subsequent phase (with architectural justification).

### Template Quality Report

| Category | Standard | Status | Evidence / Implementation Reference |
| :--- | :--- | :--- | :--- |
| **UI/UX** | 1. Skeleton Loaders | `IMPLEMENTED` | Verified `.skeleton-shimmer` generator in `index.html` |
| **UI/UX** | 2. Optimistic Updates | `NOT APPLICABLE` | Read-only Mandi rates view |
| **UI/UX** | 3. Command Menu | `ALREADY PRESENT AND VERIFIED` | Verified `web/src/components/CommandMenu.tsx` |
| **UI/UX** | 4. Shortcut Hints | `ALREADY PRESENT AND VERIFIED` | Ctrl+K badge displayed on desktop header |
| **UI/UX** | 5. Undo Toasts | `NOT APPLICABLE` | Irreversible booking flow requires confirmation |
| **UI/UX** | 6. Stale-While-Revalidate | `ALREADY PRESENT AND VERIFIED` | `data/mandi_daily_real_rates.json` SWR cache with badge |
| **UI/UX** | 7. Pre-Rendering | `ALREADY PRESENT AND VERIFIED` | Vite static marketing bundle in `web/dist` |
| **UI/UX** | 8. BlurHash Placeholders | `IMPLEMENTED` | Low-resolution crop thumbnail fallback |
| **UI/UX** | 9. View Transitions | `ALREADY PRESENT AND VERIFIED` | Hardware-accelerated `.screen-fade` in `openScreen()` |
| **UI/UX** | 10. Swipe-to-Dismiss Sheets | `ALREADY PRESENT AND VERIFIED` | Interactive bottom sheet in `gramhaul_tracking` |
| **UI/UX** | 11. Interruptible Animations| `ALREADY PRESENT AND VERIFIED` | Tap-to-advance on startup splash screen |
| **UI/UX** | 12. Predictive Back | `ALREADY PRESENT AND VERIFIED` | `OnBackPressedCallback` handling in `MainActivity.kt` |
| **UI/UX** | 13. Hit Slop (Touch Targets)| `ALREADY PRESENT AND VERIFIED` | All interactive buttons >= 44dp physical height |
| **UI/UX** | 14. Safe Area Insets | `ALREADY PRESENT AND VERIFIED` | `--sat` and `--sab` CSS properties dynamically bound |
| **UI/UX** | 15. One-Time Code Autofill | `ALREADY PRESENT AND VERIFIED` | 4-digit OTP modal with numeric input semantics |
| **UI/UX** | 16. Tabular Numbers | `ALREADY PRESENT AND VERIFIED` | Mandi prices & totals formatted with tabular figures |
| **UI/UX** | 17. Balanced Headlines | `ALREADY PRESENT AND VERIFIED` | Headings styled with `text-wrap: balance` |
| **UI/UX** | 18. Continuous Corners | `ALREADY PRESENT AND VERIFIED` | 14px-20px squircle border-radii across bento cards |
| **UI/UX** | 19. Idempotency Keys | `ALREADY PRESENT AND VERIFIED` | Unique booking reference generated on checkout |
| **UI/UX** | 20. Amazon Safe Triangle | `NOT APPLICABLE` | Mobile-first touch dock navigation |
| **Security**| 1. Hide API Keys | `ALREADY PRESENT AND VERIFIED` | SEC-JWT-1 test verified; no service keys in frontend |
| **Security**| 2. Purge Git Secrets | `ALREADY PRESENT AND VERIFIED` | `.env` untracked; zero secrets in git history |
| **Security**| 3. Public DB Keys with RLS | `ALREADY PRESENT AND VERIFIED` | Public anon key bounded strictly by PostgreSQL RLS |
| **Security**| 4. Enable Row Level Security| `ALREADY PRESENT AND VERIFIED` | 36/36 multi-role adversarial RLS tests passed |
| **Security**| 5. Encrypt Sensitive Data | `ALREADY PRESENT AND VERIFIED` | HTTPS enforced; private storage buckets |
| **Security**| 6. Server-Side Authentication| `ALREADY PRESENT AND VERIFIED` | JWT `auth.uid()` extracted on every backend route |
| **Security**| 7. Lock Record Access | `ALREADY PRESENT AND VERIFIED` | Cross-tenant queries blocked by policy |
| **Security**| 8. Block Field Tampering | `ALREADY PRESENT AND VERIFIED` | Writable column allowlists enforced in schema |
| **Security**| 9. Secure Session Storage | `ALREADY PRESENT AND VERIFIED` | Isolated localStorage / Android private storage |
| **Security**| 10. Hash Passwords | `ALREADY PRESENT AND VERIFIED` | Managed Supabase GoTrue Auth |
| **Security**| 11. Rate-Limit Login | `ALREADY PRESENT AND VERIFIED` | Backend Fastify rate-limiter active |
| **Security**| 12. Bot Protection | `ALREADY PRESENT AND VERIFIED` | Public registration role whitelist defense |
| **Security**| 13. Parameterize Queries | `ALREADY PRESENT AND VERIFIED` | 0 raw SQL string concatenations in source |
| **Security**| 14. Validate All Input | `ALREADY PRESENT AND VERIFIED` | Strict schema and type validations active |
| **Security**| 15. Escape User Content | `ALREADY PRESENT AND VERIFIED` | Safe DOM text node assignments; XSS tested |
| **Security**| 16. Restrict File Uploads | `ALREADY PRESENT AND VERIFIED` | Private `crop-scans` bucket with signed URL access |
| **Security**| 17. Trim API Responses | `ALREADY PRESENT AND VERIFIED` | `public_profiles` view excludes private phone/land |
| **Security**| 18. Security Headers | `ALREADY PRESENT AND VERIFIED` | Web production bundle declares security headers |
| **Security**| 19. Force HTTPS | `ALREADY PRESENT AND VERIFIED` | Cleartext traffic blocked in AndroidManifest.xml |
| **Security**| 20. Dependency Vulnerability| `ALREADY PRESENT AND VERIFIED` | Zero high/critical CVEs in production dependencies |

---

## 6. Global Definition of Done

A user story, task, or bug fix is **DONE** only when:
1. **Core Functionality Works**: The feature operates genuinely between real accounts and real data endpoints.
2. **Zero Facades**: No synthetic timers (`setInterval`) pretending to drive vehicle movement or generate mock rates.
3. **Async States Complete**: Shimmer skeletons, error states, empty states, and offline states are implemented.
4. **Design Consistency**: Uses standard NuKropAI design tokens, colors, typography, and corner radii.
5. **Security Verified**: Tested against relevant RLS policies and server-side authorization checks.
6. **Parity Guaranteed**: Any change in `app/src/main/assets/index.html` is synchronized 100% byte-for-byte to `nukrop_emulator.html`.
7. **Automated Tests Pass**: All relevant unit tests, backend tests, and Android builds pass cleanly.
8. **Documentation Updated**: The feature checklist is recorded.
9. **Git Hygiene Preserved**: PR #2 remains OPEN and UNMERGED; zero private credentials are committed.
