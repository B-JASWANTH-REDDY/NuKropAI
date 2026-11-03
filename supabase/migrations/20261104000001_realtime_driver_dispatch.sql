-- ============================================================================
-- NuKropAI Agrarian Intelligence OS — Migration: 20261104000001_realtime_driver_dispatch.sql
-- Module: Real-Time Driver Marketplace, Live Dispatch & GPS Tracking (Phase 7)
-- Standards: PostGIS Geography Queries, Atomic Concurrency, Strict Multi-Tenant RLS
-- ============================================================================

-- ── 1. POSTGIS SPATIAL EXTENSION ──
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. SCHEMA EXTENSIONS FOR DRIVER & VEHICLE VERIFICATION ──

-- Driver verification lifecycle: PENDING, VERIFIED, REJECTED, SUSPENDED, EXPIRED
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS driver_verified_status VARCHAR(20) DEFAULT 'PENDING';

DO $$ BEGIN
  ALTER TABLE public.profiles 
    ADD CONSTRAINT chk_profiles_driver_verified_status 
    CHECK (driver_verified_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Vehicle verification lifecycle
ALTER TABLE public.truck_listings 
  ADD COLUMN IF NOT EXISTS vehicle_verified_status VARCHAR(20) DEFAULT 'PENDING';

DO $$ BEGIN
  ALTER TABLE public.truck_listings 
    ADD CONSTRAINT chk_truck_listings_vehicle_verified_status 
    CHECK (vehicle_verified_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. DRIVER PRESENCE & SPATIAL COLUMNS ON DRIVER_LOCATIONS ──
ALTER TABLE public.driver_locations 
  ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN DEFAULT false;

ALTER TABLE public.driver_locations 
  ADD COLUMN IF NOT EXISTS on_duty_since TIMESTAMPTZ;

ALTER TABLE public.driver_locations 
  ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION DEFAULT 5.0;

ALTER TABLE public.driver_locations 
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Tata Ace (1.5T)';

ALTER TABLE public.driver_locations 
  ADD COLUMN IF NOT EXISTS capacity_tonnes NUMERIC(6,2) DEFAULT 1.5;

ALTER TABLE public.driver_locations 
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Spatial sync trigger to keep location geography updated automatically
CREATE OR REPLACE FUNCTION public.sync_driver_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_driver_location_geom ON public.driver_locations;
CREATE TRIGGER trg_sync_driver_location_geom
BEFORE INSERT OR UPDATE OF current_lat, current_lng ON public.driver_locations
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_location_geom();

-- Create GIST spatial index for ultra-fast PostGIS distance lookups
CREATE INDEX IF NOT EXISTS idx_driver_locations_spatial 
  ON public.driver_locations USING GIST (location);

-- Compound index for query pruning on duty, availability, and heartbeat freshness
CREATE INDEX IF NOT EXISTS idx_driver_locations_duty_freshness 
  ON public.driver_locations (is_on_duty, is_available, last_ping DESC);

-- ── 4. RPC: GET_NEARBY_DRIVERS (SERVER-ENFORCED 10 KM RADIUS) ──
CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
  p_farmer_lat DOUBLE PRECISION,
  p_farmer_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000.0,
  p_max_drivers INT DEFAULT 20
)
RETURNS TABLE (
  driver_id TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_number TEXT,
  vehicle_type TEXT,
  capacity_tonnes NUMERIC,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  last_ping TIMESTAMPTZ,
  is_on_duty BOOLEAN,
  verification_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_farmer_geog geography;
BEGIN
  -- Strict validation of farmer coordinate inputs
  IF p_farmer_lat < -90.0 OR p_farmer_lat > 90.0 THEN
    RAISE EXCEPTION 'Invalid farmer latitude: %. Must be between -90 and 90.', p_farmer_lat;
  END IF;
  IF p_farmer_lng < -180.0 OR p_farmer_lng > 180.0 THEN
    RAISE EXCEPTION 'Invalid farmer longitude: %. Must be between -180 and 180.', p_farmer_lng;
  END IF;

  v_farmer_geog := ST_SetSRID(ST_MakePoint(p_farmer_lng, p_farmer_lat), 4326)::geography;

  RETURN QUERY
  SELECT 
    dl.driver_id,
    dl.driver_name,
    dl.driver_phone,
    dl.vehicle_number,
    dl.vehicle_type,
    COALESCE(dl.capacity_tonnes, 1.5)::NUMERIC,
    dl.current_lat,
    dl.current_lng,
    ST_Distance(
      COALESCE(dl.location, ST_SetSRID(ST_MakePoint(dl.current_lng, dl.current_lat), 4326)::geography),
      v_farmer_geog
    ) AS distance_meters,
    dl.last_ping,
    dl.is_on_duty,
    COALESCE(p.driver_verified_status, 'PENDING')::TEXT AS verification_status
  FROM public.driver_locations dl
  LEFT JOIN public.profiles p ON (p.id = dl.driver_id OR p.user_id = dl.driver_id OR p.driver_id = dl.driver_id)
  WHERE dl.is_on_duty = true
    AND dl.is_available = true
    AND dl.active_booking_id IS NULL
    -- Freshness threshold: excluded if driver ping older than 5 minutes
    AND dl.last_ping >= (NOW() - INTERVAL '5 minutes')
    -- Verification requirement: only genuine VERIFIED drivers
    AND COALESCE(p.driver_verified_status, 'PENDING') = 'VERIFIED'
    -- Server-enforced radius check
    AND ST_DWithin(
      COALESCE(dl.location, ST_SetSRID(ST_MakePoint(dl.current_lng, dl.current_lat), 4326)::geography),
      v_farmer_geog,
      p_radius_meters
    )
  ORDER BY distance_meters ASC
  LIMIT p_max_drivers;
END;
$$;

-- ── 5. RPC: SET_DRIVER_DUTY_STATUS (AUTHENTICATED ON/OFF DUTY TOGGLE) ──
CREATE OR REPLACE FUNCTION public.set_driver_duty_status(
  p_driver_id TEXT,
  p_is_on_duty BOOLEAN,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT 5.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_driver_verified TEXT;
  v_vehicle_verified TEXT;
  v_driver_name TEXT;
  v_driver_phone TEXT;
  v_vehicle_plate TEXT;
  v_vehicle_type TEXT;
  v_capacity NUMERIC;
  v_has_active_booking BOOLEAN;
BEGIN
  -- 1. Check profile verification status
  SELECT driver_verified_status, full_name, phone
  INTO v_driver_verified, v_driver_name, v_driver_phone
  FROM public.profiles
  WHERE id = p_driver_id OR user_id = p_driver_id OR driver_id = p_driver_id
  LIMIT 1;

  IF v_driver_verified IS NULL OR v_driver_verified <> 'VERIFIED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_NOT_VERIFIED',
      'message', 'Driver must have VERIFIED status to go ON DUTY. Current status: ' || COALESCE(v_driver_verified, 'UNREGISTERED')
    );
  END IF;

  -- 2. Going ON DUTY requires genuine valid GPS coordinates
  IF p_is_on_duty = true THEN
    IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_GPS_COORDINATES',
        'message', 'Valid GPS coordinates are required to go ON DUTY'
      );
    END IF;

    -- Lookup verified vehicle
    SELECT vehicle_plate, truck_type, capacity_tonnes, vehicle_verified_status
    INTO v_vehicle_plate, v_vehicle_type, v_capacity, v_vehicle_verified
    FROM public.truck_listings
    WHERE transporter_id = p_driver_id OR user_id = p_driver_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_vehicle_verified IS NOT NULL AND v_vehicle_verified = 'REJECTED' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'VEHICLE_REJECTED',
        'message', 'Registered vehicle has been rejected by admin review'
      );
    END IF;

    -- Upsert driver presence in driver_locations
    INSERT INTO public.driver_locations (
      driver_id,
      driver_name,
      driver_phone,
      vehicle_number,
      vehicle_type,
      capacity_tonnes,
      current_lat,
      current_lng,
      location,
      accuracy,
      is_available,
      is_on_duty,
      on_duty_since,
      last_ping,
      updated_at
    )
    VALUES (
      p_driver_id,
      COALESCE(v_driver_name, 'Verified Driver'),
      COALESCE(v_driver_phone, '0000000000'),
      COALESCE(v_vehicle_plate, 'AP-39-TK-0001'),
      COALESCE(v_vehicle_type, 'Tata Ace (1.5T)'),
      COALESCE(v_capacity, 1.5),
      p_lat,
      p_lng,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_accuracy,
      true,
      true,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      current_lat = EXCLUDED.current_lat,
      current_lng = EXCLUDED.current_lng,
      location = EXCLUDED.location,
      accuracy = EXCLUDED.accuracy,
      is_available = true,
      is_on_duty = true,
      on_duty_since = COALESCE(driver_locations.on_duty_since, NOW()),
      last_ping = NOW(),
      updated_at = NOW();

    RETURN jsonb_build_object(
      'success', true,
      'is_on_duty', true,
      'message', 'Driver is now ON DUTY'
    );
  ELSE
    -- Going OFF DUTY: preserve active booking if trip is ongoing
    SELECT (active_booking_id IS NOT NULL) INTO v_has_active_booking
    FROM public.driver_locations
    WHERE driver_id = p_driver_id;

    UPDATE public.driver_locations
    SET is_on_duty = false,
        is_available = false,
        updated_at = NOW()
    WHERE driver_id = p_driver_id;

    RETURN jsonb_build_object(
      'success', true,
      'is_on_duty', false,
      'active_trip_preserved', COALESCE(v_has_active_booking, false),
      'message', 'Driver is now OFF DUTY'
    );
  END IF;
END;
$$;

-- ── 6. RPC: ACCEPT_HAUL_BOOKING (ATOMIC CONCURRENCY-SAFE ACCEPTANCE) ──
CREATE OR REPLACE FUNCTION public.accept_haul_booking(
  p_booking_id TEXT,
  p_driver_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking RECORD;
  v_driver RECORD;
  v_driver_verified TEXT;
BEGIN
  -- 1. Check driver verification status
  SELECT driver_verified_status, full_name, phone
  INTO v_driver_verified, v_driver.full_name, v_driver.phone
  FROM public.profiles
  WHERE id = p_driver_id OR user_id = p_driver_id OR driver_id = p_driver_id
  LIMIT 1;

  IF v_driver_verified IS NULL OR v_driver_verified <> 'VERIFIED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_NOT_VERIFIED',
      'message', 'Only VERIFIED drivers can accept haul bookings'
    );
  END IF;

  -- 2. Check if driver is ON DUTY and available
  SELECT * INTO v_driver
  FROM public.driver_locations
  WHERE driver_id = p_driver_id;

  IF v_driver.is_on_duty IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_OFF_DUTY',
      'message', 'Driver must be ON DUTY to accept bookings'
    );
  END IF;

  IF v_driver.active_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_BUSY',
      'message', 'Driver already has an active ongoing booking'
    );
  END IF;

  -- 3. Atomic conditional update: only 1 driver can win race condition
  UPDATE public.haul_bookings
  SET status = 'ACCEPTED',
      driver_user_id = p_driver_id,
      driver_id = p_driver_id,
      driver_name = COALESCE(v_driver.driver_name, v_driver.full_name, 'Verified Driver'),
      driver_phone = COALESCE(v_driver.driver_phone, v_driver.phone, ''),
      vehicle_type = COALESCE(v_driver.vehicle_type, vehicle_type),
      vehicle_plate = COALESCE(v_driver.vehicle_number, vehicle_plate),
      updated_at = NOW()
  WHERE id = p_booking_id
    AND status IN ('PENDING', 'REQUESTED', 'SEARCHING')
  RETURNING * INTO v_booking;

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOOKING_UNAVAILABLE',
      'message', 'Booking has already been accepted by another driver or cancelled'
    );
  END IF;

  -- 4. Mark driver as committed to this active booking
  UPDATE public.driver_locations
  SET is_available = false,
      active_booking_id = p_booking_id,
      updated_at = NOW()
  WHERE driver_id = p_driver_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'status', 'ACCEPTED',
    'farmer_user_id', v_booking.farmer_user_id,
    'driver_id', p_driver_id,
    'pickup_village', v_booking.pickup_village,
    'destination_mandi', v_booking.destination_mandi,
    'agreed_fare', v_booking.agreed_fare
  );
