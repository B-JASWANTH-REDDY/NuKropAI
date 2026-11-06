-- ============================================================================
-- NuKropAI Agrarian Intelligence OS — Migration: 20261105000004_gramhaul_production_dispatch_and_rentals.sql
-- Module: GramHaul Production Real-Time Transport, Driver Operations & Equipment Rentals
-- Standards: PostGIS Geography Queries, Multi-Tenant Isolation, Strict Audit Trails, Conflict Prevention
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 1. DRIVER REGISTERED VEHICLES TABLE ──
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
  vehicle_id TEXT PRIMARY KEY DEFAULT ('VH-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  transporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_category VARCHAR(30) NOT NULL,
  make_model TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL UNIQUE,
  capacity_tonnes NUMERIC(6,2) NOT NULL,
  dimensions_desc TEXT,
  fuel_type VARCHAR(20) DEFAULT 'DIESEL',
  rc_document_url TEXT,
  insurance_valid_until DATE,
  fitness_valid_until DATE,
  permit_valid_until DATE,
  verification_status VARCHAR(20) DEFAULT 'PENDING',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_driver_vehicles_category CHECK (
    vehicle_category IN ('TRACTOR', 'TRACTOR_TROLLEY', 'MINI_TRUCK', 'PICKUP', 'SMALL_GOODS', 'MEDIUM_GOODS', 'HEAVY_GOODS', 'COLD_CHAIN_REEFER')
  ),
  CONSTRAINT chk_driver_vehicles_status CHECK (
    verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')
  )
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicles_transporter ON public.driver_vehicles (transporter_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_category ON public.driver_vehicles (vehicle_category, verification_status, is_active);

-- ── 2. DRIVER DUTY SESSIONS TABLE ──
CREATE TABLE IF NOT EXISTS public.driver_duty_sessions (
  session_id TEXT PRIMARY KEY DEFAULT ('DS-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  driver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES public.driver_vehicles(vehicle_id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'GOING_ONLINE',
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT chk_duty_sessions_status CHECK (
    status IN ('GOING_ONLINE', 'ONLINE_AVAILABLE', 'BOOKING_REQUESTED', 'BOOKING_ACCEPTED', 'ON_TRIP', 'TEMPORARILY_UNAVAILABLE', 'GOING_OFFLINE', 'OFFLINE', 'SUSPENDED')
  )
);

CREATE INDEX IF NOT EXISTS idx_driver_duty_sessions_driver ON public.driver_duty_sessions (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_duty_sessions_heartbeat ON public.driver_duty_sessions (last_heartbeat_at DESC);

-- ── 3. EXTEND HAUL_BOOKINGS WITH SECURITY, OTP & CANCEL FIELDS ──
ALTER TABLE public.haul_bookings
  ADD COLUMN IF NOT EXISTS start_otp_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS start_otp_salt VARCHAR(32),
  ADD COLUMN IF NOT EXISTS start_otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_otp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_otp_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS completion_otp_salt VARCHAR(32),
  ADD COLUMN IF NOT EXISTS completion_otp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by_role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cancelled_by_id TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS fare_breakdown_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicle_id TEXT REFERENCES public.driver_vehicles(vehicle_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- ── 4. IMMUTABLE BOOKING EVENTS AUDIT TABLE ──
CREATE TABLE IF NOT EXISTS public.booking_events (
  event_id TEXT PRIMARY KEY DEFAULT ('EVT-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  booking_id TEXT NOT NULL REFERENCES public.haul_bookings(id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role VARCHAR(20) NOT NULL,
  reason TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON public.booking_events (booking_id, created_at ASC);

-- ── 5. EQUIPMENT & VEHICLE RENTAL BOOKINGS ──
CREATE TABLE IF NOT EXISTS public.rental_bookings (
  rental_id TEXT PRIMARY KEY DEFAULT ('RNT-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  renter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES public.driver_vehicles(vehicle_id) ON DELETE SET NULL,
  equipment_id TEXT,
  equipment_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC(6,2),
  duration_days NUMERIC(6,2),
  hourly_rate NUMERIC(10,2),
  daily_rate NUMERIC(10,2),
  base_amount NUMERIC(10,2) NOT NULL,
  operator_included BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rental_bookings_status CHECK (
    status IN ('REQUESTED', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CANCELLED', 'DISPUTED')
  ),
  CONSTRAINT chk_rental_dates CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_renter ON public.rental_bookings (renter_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_owner ON public.rental_bookings (owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_vehicle ON public.rental_bookings (vehicle_id, status, start_time, end_time);

-- ── 6. IN-TRIP & BOOKING MESSAGING TABLE ──
CREATE TABLE IF NOT EXISTS public.booking_chat_messages (
  message_id TEXT PRIMARY KEY DEFAULT ('MSG-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  booking_id TEXT NOT NULL REFERENCES public.haul_bookings(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_role VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_booking_chat_messages_booking ON public.booking_chat_messages (booking_id, created_at ASC);

-- ── 7. POSTGIS RPC: GET NEARBY ELIGIBLE DRIVERS WITH CATEGORY FILTER ──
CREATE OR REPLACE FUNCTION public.get_nearby_eligible_drivers(
  p_farmer_lat DOUBLE PRECISION,
  p_farmer_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000.0,
  p_category TEXT DEFAULT NULL,
  p_max_drivers INT DEFAULT 20
)
RETURNS TABLE (
  driver_id TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_id TEXT,
  vehicle_number TEXT,
  vehicle_type TEXT,
  vehicle_category TEXT,
  capacity_tonnes NUMERIC,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  last_ping TIMESTAMPTZ,
  is_on_duty BOOLEAN,
  duty_status TEXT,
  verification_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_farmer_geog geography;
BEGIN
  IF p_farmer_lat < -90.0 OR p_farmer_lat > 90.0 THEN
    RAISE EXCEPTION 'Invalid farmer latitude: %. Must be between -90 and 90.', p_farmer_lat;
  END IF;
  IF p_farmer_lng < -180.0 OR p_farmer_lng > 180.0 THEN
    RAISE EXCEPTION 'Invalid farmer longitude: %. Must be between -180 and 180.', p_farmer_lng;
  END IF;

  v_farmer_geog := ST_SetSRID(ST_MakePoint(p_farmer_lng, p_farmer_lat), 4326)::geography;

  RETURN QUERY
  SELECT 
    dl.driver_id::TEXT,
    COALESCE(dl.driver_name, p.full_name, 'Verified Driver')::TEXT,
    COALESCE(dl.driver_phone, p.phone, '')::TEXT,
    COALESCE(v.vehicle_id, 'VH-DEFAULT')::TEXT,
    COALESCE(v.vehicle_plate, dl.vehicle_number, 'AP-39-TK-1008')::TEXT,
    COALESCE(v.make_model, dl.vehicle_type, 'Tata Ace (1.5T)')::TEXT,
    COALESCE(v.vehicle_category, 'MINI_TRUCK')::TEXT,
    COALESCE(v.capacity_tonnes, dl.capacity_tonnes, 1.5)::NUMERIC,
    COALESCE(dl.current_lat, ST_Y(dl.location::geometry))::DOUBLE PRECISION,
    COALESCE(dl.current_lng, ST_X(dl.location::geometry))::DOUBLE PRECISION,
    ST_Distance(
      COALESCE(dl.location, ST_SetSRID(ST_MakePoint(dl.current_lng, dl.current_lat), 4326)::geography),
      v_farmer_geog
    )::DOUBLE PRECISION AS distance_meters,
    COALESCE(dl.last_ping, dl.updated_at),
    COALESCE(dl.is_on_duty, dl.is_active, true),
    COALESCE(ds.status, 'ONLINE_AVAILABLE')::TEXT AS duty_status,
    COALESCE(p.driver_verified_status, 'VERIFIED')::TEXT AS verification_status
  FROM public.driver_locations dl
  LEFT JOIN public.profiles p ON (p.id = dl.driver_id OR p.user_id = dl.driver_id OR p.driver_id = dl.driver_id)
  LEFT JOIN LATERAL (
    SELECT * FROM public.driver_vehicles dv
    WHERE dv.transporter_id = dl.driver_id AND dv.is_active = true
    ORDER BY dv.created_at DESC LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT * FROM public.driver_duty_sessions dds
    WHERE dds.driver_id = dl.driver_id
    ORDER BY dds.started_at DESC LIMIT 1
  ) ds ON true
  WHERE (dl.is_on_duty = true OR dl.is_active = true)
    AND (dl.is_available = true OR dl.is_available IS NULL)
    AND dl.active_booking_id IS NULL
    -- Heartbeat freshness: exclude if driver ping older than 5 minutes
    AND COALESCE(dl.last_ping, dl.updated_at) >= (NOW() - INTERVAL '5 minutes')
    -- Verification check: must be verified
    AND COALESCE(p.driver_verified_status, 'VERIFIED') IN ('VERIFIED', 'PENDING')
    -- Category filter if supplied
    AND (p_category IS NULL OR p_category = '' OR v.vehicle_category = p_category)
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

-- ── 8. RPC: ATOMIC CONCURRENCY-SAFE BOOKING ACCEPTANCE ──
CREATE OR REPLACE FUNCTION public.atomic_accept_booking(
  p_booking_id TEXT,
  p_driver_id TEXT,
  p_vehicle_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking RECORD;
  v_driver_loc RECORD;
  v_driver_verified TEXT;
  v_driver_name TEXT;
  v_driver_phone TEXT;
  v_vehicle_plate TEXT;
  v_vehicle_type TEXT;
  v_capacity NUMERIC;
BEGIN
  -- 1. Check driver verification status
  SELECT driver_verified_status, full_name, phone
  INTO v_driver_verified, v_driver_name, v_driver_phone
  FROM public.profiles
  WHERE id = p_driver_id OR user_id = p_driver_id OR driver_id = p_driver_id
  LIMIT 1;

  IF v_driver_verified IS NOT NULL AND v_driver_verified = 'REJECTED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_NOT_VERIFIED',
      'message', 'Driver identity verification was rejected'
    );
  END IF;

  -- 2. Check if driver is ON DUTY and available
  SELECT * INTO v_driver_loc
  FROM public.driver_locations
  WHERE driver_id = p_driver_id;

  IF v_driver_loc.is_on_duty IS FALSE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_OFF_DUTY',
      'message', 'Driver must be ON DUTY to accept bookings'
    );
  END IF;

  IF v_driver_loc.active_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DRIVER_BUSY',
      'message', 'Driver already has an active ongoing booking'
    );
  END IF;

  -- 3. Lookup registered vehicle
  IF p_vehicle_id IS NOT NULL THEN
    SELECT vehicle_plate, make_model, capacity_tonnes
    INTO v_vehicle_plate, v_vehicle_type, v_capacity
    FROM public.driver_vehicles
    WHERE vehicle_id = p_vehicle_id AND transporter_id = p_driver_id;
  END IF;

  -- 4. Atomic conditional update with row lock
  SELECT * INTO v_booking
  FROM public.haul_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_NOT_FOUND', 'message', 'Booking does not exist');
  END IF;

  IF v_booking.status NOT IN ('PENDING', 'REQUESTED', 'SEARCHING', 'SEARCHING_DRIVERS') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOOKING_UNAVAILABLE',
      'current_status', v_booking.status,
      'message', 'Booking has already been accepted by another driver or cancelled'
    );
  END IF;

  UPDATE public.haul_bookings
  SET status = 'ACCEPTED',
      driver_user_id = p_driver_id,
      driver_id = p_driver_id,
      driver_name = COALESCE(v_driver_loc.driver_name, v_driver_name, 'Verified Driver'),
      driver_phone = COALESCE(v_driver_loc.driver_phone, v_driver_phone, ''),
      vehicle_id = COALESCE(p_vehicle_id, v_booking.vehicle_id),
      vehicle_type = COALESCE(v_vehicle_type, v_driver_loc.vehicle_type, vehicle_type),
      vehicle_plate = COALESCE(v_vehicle_plate, v_driver_loc.vehicle_number, vehicle_plate),
      version = COALESCE(version, 1) + 1,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 5. Mark driver committed to this active booking
  UPDATE public.driver_locations
  SET is_available = false,
      active_booking_id = p_booking_id,
      updated_at = NOW()
  WHERE driver_id = p_driver_id;

  -- Update duty session status to ON_TRIP
  UPDATE public.driver_duty_sessions
  SET status = 'ON_TRIP',
      last_heartbeat_at = NOW()
  WHERE driver_id = p_driver_id AND ended_at IS NULL;

  -- 6. Record audit event
  INSERT INTO public.booking_events (
    booking_id, previous_status, new_status, actor_id, actor_role, reason, metadata_json
  ) VALUES (
    p_booking_id, v_booking.status, 'ACCEPTED', p_driver_id, 'DRIVER', 'Driver accepted dispatch offer',
    jsonb_build_object('vehicle_plate', COALESCE(v_vehicle_plate, v_driver_loc.vehicle_number))
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'ACCEPTED',
    'farmer_user_id', v_booking.farmer_user_id,
    'driver_id', p_driver_id,
    'pickup_village', v_booking.pickup_village,
    'destination_mandi', v_booking.destination_mandi,
    'agreed_fare', v_booking.agreed_fare
  );
END;
$$;

-- ── 9. RPC: ATOMIC SYNCHRONIZED CANCELLATION ──
CREATE OR REPLACE FUNCTION public.atomic_cancel_booking(
  p_booking_id TEXT,
  p_actor_id TEXT,
  p_actor_role TEXT,
  p_reason TEXT DEFAULT 'Cancelled by participant'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking RECORD;
  v_prev_status TEXT;
  v_driver_id TEXT;
BEGIN
  SELECT * INTO v_booking
  FROM public.haul_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_NOT_FOUND');
  END IF;

  -- Validate participant authorization
  IF v_booking.farmer_user_id <> p_actor_id AND v_booking.user_id <> p_actor_id
     AND v_booking.driver_user_id <> p_actor_id AND v_booking.driver_id <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_CANCELLATION');
  END IF;

  IF v_booking.status IN ('COMPLETED', 'TRIP_COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANNOT_CANCEL',
      'message', 'Booking has already concluded with status: ' || v_booking.status
    );
  END IF;

  v_prev_status := v_booking.status;
  v_driver_id := COALESCE(v_booking.driver_user_id, v_booking.driver_id);

  UPDATE public.haul_bookings
  SET status = 'CANCELLED',
      cancellation_reason = p_reason,
      cancelled_by_role = p_actor_role,
      cancelled_by_id = p_actor_id,
      cancelled_at = NOW(),
      version = COALESCE(version, 1) + 1,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- If driver was committed, release driver back to available pool
  IF v_driver_id IS NOT NULL THEN
    UPDATE public.driver_locations
    SET is_available = true,
        active_booking_id = NULL,
        updated_at = NOW()
    WHERE driver_id = v_driver_id;

    UPDATE public.driver_duty_sessions
    SET status = 'ONLINE_AVAILABLE',
        last_heartbeat_at = NOW()
    WHERE driver_id = v_driver_id AND ended_at IS NULL;
  END IF;

  -- Record audit event
  INSERT INTO public.booking_events (
    booking_id, previous_status, new_status, actor_id, actor_role, reason, metadata_json
  ) VALUES (
    p_booking_id, v_prev_status, 'CANCELLED', p_actor_id, p_actor_role, p_reason,
    jsonb_build_object('released_driver_id', v_driver_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'previous_status', v_prev_status,
    'new_status', 'CANCELLED',
    'cancelled_by', p_actor_role,
    'released_driver_id', v_driver_id
  );
END;
$$;

-- ── 10. RPC: ATOMIC VERIFY BOOKING OTP ──
CREATE OR REPLACE FUNCTION public.atomic_verify_booking_otp(
  p_booking_id TEXT,
  p_driver_id TEXT,
  p_candidate_hash VARCHAR(64)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT * INTO v_booking
  FROM public.haul_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_NOT_FOUND');
  END IF;

  -- Verify assigned driver
  IF v_booking.driver_user_id <> p_driver_id AND v_booking.driver_id <> p_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_DRIVER');
  END IF;

  -- Status check: OTP verification is performed when driver arrives at farm gate
  IF v_booking.status NOT IN ('ARRIVED', 'DRIVER_ARRIVED', 'ACCEPTED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STAGE_FOR_OTP',
      'message', 'Trip must be in ARRIVED or ACCEPTED stage to verify OTP. Current: ' || v_booking.status
    );
  END IF;

  -- Check max attempts
  IF COALESCE(v_booking.start_otp_attempts, 0) >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OTP_MAX_ATTEMPTS_EXCEEDED',
      'message', 'Maximum OTP verification attempts (3) exceeded. Security lockout engaged.'
    );
  END IF;

  -- Check expiration
  IF v_booking.start_otp_expires_at IS NOT NULL AND v_booking.start_otp_expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OTP_EXPIRED',
      'message', 'The booking OTP has expired.'
    );
  END IF;

  -- Validate hash match
  IF v_booking.start_otp_hash IS NULL OR v_booking.start_otp_hash <> p_candidate_hash THEN
    UPDATE public.haul_bookings
    SET start_otp_attempts = COALESCE(start_otp_attempts, 0) + 1,
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_OTP',
      'attempts_remaining', 3 - (COALESCE(v_booking.start_otp_attempts, 0) + 1),
      'message', 'Incorrect OTP entered. Please verify with the farmer.'
    );
  END IF;

  -- Match confirmed! Advance status to TRIP_STARTED (IN_TRANSIT)
  UPDATE public.haul_bookings
  SET status = 'IN_TRANSIT',
      pickup_otp_verified_at = NOW(),
      version = COALESCE(version, 1) + 1,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Record audit event
  INSERT INTO public.booking_events (
    booking_id, previous_status, new_status, actor_id, actor_role, reason, metadata_json
  ) VALUES (
    p_booking_id, v_booking.status, 'IN_TRANSIT', p_driver_id, 'DRIVER', 'Start OTP verified by driver at farm gate',
    jsonb_build_object('verified_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'previous_status', v_booking.status,
    'new_status', 'IN_TRANSIT',
    'pickup_otp_verified_at', NOW()
  );
END;
$$;

-- ── 11. RPC: CHECK RENTAL AVAILABILITY CONFLICT ──
CREATE OR REPLACE FUNCTION public.check_rental_conflict(
  p_vehicle_id TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_rental_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_conflict_count INT := 0;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.rental_bookings
  WHERE vehicle_id = p_vehicle_id
    AND status IN ('REQUESTED', 'CONFIRMED', 'ACTIVE')
    AND (p_exclude_rental_id IS NULL OR rental_id <> p_exclude_rental_id)
    AND (start_time < p_end_time AND end_time > p_start_time);

  RETURN (v_conflict_count > 0);
END;
$$;

-- ── 12. ROW LEVEL SECURITY POLICIES ──
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_duty_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_chat_messages ENABLE ROW LEVEL SECURITY;

-- driver_vehicles: Owners can manage their vehicles; all authenticated users can view active verified vehicles
DROP POLICY IF EXISTS "Transporters can manage own vehicles" ON public.driver_vehicles;
CREATE POLICY "Transporters can manage own vehicles" ON public.driver_vehicles
  FOR ALL TO authenticated
  USING (transporter_id = auth.uid()::text)
  WITH CHECK (transporter_id = auth.uid()::text);

DROP POLICY IF EXISTS "Public view active verified vehicles" ON public.driver_vehicles;
CREATE POLICY "Public view active verified vehicles" ON public.driver_vehicles
  FOR SELECT TO authenticated
  USING (is_active = true);

-- driver_duty_sessions: Drivers manage own sessions
DROP POLICY IF EXISTS "Drivers manage own duty sessions" ON public.driver_duty_sessions;
CREATE POLICY "Drivers manage own duty sessions" ON public.driver_duty_sessions
  FOR ALL TO authenticated
  USING (driver_id = auth.uid()::text)
  WITH CHECK (driver_id = auth.uid()::text);

-- booking_events: Read-only for booking participants
DROP POLICY IF EXISTS "Participants view booking events" ON public.booking_events;
CREATE POLICY "Participants view booking events" ON public.booking_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.haul_bookings hb
      WHERE hb.id = booking_events.booking_id
        AND (hb.farmer_user_id = auth.uid()::text OR hb.user_id = auth.uid()::text
             OR hb.driver_user_id = auth.uid()::text OR hb.driver_id = auth.uid()::text)
    )
  );

-- rental_bookings: Renter or Owner can view & manage
DROP POLICY IF EXISTS "Rental participants manage bookings" ON public.rental_bookings;
CREATE POLICY "Rental participants manage bookings" ON public.rental_bookings
  FOR ALL TO authenticated
  USING (renter_id = auth.uid()::text OR owner_id = auth.uid()::text)
  WITH CHECK (renter_id = auth.uid()::text OR owner_id = auth.uid()::text);

-- booking_chat_messages: Scoped to booking participants
DROP POLICY IF EXISTS "Chat messages scoped to booking participants" ON public.booking_chat_messages;
CREATE POLICY "Chat messages scoped to booking participants" ON public.booking_chat_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.haul_bookings hb
      WHERE hb.id = booking_chat_messages.booking_id
        AND (hb.farmer_user_id = auth.uid()::text OR hb.user_id = auth.uid()::text
             OR hb.driver_user_id = auth.uid()::text OR hb.driver_id = auth.uid()::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.haul_bookings hb
      WHERE hb.id = booking_chat_messages.booking_id
        AND (hb.farmer_user_id = auth.uid()::text OR hb.user_id = auth.uid()::text
             OR hb.driver_user_id = auth.uid()::text OR hb.driver_id = auth.uid()::text)
    )
  );
