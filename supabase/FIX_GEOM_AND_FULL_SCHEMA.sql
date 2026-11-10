-- ══════════════════════════════════════════════════════════════════════════════
-- NuKropAI SELF-HEALING PRODUCTION DATABASE MIGRATION & FULL SCHEMA
-- Fixes: ERROR: 42703: column "geom" does not exist
-- Idempotent (Can be executed safely multiple times on existing or fresh DBs)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Timestamp Trigger Function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. DRIVER TELEMETRY (FIX FOR MISSING GEOM COLUMN)
-- ══════════════════════════════════════════════════════════════════════════════

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.driver_telemetry (
  driver_id TEXT PRIMARY KEY,
  user_id UUID,
  driver_name TEXT NOT NULL,
  phone TEXT,
  vehicle_plate TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  speed_kmh NUMERIC(5,2) DEFAULT 0.0,
  heading NUMERIC(5,2) DEFAULT 0.0,
  is_online BOOLEAN DEFAULT FALSE,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crucial: Explicitly ensure "geom" column exists on existing table
ALTER TABLE public.driver_telemetry 
ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);

-- Populate geom from current_lat and current_lng for existing rows
UPDATE public.driver_telemetry 
SET geom = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)
WHERE current_lat IS NOT NULL 
  AND current_lng IS NOT NULL 
  AND geom IS NULL;

-- Create GIST spatial index safely now that column is guaranteed to exist
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_geom 
ON public.driver_telemetry USING GIST(geom);

CREATE INDEX IF NOT EXISTS idx_driver_telemetry_online 
ON public.driver_telemetry(is_online, last_ping DESC);

-- Automatic Geometry point sync trigger
CREATE OR REPLACE FUNCTION trg_fn_update_driver_geom()
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
FOR EACH ROW EXECUTE FUNCTION trg_fn_update_driver_geom();

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. FARMER PROFILES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.farmer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE,
  email TEXT,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  farmer_id TEXT UNIQUE NOT NULL,
  village TEXT,
  district TEXT,
  state TEXT DEFAULT 'Telangana',
  land_acres NUMERIC(6,2) DEFAULT 0.0,
  soil_health_score INTEGER DEFAULT 800,
  pattadar_passbook_no TEXT,
  is_ekyc_verified BOOLEAN DEFAULT FALSE,
  preferred_lang TEXT DEFAULT 'te',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. KISAN COMMUNITY FEED (POSTS, LIKES, COMMENTS)
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_comm_posts_crop ON public.community_posts(crop_id);
CREATE INDEX IF NOT EXISTS idx_comm_posts_created ON public.community_posts(created_at DESC);

-- Community Likes
CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_comm_like_user_post UNIQUE(post_id, user_id)
);

-- Community Comments
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id TEXT,
  author_name TEXT NOT NULL,
  farmer_id TEXT,
  role TEXT DEFAULT 'Farmer',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_comments_post ON public.community_comments(post_id, created_at ASC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. GRAMHAUL HAUL BOOKINGS & WAYPOINTS
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.haul_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_user_id TEXT,
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
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_haul_bookings_status ON public.haul_bookings(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trip_waypoints (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID REFERENCES public.haul_bookings(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_kmh NUMERIC(5,2),
  heading NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_waypoints_booking ON public.trip_waypoints(booking_id, recorded_at ASC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. MANDI LIVE RATES, SCANS & MESSAGES
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandi_rates_lookup ON public.mandi_live_rates(state, commodity, trade_date DESC);

CREATE TABLE IF NOT EXISTS public.disease_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  farmer_id TEXT,
  crop_name TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  severity TEXT DEFAULT 'Moderate',
  recommended_treatment TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.peer_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_email TEXT NOT NULL,
  receiver_email TEXT NOT NULL,
  receiver_name TEXT,
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- 8. GET NEARBY DRIVERS RPC FUNCTION
-- ══════════════════════════════════════════════════════════════════════════
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp;

-- ══════════════════════════════════════════════════════════════════════════
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_live_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Safe creation of RLS policies if not already present
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'farmer_profiles_all') THEN
    CREATE POLICY "farmer_profiles_all" ON public.farmer_profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'community_posts_all') THEN
    CREATE POLICY "community_posts_all" ON public.community_posts FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'community_likes_all') THEN
    CREATE POLICY "community_likes_all" ON public.community_likes FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'community_comments_all') THEN
    CREATE POLICY "community_comments_all" ON public.community_comments FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'driver_telemetry_all') THEN
    CREATE POLICY "driver_telemetry_all" ON public.driver_telemetry FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'haul_bookings_all') THEN
    CREATE POLICY "haul_bookings_all" ON public.haul_bookings FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'trip_waypoints_all') THEN
    CREATE POLICY "trip_waypoints_all" ON public.trip_waypoints FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandi_rates_all') THEN
    CREATE POLICY "mandi_rates_all" ON public.mandi_live_rates FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'disease_scans_all') THEN
    CREATE POLICY "disease_scans_all" ON public.disease_scans FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'peer_messages_all') THEN
    CREATE POLICY "peer_messages_all" ON public.peer_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. ENABLE SUPABASE REALTIME SUBSCRIPTIONS
-- ══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_telemetry;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.haul_bookings;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;
