-- ══════════════════════════════════════════════════════════════════════════════
-- NuKropAI Production Database Schema & Real-Time Subsystem
-- 100% Clean, Dynamic, Production-Ready (Zero Hardcoded / Mock Rows)
-- Target Engine: PostgreSQL 15+ with PostGIS / Supabase
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Automatic Updated_At Timestamp Trigger Function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. FARMER & USER PROFILES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.farmer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TRIGGER trg_farmer_profiles_updated_at
BEFORE UPDATE ON public.farmer_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. KISAN COMMUNITY FEED (POSTS, COMMENTS, LIKES)
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  farmer_id TEXT,
  crop_id TEXT DEFAULT 'all',
  crop_tag TEXT,
  title TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT, -- 'photo', 'video', 'voice'
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_posts_crop ON public.community_posts(crop_id);
CREATE INDEX IF NOT EXISTS idx_comm_posts_created ON public.community_posts(created_at DESC);

CREATE TRIGGER trg_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Community Post Likes (Unique per user/post)
CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_comm_like_user_post UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_likes_post ON public.community_likes(post_id);

-- Trigger to maintain post likes count automatically
CREATE OR REPLACE FUNCTION trg_fn_update_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts 
    SET likes_count = GREATEST(0, likes_count - 1) 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_post_likes ON public.community_likes;
CREATE TRIGGER trg_auto_post_likes
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION trg_fn_update_post_likes();

-- Community Post Comments
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

-- Trigger to maintain post comments count automatically
CREATE OR REPLACE FUNCTION trg_fn_update_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts 
    SET comments_count = comments_count + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts 
    SET comments_count = GREATEST(0, comments_count - 1) 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_post_comments ON public.community_comments;
CREATE TRIGGER trg_auto_post_comments
AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION trg_fn_update_post_comments();

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. GRAMHAUL DRIVER TELEMETRY & LIVE GPS TRACKING
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.driver_telemetry (
  driver_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_telemetry_geom ON public.driver_telemetry USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_online ON public.driver_telemetry(is_online, last_ping DESC);

-- Trigger to automatically update PostGIS geometry point from lat/lng
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
CREATE INDEX IF NOT EXISTS idx_haul_bookings_driver ON public.haul_bookings(driver_id);

CREATE TRIGGER trg_haul_bookings_updated_at
BEFORE UPDATE ON public.haul_bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Live GPS Trip Waypoints Trail
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
-- 7. LIVE AGMARKNET & APMC MANDI RATES
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

-- ══════════════════════════════════════════════════════════════════════════
-- 8. AI CROP & SOIL DISEASE SCANS
-- ══════════════════════════════════════════════════════════════════════════
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

CREATE INDEX IF NOT EXISTS idx_disease_scans_user ON public.disease_scans(user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- 9. P2P REALTIME CHAT MESSAGES
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.peer_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_email TEXT NOT NULL,
  receiver_email TEXT NOT NULL,
  receiver_name TEXT,
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_messages_thread ON public.peer_messages(sender_email, receiver_email, created_at ASC);

-- ══════════════════════════════════════════════════════════════════════════
-- 10. SPATIAL RPC FUNCTION: GET NEARBY ONLINE DRIVERS
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
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ══════════════════════════════════════════════════════════════════════════

-- Enable RLS across all tables
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

-- 1. Farmer Profiles
CREATE POLICY "farmer_profiles_select_public" ON public.farmer_profiles FOR SELECT USING (true);
CREATE POLICY "farmer_profiles_insert_all" ON public.farmer_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "farmer_profiles_update_all" ON public.farmer_profiles FOR UPDATE USING (true);

-- 2. Community Posts
CREATE POLICY "comm_posts_select" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "comm_posts_insert" ON public.community_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "comm_posts_update" ON public.community_posts FOR UPDATE USING (true);
CREATE POLICY "comm_posts_delete" ON public.community_posts FOR DELETE USING (true);

-- 3. Community Likes
CREATE POLICY "comm_likes_select" ON public.community_likes FOR SELECT USING (true);
CREATE POLICY "comm_likes_insert" ON public.community_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "comm_likes_delete" ON public.community_likes FOR DELETE USING (true);

-- 4. Community Comments
CREATE POLICY "comm_comments_select" ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "comm_comments_insert" ON public.community_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comm_comments_delete" ON public.community_comments FOR DELETE USING (true);

-- 5. Driver Telemetry
CREATE POLICY "driver_telemetry_select" ON public.driver_telemetry FOR SELECT USING (true);
CREATE POLICY "driver_telemetry_insert" ON public.driver_telemetry FOR INSERT WITH CHECK (true);
CREATE POLICY "driver_telemetry_update" ON public.driver_telemetry FOR UPDATE USING (true);

-- 6. Haul Bookings
CREATE POLICY "haul_bookings_select" ON public.haul_bookings FOR SELECT USING (true);
CREATE POLICY "haul_bookings_insert" ON public.haul_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "haul_bookings_update" ON public.haul_bookings FOR UPDATE USING (true);

-- 7. Trip Waypoints
CREATE POLICY "trip_waypoints_select" ON public.trip_waypoints FOR SELECT USING (true);
CREATE POLICY "trip_waypoints_insert" ON public.trip_waypoints FOR INSERT WITH CHECK (true);

-- 8. Mandi Live Rates
CREATE POLICY "mandi_rates_select" ON public.mandi_live_rates FOR SELECT USING (true);
CREATE POLICY "mandi_rates_insert" ON public.mandi_live_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "mandi_rates_update" ON public.mandi_live_rates FOR UPDATE USING (true);

-- 9. Disease Scans
CREATE POLICY "disease_scans_select" ON public.disease_scans FOR SELECT USING (true);
CREATE POLICY "disease_scans_insert" ON public.disease_scans FOR INSERT WITH CHECK (true);

-- 10. Peer Messages
CREATE POLICY "peer_messages_select" ON public.peer_messages FOR SELECT USING (true);
CREATE POLICY "peer_messages_insert" ON public.peer_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "peer_messages_update" ON public.peer_messages FOR UPDATE USING (true);

-- ══════════════════════════════════════════════════════════════════════════
-- 12. ENABLE SUPABASE REALTIME SUBSCRIPTIONS
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
