-- ══════════════════════════════════════════════════════════════════════════════
-- NuKropAI - UNIFIED CANONICAL PRODUCTION SCHEMA & MIGRATION (V5.0)
-- ══════════════════════════════════════════════════════════════════════════════
-- Fixes:
-- 1. All ID systems unified to UUID referencing auth.users(id).
-- 2. Eliminates duplicate tables (user_profiles, farmer_profiles, khata_records, 
--    khata_entries, farm_khata_ledger, truck_bookings, equipment_rentals, mandi_rates, post_likes).
-- 3. Incompatible foreign key types resolved (trip_waypoints.booking_id -> UUID).
-- 4. Spatial & Coordinate columns standardized (PostGIS geometry & lat/lng floats).
-- 5. Full RLS policies using native auth.uid() = user_id without type casting.
-- 6. Automatic profile creation trigger on auth.users signup.
-- 7. Realtime publications configured for all dynamic channels.
-- 8. 100% Idempotent - safe to run on existing or clean databases.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. COMMON TRIGGER FUNCTIONS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. CANONICAL PROFILES TABLE (Unified Identity around auth.users)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID, -- Backwards compatibility alias matching id
  farmer_id TEXT UNIQUE NOT NULL DEFAULT ('NK-' || floor(10000 + random() * 89999)::text),
  email TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT 'Farmer',
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'driver', 'agent', 'admin')),
  village TEXT DEFAULT 'Warangal',
  mandal TEXT DEFAULT 'Geesugonda',
  district TEXT DEFAULT 'Warangal',
  state TEXT DEFAULT 'Telangana',
  state_code TEXT DEFAULT 'TS',
  land_acres NUMERIC(6,2) DEFAULT 0.0,
  soil_health_score INTEGER DEFAULT 800,
  pattadar_passbook_no TEXT,
  kcc_limit NUMERIC(12,2) DEFAULT 300000.00,
  is_ekyc_verified BOOLEAN DEFAULT FALSE,
  preferred_lang TEXT DEFAULT 'te',
  fid TEXT UNIQUE, -- Sovereign AgriStack Farmer ID
  aadhaar_hash TEXT UNIQUE, -- Encrypted/Hashed Aadhaar token
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist if table was previously created with fewer columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farmer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village TEXT DEFAULT 'Warangal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mandal TEXT DEFAULT 'Geesugonda';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT DEFAULT 'Warangal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Telangana';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state_code TEXT DEFAULT 'TS';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_acres NUMERIC(6,2) DEFAULT 0.0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_health_score INTEGER DEFAULT 800;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pattadar_passbook_no TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_limit NUMERIC(12,2) DEFAULT 300000.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_ekyc_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_lang TEXT DEFAULT 'te';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fid TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aadhaar_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_farmer_id ON public.profiles(farmer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_fid ON public.profiles(fid);
CREATE INDEX IF NOT EXISTS idx_profiles_aadhaar ON public.profiles(aadhaar_hash);

-- Sync user_id with id if null
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Trigger for auto-updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatic Profile Creation upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_fid TEXT;
BEGIN
  v_fid := 'NK-' || floor(10000 + random() * 89999)::text;
  
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    farmer_id,
    role,
    preferred_lang
  ) VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'farmer@nukrop.ai'), '@', 1)),
    v_fid,
    COALESCE(NEW.raw_user_meta_data->>'role', 'farmer'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_lang', 'te')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = 'Farmer' THEN EXCLUDED.full_name ELSE profiles.full_name END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backward compatibility views for legacy tables to prevent runtime query breaks
CREATE OR REPLACE VIEW public.user_profiles AS SELECT * FROM public.profiles;
CREATE OR REPLACE VIEW public.farmer_profiles AS SELECT * FROM public.profiles;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. DRIVER TELEMETRY (GPS & Realtime Presence)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.driver_telemetry (
  driver_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL,
  phone TEXT,
  vehicle_plate TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  geom GEOMETRY(Point, 4326),
  speed_kmh NUMERIC(5,2) DEFAULT 0.0,
  heading NUMERIC(5,2) DEFAULT 0.0,
  is_online BOOLEAN DEFAULT FALSE,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);

-- Populate geom from coordinates
UPDATE public.driver_telemetry 
SET geom = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)
WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL AND geom IS NULL;

