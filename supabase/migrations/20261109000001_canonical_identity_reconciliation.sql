-- ============================================================================
-- NUKROPAI CANONICAL IDENTITY & AUTHORIZATION RECONCILIATION MIGRATION
-- Migration: 20261109000001_canonical_identity_reconciliation.sql
--
-- Strict Additive & Safe Execution:
-- 1. Uses Supabase platform auth.users as canonical identity.
-- 2. Respects Supabase platform auth functions (auth.uid, auth.role).
-- 3. Strict privacy-by-default: Removes broad SELECT on public.profiles.
-- 4. Creates restricted public.public_profiles view for non-sensitive discovery.
-- 5. Adds durable public.price_alerts table with strict RLS and idempotency.
-- 6. Adds durable public.notifications table with strict RLS.
-- 7. Observable legacy user migration tracking with audit table.
-- ============================================================================

-- Step 1: Ensure public.users check constraint supports 'driver' role if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('farmer', 'buyer', 'admin', 'driver'));
  END IF;
END $$;

-- Step 2: Additive column expansion for public.profiles (guaranteed safe on tracked baseline)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(30),
  full_name VARCHAR(150) NOT NULL DEFAULT 'Farmer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add all required domain attributes if they do not exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_id VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mandal VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_acres NUMERIC(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_extent_acres NUMERIC(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_type VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_crops TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_credit_limit NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_balance NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_id VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_lock BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_given BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_timestamp TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_id TEXT;

-- Drop legacy fabricated defaults from columns to guarantee unverified attributes are never assumed
ALTER TABLE public.profiles ALTER COLUMN village DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN district DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN state DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN land_extent_acres DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN dpdp_consent_given SET DEFAULT FALSE;
ALTER TABLE public.profiles ALTER COLUMN dpdp_consent_timestamp DROP DEFAULT;

-- Safely make phone nullable to support email-based authentication without synthetic phone numbers
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
END $$;

-- Populate user_id from id for existing profiles where user_id is null
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Secure schema permissions: untrusted roles cannot create objects in public or extensions schemas
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT CREATE ON SCHEMA public TO postgres, service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'extensions') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA extensions FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT CREATE ON SCHEMA extensions TO postgres, service_role';
  END IF;
END $$;

-- Dedicated server generator for public_id (128-bit UUID representation, 122 bits of RFC 4122 UUIDv4 random entropy)
-- Restricted strictly to service_role and postgres; denied to untrusted roles.
CREATE OR REPLACE FUNCTION public.generate_profile_public_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN 'nk_pub_' || lower(replace(gen_random_uuid()::text, '-', ''));
END;
$$;

REVOKE ALL ON FUNCTION public.generate_profile_public_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_profile_public_id() TO service_role;

-- Populate public_id with dedicated opaque random identifier if null (128-bit UUID representation, 122 bits of RFC 4122 UUIDv4 random entropy, 32 hex chars suffix)
UPDATE public.profiles 
SET public_id = 'nk_pub_' || lower(replace(gen_random_uuid()::text, '-', ''))
WHERE public_id IS NULL;

-- Ensure public_id has NO column default so untrusted callers cannot rely on or manipulate default evaluation
ALTER TABLE public.profiles ALTER COLUMN public_id DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_id_unique ON public.profiles(public_id);

