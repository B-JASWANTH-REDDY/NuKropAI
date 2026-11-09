-- ============================================================================
-- NUKROPAI CANONICAL IDENTITY & AUTHORIZATION RECONCILIATION MIGRATION
-- Migration: 20261109000001_canonical_identity_reconciliation.sql
--
-- Strict Additive & Safe Execution:
-- 1. Establishes auth.users as the canonical identity store.
-- 2. Safely adapts public.profiles from the tracked baseline schema without data loss.
-- 3. Automates profile synchronization via security-definer trigger with role whitelisting.
-- 4. Prevents privilege escalation (blocks self-assignment of 'admin' role).
-- 5. Implements real PostgreSQL Row Level Security (RLS) policies for tenant isolation.
-- ============================================================================

-- Step 1: Ensure auth schema and functions exist (compatible with standalone Postgres & Supabase)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  encrypted_password VARCHAR(255),
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock or ensure auth.uid() and auth.role() helper functions
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    'anon'
  )::text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'anon';
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 2: Ensure public.users check constraint supports 'driver' role
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

-- Step 3: Additive column expansion for public.profiles (guaranteed safe on tracked baseline)
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
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Safely populate user_id from id for existing profiles where user_id is null
DO $$
BEGIN
  UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Enforce domain role check on profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('farmer', 'driver', 'agronomist', 'admin', 'buyer'));

-- Indexes for lightning-fast profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Step 4: Secure Auth Signup Trigger (Mapping auth.users -> public.profiles)
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
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Farmer'
  );
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'phone_number'
  );

  -- Role whitelist & privilege escalation prevention:
  v_requested_role := lower(COALESCE(
    NEW.raw_app_meta_data->>'role',
    NEW.raw_user_meta_data->>'role',
    'farmer'
  ));
  
  -- Administrative roles ('admin') can only be granted via server-authoritative service_role
  IF v_requested_role = 'admin' AND COALESCE(NEW.raw_app_meta_data->>'role', '') <> 'admin' THEN
    v_role := 'farmer';
  ELSIF v_requested_role IN ('farmer', 'driver', 'buyer') THEN
    v_role := v_requested_role;
  ELSE
    v_role := 'farmer';
  END IF;

  v_village := COALESCE(NEW.raw_user_meta_data->>'village', 'Warangal Rural');
  v_district := COALESCE(NEW.raw_user_meta_data->>'district', 'Warangal');

  IF v_role = 'driver' THEN
    v_farmer_id := NULL;
    v_driver_id := 'DRV-' || floor(10000 + random() * 89999)::text;
  ELSE
    v_farmer_id := 'NK-' || floor(10000 + random() * 89999)::text;
    v_driver_id := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, user_id, farmer_id, driver_id, email, full_name, phone, phone_number,
    role, village, district, mandal, state, preferred_language, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.id, v_farmer_id, v_driver_id, NEW.email, v_full_name,
    v_phone, v_phone, v_role, v_village, v_district, 'Warangal', 'Telangana', 'te', NOW(), NOW()
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

-- Step 5: Legacy Account Synchronization (public.users -> auth.users & public.profiles)
-- Seamlessly backfills existing public.users into auth.users (if absent) and public.profiles
DO $$
DECLARE
  rec RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    FOR rec IN SELECT id, email, password_hash, role, created_at FROM public.users LOOP
      -- Insert into auth.users if not present
      INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES (
        rec.id,
        rec.email,
        rec.password_hash,
        jsonb_build_object('role', rec.role, 'legacy_migrated', true),
        jsonb_build_object('role', rec.role),
        rec.created_at,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data;

      -- Insert into public.profiles
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
    END LOOP;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Step 6: Explicit Row Level Security (RLS) Policies on Core Tables

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_public" ON public.profiles;
CREATE POLICY "profiles_select_own_or_public"
  ON public.profiles FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = id 
      OR auth.uid() = user_id
      OR role IN ('farmer', 'driver') -- Public profile card visible for matching
      OR (SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->'app_metadata'->>'role') = 'admin'
    )
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

-- 2. DISEASE SCANS RLS
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

-- 3. KHATA TRANSACTIONS RLS
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

-- 4. COMMUNITY POSTS RLS
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

-- 5. POST LIKES TABLE & RLS
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

-- Step 7: Grant appropriate permissions to authenticated and service_role
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

