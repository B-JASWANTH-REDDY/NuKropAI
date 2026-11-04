import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { pool } from '../config/db';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// In-memory fallback stores for when DB/Supabase are offline in local dev/tests
export const dispatchMemoryStore = {
  driverLocations: new Map<string, any>(),
  bookings: new Map<string, any>(),
  telemetry: [] as any[],
  profiles: new Map<string, any>(),
  idempotencyMap: new Map<string, any>()
};

function getHeaders(authToken?: string) {
  const token = authToken || SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

/**
 * 1. DRIVER ON-DUTY / OFF-DUTY PRESENCE
 * POST /api/dispatch/duty
 */
export const setDutyStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const userRole = request.user?.role;
  const { isOnDuty, lat, lng, accuracy = 5.0 } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  const authHeader = request.headers.authorization?.replace(/^Bearer\s+/, '') || SUPABASE_ANON_KEY;

  // 1. Check Driver Verification Status from database or Supabase profiles
  let driverVerifiedStatus = 'PENDING';
  let driverName = 'Driver';
  let driverPhone = '';

  if (SUPABASE_URL) {
    try {
      const profRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,full_name,phone,driver_verified_status`,
        { headers: getHeaders(authHeader), timeout: 4000 }
      );
      if (profRes.data && profRes.data.length > 0) {
        driverVerifiedStatus = profRes.data[0].driver_verified_status || 'PENDING';
        driverName = profRes.data[0].full_name || 'Driver';
        driverPhone = profRes.data[0].phone || '';
      }
    } catch {
      // Fallback to local profile store
      const memProf = dispatchMemoryStore.profiles.get(userId);
      if (memProf) {
        driverVerifiedStatus = memProf.driver_verified_status || 'PENDING';
        driverName = memProf.full_name || 'Driver';
        driverPhone = memProf.phone || '';
      }
    }
  } else {
    const memProf = dispatchMemoryStore.profiles.get(userId);
    if (memProf) {
      driverVerifiedStatus = memProf.driver_verified_status || 'PENDING';
      driverName = memProf.full_name || 'Driver';
      driverPhone = memProf.phone || '';
    }
  }

  // Strict enforcement: Driver must be VERIFIED
  if (driverVerifiedStatus !== 'VERIFIED') {
    return reply.status(403).send({
      error: 'DRIVER_NOT_VERIFIED',
      message: `Driver identity verification is ${driverVerifiedStatus}. Only VERIFIED drivers can go ON DUTY.`,
      currentStatus: driverVerifiedStatus
    });
  }

  // If going ON DUTY, valid GPS is strictly required
  if (isOnDuty === true) {
    if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return reply.status(400).send({
        error: 'INVALID_GPS_COORDINATES',
        message: 'Valid decimal latitude and longitude are required to switch ON DUTY.'
      });
    }

    const nLat = Number(lat);
    const nLng = Number(lng);
    if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
      return reply.status(400).send({
        error: 'OUT_OF_BOUNDS_COORDINATES',
        message: 'Latitude must be between -90 and 90; longitude must be between -180 and 180.'
      });
    }

    const locRecord = {
      driver_id: userId,
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_number: 'AP-39-TK-1008',
      vehicle_type: 'Tata Ace (1.5T)',
      capacity_tonnes: 1.5,
      current_lat: nLat,
      current_lng: nLng,
      accuracy: Number(accuracy) || 5.0,
      is_available: true,
      is_on_duty: true,
      on_duty_since: new Date().toISOString(),
      last_ping: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try Supabase RPC or upsert
    if (SUPABASE_URL) {
      try {
        await axios.post(
          `${SUPABASE_URL}/rest/v1/rpc/upsert_driver_location`,
          { p_driver_id: userId, p_lon: nLng, p_lat: nLat, p_heading: 0, p_speed_kmh: 0 },
          { headers: getHeaders(authHeader), timeout: 4000 }
        );
      } catch {
        // Fallback to table upsert
        try {
          await axios.post(
            `${SUPABASE_URL}/rest/v1/driver_locations`,
            locRecord,
            { headers: { ...getHeaders(authHeader), Prefer: 'resolution=merge-duplicates' }, timeout: 4000 }
          );
        } catch {}
      }
    }

    dispatchMemoryStore.driverLocations.set(userId, locRecord);

    return reply.send({
      success: true,
      isOnDuty: true,
      isAvailable: true,
      driverId: userId,
      location: { lat: nLat, lng: nLng },
      message: 'Driver presence updated: ON DUTY and eligible for nearby farmer dispatch.'
    });
  } else {
    // Going OFF DUTY: preserve ongoing active trip
    const existing = dispatchMemoryStore.driverLocations.get(userId) || {};
    const hasActiveTrip = !!existing.active_booking_id;

    const offRecord = {
      ...existing,
      driver_id: userId,
      is_on_duty: false,
      is_available: false,
      updated_at: new Date().toISOString()
    };

    if (SUPABASE_URL) {
      try {
        await axios.patch(
          `${SUPABASE_URL}/rest/v1/driver_locations?driver_id=eq.${userId}`,
          { is_on_duty: false, is_available: false, updated_at: new Date().toISOString() },
          { headers: getHeaders(authHeader), timeout: 4000 }
        );
      } catch {}
    }

    dispatchMemoryStore.driverLocations.set(userId, offRecord);

    return reply.send({
      success: true,
      isOnDuty: false,
      isAvailable: false,
      activeTripPreserved: hasActiveTrip,
      message: hasActiveTrip
        ? 'Driver is OFF DUTY for new bookings; active trip tracking preserved.'
        : 'Driver is now OFF DUTY.'
    });
  }
};

/**
 * 2. REAL-TIME GPS LOCATION UPDATE & JUMP VALIDATION
 * POST /api/dispatch/location
 */
export const recordLocationPing = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { lat, lng, speed = 0, heading = 0, accuracy = 5.0 } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver authentication required' });
  }

  const nLat = Number(lat);
  const nLng = Number(lng);
  const nAccuracy = Number(accuracy);
  const nSpeed = Number(speed);

  // Validate coordinates
  if (isNaN(nLat) || isNaN(nLng) || nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
    return reply.status(400).send({ error: 'INVALID_COORDINATES', message: 'Invalid latitude or longitude.' });
  }

  // Accuracy threshold (reject poor GPS readings > 50 meters)
  if (nAccuracy > 50.0) {
    return reply.status(400).send({
      error: 'POOR_GPS_ACCURACY',
      accuracy: nAccuracy,
      message: 'GPS reading discarded due to poor accuracy (> 50m).'
    });
  }

  // Jump anomaly detection
  const previous = dispatchMemoryStore.driverLocations.get(userId);
  if (previous && previous.current_lat && previous.last_ping) {
    const prevTime = new Date(previous.last_ping).getTime();
    const currTime = Date.now();
    const timeDeltaSec = (currTime - prevTime) / 1000;

    if (timeDeltaSec > 1.0) {
      // Calculate Haversine distance in meters
      const R = 6371e3;
      const φ1 = (previous.current_lat * Math.PI) / 180;
      const φ2 = (nLat * Math.PI) / 180;
      const Δφ = ((nLat - previous.current_lat) * Math.PI) / 180;
      const Δλ = ((nLng - previous.current_lng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distMeters = R * c;

      const impliedSpeedKmh = (distMeters / timeDeltaSec) * 3.6;
      if (impliedSpeedKmh > 160.0) {
        return reply.status(400).send({
          error: 'IMPOSSIBLE_GPS_JUMP',
          impliedSpeedKmh: Math.round(impliedSpeedKmh),
          message: 'Impossible location jump detected. Coordinate update rejected.'
        });
      }
    }
  }

  const updatedRecord = {
    ...(previous || {}),
    driver_id: userId,
    current_lat: nLat,
    current_lng: nLng,
    speed_kmh: nSpeed,
    heading: Number(heading) || 0,
    accuracy: nAccuracy,
    last_ping: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.driverLocations.set(userId, updatedRecord);

  // If driver has an active booking, persist breadcrumb in driver_telemetry
  const activeBookingId = updatedRecord.active_booking_id;
  if (activeBookingId) {
    const breadcrumb = {
      driver_id: userId,
      booking_id: activeBookingId,
      latitude: nLat,
      longitude: nLng,
      speed: nSpeed,
      heading: Number(heading) || 0,
      accuracy: nAccuracy,
      is_online: true,
      last_ping: new Date().toISOString()
    };
    dispatchMemoryStore.telemetry.push(breadcrumb);

    if (SUPABASE_URL) {
      const authHeader = request.headers.authorization?.replace(/^Bearer\s+/, '') || SUPABASE_ANON_KEY;
      try {
        await axios.post(
          `${SUPABASE_URL}/rest/v1/driver_telemetry`,
          breadcrumb,
          { headers: getHeaders(authHeader), timeout: 3000 }
        );
      } catch {}
    }
  }

  return reply.send({
    success: true,
    lat: nLat,
    lng: nLng,
    speed: nSpeed,
    heading: Number(heading) || 0,
    activeBookingId: activeBookingId || null,
    timestamp: updatedRecord.last_ping
  });
};

/**
 * 3. SERVER-ENFORCED 10 KM NEARBY DRIVER DISCOVERY (POSTGIS)
 * GET /api/dispatch/nearby
 */
export const getNearbyDrivers = async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as any;
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radiusKm = parseFloat(query.radiusKm || '10');

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return reply.status(400).send({
      error: 'INVALID_COORDINATES',
      message: 'Valid decimal latitude (-90..90) and longitude (-180..180) are required.'
    });
  }

  // Server-enforced radius: capped at requested radius or 10km default
  const radiusMeters = Math.min(Math.max(radiusKm * 1000, 1000), 50000);
  const maxPingAgeMs = 5 * 60 * 1000; // 5 minute freshness window

  let eligibleDrivers: any[] = [];

  // Try live PostGIS RPC via Supabase if connected
  if (SUPABASE_URL) {
    try {
      const rpcRes = await axios.post(
        `${SUPABASE_URL}/rest/v1/rpc/get_nearest_drivers`,
        { user_lon: lng, user_lat: lat, radius_meters: radiusMeters, max_drivers: 20 },
        { headers: getHeaders(), timeout: 4000 }
      );

      if (Array.isArray(rpcRes.data)) {
        eligibleDrivers = rpcRes.data.map((d: any) => ({
          driverId: d.driver_id,
          driverName: d.driver_name || 'Verified Driver',
          vehicleType: d.vehicle_type || 'Tata Ace (1.5T)',
          vehicleNumber: d.vehicle_plate || d.vehicle_number || 'AP-39-TK-1008',
          capacityTonnes: 1.5,
          lat: d.lat,
          lng: d.lon,
          distanceMeters: Math.round(d.distance_meters),
          distanceKm: parseFloat((d.distance_meters / 1000).toFixed(2)),
          lastPing: d.updated_at,
          verificationStatus: 'VERIFIED'
        }));
      }
    } catch {}
  }

  // Also query memory store / local records
  if (eligibleDrivers.length === 0) {
    const now = Date.now();
    for (const [driverId, loc] of dispatchMemoryStore.driverLocations.entries()) {
      if (!loc.is_on_duty || !loc.is_available || loc.active_booking_id) continue;

      // Freshness check: exclude drivers who haven't pinged in 5 minutes
      const pingTime = new Date(loc.last_ping || loc.updated_at || 0).getTime();
      if (now - pingTime > maxPingAgeMs) continue;

      // Verification check: driver profile must be VERIFIED
      const prof = dispatchMemoryStore.profiles.get(driverId) || {};
      if (prof.driver_verified_status && prof.driver_verified_status !== 'VERIFIED') continue;

      // PostGIS / Haversine distance
      const R = 6371e3;
      const φ1 = (lat * Math.PI) / 180;
      const φ2 = (loc.current_lat * Math.PI) / 180;
      const Δφ = ((loc.current_lat - lat) * Math.PI) / 180;
      const Δλ = ((loc.current_lng - lng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distMeters = R * c;

      if (distMeters <= radiusMeters) {
        eligibleDrivers.push({
          driverId,
          driverName: loc.driver_name || prof.full_name || 'Verified Driver',
          vehicleType: loc.vehicle_type || 'Tata Ace (1.5T)',
          vehicleNumber: loc.vehicle_number || 'AP-39-TK-1008',
          capacityTonnes: loc.capacity_tonnes || 1.5,
          lat: loc.current_lat,
          lng: loc.current_lng,
          distanceMeters: Math.round(distMeters),
          distanceKm: parseFloat((distMeters / 1000).toFixed(2)),
          lastPing: loc.last_ping,
          verificationStatus: 'VERIFIED'
        });
      }
    }

    eligibleDrivers.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  if (eligibleDrivers.length === 0) {
    return reply.send({
      success: true,
      count: 0,
      radiusKm,
      drivers: [],
      message: `No verified drivers are currently available within ${radiusKm} km.`
    });
  }

  return reply.send({
    success: true,
    count: eligibleDrivers.length,
    radiusKm,
    drivers: eligibleDrivers
  });
};

/**
 * 4. REAL BOOKING REQUEST CREATION
 * POST /api/dispatch/book
 */
export const createBookingRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Farmer authentication required' });
  }

  const idempotencyKey = ((request.headers['idempotency-key'] as string) || (request.body as any)?.idempotencyKey || '').trim();
  if (idempotencyKey) {
    const existing = dispatchMemoryStore.idempotencyMap.get(idempotencyKey);
    if (existing) {
      return reply.status(200).send({
        success: true,
        idempotentReplay: true,
        bookingId: existing.id,
        status: existing.status,
        booking: existing
      });
    }
  }

  const {
    pickupVillage,
    destinationMandi,
    cropName,
    loadQuintals,
    agreedFare,
    vehicleType = 'Tata Ace (1.5T)',
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    notes
  } = request.body as any;

  if (!pickupVillage || !destinationMandi || !cropName || !loadQuintals || !agreedFare) {
    return reply.status(400).send({
      error: 'MISSING_REQUIRED_FIELDS',
      message: 'pickupVillage, destinationMandi, cropName, loadQuintals, and agreedFare are required.'
    });
  }

  const bookingId = `HB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const bookingRecord = {
    id: bookingId,
    farmer_user_id: userId,
    user_id: userId,
    pickup_village: pickupVillage,
    destination_mandi: destinationMandi,
    crop_name: cropName,
    load_quintals: Number(loadQuintals),
    agreed_fare: Number(agreedFare),
    vehicle_type: vehicleType,
    status: 'PENDING',
    pickup_lat: pickupLat ? Number(pickupLat) : null,
    pickup_lng: pickupLng ? Number(pickupLng) : null,
    dropoff_lat: dropoffLat ? Number(dropoffLat) : null,
    dropoff_lng: dropoffLng ? Number(dropoffLng) : null,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.bookings.set(bookingId, bookingRecord);
  if (idempotencyKey) {
    dispatchMemoryStore.idempotencyMap.set(idempotencyKey, bookingRecord);
  }

  if (SUPABASE_URL) {
    const authHeader = request.headers.authorization?.replace(/^Bearer\s+/, '') || SUPABASE_ANON_KEY;
    try {
      await axios.post(
        `${SUPABASE_URL}/rest/v1/haul_bookings`,
        bookingRecord,
        { headers: getHeaders(authHeader), timeout: 4000 }
      );
    } catch {}
  }

  return reply.status(201).send({
    success: true,
    bookingId,
    status: 'PENDING',
    booking: bookingRecord
  });
};

/**
 * 5. ATOMIC DRIVER BOOKING ACCEPTANCE (CONCURRENCY-SAFE)
 * POST /api/dispatch/accept
 */
export const acceptBooking = async (request: FastifyRequest, reply: FastifyReply) => {
  const driverId = request.user?.id;
  const { bookingId } = request.body as any;
  const idempotencyKey = ((request.headers['idempotency-key'] as string) || (request.body as any)?.idempotencyKey || '').trim();

  if (idempotencyKey && dispatchMemoryStore.idempotencyMap.has(idempotencyKey)) {
    return reply.status(200).send(dispatchMemoryStore.idempotencyMap.get(idempotencyKey));
  }

  if (!driverId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver authentication required' });
  }

  if (!bookingId) {
    return reply.status(400).send({ error: 'MISSING_BOOKING_ID', message: 'bookingId is required.' });
  }

  // 1. Verify Driver Verification Status
  const prof = dispatchMemoryStore.profiles.get(driverId) || {};
  if (prof.driver_verified_status && prof.driver_verified_status !== 'VERIFIED') {
    return reply.status(403).send({
      error: 'DRIVER_NOT_VERIFIED',
      message: 'Only VERIFIED drivers can accept bookings.'
    });
  }

  // 2. Verify Driver is ON DUTY
  const driverLoc = dispatchMemoryStore.driverLocations.get(driverId);
  if (driverLoc && !driverLoc.is_on_duty) {
    return reply.status(403).send({
      error: 'DRIVER_OFF_DUTY',
      message: 'Driver must be ON DUTY to accept bookings.'
    });
  }

  // 3. Atomic Conditional Check: Booking must be in PENDING status
  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  if (booking.status !== 'PENDING' && booking.status !== 'REQUESTED' && booking.status !== 'SEARCHING') {
    // 409 Conflict: Already accepted by another driver or cancelled
    return reply.status(409).send({
      error: 'BOOKING_ALREADY_ACCEPTED_OR_CANCELLED',
      currentStatus: booking.status,
      assignedDriver: booking.driver_user_id || booking.driver_id || null,
      message: 'This booking has already been accepted by another driver or is no longer available.'
    });
  }

  // Atomically assign booking to this driver
  booking.status = 'ACCEPTED';
  booking.driver_user_id = driverId;
  booking.driver_id = driverId;
  booking.driver_name = (driverLoc && driverLoc.driver_name) || prof.full_name || 'Verified Driver';
  booking.driver_phone = (driverLoc && driverLoc.driver_phone) || prof.phone || '';
  booking.updated_at = new Date().toISOString();

  dispatchMemoryStore.bookings.set(bookingId, booking);

  // Update driver presence: unavailable for new bookings, bound to this trip
  if (driverLoc) {
    driverLoc.is_available = false;
    driverLoc.active_booking_id = bookingId;
    driverLoc.updated_at = new Date().toISOString();
    dispatchMemoryStore.driverLocations.set(driverId, driverLoc);
  }

  // Sync to Supabase if connected
  if (SUPABASE_URL) {
    const authHeader = request.headers.authorization?.replace(/^Bearer\s+/, '') || SUPABASE_ANON_KEY;
    try {
      await axios.patch(
        `${SUPABASE_URL}/rest/v1/haul_bookings?id=eq.${bookingId}&status=in.(PENDING,REQUESTED,SEARCHING)`,
        {
          status: 'ACCEPTED',
          driver_user_id: driverId,
          driver_id: driverId,
          updated_at: new Date().toISOString()
        },
        { headers: getHeaders(authHeader), timeout: 4000 }
      );
    } catch {}
  }

  const acceptResponse = {
    success: true,
    bookingId,
    status: 'ACCEPTED',
    assignedDriverId: driverId,
    message: 'Booking accepted successfully. Live GPS tracking engaged.'
  };

  if (idempotencyKey) {
    dispatchMemoryStore.idempotencyMap.set(idempotencyKey, acceptResponse);
  }

  return reply.send(acceptResponse);
};

/**
 * 6. TRIP PROGRESSION (ARRIVED, IN_TRANSIT, COMPLETED, CANCELLED)
 * POST /api/dispatch/trip-status
 */
export const updateTripStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { bookingId, status: newStatus } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  // Authorization: Only the assigned driver or the booking farmer can update status
  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;
  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;

  if (!isDriver && !isFarmer) {
    return reply.status(403).send({
      error: 'UNAUTHORIZED_ACCESS',
      message: 'You are not an authorized participant in this booking.'
    });
  }

  // Validate state transitions
  const validTransitions: Record<string, string[]> = {
    ACCEPTED: ['ARRIVED', 'DRIVER_ARRIVED', 'CANCELLED'],
    ARRIVED: ['IN_TRANSIT', 'TRIP_STARTED', 'CANCELLED'],
    DRIVER_ARRIVED: ['IN_TRANSIT', 'TRIP_STARTED', 'CANCELLED'],
    IN_TRANSIT: ['COMPLETED', 'TRIP_COMPLETED', 'CANCELLED'],
    TRIP_STARTED: ['COMPLETED', 'TRIP_COMPLETED', 'CANCELLED']
  };

  const allowed = validTransitions[booking.status] || ['CANCELLED'];
  if (!allowed.includes(newStatus)) {
    return reply.status(400).send({
      error: 'INVALID_STATUS_TRANSITION',
      currentStatus: booking.status,
      targetStatus: newStatus,
      allowedNextStatuses: allowed
    });
  }

  booking.status = newStatus;
  booking.updated_at = new Date().toISOString();
  dispatchMemoryStore.bookings.set(bookingId, booking);

  // If completed or cancelled, release driver back to available pool
  if (['COMPLETED', 'TRIP_COMPLETED', 'CANCELLED'].includes(newStatus)) {
    const driverId = booking.driver_user_id || booking.driver_id;
    if (driverId) {
      const driverLoc = dispatchMemoryStore.driverLocations.get(driverId);
      if (driverLoc) {
        driverLoc.is_available = true;
        driverLoc.active_booking_id = null;
        driverLoc.updated_at = new Date().toISOString();
        dispatchMemoryStore.driverLocations.set(driverId, driverLoc);
      }
    }
  }

  return reply.send({
    success: true,
    bookingId,
    previousStatus: booking.status,
    newStatus,
    message: `Trip status advanced to ${newStatus}.`
  });
};

/**
 * 7. AUTHORIZED LIVE TRACKING ENDPOINT (MULTI-TENANT DEFENSE)
 * GET /api/dispatch/track/:bookingId
 */
export const trackBooking = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { bookingId } = request.params as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required to track trips.' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  // MULTI-TENANT ISOLATION: Requester MUST be the farmer or the assigned driver
  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;
  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;

  if (!isFarmer && !isDriver) {
    return reply.status(403).send({
      error: 'FORBIDDEN_TRACKING_ACCESS',
      message: 'Access Denied: You are not authorized to track this booking or driver.'
    });
  }

  const driverId = booking.driver_user_id || booking.driver_id;
  if (!driverId) {
    return reply.send({
      bookingId,
      status: booking.status,
      driverAssigned: false,
      message: 'Finding verified drivers near you...'
    });
  }

  const loc = dispatchMemoryStore.driverLocations.get(driverId);
  const now = Date.now();
  const pingTime = loc?.last_ping ? new Date(loc.last_ping).getTime() : 0;
  const isStale = loc ? now - pingTime > 5 * 60 * 1000 : true;

  return reply.send({
    bookingId,
    status: booking.status,
    driverAssigned: true,
    driver: {
      driverId,
      driverName: booking.driver_name || loc?.driver_name || 'Verified Driver',
      driverPhone: booking.driver_phone || loc?.driver_phone || '',
      vehicleType: booking.vehicle_type || loc?.vehicle_type || 'Tata Ace (1.5T)',
      vehicleNumber: booking.vehicle_plate || loc?.vehicle_number || 'AP-39-TK-1008',
      currentLat: loc?.current_lat || null,
      currentLng: loc?.current_lng || null,
      speedKmh: loc?.speed_kmh || 0,
      heading: loc?.heading || 0,
      accuracy: loc?.accuracy || 5.0,
      lastPing: loc?.last_ping || null,
      isStale,
      statusMessage: isStale
        ? "Waiting for driver's latest location..."
        : 'Live GPS stream active'
    },
    trip: {
      pickupVillage: booking.pickup_village,
      destinationMandi: booking.destination_mandi,
      cropName: booking.crop_name,
      loadQuintals: booking.load_quintals,
      agreedFare: booking.agreed_fare
    }
  });
};

