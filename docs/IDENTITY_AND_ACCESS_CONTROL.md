# NuKropAI — Identity Architecture & Access Control Specification

**Document ID:** `DOC-SEC-IAM-001`  
**Classification:** Enterprise Security Specification  
**Status:** Canonical & Active  

---

## 1. Single Authoritative Identity System

NuKropAI enforces a unified, single authoritative identity system rooted in **Supabase Authentication (`auth.users`) & PostgREST**, coupled with a **Fastify TypeScript API Gateway**.

```
                [ Mobile / Flutter Client ]
                             |
                     Bearer Access JWT
                             |
                +------------v------------+
                |   Fastify Auth Gateway  |
                | • Fail-Closed Verify    |
                | • Algorithm Check (HS256)|
                | • Issuer / Audience Val |
                | • Rate Limiting         |
                +------------+------------+
                             |
            Signed with SUPABASE_JWT_SECRET
                             |
                +------------v------------+
                |  PostgreSQL PostGIS RLS |
                | • auth.uid() Isolation  |
                | • Role-based Policies   |
                | • Deny-by-Default       |
                +-------------------------+
```

### Identity Rules
1. **Canonical ID**: Every authenticated farmer and driver is assigned a unique UUID in `auth.users`, referenced via `auth.uid()` across all database tables (`farms`, `community_posts`, `khata_entries`, `trips`).
2. **No Role Forgery**: Frontend client role parameters and `user_metadata.role` are untrusted. Only server-validated `app_metadata.role` or verified database profile records grant permissions.
3. **Secret Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to the backend environment and never bundled in Flutter APKs, client assets, or public repositories.

---

## 2. Authentication Flows & Token Trust Model

### A. Access & Refresh Token Lifecycles
- **Access Tokens**: Short-lived JWTs (15-minute expiration) containing:
  - `sub`: `auth.uid()` (canonical user ID)
  - `aud`: `authenticated`
  - `iss`: `https://yxjqseiegwjdfnccdchk.supabase.co/auth/v1`
  - `role`: `authenticated`
  - `app_metadata`: `{ "role": "farmer" | "driver" | "admin" }`
- **Refresh Tokens**: Cryptographically random 256-bit entropy tokens with single-use rotation.
  - Used tokens are immediately invalidated in `refresh_tokens` database table.
  - Detected replay attacks instantly revoke the entire token family.

### B. Supported Authentication Channels
1. **Farmer Phone OTP**: Mobile number verified via SMS OTP with rate-limiting defense (max 5 attempts per 15-minute window).
2. **Email & Password**: Argon2id / bcrypt password hashing with minimum 8 characters, passphrase support, and password-manager paste permission.
3. **Google OAuth (PKCE)**: Mobile deep-link callback `nukrop://auth-callback` with code challenge validation.
4. **Biometric App Unlock**: Local Android Keystore / iOS Keychain biometric authentication for instant session re-entry.

---

## 3. Role-Based & Attribute-Based Access Control (RBAC + ABAC)

### Role Hierarchy
- **Farmer (`UserRole.farmer`)**: Can manage own farm, scan foliar samples, post in Kisan Community, view mandi rates, book GramHaul trucks, log khata transactions.
- **Logistics Driver (`UserRole.driver`)**: Can access Driver Cockpit, view nearby loads, accept freight dispatches, stream GPS route telemetry, complete trips with OTP PIN.
- **Agronomist Specialist**: Verified authority to publish certified treatment advisories and answer community pest queries.
- **System Admin**: Platform management, moderation, audit log analysis.

### Explicit Permission Matrix

| Permission Key | Description | Farmer | Driver | Admin |
| :--- | :--- | :---: | :---: | :---: |
| `farm.read.own` | Read own farm parcel and soil data | ✔ | ✖ | ✔ |
| `farm.update.own` | Update crop and acreage profiles | ✔ | ✖ | ✔ |
| `mandi.rates.read` | View live APMC mandi prices and trends | ✔ | ✔ | ✔ |
| `scanner.diagnose` | Execute AI crop disease diagnosis | ✔ | ✖ | ✔ |
| `community.post.create` | Publish advice or questions to Kisan feed | ✔ | ✔ | ✔ |
| `community.post.delete.own`| Delete own community submissions | ✔ | ✔ | ✔ |
| `gramhaul.booking.create` | Request freight logistics haul | ✔ | ✖ | ✔ |
| `gramhaul.trip.accept` | Accept assigned farm pickup haul | ✖ | ✔ | ✔ |
| `gramhaul.trip.telemetry`| Stream GPS coordinates during transit | ✖ | ✔ | ✔ |
| `khata.entry.manage` | Add, view, and delete farm bookkeeping entries| ✔ | ✔ | ✔ |
| `admin.audit.read` | Inspect system security and IAM audit logs | ✖ | ✖ | ✔ |

---

## 4. Session Termination & Clean Tenant Isolation

On user sign-out (`SecureStorage.clearSession()`):
1. **Local Purge**: Wipe all JWT access tokens, refresh tokens, and cached farmer profile records from local storage.
2. **Server Revocation**: Invalidate active session tokens on Supabase / Fastify server.
3. **Tenant Switch Safety**: Ensure Farmer B logging into the same device cannot access Farmer A's cached khata entries or foliar scan history. Verified by Mandatory User Journey H.

