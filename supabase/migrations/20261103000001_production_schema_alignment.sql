-- ============================================================================
-- NUKROPAI AGRARIAN OS — PRODUCTION SCHEMA ALIGNMENT MIGRATION
-- Migration: 20261103000001_production_schema_alignment.sql
-- Purpose:
--   1. Add missing alias and telemetry columns across tables (100% additive & non-destructive)
--   2. Ensure full column compatibility across Backend, Web, Android, and AI pipelines
--   3. Create backward-compatible views for Android SupabaseClient (user_profiles, mandi_arbitrage_quotes)
--   4. Configure storage buckets ('crop-scans', 'avatars', 'disease-scans') with RLS
--   5. Idempotent Realtime publication registration without ERROR 42710
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: ADDITIVE COLUMN ALIGNMENT FOR PRE-EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- A. TRUCK LISTINGS (Full Regional Fleet & Shared Logistics Alignment)
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Tata 407 (Heavy Duty)';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS capacity_tons NUMERIC(5,2) DEFAULT 3.0;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS capacity_tonnes NUMERIC(5,2) DEFAULT 3.0;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS available_capacity_tonnes NUMERIC(5,2) DEFAULT 1.5;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS total_bags_capacity INTEGER DEFAULT 30;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS filled_bags INTEGER DEFAULT 0;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS rate_per_bag NUMERIC(8,2) DEFAULT 45.00;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS solo_rate NUMERIC(10,2) DEFAULT 1800.00;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS origin_village TEXT DEFAULT 'Warangal Rural';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS destination_mandi TEXT DEFAULT 'Warangal Enumamula APMC Yard';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS current_mandi TEXT DEFAULT 'Warangal Enumamula APMC Yard';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS departure_time TEXT DEFAULT 'Today, 4:30 PM';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS pickup_eta TEXT DEFAULT '30 mins';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 17.9750;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 79.5990;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS is_cold_chain BOOLEAN DEFAULT FALSE;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 4.9;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS trips_count INTEGER DEFAULT 25;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- B. DRIVER LOCATIONS (Live Dispatch Tracking)
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Truck';
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS current_lat NUMERIC(9,6);
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS current_lng NUMERIC(9,6);
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS active_booking_id TEXT;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ DEFAULT NOW();

-- C. DRIVER TELEMETRY (GPS Sensor & Speed Ingestion)
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS booking_id TEXT;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS speed NUMERIC(5,2);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS accuracy NUMERIC(5,2) DEFAULT 5.0;

-- D. DISEASE SCANS (AI Scanner & Agronomist Remediation)
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS recommendations TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS treatment_recommendation TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS disease_detected TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);

-- E. KHATA TRANSACTIONS (Financial Ledger & Export Alignment)
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

-- F. LAND PARCELS (AgriStack Cadastral Coordinates)
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS irrigation_source VARCHAR(100) DEFAULT 'Borewell';
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS cadastral_geojson JSONB;
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- G. OUTBREAK ALERTS (Pest Monitoring & Early Warnings)
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS pest_disease VARCHAR(100);
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS crop_affected VARCHAR(50);
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS severity_level VARCHAR(20) DEFAULT 'HIGH_ALERT';
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS advisory_summary TEXT;
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100);

-- H. PEER MESSAGES (Farmer Peer Chat)
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS sender_id VARCHAR(50);
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS receiver_id VARCHAR(50);

-- I. COMMUNITY POSTS (Agrarian Knowledge Feed)
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS crop_type VARCHAR(50);

-- J. BIORX BATCHES (Natural Bio-Formulation Tracking)
ALTER TABLE public.biorx_batches ADD COLUMN IF NOT EXISTS batch_number VARCHAR(50);
ALTER TABLE public.biorx_batches ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.biorx_batches ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
ALTER TABLE public.biorx_batches ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'FERMENTING';
ALTER TABLE public.biorx_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: BACKWARD-COMPATIBLE VIEWS FOR ANDROID NATIVE INTEGRATION
-- ─────────────────────────────────────────────────────────────────────────────

