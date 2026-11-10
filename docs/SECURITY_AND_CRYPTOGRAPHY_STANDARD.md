# NuKropAI — Security & Cryptography Engineering Standard

**Document ID:** `DOC-SEC-CRYPTO-001`  
**Classification:** Enterprise Security Standard  
**Status:** Authoritative & Active  

---

## 1. Cryptographic Standards & Key Management

### A. Password Hashing
- **Primary Algorithm**: Argon2id (Memory: 64MB, Iterations: 3, Parallelism: 4) for new registrations.
- **Legacy Compatibility**: Secure bcrypt ($2b$ salt rounds 12) with transparent re-hashing upon successful authentication.
- **Strict Prohibitions**: Plaintext passwords, reversible encryption, MD5, SHA-1, and unsalted SHA-256 are strictly prohibited for credentials.

### B. Token Integrity & Refresh Token Hashing
- **Signature Algorithm**: HMAC-SHA256 (`HS256`) using high-entropy 512-bit secrets (`JWT_SECRET`).
- **Refresh Token Storage**: Stored as SHA-256 digests in `refresh_tokens.token_hash`. Active plaintext refresh tokens are never persisted in the database.

### C. Data Encryption at Rest & In-Transit
- **In-Transit**: TLS 1.3 enforced across all API endpoints with modern cipher suites (ChaCha20-Poly1305, AES-256-GCM). `network_security_config.xml` sets `cleartextTrafficPermitted="false"`.
- **At-Rest**: AES-256-GCM encrypted PostgreSQL disk volumes and object storage buckets.
- **Field-Level Encryption**: Sensitive farmer identity documents (Aadhaar virtual IDs, survey deeds) encrypted via envelope encryption with hardware-isolated KMS keys.

---

## 2. Four-Tier Data Classification Matrix

| Classification Level | Definition | Examples | Handling & Protection Requirements |
| :--- | :--- | :--- | :--- |
| **Tier 1: Public** | Non-sensitive information available to all users | APMC Mandi rates, general crop calendar, weather advisories | Publicly queryable; SWR cache enabled. |
| **Tier 2: Internal** | Aggregate operational data and metadata | Aggregated mandi arrival volumes, system health metrics | Access restricted to authenticated services. |
| **Tier 3: Confidential** | Private farmer and business operational data | Khata entries, disease scans, GramHaul bookings, community drafts | Encrypted at rest; strict PostGIS RLS with `auth.uid() = user_id`. |
| **Tier 4: Restricted** | Highly sensitive identity and authentication secrets | Passwords, refresh tokens, KCC bank accounts, private deeds | Salted & hashed; field-level AES-256-GCM; zero plain logging. |

---

## 3. Local Mobile Security (MASVS Level 2 Compliance)

1. **Android Keystore / iOS Keychain**:
   - Authentication tokens and encryption keys are stored exclusively in platform-backed secure hardware storage (`SharedPreferences` / Keychain with AES-256 cipher).
   - Plaintext shared preferences, unencrypted SQLite databases, and world-readable directories are forbidden.
2. **Predictive Back Navigation**:
   - Hardware back button dismisses active bottom sheets, modals, and sub-views gracefully before navigating to role dashboards.
3. **No Secret Leaking**:
   - APK and source assets contain zero hardcoded API secrets, private service keys, or staging credentials.
4. **Logging Restrictions**:
   - Loggers, crashlytics, and analytics sanitize all requests: passwords, tokens, OTP codes, and private document URLs are stripped prior to emission.

