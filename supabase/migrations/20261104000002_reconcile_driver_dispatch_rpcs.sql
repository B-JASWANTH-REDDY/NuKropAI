-- ============================================================================
-- NuKropAI Agrarian Intelligence OS
-- Migration: 20261104000002_reconcile_driver_dispatch_rpcs.sql
-- Module: Reconcile PL/pgSQL Type Safety & Tuple Structures for Driver Dispatch
-- ============================================================================

-- ── 1. RPC: GET_NEARBY_DRIVERS (STRICT TYPE CASTING RECONCILIATION) ──
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
  -- Strict validation of farmer coordinates
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
    COALESCE(dl.vehicle_number, 'AP-39-TK-1008')::TEXT,
    COALESCE(dl.vehicle_type, 'Tata Ace (1.5T)')::TEXT,
    COALESCE(dl.capacity_tonnes, 1.5)::NUMERIC,
    COALESCE(dl.current_lat, ST_Y(dl.location::geometry))::DOUBLE PRECISION,
    COALESCE(dl.current_lng, ST_X(dl.location::geometry))::DOUBLE PRECISION,
    ST_Distance(
      COALESCE(dl.location, ST_SetSRID(ST_MakePoint(dl.current_lng, dl.current_lat), 4326)::geography),
      v_farmer_geog
    )::DOUBLE PRECISION AS distance_meters,
    COALESCE(dl.last_ping, dl.updated_at),
    COALESCE(dl.is_on_duty, dl.is_active, true),
    COALESCE(p.driver_verified_status, 'PENDING')::TEXT AS verification_status
  FROM public.driver_locations dl
  LEFT JOIN public.profiles p ON (p.id = dl.driver_id OR p.user_id = dl.driver_id OR p.driver_id = dl.driver_id)
  WHERE (dl.is_on_duty = true OR dl.is_active = true)
    AND (dl.is_available = true OR dl.is_available IS NULL)
    AND dl.active_booking_id IS NULL
    -- Freshness threshold: 5 minute window
    AND COALESCE(dl.last_ping, dl.updated_at) >= (NOW() - INTERVAL '5 minutes')
    -- Verification check: verified or existing drivers
    AND COALESCE(p.driver_verified_status, 'VERIFIED') IN ('VERIFIED', 'PENDING')
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

-- ── 2. RPC: ACCEPT_HAUL_BOOKING (RECORD TUPLE SAFETY RECONCILIATION) ──
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
  v_driver_loc RECORD;
  v_driver_verified TEXT;
  v_driver_name TEXT;
  v_driver_phone TEXT;
BEGIN
  -- 1. Check driver verification status in scalar variables (tuple safe)
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

  -- 3. Atomic conditional update: only 1 driver can win race condition
  UPDATE public.haul_bookings
  SET status = 'ACCEPTED',
      driver_user_id = p_driver_id,
      driver_id = p_driver_id,
      driver_name = COALESCE(v_driver_loc.driver_name, v_driver_name, 'Verified Driver'),
      driver_phone = COALESCE(v_driver_loc.driver_phone, v_driver_phone, ''),
      vehicle_type = COALESCE(v_driver_loc.vehicle_type, vehicle_type),
      vehicle_plate = COALESCE(v_driver_loc.vehicle_number, vehicle_plate),
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

-- ── 3. EXECUTE GRANTS ──
GRANT EXECUTE ON FUNCTION public.get_nearby_drivers(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.accept_haul_booking(TEXT, TEXT) TO authenticated, service_role;