-- user_profiles compatibility view for Android SupabaseClient.syncProfile()
DROP VIEW IF EXISTS public.user_profiles CASCADE;
CREATE VIEW public.user_profiles WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  farmer_id,
  email,
  full_name,
  phone AS phone_number,
  state,
  district,
  mandal,
  village,
  (CASE WHEN array_length(primary_crops, 1) > 0 THEN primary_crops[1] ELSE 'cotton' END) AS primary_crop,
  land_acres AS farm_size_acres,
  17.9689::numeric(9,6) AS latitude,
  79.5941::numeric(9,6) AS longitude,
  agristack_id AS dharani_passbook,
  true AS kcc_active,
  kcc_credit_limit AS kcc_sanctioned_limit,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.user_profiles TO authenticated, service_role, anon;

-- mandi_arbitrage_quotes compatibility view for Android MandiPilotScreen
DROP VIEW IF EXISTS public.mandi_arbitrage_quotes CASCADE;
CREATE VIEW public.mandi_arbitrage_quotes WITH (security_invoker = true) AS
SELECT 
  id,
  commodity,
  state AS origin_state,
  district AS origin_district,
  market AS origin_mandi,
  modal_price AS origin_price,
  ROUND(modal_price * 1.15, 2) AS target_price,
  ROUND(modal_price * 0.05, 2) AS transport_cost,
  ROUND((modal_price * 1.15) - (modal_price * 0.05), 2) AS net_realized_price,
  15.00 AS gain_pct,
  'Warangal Enumamula APMC'::text AS recommended_destination,
  'ACTIVE'::text AS quote_status,
  NOW() AS created_at
FROM public.mandi_live_rates;

GRANT SELECT ON public.mandi_arbitrage_quotes TO authenticated, service_role, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: STORAGE BUCKETS CONFIGURATION (PRIVACY-BY-DEFAULT)
-- ─────────────────────────────────────────────────────────────────────────────
-- crop-scans and disease-scans are strictly PRIVATE (public = false) to prevent
-- unauthorized access to farmers' personal field and pathology photos.
-- Avatars are public for display across community feeds and driver profiles.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('crop-scans', 'crop-scans', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('disease-scans', 'disease-scans', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 1. Remove insecure public read policies if they exist
DROP POLICY IF EXISTS "crop_scans_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on crop scans" ON storage.objects;
DROP POLICY IF EXISTS "disease_scans_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on disease scans" ON storage.objects;

-- 2. Enforce Private Owner-Only Read Policy (via auth.uid() and folder matching)
DROP POLICY IF EXISTS "crop_scans_owner_read" ON storage.objects;
CREATE POLICY "crop_scans_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'crop-scans' 
    AND auth.uid() IS NOT NULL 
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 3. Enforce Private Owner-Only Upload Policy
DROP POLICY IF EXISTS "crop_scans_owner_upload" ON storage.objects;
CREATE POLICY "crop_scans_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'crop-scans' 
    AND auth.uid() IS NOT NULL 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 4. Enforce Private Owner-Only Delete Policy
DROP POLICY IF EXISTS "crop_scans_owner_delete" ON storage.objects;
CREATE POLICY "crop_scans_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'crop-scans' 
    AND auth.uid() IS NOT NULL 
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 5. Disease Scans Private Policies
DROP POLICY IF EXISTS "disease_scans_owner_read" ON storage.objects;
CREATE POLICY "disease_scans_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'disease-scans' 
    AND auth.uid() IS NOT NULL 
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

DROP POLICY IF EXISTS "disease_scans_owner_upload" ON storage.objects;
CREATE POLICY "disease_scans_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'disease-scans' 
    AND auth.uid() IS NOT NULL 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

DROP POLICY IF EXISTS "disease_scans_owner_delete" ON storage.objects;
CREATE POLICY "disease_scans_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'disease-scans' 
    AND auth.uid() IS NOT NULL 
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 6. Profile Avatars Policies (Public Read, Owner Upload & Delete)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_upload" ON storage.objects;
CREATE POLICY "avatars_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid() IS NOT NULL 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' 
    AND auth.uid() IS NOT NULL 
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: SAFE IDEMPOTENT REALTIME REGISTRATION
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
  target_tables text[] := ARRAY[
    'driver_telemetry',
    'driver_locations',
    'haul_bookings',
    'community_posts',
    'community_comments',
    'community_stories',
    'outbreak_alerts',
    'price_alerts',
    'mandi_live_rates',
    'truck_listings',
    'peer_messages',
    'post_likes'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY target_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = tbl
      ) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION 
          WHEN duplicate_object THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