END;
$$;

-- ── 7. RPC: UPDATE_HAUL_TRIP_STATUS (LIFECYCLE PROGRESSION & AUDIT) ──
CREATE OR REPLACE FUNCTION public.update_haul_trip_status(
  p_booking_id TEXT,
  p_driver_id TEXT,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking RECORD;
  v_valid_transition BOOLEAN := false;
BEGIN
  SELECT * INTO v_booking
  FROM public.haul_bookings
  WHERE id = p_booking_id;

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_NOT_FOUND');
  END IF;

  -- Verify driver ownership
  IF v_booking.driver_user_id <> p_driver_id AND v_booking.driver_id <> p_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_DRIVER');
  END IF;

  -- Validate lifecycle transitions:
  -- ACCEPTED -> ARRIVED (or DRIVER_ARRIVED)
  -- ARRIVED -> IN_TRANSIT (or TRIP_STARTED)
  -- IN_TRANSIT -> COMPLETED (or TRIP_COMPLETED)
  -- Any -> CANCELLED
  IF p_new_status = 'CANCELLED' THEN
    v_valid_transition := true;
  ELSIF v_booking.status = 'ACCEPTED' AND p_new_status IN ('ARRIVED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED') THEN
    v_valid_transition := true;
  ELSIF v_booking.status IN ('ARRIVED', 'DRIVER_ARRIVED') AND p_new_status IN ('IN_TRANSIT', 'TRIP_STARTED') THEN
    v_valid_transition := true;
  ELSIF v_booking.status IN ('IN_TRANSIT', 'TRIP_STARTED') AND p_new_status IN ('COMPLETED', 'TRIP_COMPLETED') THEN
    v_valid_transition := true;
  END IF;

  IF NOT v_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS_TRANSITION',
      'current_status', v_booking.status,
      'target_status', p_new_status
    );
  END IF;

  -- Apply status transition
  UPDATE public.haul_bookings
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- When trip finishes or cancels, release driver back to available pool
  IF p_new_status IN ('COMPLETED', 'TRIP_COMPLETED', 'CANCELLED') THEN
    UPDATE public.driver_locations
    SET is_available = true,
        active_booking_id = NULL,
        updated_at = NOW()
    WHERE driver_id = p_driver_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'previous_status', v_booking.status,
    'new_status', p_new_status
  );
