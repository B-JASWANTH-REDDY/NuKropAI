# NuKropAI Security Audit & Compliance Report

**Status:** APPROVED FOR PRODUCTION  
**Standards:** OWASP Mobile Top 10, Supabase RLS Best Practices, India Digital Personal Data Protection (DPDP) Act 2023  

---

## 1. Compliance Directives & Remediation Summary

| Directive | Requirement | Implemented Protection | Audit Result |
| :--- | :--- | :--- | :---: |
| **SEC-01** | **No Hardcoded Secrets** | Agmarknet API keys, Supabase Service Role keys, and Gemini tokens removed from tracked client files. All credentials resolved via environment variables (`.env`). | **COMPLIANT** |
| **SEC-02** | **Row Level Security** | Every table in the schema must enable RLS with explicit `USING` and `WITH CHECK` clauses. Zero unrestricted writes allowed. | **COMPLIANT (30/30 Tables)** |
| **SEC-03** | **Anti-Privilege Escalation** | Auth signup trigger rejects arbitrary client-supplied roles. Self-grant of `admin` role is strictly blocked. | **COMPLIANT** |
| **SEC-04** | **Search Path Safety** | All `SECURITY DEFINER` functions in PostgreSQL must declare `SET search_path = public, pg_temp` to prevent search_path hijacking. | **COMPLIANT** |
| **SEC-05** | **DPDP Act Privacy Shield** | Personal identifiers (phone numbers, full names, biometric flags, land extents) must not be publicly readable. | **COMPLIANT (`public_profiles` view)** |
| **SEC-06** | **Storage Privacy** | `crop-scans` bucket containing field images must be private (`public = false`); access restricted to authenticated owners. | **COMPLIANT** |
| **SEC-07** | **Role Impersonation Defense** | Client role guard validates identity across authentication providers (Phone, Email, Google OAuth) to prevent cross-role hijacking. | **COMPLIANT** |
| **SEC-08** | **Input Sanitization** | SQL queries use parameterized statements. Phone numbers and emails undergo rigorous client/server normalization. | **COMPLIANT** |
| **SEC-09** | **Realtime Publication Concurrency** | Idempotent publication attachment avoids transaction aborts from PostgreSQL error `42710`. | **COMPLIANT** |
| **SEC-10** | **IoT Hardware Safety Interlock** | Remote device commands require device ownership verification; offline devices reject commands to prevent physical hazard. | **COMPLIANT** |
| **SEC-11** | **CSRF & Origin Protection** | Supabase OAuth redirect URIs restricted to production Android deep links (`nukrop://auth/callback`) and verified domains. | **COMPLIANT** |
| **SEC-12** | **Cryptographic Standards** | All passwords and authentication tokens handled via Supabase GoTrue with bcrypt/PBKDF2. | **COMPLIANT** |

---

## 2. Row Level Security Policy Verification

The 30 tables in `public` schema have been audited for exact policy enforcement:

1. **`public.profiles`**: SELECT allowed for authenticated owner (`auth.uid() = id`). Public access directed to `public.public_profiles`.
2. **`public.soil_health_cards`**: Private to owner (`auth.uid() = user_id`).
3. **`public.disease_scans`**: Private to owner (`auth.uid() = user_id`).
4. **`public.land_parcels`**: Private to owner (`auth.uid() = user_id`).
5. **`public.kcc_applications`**: Private to owner (`auth.uid() = user_id`).
6. **`public.khata_transactions`**: Private to owner (`auth.uid() = user_id`).
7. **`public.truck_listings`**: Public SELECT; INSERT/UPDATE/DELETE restricted to listing driver.
8. **`public.haul_bookings`**: Accessible only to participating farmer and driver.
9. **`public.community_posts`**: Public SELECT; INSERT requires authenticated user; UPDATE/DELETE restricted to author.
10. **`public.community_stories`**: Public SELECT for unexpired stories (`expires_at > now()`); INSERT requires authenticated user; DELETE restricted to author.
