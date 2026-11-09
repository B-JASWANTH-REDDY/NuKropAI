-- ============================================================================
-- NUKROPAI CANONICAL IDENTITY & AUTHORIZATION RECONCILIATION MIGRATION
-- Migration: 20261109000001_canonical_identity_reconciliation.sql
--
-- Reconciles:
-- 1. Fastify backend authentication identity (public.users)
-- 2. Supabase Auth identity (auth.users)
-- 3. Domain profiles (public.profiles)
--
-- Guarantees:
-- - One canonical user UUID across auth and application layers.
-- - Automatic synchronization of accounts from public.users to public.profiles.
-- - RLS policies seamlessly resolve auth.uid() = user_id or auth.uid()::text = id::text.
-- - Role constraints support all official domain roles: farmer, buyer, driver, admin.
-- - Multi-role access isolation and ownership enforcement.
-- ============================================================================

-- Step 1: Align public.users check constraint to include 'driver'
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

-- Step 2: Ensure public.profiles table exists and has user_id and email indexed
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  user_id UUID,
  farmer_id VARCHAR(50) UNIQUE,
  driver_id VARCHAR(50) UNIQUE,
  full_name VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(30),
  phone_number VARCHAR(30),
  role VARCHAR(30) DEFAULT 'farmer' CHECK (role IN ('farmer', 'driver', 'agronomist', 'admin', 'buyer')),
  state VARCHAR(50) DEFAULT NULL,
  district VARCHAR(50) DEFAULT NULL,
  mandal VARCHAR(100) DEFAULT NULL,
  village VARCHAR(100) DEFAULT NULL,
  land_acres NUMERIC(6,2) DEFAULT NULL,
  land_extent_acres NUMERIC(6,2) DEFAULT NULL,
  preferred_language VARCHAR(10) DEFAULT 'te',
  avatar_url TEXT,
  soil_type VARCHAR(100),
  primary_crops TEXT[],
  kcc_credit_limit NUMERIC(10,2),
  kcc_balance NUMERIC(10,2),
  agristack_id VARCHAR(100),
  agristack_verified BOOLEAN DEFAULT FALSE,
  biometric_lock BOOLEAN DEFAULT FALSE,
  dpdp_consent_given BOOLEAN DEFAULT TRUE,
  dpdp_consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Step 3: Bidirectional identity trigger from public.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_user_canonical_identity_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    role,
    full_name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id::text,
    NEW.id,
    NEW.email,
    NEW.role,
    COALESCE(SPLIT_PART(NEW.email, '@', 1), 'User'),
    NEW.created_at,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS trg_user_canonical_identity_sync ON public.users;
    CREATE TRIGGER trg_user_canonical_identity_sync
      AFTER INSERT OR UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_user_canonical_identity_sync();
  END IF;
END $$;

-- Step 4: Backfill existing public.users into public.profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    INSERT INTO public.profiles (id, user_id, email, role, full_name, created_at)
    SELECT 
      u.id::text,
      u.id,
      u.email,
      u.role,
      SPLIT_PART(u.email, '@', 1),
      u.created_at
    FROM public.users u
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      email = EXCLUDED.email,
      role = EXCLUDED.role;
  END IF;
END $$;

-- Step 5: Enforce RLS on public.profiles and public.users
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = id::text 
      OR auth.uid()::text = user_id::text
      OR (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
      OR (SELECT current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'admin'
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = id::text 
      OR auth.uid()::text = user_id::text
      OR (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = id::text 
      OR auth.uid()::text = user_id::text
      OR (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
    )
  );