END;
$$;

-- ── 8. RPC: RECORD_DRIVER_GPS_PING (VALIDATION & BREADCRUMB TELEMETRY) ──
CREATE OR REPLACE FUNCTION public.record_driver_gps_ping(
  p_driver_id TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_speed DOUBLE PRECISION DEFAULT 0.0,
  p_heading DOUBLE PRECISION DEFAULT 0.0,
  p_accuracy DOUBLE PRECISION DEFAULT 5.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_loc RECORD;
  v_dist_meters DOUBLE PRECISION;
  v_time_diff_sec DOUBLE PRECISION;
  v_active_booking TEXT;
BEGIN
  -- 1. Validate coordinate boundaries
  IF p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_COORDINATES');
  END IF;

  -- 2. Reject unreliable GPS readings with accuracy worse than 50 meters
  IF p_accuracy > 50.0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'POOR_GPS_ACCURACY', 'accuracy', p_accuracy);
  END IF;

  -- 3. Check for impossible speed jumps / spoofing (>160 km/h)
  SELECT current_lat, current_lng, last_ping, active_booking_id
  INTO v_loc
  FROM public.driver_locations
  WHERE driver_id = p_driver_id;

  IF v_loc.current_lat IS NOT NULL THEN
    v_dist_meters := ST_Distance(
      ST_SetSRID(ST_MakePoint(v_loc.current_lng, v_loc.current_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    );
    v_time_diff_sec := EXTRACT(EPOCH FROM (NOW() - v_loc.last_ping));

    IF v_time_diff_sec > 1.0 AND (v_dist_meters / v_time_diff_sec) * 3.6 > 160.0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'IMPOSSIBLE_GPS_JUMP',
        'implied_speed_kmh', (v_dist_meters / v_time_diff_sec) * 3.6
      );
    END IF;
    v_active_booking := v_loc.active_booking_id;
  END IF;

  -- 4. Update current driver location
  UPDATE public.driver_locations
  SET current_lat = p_lat,
      current_lng = p_lng,
      location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      speed_kmh = p_speed,
      heading = p_heading,
      accuracy = p_accuracy,
      last_ping = NOW(),
      updated_at = NOW()
  WHERE driver_id = p_driver_id;

  -- 5. If driver has an active booking, persist breadcrumb in driver_telemetry
  IF v_active_booking IS NOT NULL THEN
    INSERT INTO public.driver_telemetry (
      driver_id,
      booking_id,
      latitude,
      longitude,
      speed,
      heading,
      accuracy,
      is_online,
      last_ping,
      updated_at
    )
    VALUES (
      p_driver_id,
      v_active_booking,
      p_lat,
      p_lng,
      p_speed,
      p_heading,
      p_accuracy,
      true,
      NOW(),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lat', p_lat,
    'lng', p_lng,
    'active_booking_id', v_active_booking
  );
END;
$$;

-- ── 9. ROW LEVEL SECURITY (RLS) FOR DISPATCH & TRACKING ──
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_telemetry ENABLE ROW LEVEL SECURITY;

-- Driver Locations RLS:
-- 1. Driver can read/write own location record
DROP POLICY IF EXISTS "driver_locations_driver_own_rw" ON public.driver_locations;
CREATE POLICY "driver_locations_driver_own_rw"
  ON public.driver_locations FOR ALL
  TO authenticated
  USING (driver_id = auth.uid()::text OR (SELECT user_id FROM public.profiles WHERE id = auth.uid()::text) = driver_id)
  WITH CHECK (driver_id = auth.uid()::text OR (SELECT user_id FROM public.profiles WHERE id = auth.uid()::text) = driver_id);

-- 2. Farmer can read assigned driver location for active ongoing bookings
DROP POLICY IF EXISTS "driver_locations_farmer_read_active_booking" ON public.driver_locations;
CREATE POLICY "driver_locations_farmer_read_active_booking"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.haul_bookings hb
      WHERE (hb.farmer_user_id = auth.uid()::text OR hb.user_id = auth.uid()::text)
        AND (hb.driver_user_id = driver_locations.driver_id OR hb.driver_id = driver_locations.driver_id)
        AND hb.status IN ('ACCEPTED', 'ARRIVED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_TRANSIT', 'TRIP_STARTED')
    )
  );

-- Driver Telemetry RLS:
-- 1. Driver can insert and read own telemetry
DROP POLICY IF EXISTS "driver_telemetry_driver_own_rw" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_driver_own_rw"
  ON public.driver_telemetry FOR ALL
  TO authenticated
  USING (driver_id = auth.uid()::text OR (SELECT user_id FROM public.profiles WHERE id = auth.uid()::text) = driver_id)
  WITH CHECK (driver_id = auth.uid()::text OR (SELECT user_id FROM public.profiles WHERE id = auth.uid()::text) = driver_id);

-- 2. Farmer can read telemetry breadcrumbs only for their active booking
DROP POLICY IF EXISTS "driver_telemetry_farmer_read_active_booking" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_farmer_read_active_booking"
  ON public.driver_telemetry FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.haul_bookings hb
      WHERE hb.id = driver_telemetry.booking_id
        AND (hb.farmer_user_id = auth.uid()::text OR hb.user_id = auth.uid()::text)
    )
  );

-- ── 10. GRANTS AND REALTIME PUBLICATION ──
GRANT EXECUTE ON FUNCTION public.get_nearby_drivers(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_driver_duty_status(TEXT, BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_haul_booking(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_haul_trip_status(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_driver_gps_ping(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_telemetry;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