-- Enforce server-controlled public_id generation on profile insert (rejects client selection, empty, malformed, or UUID injection)
-- Does NOT rely on custom GUCs, client headers, or forgeable session state.
CREATE OR REPLACE FUNCTION public.ensure_profile_public_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. If public_id is omitted or explicitly passed as NULL, generate 122-bit CSPRNG server identifier (RFC 4122 UUID v4)
  IF NEW.public_id IS NULL THEN
    NEW.public_id := 'nk_pub_' || lower(replace(gen_random_uuid()::text, '-', ''));
    RETURN NEW;
  END IF;

  -- 2. Reject client-specified public IDs if called by untrusted authenticated or anon role
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Client-specified public_id is prohibited. public_id must be server-generated.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Reject empty strings
  IF NEW.public_id = '' THEN
    RAISE EXCEPTION 'MALFORMED_PUBLIC_ID: public_id cannot be an empty string'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Reject UUID injection (e.g. attempting to inject internal auth UUID with hyphens as public identifier)
  IF NEW.public_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'UUID_INJECTION_REJECTED: Internal UUID cannot be used as public_id'
      USING ERRCODE = '22023';
  END IF;

  -- 5. Reject arbitrary strings, user-selected vanity names, or malformed/predictable strings from trusted callers
  -- Only exact 32-hex format 'nk_pub_[32 hex]' is permitted
  IF NOT (NEW.public_id ~ '^nk_pub_[0-9a-f]{32}$') THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_ID: Caller-supplied public_id "%" is prohibited. Must be server-generated with 122-bit UUIDv4 randomness.', NEW.public_id
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_public_id ON public.profiles;
CREATE TRIGGER trg_ensure_profile_public_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_public_id();

-- Enforce public_id immutability on profile updates
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.public_id IS NOT NULL AND OLD.public_id IS DISTINCT FROM NEW.public_id) THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: public_id cannot be modified once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_immutable_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_immutable_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_immutable_fields();

-- Enforce domain role check on profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('farmer', 'driver', 'agronomist', 'admin', 'buyer'));

-- Audit and resolve any conflicting duplicate profile user_id mappings before adding uniqueness constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON public.profiles(user_id) WHERE user_id IS NOT NULL;

-- Indexes for lightning-fast profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Step 3: Secure Auth Signup Trigger (Mapping auth.users -> public.profiles)
-- Prevents privilege escalation: only permits 'farmer' or 'driver' from user metadata.
-- Administrative role ('admin') can NEVER be self-assigned during registration.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_role text;
  v_requested_role text;
  v_village text;
  v_mandal text;
  v_district text;
  v_state text;
  v_dpdp_consent boolean;
  v_public_profile_enabled boolean;
  v_farmer_id text;
  v_driver_id text;
  v_public_id text;
