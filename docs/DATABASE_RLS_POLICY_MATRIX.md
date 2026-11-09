# NuKropAI — Database Row Level Security (RLS) Policy Matrix

**Document ID:** `DOC-DB-RLS-001`  
**Classification:** Database Security Architecture Specification  
**Status:** Authoritative & Active  

---

## 1. Master RLS Policy Enforcement Matrix

Every table storing user or transactional data has RLS enabled with **Deny-by-Default** enforcement.

| Table Name | Operation | Target Role | RLS Policy Expression | Security Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `public.farms` | `SELECT` | `authenticated` | `auth.uid() = user_id` | Prevents cross-farmer land inspection. |
| `public.farms` | `INSERT` | `authenticated` | `auth.uid() = user_id` | Enforces self-ownership on farm creation. |
| `public.farms` | `UPDATE` | `authenticated` | `auth.uid() = user_id` | Prevents unauthorized acreage mutation. |
| `public.farms` | `DELETE` | `authenticated` | `auth.uid() = user_id` | Only owner can remove farm registration. |
| `public.disease_scans` | `SELECT` | `authenticated` | `auth.uid() = user_id` | Foliar disease history remains private. |
| `public.disease_scans` | `INSERT` | `authenticated` | `auth.uid() = user_id` | Restricts diagnostic uploads to active user. |
| `public.khata_entries` | `ALL` | `authenticated` | `auth.uid() = user_id` | Protects financial bookkeeping records. |
| `public.community_posts` | `SELECT` | `anon, auth` | `is_published = true` | Publicly viewable agrarian knowledge feed. |
| `public.community_posts` | `INSERT` | `authenticated` | `auth.uid() = user_id` | Attributed post authorship. |
| `public.community_posts` | `UPDATE` | `authenticated` | `auth.uid() = user_id` | Prevents tampering with another farmer's post. |
| `public.community_posts` | `DELETE` | `authenticated` | `auth.uid() = user_id OR is_admin()` | Author or moderator deletion only. |
| `public.mandi_rates` | `SELECT` | `anon, auth` | `true` | Public Agmarknet market ticker rates. |
| `public.mandi_rates` | `ALL` (Write) | `service_role` | `auth.jwt() ->> 'role' = 'service_role'`| Write-protected against client manipulation. |
| `public.gramhaul_bookings` | `SELECT` | `authenticated` | `auth.uid() = farmer_id OR auth.uid() = driver_id` | Isolates logistics trips to participants. |
| `public.gramhaul_bookings` | `INSERT` | `authenticated` | `auth.uid() = farmer_id` | Only farmers can dispatch freight requests. |
| `public.gramhaul_bookings` | `UPDATE` | `authenticated` | `auth.uid() = farmer_id OR auth.uid() = driver_id` | Restricted to trip state lifecycle transitions. |
| `public.refresh_tokens` | `ALL` | `service_role` | `auth.jwt() ->> 'role' = 'service_role'`| Token hashes inaccessible to standard clients. |

---

## 2. Supabase Storage Bucket Policies

1. **`community-media` (Public Bucket)**:
   - `SELECT`: Allowed for all authenticated and anonymous clients (`bucket_id = 'community-media'`).
   - `INSERT`: Allowed only for authenticated farmers with file size <= 10MB and MIME type `image/jpeg`, `image/png`, or `video/mp4`.
2. **`foliar-scans` (Private Bucket)**:
   - `SELECT`: Allowed only if `auth.uid() = (storage.foldername(name))[1]`.
   - `INSERT`: Restricted to user's personal folder prefix `auth.uid()/*`.
3. **`land-deeds` (Confidential Bucket)**:
   - Private bucket with short-lived signed URLs (15-minute validity).
   - Zero direct public URL access permitted.