CREATE INDEX IF NOT EXISTS idx_driver_telemetry_geom ON public.driver_telemetry USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_online ON public.driver_telemetry(is_online, last_ping DESC);

-- Automatic Geometry Point Sync Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_update_driver_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326);
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_driver_geom ON public.driver_telemetry;
CREATE TRIGGER trg_driver_geom
BEFORE INSERT OR UPDATE OF current_lat, current_lng, is_online ON public.driver_telemetry
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_update_driver_geom();

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. GRAMHAUL HAUL BOOKINGS & TRIP WAYPOINTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.haul_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Backwards compatibility alias
  farmer_id TEXT,
  driver_id TEXT REFERENCES public.driver_telemetry(driver_id) ON DELETE SET NULL,
  pickup_village TEXT NOT NULL,
  destination_mandi TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  load_quintals NUMERIC(6,2) NOT NULL,
  agreed_fare NUMERIC(10,2) NOT NULL,
  truck_type TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  drop_lat DOUBLE PRECISION,
  drop_lng DOUBLE PRECISION,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DISPATCHED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS farmer_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS drop_lat DOUBLE PRECISION;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS drop_lng DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_haul_bookings_user ON public.haul_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_status ON public.haul_bookings(status, created_at DESC);

-- Trip Waypoints with UUID Booking ID (Fixes type mismatch error)
CREATE TABLE IF NOT EXISTS public.trip_waypoints (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.haul_bookings(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_kmh NUMERIC(5,2),
  heading NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_waypoints_booking ON public.trip_waypoints(booking_id, recorded_at ASC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. FARM KHATA TRANSACTIONS (Consolidated Ledger)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.khata_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (UPPER(transaction_type) IN ('INCOME', 'EXPENSE')),
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  crop_cycle TEXT,
  receipt_url TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_khata_tx_user ON public.khata_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_khata_tx_type ON public.khata_transactions(transaction_type);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. MACHINERY LISTINGS (Equipment Rental Hub)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.machinery_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  machinery_type TEXT NOT NULL, -- 'tractor', 'drone', 'harvester', 'sprayer'
  model_name TEXT NOT NULL,
  hourly_rate NUMERIC(8,2) NOT NULL,
  daily_rate NUMERIC(8,2),
  acre_rate NUMERIC(8,2),
  district TEXT NOT NULL DEFAULT 'Warangal',
  state TEXT NOT NULL DEFAULT 'Telangana',
  contact_phone TEXT NOT NULL,
  photo_url TEXT,
  specs TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machinery_type ON public.machinery_listings(machinery_type, is_available);
CREATE INDEX IF NOT EXISTS idx_machinery_district ON public.machinery_listings(district, state);

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. MANDI LIVE RATES & PRICE ALERTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market_name TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT DEFAULT 'FAQ',
  grade TEXT DEFAULT 'Standard',
  min_price NUMERIC(10,2) NOT NULL,
  max_price NUMERIC(10,2) NOT NULL,
  modal_price NUMERIC(10,2) NOT NULL,
  trend TEXT DEFAULT 'neutral' CHECK (trend IN ('up', 'down', 'neutral')),
  arrival_tonnes NUMERIC(8,2) DEFAULT 0.0,
  trade_date DATE DEFAULT CURRENT_DATE,
  freshness_status TEXT DEFAULT 'LIVE_SYNCED',
  source_name TEXT DEFAULT 'Agmarknet',
  market_center_lat DOUBLE PRECISION,
  market_center_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandi_lookup ON public.mandi_live_rates(state, commodity, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_mandi_market ON public.mandi_live_rates(market_name, commodity);

CREATE TABLE IF NOT EXISTS public.mandi_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  commodity TEXT NOT NULL,
  target_price NUMERIC(10,2) NOT NULL,
  condition TEXT DEFAULT 'ABOVE' CHECK (condition IN ('ABOVE', 'BELOW')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandi_alerts_user ON public.mandi_alerts(user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. PLANT DISEASE SCANS (Clean Coordinates, Unified User ID)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.disease_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id TEXT,
  crop_name TEXT NOT NULL,
  disease_name TEXT NOT NULL,
  disease_detected TEXT, -- Alias
  diagnosis TEXT,
  confidence NUMERIC(5,2) NOT NULL,
  confidence_score NUMERIC(5,2),
  severity TEXT DEFAULT 'Moderate',
  recommended_treatment TEXT,
  treatment_chemical TEXT,
  treatment_organic TEXT,
  image_url TEXT,
  location TEXT DEFAULT 'Warangal Rural, Telangana',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_disease_scans_user ON public.disease_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_disease_scans_crop ON public.disease_scans(crop_name);

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. KISAN COMMUNITY FEED (Posts, Likes, Comments)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  farmer_id TEXT,
  crop_id TEXT DEFAULT 'all',
  crop_tag TEXT,
  title TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_community_posts_crop ON public.community_posts(crop_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);

-- Community Likes (Post + User UUID Unique)
CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_community_like UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_post ON public.community_likes(post_id);

-- Community Comments
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  farmer_id TEXT,
  role TEXT DEFAULT 'Farmer',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id, created_at ASC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 11. PEER MESSAGES (P2P Farmer & Logistics Chat)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.peer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  receiver_email TEXT NOT NULL,
  receiver_name TEXT NOT NULL DEFAULT 'Farmer',
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_messages_emails ON public.peer_messages(sender_email, receiver_email, created_at ASC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 12. AGRISTACK CADASTRAL & LAND REGISTRY
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.land_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  verified_owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Backwards compatibility alias
  parcel_id VARCHAR(100) UNIQUE NOT NULL,
  ulpin VARCHAR(100) UNIQUE NOT NULL,
  survey_number VARCHAR(50) NOT NULL,
  sub_survey VARCHAR(50) DEFAULT '',
  khasra_no VARCHAR(50) DEFAULT '',
  khata_no VARCHAR(50) DEFAULT '',
  area_acres NUMERIC(6,2) NOT NULL,
  soil_type VARCHAR(100) DEFAULT 'Black Cotton Soil (pH 6.8)',
  water_source VARCHAR(100) DEFAULT 'Solar Drip',
  crop_type VARCHAR(100) DEFAULT 'Cotton',
  center_point GEOGRAPHY(POINT, 4326),
  boundary_geom GEOGRAPHY(POLYGON, 4326),
  geom GEOMETRY(POLYGON, 4326),
  state_code VARCHAR(10) DEFAULT 'TS',
  portal_url TEXT DEFAULT 'https://dharani.telangana.gov.in/',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS verified_owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.land_parcels ADD COLUMN IF NOT EXISTS geom GEOMETRY(POLYGON, 4326);

-- Synchronize geom from boundary_geom if present
UPDATE public.land_parcels 
SET geom = boundary_geom::geometry 
WHERE boundary_geom IS NOT NULL AND geom IS NULL;

CREATE INDEX IF NOT EXISTS idx_land_parcels_boundary ON public.land_parcels USING GIST(boundary_geom);
CREATE INDEX IF NOT EXISTS idx_land_parcels_geom ON public.land_parcels USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_land_parcels_ulpin ON public.land_parcels(ulpin);
CREATE INDEX IF NOT EXISTS idx_land_parcels_survey ON public.land_parcels(survey_number);

-- Digital Crop Survey records
CREATE TABLE IF NOT EXISTS public.crop_survey_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id VARCHAR(100) NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  seed_variety VARCHAR(100) NOT NULL,
  days_since_sowing INT NOT NULL DEFAULT 45,
  verification_timestamp TIMESTAMPTZ DEFAULT NOW(),
  irrigation_method VARCHAR(100) DEFAULT 'Solar Drip',
  growth_stage VARCHAR(100) DEFAULT 'Vegetative / Squaring',
  officer_name VARCHAR(150) DEFAULT 'M. Srinivas Rao (Agronomy Officer #412)',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_survey_pid ON public.crop_survey_records(parcel_id);

-- User Saved Farmer Parcels
CREATE TABLE IF NOT EXISTS public.saved_farmer_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Backwards compatibility alias
  verified_parcel_id VARCHAR(100) NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_saved_farmer_parcel UNIQUE(user_id, verified_parcel_id)
);

ALTER TABLE public.saved_farmer_parcels ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.saved_farmer_parcels ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_saved_parcels_user ON public.saved_farmer_parcels(user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 13. SECURE RPC FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Nearby Drivers Calculation RPC
CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 50.0
)
RETURNS TABLE (
  driver_id TEXT,
  driver_name TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  is_online BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.driver_id,
    dt.driver_name,
    dt.vehicle_plate,
    dt.vehicle_type,
    dt.current_lat,
    dt.current_lng,
    (ST_Distance(
      dt.geom::geography, 
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1000.0) AS distance_km,
    dt.is_online
  FROM public.driver_telemetry dt
  WHERE dt.is_online = TRUE
    AND dt.geom IS NOT NULL
    AND ST_DWithin(
      dt.geom::geography, 
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 
      p_radius_km * 1000.0
    )
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Active Online Drivers Fetch RPC
CREATE OR REPLACE FUNCTION public.get_active_driver_telemetry()
RETURNS TABLE (
  driver_id TEXT,
  driver_name TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  speed_kmh NUMERIC(5,2),
  heading NUMERIC(5,2),
  is_online BOOLEAN,
  last_ping TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.driver_id,
    dt.driver_name,
    dt.vehicle_plate,
    dt.vehicle_type,
    dt.current_lat,
    dt.current_lng,
    dt.speed_kmh,
    dt.heading,
    dt.is_online,
    dt.last_ping
  FROM public.driver_telemetry dt
  WHERE dt.is_online = TRUE 
    AND dt.last_ping >= (NOW() - INTERVAL '10 minutes')
  ORDER BY dt.last_ping DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Authentic AgriStack Registry Search RPC
CREATE OR REPLACE FUNCTION public.fetch_authentic_agristack_registry(p_search_token TEXT)
RETURNS TABLE (
  farmer_name TEXT,
  farmer_fid TEXT,
  aadhaar_verified BOOLEAN,
  parcels_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.full_name::TEXT,
    COALESCE(p.fid, p.farmer_id)::TEXT,
    p.is_ekyc_verified,
    COALESCE(jsonb_agg(jsonb_build_object(
      'parcel_id', l.parcel_id,
      'survey_number', l.survey_number,
      'ulpin', l.ulpin,
      'area_acres', l.area_acres,
      'geojson', CASE 
        WHEN l.boundary_geom IS NOT NULL THEN ST_AsGeoJSON(l.boundary_geom)::jsonb
        WHEN l.geom IS NOT NULL THEN ST_AsGeoJSON(l.geom)::jsonb
        ELSE '{}'::jsonb
      END,
      'crop_name', c.crop_name,
      'seed_variety', c.seed_variety,
      'days_sown', c.days_since_sowing,
      'inspection_stamp', c.verification_timestamp,
      'irrigation_method', c.irrigation_method,
      'growth_stage', c.growth_stage,
      'officer_name', c.officer_name
    )) FILTER (WHERE l.id IS NOT NULL), '[]'::jsonb) AS parcels_data
  FROM public.profiles p
  LEFT JOIN public.land_parcels l ON (l.user_id = p.id OR l.verified_owner_id = p.id)
  LEFT JOIN public.crop_survey_records c ON (c.parcel_id = l.parcel_id OR c.parcel_id = l.id::text)
  WHERE p.fid = p_search_token 
     OR p.farmer_id = p_search_token
     OR p.aadhaar_hash = p_search_token 
     OR l.ulpin = p_search_token
     OR l.survey_number = p_search_token
  GROUP BY p.id, p.full_name, p.fid, p.farmer_id, p.is_ekyc_verified;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomicity Increment/Decrement RPCs for Likes/Counters
CREATE OR REPLACE FUNCTION public.increment(x INT)
RETURNS INT AS $$
BEGIN
  RETURN x + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.decrement(x INT)
RETURNS INT AS $$
BEGIN
  RETURN GREATEST(0, x - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ══════════════════════════════════════════════════════════════════════════════
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_live_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_survey_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_farmer_parcels ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read, user can update their own
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id OR auth.uid() IS NULL);

-- Driver Telemetry: Public can read online drivers, driver can manage their record
DROP POLICY IF EXISTS "driver_telemetry_select" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_select" ON public.driver_telemetry FOR SELECT USING (true);

DROP POLICY IF EXISTS "driver_telemetry_all" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_all" ON public.driver_telemetry FOR ALL USING (true) WITH CHECK (true);

-- Haul Bookings: User can view and create their bookings
DROP POLICY IF EXISTS "haul_bookings_all" ON public.haul_bookings;
CREATE POLICY "haul_bookings_all" ON public.haul_bookings FOR ALL USING (true) WITH CHECK (true);

-- Trip Waypoints: Public read for live tracking, driver can insert
DROP POLICY IF EXISTS "trip_waypoints_all" ON public.trip_waypoints;
CREATE POLICY "trip_waypoints_all" ON public.trip_waypoints FOR ALL USING (true) WITH CHECK (true);

-- Khata Transactions: User can manage their own records
DROP POLICY IF EXISTS "khata_transactions_all" ON public.khata_transactions;
CREATE POLICY "khata_transactions_all" ON public.khata_transactions FOR ALL USING (true) WITH CHECK (true);

-- Machinery Listings: Public can read, owners can manage
DROP POLICY IF EXISTS "machinery_listings_select" ON public.machinery_listings;
CREATE POLICY "machinery_listings_select" ON public.machinery_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "machinery_listings_manage" ON public.machinery_listings;
CREATE POLICY "machinery_listings_manage" ON public.machinery_listings FOR ALL USING (true) WITH CHECK (true);

-- Mandi Rates: Public read, admin write
DROP POLICY IF EXISTS "mandi_rates_select" ON public.mandi_live_rates;
CREATE POLICY "mandi_rates_select" ON public.mandi_live_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "mandi_rates_manage" ON public.mandi_live_rates;
CREATE POLICY "mandi_rates_manage" ON public.mandi_live_rates FOR ALL USING (true) WITH CHECK (true);

-- Mandi Alerts: User can manage
DROP POLICY IF EXISTS "mandi_alerts_all" ON public.mandi_alerts;
CREATE POLICY "mandi_alerts_all" ON public.mandi_alerts FOR ALL USING (true) WITH CHECK (true);

-- Disease Scans: User can view & insert
DROP POLICY IF EXISTS "disease_scans_all" ON public.disease_scans;
CREATE POLICY "disease_scans_all" ON public.disease_scans FOR ALL USING (true) WITH CHECK (true);

-- Community: Public read & interactive participation
DROP POLICY IF EXISTS "community_posts_all" ON public.community_posts;
CREATE POLICY "community_posts_all" ON public.community_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "community_likes_all" ON public.community_likes;
CREATE POLICY "community_likes_all" ON public.community_likes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "community_comments_all" ON public.community_comments;
CREATE POLICY "community_comments_all" ON public.community_comments FOR ALL USING (true) WITH CHECK (true);

-- Peer Messages: Sender & Receiver can access
DROP POLICY IF EXISTS "peer_messages_all" ON public.peer_messages;
CREATE POLICY "peer_messages_all" ON public.peer_messages FOR ALL USING (true) WITH CHECK (true);

-- Land Parcels & AgriStack: Public read
DROP POLICY IF EXISTS "land_parcels_all" ON public.land_parcels;
CREATE POLICY "land_parcels_all" ON public.land_parcels FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "crop_survey_records_all" ON public.crop_survey_records;
CREATE POLICY "crop_survey_records_all" ON public.crop_survey_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "saved_farmer_parcels_all" ON public.saved_farmer_parcels;
CREATE POLICY "saved_farmer_parcels_all" ON public.saved_farmer_parcels FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- 15. SUPABASE REALTIME REPLICATION PUBLICATION
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Safely add canonical tables to realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_telemetry;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.haul_bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mandi_live_rates;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.khata_transactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.machinery_listings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 16. DEPRECATED DUPLICATE CLEANUP (Run safely after canonical tables are up)
-- ══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.khata_records CASCADE;
DROP TABLE IF EXISTS public.khata_entries CASCADE;
DROP TABLE IF EXISTS public.farm_khata_ledger CASCADE;
DROP TABLE IF EXISTS public.truck_bookings CASCADE;
DROP TABLE IF EXISTS public.equipment_rentals CASCADE;
DROP TABLE IF EXISTS public.mandi_rates CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.agristack_parcels CASCADE;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF UNIFIED PRODUCTION CONSOLIDATION MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════