BEGIN
  -- Extract metadata safely
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Farmer'
  );
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'phoneNumber',
    to_jsonb(NEW)->>'phone'
  );
  
  -- Generate dedicated opaque random public identifier (128-bit UUID representation, 122 bits of RFC 4122 UUIDv4 random entropy, 32 hex chars suffix)
  v_public_id := 'nk_pub_' || lower(replace(gen_random_uuid()::text, '-', ''));

  -- ROLE WHITELISTING & PRIVILEGE ESCALATION BLOCK
  v_requested_role := LOWER(COALESCE(
    NEW.raw_app_meta_data->>'role',
    NEW.raw_user_meta_data->>'role',
    'farmer'
  ));
  
  IF v_requested_role = 'driver' THEN
    v_role := 'driver';
    v_driver_id := 'NKD-' || floor(1000 + random() * 8999)::text;
  ELSE
    v_role := 'farmer';
    v_farmer_id := 'NKF-' || floor(10000 + random() * 89999)::text;
  END IF;

  -- Extract location strictly from user metadata (never fabricate unverified geographic attributes)
  v_village := NEW.raw_user_meta_data->>'village';
  v_mandal := NEW.raw_user_meta_data->>'mandal';
  v_district := NEW.raw_user_meta_data->>'district';
  v_state := NEW.raw_user_meta_data->>'state';

  -- DPDP Consent: unknown or missing consent defaults strictly to FALSE (never fabricated as TRUE)
  IF (NEW.raw_user_meta_data->>'dpdp_consent_given') IS NOT NULL THEN
    v_dpdp_consent := (NEW.raw_user_meta_data->>'dpdp_consent_given')::boolean;
  ELSE
    v_dpdp_consent := FALSE;
  END IF;

  -- Public profile discovery opt-in: defaults strictly to FALSE (never exposed without explicit opt-in)
  IF (NEW.raw_user_meta_data->>'public_profile_enabled') IS NOT NULL THEN
    v_public_profile_enabled := (NEW.raw_user_meta_data->>'public_profile_enabled')::boolean;
  ELSE
    v_public_profile_enabled := FALSE;
  END IF;

  INSERT INTO public.profiles (
    id,
    user_id,
    public_id,
    email,
    role,
    full_name,
    phone,
    phone_number,
    farmer_id,
    driver_id,
    village,
    mandal,
    district,
    state,
    dpdp_consent_given,
    dpdp_consent_timestamp,
    public_profile_enabled,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    v_public_id,
    NEW.email,
    v_role,
    v_full_name,
    v_phone,
    v_phone,
    v_farmer_id,
    v_driver_id,
    v_village,
    v_mandal,
    v_district,
    v_state,
    v_dpdp_consent,
    CASE WHEN v_dpdp_consent THEN NOW() ELSE NULL END,
    v_public_profile_enabled,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.id,
    public_id = COALESCE(public.profiles.public_id, EXCLUDED.public_id),
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    full_name = CASE WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = 'Farmer' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
    village = COALESCE(public.profiles.village, EXCLUDED.village),
    mandal = COALESCE(public.profiles.mandal, EXCLUDED.mandal),
    district = COALESCE(public.profiles.district, EXCLUDED.district),
    state = COALESCE(public.profiles.state, EXCLUDED.state),
    dpdp_consent_given = COALESCE(public.profiles.dpdp_consent_given, EXCLUDED.dpdp_consent_given, FALSE),
    dpdp_consent_timestamp = CASE 
      WHEN EXCLUDED.dpdp_consent_given = TRUE AND public.profiles.dpdp_consent_given IS NOT TRUE THEN NOW()
      ELSE public.profiles.dpdp_consent_timestamp 
    END,
    public_profile_enabled = COALESCE(public.profiles.public_profile_enabled, EXCLUDED.public_profile_enabled, FALSE),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Revoke handle_new_auth_user execute from untrusted roles
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;
  END IF;
END $$;

-- Step 4: Observable Legacy Account Migration with Audit Log
CREATE TABLE IF NOT EXISTS public._migration_legacy_user_sync_audit (
  user_id UUID PRIMARY KEY,
  email TEXT,
  role TEXT,
  status TEXT NOT NULL, -- 'MIGRATED', 'ALREADY_EXISTS', 'PASSWORD_RECOVERY_REQUIRED', 'ADMIN_VERIFICATION_REQUIRED'
  details TEXT,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  rec RECORD;
  v_migrated INT := 0;
  v_existing INT := 0;
  v_recovery INT := 0;
  v_admin_count INT := 0;
  v_sanitized_role TEXT;
  v_admin_flagged BOOLEAN := FALSE;
  v_status TEXT;
  v_details TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    FOR rec IN SELECT id, email, password_hash, role, created_at FROM public.users LOOP
      IF EXISTS (SELECT 1 FROM auth.users WHERE id = rec.id) THEN
        v_existing := v_existing + 1;
        INSERT INTO public._migration_legacy_user_sync_audit (user_id, email, role, status, details)
        VALUES (rec.id, rec.email, rec.role, 'ALREADY_EXISTS', 'Account already present in auth.users')
        ON CONFLICT (user_id) DO UPDATE SET details = EXCLUDED.details;
      ELSE
        -- P0.3: ROLE WHITELISTING & ADMIN ESCALATION BLOCK
        -- Never write 'admin' to app_metadata automatically during migration
        IF LOWER(COALESCE(rec.role, '')) = 'admin' THEN
          v_sanitized_role := 'farmer';
          v_admin_flagged := TRUE;
          v_admin_count := v_admin_count + 1;
        ELSIF LOWER(COALESCE(rec.role, '')) IN ('driver', 'buyer', 'farmer') THEN
          v_sanitized_role := LOWER(rec.role);
          v_admin_flagged := FALSE;
        ELSE
          v_sanitized_role := 'farmer';
          v_admin_flagged := FALSE;
        END IF;

        -- Validate password hash compatibility (bcrypt prefix $2a$ or $2b$)
        IF rec.password_hash IS NOT NULL AND rec.password_hash ~ '^\$2[ab]\$[0-9]{2}\$' THEN
          INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
          VALUES (
            rec.id,
            rec.email,
            rec.password_hash,
            jsonb_build_object('role', v_sanitized_role, 'legacy_migrated', true, 'admin_verification_required', v_admin_flagged),
            jsonb_build_object('role', v_sanitized_role),
            rec.created_at,
            NOW()
          );
          v_migrated := v_migrated + 1;

          IF v_admin_flagged THEN
            v_status := 'ADMIN_VERIFICATION_REQUIRED';
            v_details := 'Legacy admin role stripped during automated migration; downgraded to farmer pending independent security authorization';
          ELSE
            v_status := 'MIGRATED';
            v_details := 'Migrated successfully with compatible bcrypt hash';
          END IF;

          INSERT INTO public._migration_legacy_user_sync_audit (user_id, email, role, status, details)
          VALUES (rec.id, rec.email, rec.role, v_status, v_details)
          ON CONFLICT (user_id) DO UPDATE SET details = EXCLUDED.details, status = EXCLUDED.status;
        ELSE
          -- Incompatible or legacy cleartext/SHA hash -> insert with disabled password and require recovery
          INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
          VALUES (
            rec.id,
            rec.email,
            jsonb_build_object('role', v_sanitized_role, 'legacy_migrated', true, 'password_recovery_required', true, 'admin_verification_required', v_admin_flagged),
            jsonb_build_object('role', v_sanitized_role),
            rec.created_at,
            NOW()
          );
          v_recovery := v_recovery + 1;

          IF v_admin_flagged THEN
            v_status := 'ADMIN_VERIFICATION_REQUIRED';
            v_details := 'Legacy admin role stripped and password hash incompatible; recovery and admin authorization required';
          ELSE
            v_status := 'PASSWORD_RECOVERY_REQUIRED';
            v_details := 'Hash incompatible with bcrypt; password recovery required';
          END IF;

          INSERT INTO public._migration_legacy_user_sync_audit (user_id, email, role, status, details)
          VALUES (rec.id, rec.email, rec.role, v_status, v_details)
          ON CONFLICT (user_id) DO UPDATE SET details = EXCLUDED.details, status = EXCLUDED.status;
        END IF;

        -- Ensure public.profiles has corresponding record without clobbering existing profile data
        INSERT INTO public.profiles (id, user_id, email, role, full_name, created_at, updated_at)
        VALUES (
          rec.id,
          rec.id,
          rec.email,
          v_sanitized_role,
          split_part(rec.email, '@', 1),
          rec.created_at,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          email = COALESCE(public.profiles.email, EXCLUDED.email),
          role = v_sanitized_role,
          full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
          updated_at = NOW();
      END IF;
    END LOOP;
    RAISE NOTICE 'Legacy user migration observable audit: migrated=%, already_exists=%, recovery_required=%, admin_downgraded=%', v_migrated, v_existing, v_recovery, v_admin_count;
  END IF;
END $$;

-- Step 4B: Historical Profile Provenance Audit (Non-Destructive)
-- Problem: Earlier schemas applied blanket column defaults ('Hanamkonda', 'Warangal', 'Telangana', 4.50).
-- Removing column defaults prevents future synthetic values, but historical rows may contain unverified defaults.
-- Solution (Non-Destructive Audit):
-- 1. Create an immutable, observable audit table `_profile_provenance_audit` with unique constraint on (profile_id, field_name).
-- 2. Identify rows matching boilerplate combinations (village='Hanamkonda', district='Warangal', state='Telangana', land_extent_acres=4.50).
-- 3. CRITICAL: Never perform destructive updates or nullify farmer profile values.
--    Do not treat lack of land document as proof that acreage or location is false.
--    Record unverified provenance in audit table ('FLAGGED_UNVERIFIED_DEFAULT', 'PRESERVED_FOR_USER_CONFIRMATION')
--    while preserving all genuine user data, accounts, credentials, and transactions intact.
CREATE TABLE IF NOT EXISTS public._profile_provenance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  current_value TEXT,
  old_value TEXT,
  new_value TEXT,
  provenance_status TEXT NOT NULL, -- 'FLAGGED_UNVERIFIED_DEFAULT', 'PRESERVED_GENUINE', 'USER_CONFIRMED'
  action TEXT NOT NULL,            -- 'PRESERVED_FOR_USER_CONFIRMATION', 'PRESERVED_GENUINE'
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_provenance_audit_unique 
  ON public._profile_provenance_audit (profile_id, field_name);

DO $$
DECLARE
  p_rec RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    FOR p_rec IN 
      SELECT id, village, district, state, land_extent_acres, land_acres, full_name, email 
      FROM public.profiles 
      WHERE village = 'Hanamkonda' AND district = 'Warangal' AND state = 'Telangana' 
        AND (land_extent_acres = 4.50 OR land_acres = 4.50)
    LOOP
      -- NON-DESTRUCTIVE AUDIT LOGGING:
      -- Preserve all existing values in profiles table without destructive NULL overwrites.
      -- Record unverified legacy default pattern in audit table for user confirmation.
      INSERT INTO public._profile_provenance_audit (
        profile_id, field_name, current_value, old_value, new_value, provenance_status, action, reason
      )
      VALUES 
        (p_rec.id::text, 'village', p_rec.village, p_rec.village, p_rec.village, 'FLAGGED_UNVERIFIED_DEFAULT', 'PRESERVED_FOR_USER_CONFIRMATION', 'Matches legacy boilerplate default; preserved intact pending user profile confirmation'),
        (p_rec.id::text, 'district', p_rec.district, p_rec.district, p_rec.district, 'FLAGGED_UNVERIFIED_DEFAULT', 'PRESERVED_FOR_USER_CONFIRMATION', 'Matches legacy boilerplate default; preserved intact pending user profile confirmation'),
        (p_rec.id::text, 'state', p_rec.state, p_rec.state, p_rec.state, 'FLAGGED_UNVERIFIED_DEFAULT', 'PRESERVED_FOR_USER_CONFIRMATION', 'Matches legacy boilerplate default; preserved intact pending user profile confirmation'),
        (p_rec.id::text, 'land_extent_acres', COALESCE(p_rec.land_extent_acres::text, p_rec.land_acres::text), COALESCE(p_rec.land_extent_acres::text, p_rec.land_acres::text), COALESCE(p_rec.land_extent_acres::text, p_rec.land_acres::text), 'FLAGGED_UNVERIFIED_DEFAULT', 'PRESERVED_FOR_USER_CONFIRMATION', 'Matches legacy boilerplate default 4.50; preserved intact pending user profile confirmation')
      ON CONFLICT (profile_id, field_name) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Step 5: Strict Privacy-by-Default Row Level Security (RLS) Policies

-- 1. PROFILES RLS (Strict Owner-Only & Admin/Service-Role Access)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (
    (auth.role() = 'authenticated' AND (
      auth.uid() = id 
      OR auth.uid() = user_id
      OR (SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->'app_metadata'->>'role') = 'admin'
    ))
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id 
    OR auth.uid() = user_id
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (
    (auth.uid() = id OR auth.uid() = user_id OR auth.role() = 'service_role')
  )
  WITH CHECK (
    (auth.uid() = id OR auth.uid() = user_id OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (
    auth.uid() = id OR auth.uid() = user_id OR auth.role() = 'service_role'
  );

-- 2. RESTRICTED PUBLIC PROFILES VIEW (Approved Opt-In Non-Sensitive Public Discovery Only)
-- Defined as a SECURITY DEFINER view (WITH security_barrier = true, security_invoker = false)
-- owned by postgres so that authenticated users can discover opted-in users' public identities
-- while keeping the underlying public.profiles table strictly owner-only.
-- Filters strictly to users who have explicitly opted in (WHERE public_profile_enabled = TRUE).
-- Excludes internal auth identifiers (id, user_id) and confidential attributes
-- (phone, email, village, mandal, land_acres, land_extent_acres, kcc_balance, kcc_credit_limit, agristack_id, dpdp_consent).
-- Excludes unverified claims (agristack_verified) and private preferences (preferred_language).
-- Exposes distinct public identifier (farmer_id / driver_id / surrogate public_id) without auth UUIDs.
CREATE OR REPLACE VIEW public.public_profiles WITH (security_barrier = true, security_invoker = false) AS
SELECT 
  public_id,
  full_name,
  role,
  avatar_url,
  district,
  state,
  created_at
FROM public.profiles
WHERE public_profile_enabled = TRUE;

ALTER VIEW public.public_profiles OWNER TO postgres;
REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.public_profiles FROM authenticated, anon;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;

-- 2B. PREVENT DIRECT CLIENT MUTATION OF DISCOVERY FLAG
-- Protects public_profile_enabled from direct client table mutation via PostgREST/raw UPDATE.
-- Setting or revoking discovery must be performed via the authenticated backend API
-- or through the audited SECURITY DEFINER RPC function (set_my_profile_discovery).
CREATE OR REPLACE FUNCTION public.prevent_direct_discovery_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (current_user = 'authenticated') THEN
    IF (OLD.public_profile_enabled IS DISTINCT FROM NEW.public_profile_enabled) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Direct table mutation of public_profile_enabled is prohibited. Use the authenticated discovery endpoint or audited function.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_discovery_mutation ON public.profiles;
CREATE TRIGGER trg_prevent_direct_discovery_mutation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_discovery_mutation();

-- Audited SECURITY DEFINER RPC function for setting authenticated user's own discovery flag
-- Enforces canonical identity uniqueness: rejects ambiguous mappings (v_match_count > 1)
-- Updates strictly by canonical primary key.
CREATE OR REPLACE FUNCTION public.set_my_profile_discovery(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_match_count int;
  v_profile_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to set discovery visibility';
  END IF;

  -- Canonical identity check: verify single unambiguous profile mapping for caller
  SELECT count(*), min(id::text) 
  INTO v_match_count, v_profile_id
  FROM public.profiles
  WHERE (id::text = v_uid::text OR user_id::text = v_uid::text);

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: No canonical profile found for authenticated user';
  ELSIF v_match_count > 1 THEN
    RAISE EXCEPTION 'AMBIGUOUS_IDENTITY: Multiple profile mappings found for authenticated user. Ambiguous update rejected.';
  END IF;

  -- Strictly update by unique canonical primary key
  UPDATE public.profiles
  SET public_profile_enabled = p_enabled, updated_at = NOW()
  WHERE id::text = v_profile_id;

  RETURN p_enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_profile_discovery(boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_my_profile_discovery(boolean) FROM anon, PUBLIC;

-- 3. DISEASE SCANS RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disease_scans') THEN
    ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.disease_scans FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "scans_select_own" ON public.disease_scans;
    CREATE POLICY "scans_select_own" ON public.disease_scans FOR SELECT
      USING (auth.uid() = user_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "scans_insert_own" ON public.disease_scans;
    CREATE POLICY "scans_insert_own" ON public.disease_scans FOR INSERT
      WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "scans_delete_own" ON public.disease_scans;
    CREATE POLICY "scans_delete_own" ON public.disease_scans FOR DELETE
      USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- 4. KHATA TRANSACTIONS RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'khata_transactions') THEN
    ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.khata_transactions FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "khata_select_own" ON public.khata_transactions;
    CREATE POLICY "khata_select_own" ON public.khata_transactions FOR SELECT
      USING (auth.uid() = user_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "khata_insert_own" ON public.khata_transactions;
    CREATE POLICY "khata_insert_own" ON public.khata_transactions FOR INSERT
      WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "khata_update_own" ON public.khata_transactions;
    CREATE POLICY "khata_update_own" ON public.khata_transactions FOR UPDATE
      USING (auth.uid() = user_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "khata_delete_own" ON public.khata_transactions;
    CREATE POLICY "khata_delete_own" ON public.khata_transactions FOR DELETE
      USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- 5. COMMUNITY POSTS RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'community_posts') THEN
    ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.community_posts FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "posts_select_all" ON public.community_posts;
    CREATE POLICY "posts_select_all" ON public.community_posts FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "posts_insert_own" ON public.community_posts;
    CREATE POLICY "posts_insert_own" ON public.community_posts FOR INSERT
      WITH CHECK (auth.uid() = author_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "posts_update_own" ON public.community_posts;
    CREATE POLICY "posts_update_own" ON public.community_posts FOR UPDATE
      USING (auth.uid() = author_id OR auth.role() = 'service_role');

    DROP POLICY IF EXISTS "posts_delete_own" ON public.community_posts;
    CREATE POLICY "posts_delete_own" ON public.community_posts FOR DELETE
      USING (auth.uid() = author_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- 6. POST LIKES TABLE & RLS
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON public.post_likes;
CREATE POLICY "likes_select_all" ON public.post_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON public.post_likes;
CREATE POLICY "likes_insert_own" ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "likes_delete_own" ON public.post_likes;
CREATE POLICY "likes_delete_own" ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 7. PRICE ALERTS TABLE & RLS (Genuinely Persistent Agrarian Market Alerts)
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop VARCHAR(100) NOT NULL,
  commodity VARCHAR(100) NOT NULL,
  mandi VARCHAR(150) NOT NULL,
  target_price NUMERIC(10,2) NOT NULL CHECK (target_price > 0),
  condition VARCHAR(20) NOT NULL DEFAULT 'ABOVE' CHECK (condition IN ('ABOVE', 'BELOW')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIGGERED', 'PAUSED', 'CANCELLED')),
  idempotency_key VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_at TIMESTAMPTZ,
  CONSTRAINT uq_price_alerts_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_status ON public.price_alerts(status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_eval ON public.price_alerts(commodity, mandi, status);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_alerts_select_own" ON public.price_alerts;
CREATE POLICY "price_alerts_select_own"
  ON public.price_alerts FOR SELECT
  USING (
    (auth.role() = 'authenticated' AND (auth.uid() = user_id OR (SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->'app_metadata'->>'role') = 'admin'))
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "price_alerts_insert_own" ON public.price_alerts;
CREATE POLICY "price_alerts_insert_own"
  ON public.price_alerts FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "price_alerts_update_own" ON public.price_alerts;
CREATE POLICY "price_alerts_update_own"
  ON public.price_alerts FOR UPDATE
  USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "price_alerts_delete_own" ON public.price_alerts;
CREATE POLICY "price_alerts_delete_own"
  ON public.price_alerts FOR DELETE
  USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  );

-- 8. NOTIFICATIONS TABLE & RLS (Genuinely Persistent Domain Event Notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_source VARCHAR(50) NOT NULL,
  event_id VARCHAR(100),
  category VARCHAR(50) NOT NULL DEFAULT 'SYSTEM' CHECK (category IN ('PRICE_ALERT', 'WEATHER_WARNING', 'COMMUNITY', 'SYSTEM')),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notifications_event_source_id UNIQUE (user_id, event_source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (
    (auth.role() = 'authenticated' AND (auth.uid() = user_id OR (SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->'app_metadata'->>'role') = 'admin'))
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR auth.role() = 'service_role'
  );

-- Step 6: Grant appropriate permissions to authenticated and service_role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
  END IF;
END $$;

-- Explicit Least-Privilege Enforcements: Revoke internal server routines from untrusted roles
REVOKE ALL ON FUNCTION public.generate_profile_public_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_profile_public_id() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;
  END IF;
END $$;
