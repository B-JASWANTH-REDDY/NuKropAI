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
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village VARCHAR(100) DEFAULT 'Hanamkonda';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mandal VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district VARCHAR(50) DEFAULT 'Warangal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'Telangana';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_acres NUMERIC(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_extent_acres NUMERIC(6,2) DEFAULT 4.50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'te';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_type VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_crops TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_credit_limit NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_balance NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_id VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_lock BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_given BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_timestamp TIMESTAMPTZ DEFAULT NOW();

-- Safely make phone nullable to support email-based authentication without synthetic phone numbers
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
END $$;

-- Populate user_id from id for existing profiles where user_id is null
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Enforce domain role check on profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('farmer', 'driver', 'agronomist', 'admin', 'buyer'));

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
  v_district text;
  v_farmer_id text;
  v_driver_id text;
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

  v_village := COALESCE(NEW.raw_user_meta_data->>'village', 'Hanamkonda');
  v_district := COALESCE(NEW.raw_user_meta_data->>'district', 'Warangal');

  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    role,
    full_name,
    phone,
    phone_number,
    farmer_id,
    driver_id,
    village,
    district,
    state,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    v_role,
    v_full_name,
    v_phone,
    v_phone,
    v_farmer_id,
    v_driver_id,
    v_village,
    v_district,
    'Telangana',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.id,
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    full_name = CASE WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = 'Farmer' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Step 4: Observable Legacy Account Migration with Audit Log
CREATE TABLE IF NOT EXISTS public._migration_legacy_user_sync_audit (
  user_id UUID PRIMARY KEY,
  email TEXT,
  role TEXT,
  status TEXT NOT NULL, -- 'MIGRATED', 'ALREADY_EXISTS', 'PASSWORD_RECOVERY_REQUIRED'
  details TEXT,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  rec RECORD;
  v_migrated INT := 0;
  v_existing INT := 0;
  v_recovery INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    FOR rec IN SELECT id, email, password_hash, role, created_at FROM public.users LOOP
      IF EXISTS (SELECT 1 FROM auth.users WHERE id = rec.id) THEN
        v_existing := v_existing + 1;
        INSERT INTO public._migration_legacy_user_sync_audit (user_id, email, role, status, details)
        VALUES (rec.id, rec.email, rec.role, 'ALREADY_EXISTS', 'Account already present in auth.users')
        ON CONFLICT (user_id) DO UPDATE SET details = EXCLUDED.details;
      ELSE
        -- Validate password hash compatibility (bcrypt prefix $2a$ or $2b$)
        IF rec.password_hash IS NOT NULL AND rec.password_hash ~ '^\$2[ab]\$[0-9]{2}\$' THEN
          INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
          VALUES (
            rec.id,
            rec.email,
            rec.password_hash,
            jsonb_build_object('role', rec.role, 'legacy_migrated', true),
            jsonb_build_object('role', rec.role),
            rec.created_at,
            NOW()
          );
          v_migrated := v_migrated + 1;
          INSERT INTO public._migration_legacy_user_sync_audit (user_id, email, role, status, details)
          VALUES (rec.id, rec.email, rec.role, 'MIGRATED', 'Migrated successfully with compatible bcrypt hash')
          ON CONFLICT (user_id) DO UPDATE SET details = EXCLUDED.details;
        ELSE
          -- Incompatible or legacy cleartext/SHA hash -> insert with disabled password and require recovery
          INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
          VALUES (
            rec.id,
            rec.email,
            jsonb_build_object('role', rec.role, 'legacy_migrated', true, 'password_recovery_required', true),
            jsonb_build_object('role', rec.role),
            rec.created_at,
            NOW()
          );
          v_recovery := v_recovery + 1;
          INSERT INTO public._migration_legacy_user_sync_audit (user_id, email, role, status, details)
          VALUES (rec.id, rec.email, rec.role, 'PASSWORD_RECOVERY_REQUIRED', 'Hash incompatible with bcrypt; password recovery required')
          ON CONFLICT (user_id) DO UPDATE SET details = EXCLUDED.details;
        END IF;

        -- Ensure public.profiles has corresponding record
        INSERT INTO public.profiles (id, user_id, email, role, full_name, created_at, updated_at)
        VALUES (
          rec.id,
          rec.id,
          rec.email,
          rec.role,
          split_part(rec.email, '@', 1),
          rec.created_at,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          updated_at = NOW();
      END IF;
    END LOOP;
    RAISE NOTICE 'Legacy user migration observable audit: migrated=%, already_exists=%, recovery_required=%', v_migrated, v_existing, v_recovery;
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

-- 2. RESTRICTED PUBLIC PROFILES VIEW (Approved Non-Sensitive Public Discovery Only)
-- Excludes: email, phone, land_acres, kcc_credit_limit, kcc_balance, soil_type, agristack_id, dpdp_consent
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  full_name,
  role,
  avatar_url,
  village,
  district,
  state,
  agristack_verified,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon, service_role;

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
  idempotency_key VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_at TIMESTAMPTZ
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
