-- ============================================================================
-- MIGRATION: 20261004020000_postgis_driver_tracking_osrm.sql
-- DESCRIPTION: PostGIS Spatial Queries & Driver Location Tracking for Rapido-Style LBS
-- ============================================================================

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create or alter 'driver_locations' table using geography(POINT, 4326)
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id VARCHAR(100) UNIQUE NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  heading NUMERIC(5,2) DEFAULT 0.0 CHECK (heading >= 0 AND heading <= 360),
  speed_kmh NUMERIC(5,2) DEFAULT 0.0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist if table was previously created
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS heading NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create high-performance GIST spatial index on geography column
CREATE INDEX IF NOT EXISTS idx_driver_locations_geog 
ON public.driver_locations USING GIST (location);

-- Index on updated_at and active status for query pruning
CREATE INDEX IF NOT EXISTS idx_driver_locations_active_ping 
ON public.driver_locations (is_active, updated_at DESC);

-- 4. Secure RPC: get_nearest_drivers
-- Strictly accepts [lon, lat] format conforming to PostGIS & GeoJSON standards
CREATE OR REPLACE FUNCTION public.get_nearest_drivers(
  user_lon DOUBLE PRECISION,
  user_lat DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 5000.0,
  max_drivers INT DEFAULT 15
)
RETURNS TABLE (
  driver_id VARCHAR(100),
  lon DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  heading NUMERIC(5,2),
  speed_kmh NUMERIC(5,2),
  distance_meters DOUBLE PRECISION,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_location geography;
BEGIN
  -- Strict validation of geographic inputs [-180..180, -90..90]
  IF user_lon < -180.0 OR user_lon > 180.0 THEN
    RAISE EXCEPTION 'Invalid longitude: %. Must be between -180 and 180 degrees.', user_lon;
  END IF;

  IF user_lat < -90.0 OR user_lat > 90.0 THEN
    RAISE EXCEPTION 'Invalid latitude: %. Must be between -90 and 90 degrees.', user_lat;
  END IF;

  -- Create reference point using standard [lon, lat] geometry cast to geography
  v_user_location := ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography;

  RETURN QUERY
  SELECT 
    dl.driver_id,
    ST_X(dl.location::geometry) AS lon,
    ST_Y(dl.location::geometry) AS lat,
    dl.heading,
    dl.speed_kmh,
    ST_Distance(dl.location, v_user_location) AS distance_meters,
    dl.updated_at
  FROM public.driver_locations dl
  WHERE dl.is_active = true
    AND dl.updated_at >= (NOW() - INTERVAL '5 minutes')
    AND ST_DWithin(dl.location, v_user_location, radius_meters)
  ORDER BY dl.location <-> v_user_location
  LIMIT max_drivers;
END;
$$;

-- 5. Helper RPC: upsert_driver_location
-- Safely upserts driver coordinates in standard [lon, lat] order
CREATE OR REPLACE FUNCTION public.upsert_driver_location(
  p_driver_id VARCHAR(100),
  p_lon DOUBLE PRECISION,
  p_lat DOUBLE PRECISION,
  p_heading NUMERIC(5,2) DEFAULT 0.0,
  p_speed_kmh NUMERIC(5,2) DEFAULT 0.0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.driver_locations (
    driver_id,
    location,
    heading,
    speed_kmh,
    is_active,
    updated_at
  )
  VALUES (
    p_driver_id,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
    COALESCE(p_heading, 0.0),
    COALESCE(p_speed_kmh, 0.0),
    true,
    NOW()
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    location = EXCLUDED.location,
    heading = EXCLUDED.heading,
    speed_kmh = EXCLUDED.speed_kmh,
    is_active = true,
    updated_at = NOW();
END;
$$;

-- 6. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone can query active driver locations
CREATE POLICY "Allow public read on active driver locations"
ON public.driver_locations
FOR SELECT
USING (is_active = true);

-- Write policy: Allow authenticated and service role upserts
CREATE POLICY "Allow authenticated upsert on driver locations"
ON public.driver_locations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Grant execution on RPCs to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_nearest_drivers(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_driver_location(VARCHAR, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 8. Enable Supabase Realtime replication on driver_locations
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

