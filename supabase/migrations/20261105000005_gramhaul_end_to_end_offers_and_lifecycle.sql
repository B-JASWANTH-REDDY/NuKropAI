-- ============================================================================
-- NuKropAI Agrarian Intelligence OS — Migration: 20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql
-- Module: GramHaul End-to-End Real-Time Dispatch Offers, Driver Inbox & Complete Equipment Rental Lifecycle
-- Standards: Concurrency Safety, Zero Fake Mocks, Multi-Tenant Isolation, Strict Audit Trails
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 1. DRIVER BOOKING OFFERS TABLE (DURABLE DRIVER INBOX) ──
CREATE TABLE IF NOT EXISTS public.driver_booking_offers (
  offer_id TEXT PRIMARY KEY DEFAULT ('OFR-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  booking_id TEXT NOT NULL REFERENCES public.haul_bookings(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES public.driver_vehicles(vehicle_id) ON DELETE SET NULL,
  distance_km NUMERIC(6,2) NOT NULL DEFAULT 0.0,
  agreed_fare NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT chk_driver_offers_status CHECK (
    status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED')
  )
);

CREATE INDEX IF NOT EXISTS idx_driver_booking_offers_driver ON public.driver_booking_offers (driver_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_driver_booking_offers_booking ON public.driver_booking_offers (booking_id, status);

-- ── 2. RENTAL EQUIPMENT INVENTORY TABLE ──
CREATE TABLE IF NOT EXISTS public.rental_equipment_inventory (
  equipment_id TEXT PRIMARY KEY DEFAULT ('EQ-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0')),
  owner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES public.driver_vehicles(vehicle_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category VARCHAR(40) NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL,
  per_acre_rate NUMERIC(10,2),
  specs TEXT,
  location_district VARCHAR(60),
  location_village VARCHAR(100),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rental_equipment_rates CHECK (hourly_rate > 0 AND daily_rate > 0)
);

CREATE INDEX IF NOT EXISTS idx_rental_equipment_category ON public.rental_equipment_inventory (category, is_available);
CREATE INDEX IF NOT EXISTS idx_rental_equipment_owner ON public.rental_equipment_inventory (owner_id);

-- ── 3. EXTEND RENTAL BOOKINGS WITH EXTENSION AND BILLING FIELDS ──
ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS actual_returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(6,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(10,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS final_total_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extension_count INT DEFAULT 0;

-- ── 4. RPC: DISPATCH BOOKING OFFERS TO ELIGIBLE NEARBY DRIVERS ──
CREATE OR REPLACE FUNCTION public.dispatch_booking_offers(
  p_booking_id TEXT,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000.0,
  p_max_offers INT DEFAULT 3,
  p_offer_ttl_seconds INT DEFAULT 60
)
RETURNS TABLE (
  offer_id TEXT,
  driver_id TEXT,
  driver_name TEXT,
  distance_km NUMERIC,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking RECORD;
  v_cand RECORD;
  v_offer_id TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  -- Lookup booking
  SELECT * INTO v_booking
  FROM public.haul_bookings
  WHERE id = p_booking_id;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  v_expires := NOW() + (p_offer_ttl_seconds || ' seconds')::INTERVAL;

  FOR v_cand IN
    SELECT 
      d.driver_id,
      d.driver_name,
      d.vehicle_id,
      ROUND((d.distance_meters / 1000.0)::numeric, 2) AS dist_km
    FROM public.get_nearby_eligible_drivers(
      COALESCE(v_booking.pickup_lat, 17.3850),
      COALESCE(v_booking.pickup_lng, 78.4867),
      p_radius_meters,
      v_booking.vehicle_category,
      p_max_offers
    ) d
    WHERE NOT EXISTS (
      -- Don't send offer if driver already has an active offer for this booking
      SELECT 1 FROM public.driver_booking_offers o
      WHERE o.booking_id = p_booking_id AND o.driver_id = d.driver_id
        AND o.status IN ('PENDING', 'ACCEPTED')
    )
    -- Don't send offer if vehicle is currently committed to an active rental
    AND NOT EXISTS (
      SELECT 1 FROM public.rental_bookings r
      WHERE r.vehicle_id = d.vehicle_id
        AND r.status IN ('CONFIRMED', 'ACTIVE')
        AND NOW() BETWEEN r.start_time AND r.end_time
    )
    LIMIT p_max_offers
  LOOP
    v_offer_id := 'OFR-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0');

    INSERT INTO public.driver_booking_offers (
      offer_id, booking_id, driver_id, vehicle_id, distance_km, agreed_fare, status, expires_at, created_at
    ) VALUES (
      v_offer_id, p_booking_id, v_cand.driver_id, v_cand.vehicle_id, v_cand.dist_km, v_booking.agreed_fare, 'PENDING', v_expires, NOW()
    );

    offer_id := v_offer_id;
    driver_id := v_cand.driver_id;
    driver_name := v_cand.driver_name;
    distance_km := v_cand.dist_km;
    expires_at := v_expires;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 5. RPC: ATOMIC REJECT DRIVER OFFER ──
CREATE OR REPLACE FUNCTION public.atomic_reject_offer(
  p_offer_id TEXT,
  p_driver_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_offer RECORD;
BEGIN
  SELECT * INTO v_offer
  FROM public.driver_booking_offers
  WHERE offer_id = p_offer_id
  FOR UPDATE;

  IF v_offer.offer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OFFER_NOT_FOUND');
  END IF;

  IF v_offer.driver_id <> p_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_DRIVER');
  END IF;

  IF v_offer.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'OFFER_ALREADY_RESPONDED', 'status', v_offer.status);
  END IF;

  UPDATE public.driver_booking_offers
  SET status = 'REJECTED',
      responded_at = NOW()
  WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object(
    'success', true,
    'offer_id', p_offer_id,
    'booking_id', v_offer.booking_id,
    'status', 'REJECTED'
  );
END;
$$;

-- ── 6. UPDATE ATOMIC ACCEPT BOOKING (REVOKES COMPETING OFFERS) ──
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

  -- 4. Atomic conditional update with row lock on haul_bookings
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

  -- 6. Synchronize driver offers: Mark winning offer ACCEPTED, revoke all other pending offers
  UPDATE public.driver_booking_offers
  SET status = 'ACCEPTED',
      responded_at = NOW()
  WHERE booking_id = p_booking_id AND driver_id = p_driver_id AND status = 'PENDING';

  UPDATE public.driver_booking_offers
  SET status = 'REVOKED',
      responded_at = NOW()
  WHERE booking_id = p_booking_id AND driver_id <> p_driver_id AND status = 'PENDING';

  -- 7. Record audit event
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
    'agreed_fare', v_booking.agreed_fare,
    'start_otp_hash', v_booking.start_otp_hash
  );
END;
$$;

-- ── 7. UPDATE ATOMIC CANCEL BOOKING (REVOKES ACTIVE OFFERS) ──
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

  -- Revoke any active dispatch offers for this cancelled booking
  UPDATE public.driver_booking_offers
  SET status = 'REVOKED',
      responded_at = NOW()
  WHERE booking_id = p_booking_id AND status = 'PENDING';

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

-- ── 8. RPC: ATOMIC EXTEND RENTAL WITH SCHEDULE CONFLICT PROTECTION ──
CREATE OR REPLACE FUNCTION public.atomic_extend_rental(
  p_rental_id TEXT,
  p_renter_id TEXT,
  p_new_end_time TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rental RECORD;
  v_target_id TEXT;
  v_conflict RECORD;
  v_additional_hours NUMERIC;
  v_additional_amount NUMERIC;
  v_new_total NUMERIC;
BEGIN
  SELECT * INTO v_rental
  FROM public.rental_bookings
  WHERE rental_id = p_rental_id
  FOR UPDATE;

  IF v_rental.rental_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'RENTAL_NOT_FOUND');
  END IF;

  IF v_rental.renter_id <> p_renter_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_RENTER');
  END IF;

  IF v_rental.status NOT IN ('CONFIRMED', 'ACTIVE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS_FOR_EXTENSION', 'status', v_rental.status);
  END IF;

  IF p_new_end_time <= v_rental.end_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EXTENSION_TIME', 'message', 'New end time must be after existing end time');
  END IF;

  v_target_id := COALESCE(v_rental.vehicle_id, v_rental.equipment_id);

  -- Check if another booking overlaps with the extension interval (v_rental.end_time -> p_new_end_time)
  SELECT * INTO v_conflict
  FROM public.rental_bookings
  WHERE (vehicle_id = v_target_id OR equipment_id = v_target_id)
    AND rental_id <> p_rental_id
    AND status IN ('REQUESTED', 'CONFIRMED', 'ACTIVE')
    AND start_time < p_new_end_time AND end_time > v_rental.end_time
  LIMIT 1;

  IF v_conflict.rental_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RENTAL_SCHEDULE_CONFLICT',
      'conflict_rental_id', v_conflict.rental_id,
      'message', 'Another reservation is scheduled starting at ' || v_conflict.start_time
    );
  END IF;

  -- Calculate additional cost
  v_additional_hours := ROUND(EXTRACT(EPOCH FROM (p_new_end_time - v_rental.end_time)) / 3600.0, 2);
  v_additional_amount := ROUND(v_additional_hours * COALESCE(v_rental.hourly_rate, 650));
  v_new_total := v_rental.base_amount + v_additional_amount;

  UPDATE public.rental_bookings
  SET end_time = p_new_end_time,
      duration_hours = v_rental.duration_hours + v_additional_hours,
      base_amount = v_new_total,
      extension_count = COALESCE(extension_count, 0) + 1,
      updated_at = NOW()
  WHERE rental_id = p_rental_id;

  RETURN jsonb_build_object(
    'success', true,
    'rental_id', p_rental_id,
    'new_end_time', p_new_end_time,
    'additional_hours', v_additional_hours,
    'additional_amount', v_additional_amount,
    'new_total_amount', v_new_total
  );
END;
$$;

-- ── 9. RPC: ATOMIC RETURN RENTAL & FINAL BILLING CALCULATION ──
CREATE OR REPLACE FUNCTION public.atomic_return_rental(
  p_rental_id TEXT,
  p_actor_id TEXT,
  p_returned_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rental RECORD;
  v_overtime_hours NUMERIC := 0.0;
  v_overtime_amount NUMERIC := 0.0;
  v_final_total NUMERIC;
BEGIN
  SELECT * INTO v_rental
  FROM public.rental_bookings
  WHERE rental_id = p_rental_id
  FOR UPDATE;

  IF v_rental.rental_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'RENTAL_NOT_FOUND');
  END IF;

  IF v_rental.renter_id <> p_actor_id AND v_rental.owner_id <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_PARTICIPANT');
  END IF;

  IF v_rental.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS_FOR_RETURN', 'status', v_rental.status);
  END IF;

  -- Calculate overtime if returned after scheduled end_time
  IF p_returned_at > v_rental.end_time THEN
    v_overtime_hours := ROUND(EXTRACT(EPOCH FROM (p_returned_at - v_rental.end_time)) / 3600.0, 2);
    v_overtime_amount := ROUND(v_overtime_hours * COALESCE(v_rental.hourly_rate, 650));
  END IF;

  v_final_total := v_rental.base_amount + v_overtime_amount;

  UPDATE public.rental_bookings
  SET status = 'RETURNED',
      actual_returned_at = p_returned_at,
      overtime_hours = v_overtime_hours,
      overtime_amount = v_overtime_amount,
      final_total_amount = v_final_total,
      updated_at = NOW()
  WHERE rental_id = p_rental_id;

  RETURN jsonb_build_object(
    'success', true,
    'rental_id', p_rental_id,
    'status', 'RETURNED',
    'base_amount', v_rental.base_amount,
    'overtime_hours', v_overtime_hours,
    'overtime_amount', v_overtime_amount,
    'final_total_amount', v_final_total
  );
END;
$$;

-- ── 10. ROW LEVEL SECURITY (RLS) POLICIES ──
ALTER TABLE public.driver_booking_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_equipment_inventory ENABLE ROW LEVEL SECURITY;

-- Driver Booking Offers: Drivers see their own offers; Farmers see offers for their bookings
CREATE POLICY rls_driver_booking_offers_select
  ON public.driver_booking_offers FOR SELECT
  USING (
    auth.uid()::TEXT = driver_id
    OR EXISTS (
      SELECT 1 FROM public.haul_bookings hb
      WHERE hb.id = driver_booking_offers.booking_id
        AND (hb.farmer_user_id = auth.uid()::TEXT OR hb.user_id = auth.uid()::TEXT)
    )
  );

CREATE POLICY rls_driver_booking_offers_update
  ON public.driver_booking_offers FOR UPDATE
  USING (auth.uid()::TEXT = driver_id);

-- Rental Equipment Inventory: Publicly searchable; Owners manage their own equipment
CREATE POLICY rls_rental_equipment_select
  ON public.rental_equipment_inventory FOR SELECT
  USING (true);

CREATE POLICY rls_rental_equipment_all_owner
  ON public.rental_equipment_inventory FOR ALL
  USING (auth.uid()::TEXT = owner_id);

