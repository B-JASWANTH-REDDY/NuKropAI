-- =============================================================================
-- NuKropAI Production Migration: RLS Hardening & Full-Stack Authorization Alignment
-- Migration ID: 20261103000002_production_rls_alignment.sql
--
-- Objective:
-- Resolve live HTTP 403 authorization blocks on haul_bookings, post_likes,
-- and truck_listings by applying narrow, verified, non-destructive Row Level
-- Security policies and explicit role permissions.
--
-- Non-Negotiable Standards:
-- 1. Never disable RLS.
-- 2. Never introduce permissive USING (true) write policies.
-- 3. Strict owner isolation: auth.uid() matching only.
-- 4. Idempotent: safe to run multiple times without error.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: HAUL BOOKINGS RLS POLICIES (GRAMHAUL LOGISTICS)
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure RLS is active
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;

-- Clean up any existing legacy or restrictive policies
DROP POLICY IF EXISTS "haul_bookings_parties" ON public.haul_bookings;
DROP POLICY IF EXISTS "haul_bookings_select" ON public.haul_bookings;
DROP POLICY IF EXISTS "haul_bookings_insert" ON public.haul_bookings;
DROP POLICY IF EXISTS "haul_bookings_update" ON public.haul_bookings;
DROP POLICY IF EXISTS "haul_bookings_delete" ON public.haul_bookings;
DROP POLICY IF EXISTS "haul_bookings_all" ON public.haul_bookings;
DROP POLICY IF EXISTS "Farmer view own bookings" ON public.haul_bookings;
DROP POLICY IF EXISTS "Farmer insert own bookings" ON public.haul_bookings;
DROP POLICY IF EXISTS "Farmer update own bookings" ON public.haul_bookings;
DROP POLICY IF EXISTS "Driver view eligible bookings" ON public.haul_bookings;
DROP POLICY IF EXISTS "Driver update eligible bookings" ON public.haul_bookings;
DROP POLICY IF EXISTS "Farmers own haul bookings" ON public.haul_bookings;

-- 1A. SELECT Policy: Booking parties & eligible drivers in dispatch pool
CREATE POLICY "haul_bookings_select" ON public.haul_bookings 
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- The booking farmer
    auth.uid()::text = farmer_user_id::text
    OR auth.uid()::text = user_id::text
    OR auth.uid()::text = farmer_id::text
    -- The assigned driver
    OR auth.uid()::text = driver_user_id::text
    OR auth.uid()::text = driver_id::text
    -- Eligible drivers viewing unassigned pending broadcasts
    OR (
      status IN ('PENDING', 'broadcast')
      AND driver_user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (id::text = auth.uid()::text OR user_id::text = auth.uid()::text)
          AND role = 'driver'
      )
    )
  )
);

-- 1B. INSERT Policy: Authenticated users can create bookings ONLY for themselves
CREATE POLICY "haul_bookings_insert" ON public.haul_bookings 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = farmer_user_id::text
    OR auth.uid()::text = user_id::text
    OR auth.uid()::text = farmer_id::text
  )
);

-- 1C. UPDATE Policy: Farmers can modify/cancel their own bookings; Drivers can accept/update status
CREATE POLICY "haul_bookings_update" ON public.haul_bookings 
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    -- Farmer owner
    auth.uid()::text = farmer_user_id::text
    OR auth.uid()::text = user_id::text
    OR auth.uid()::text = farmer_id::text
    -- Assigned driver
    OR auth.uid()::text = driver_user_id::text
    OR auth.uid()::text = driver_id::text
    -- Unassigned driver accepting a pending haul
    OR (
      driver_user_id IS NULL 
      AND status IN ('PENDING', 'broadcast')
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE (id::text = auth.uid()::text OR user_id::text = auth.uid()::text) 
          AND role = 'driver'
      )
    )
  )
) WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = farmer_user_id::text
    OR auth.uid()::text = user_id::text
    OR auth.uid()::text = farmer_id::text
    OR auth.uid()::text = driver_user_id::text
    OR auth.uid()::text = driver_id::text
  )
);

-- 1D. DELETE Policy: Farmer can delete only while still pending or cancelled
CREATE POLICY "haul_bookings_delete" ON public.haul_bookings 
FOR DELETE USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid()::text = farmer_user_id::text
    OR auth.uid()::text = user_id::text
    OR auth.uid()::text = farmer_id::text
  )
  AND status IN ('PENDING', 'CANCELLED', 'broadcast')
);

-- Ensure correct table grants
REVOKE ALL ON public.haul_bookings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.haul_bookings TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: POST LIKES RLS POLICIES (COMMUNITY SOCIAL ENGINE)
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure RLS is active
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Ensure unique constraint exists to prevent duplicate likes at database level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_post_likes' AND conrelid = 'public.post_likes'::regclass
  ) THEN
    ALTER TABLE public.post_likes ADD CONSTRAINT unique_post_likes UNIQUE (post_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Clean up any existing legacy policies
DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_write" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_update" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;
DROP POLICY IF EXISTS "Public can view post likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;

-- 2A. SELECT Policy: Community feed likes are publicly visible for aggregate counting
CREATE POLICY "post_likes_read" ON public.post_likes 
FOR SELECT USING (true);

-- 2B. INSERT Policy: Users can only insert a like on their own behalf
CREATE POLICY "post_likes_insert" ON public.post_likes 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- 2C. DELETE Policy: Users can only delete (unlike) their own likes
CREATE POLICY "post_likes_delete" ON public.post_likes 
FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- Grants
GRANT SELECT ON public.post_likes TO anon, authenticated, service_role;
GRANT INSERT, DELETE ON public.post_likes TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: TRUCK LISTINGS RLS POLICIES (FLEET DISPATCH & POOLING)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.truck_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "truck_listings_read" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_write" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_insert_owner" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_update_owner" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_delete_owner" ON public.truck_listings;
DROP POLICY IF EXISTS "Public can read available trucks" ON public.truck_listings;

-- 3A. SELECT: Active trucks are public; inactive trucks visible only to owners
CREATE POLICY "truck_listings_read" ON public.truck_listings 
FOR SELECT USING (
  status = 'ACTIVE' 
  OR (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = user_id::text 
      OR auth.uid()::text = transporter_id::text
    )
  )
);

-- 3B. INSERT: Transporters/drivers can only list trucks for their own account
CREATE POLICY "truck_listings_insert_owner" ON public.truck_listings 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = user_id::text 
    OR auth.uid()::text = transporter_id::text
  )
);

-- 3C. UPDATE: Owners only
CREATE POLICY "truck_listings_update_owner" ON public.truck_listings 
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = user_id::text 
    OR auth.uid()::text = transporter_id::text
  )
) WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = user_id::text 
    OR auth.uid()::text = transporter_id::text
  )
);

-- 3D. DELETE: Owners only
CREATE POLICY "truck_listings_delete_owner" ON public.truck_listings 
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = user_id::text 
    OR auth.uid()::text = transporter_id::text
  )
);

-- Grants
GRANT SELECT ON public.truck_listings TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.truck_listings TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: NOTIFY SCHEMA CACHE RELOAD
-- ─────────────────────────────────────────────────────────────────────────────
-- Force PostgREST to immediately rebuild its schema and permissions cache
NOTIFY pgrst, 'reload schema';

