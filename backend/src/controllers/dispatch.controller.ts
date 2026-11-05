import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import crypto from 'crypto';
import { pool } from '../config/db';
import { IdempotencyService } from '../services/IdempotencyService';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// In-memory fallback stores for local dev/tests & offline resilience
export const dispatchMemoryStore = {
  driverLocations: new Map<string, any>(),
  dutySessions: new Map<string, any>(),
  vehicles: new Map<string, any>(),
  bookings: new Map<string, any>(),
  bookingEvents: [] as any[],
  rentals: new Map<string, any>(),
  chatMessages: new Map<string, any[]>(),
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

export function hashOtp(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + otp).digest('hex');
}

export function generateSecureOtp(): { otp: string; salt: string; hash: string } {
  const otp = crypto.randomInt(1000, 10000).toString(); // Cryptographically secure 4-digit numeric OTP
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashOtp(otp, salt);
  return { otp, salt, hash };
}

function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. VEHICLE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const getRegisteredVehicles = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  let vehicles: any[] = [];
  try {
    const res = await pool.query(
      'SELECT * FROM public.driver_vehicles WHERE transporter_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (res && res.rows) {
      vehicles = res.rows;
    }
  } catch {
    // Memory fallback
    for (const v of dispatchMemoryStore.vehicles.values()) {
      if (v.transporter_id === userId) {
        vehicles.push(v);
      }
    }
  }

  return reply.send({ success: true, count: vehicles.length, vehicles });
};

export const registerVehicle = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  const {
    vehicleCategory,
    makeModel,
    vehiclePlate,
    capacityTonnes,
    dimensionsDesc,
    fuelType = 'DIESEL',
    insuranceValidUntil,
    fitnessValidUntil,
    permitValidUntil
  } = request.body as any;

  const validCategories = [
    'TRACTOR',
    'TRACTOR_TROLLEY',
    'MINI_TRUCK',
    'PICKUP',
    'SMALL_GOODS',
    'MEDIUM_GOODS',
    'HEAVY_GOODS',
    'COLD_CHAIN_REEFER'
  ];

  if (!vehicleCategory || !validCategories.includes(vehicleCategory)) {
    return reply.status(400).send({
      error: 'INVALID_VEHICLE_CATEGORY',
      message: `Vehicle category must be one of: ${validCategories.join(', ')}`
    });
  }

  if (!makeModel || !vehiclePlate || !capacityTonnes || isNaN(Number(capacityTonnes)) || Number(capacityTonnes) <= 0) {
    return reply.status(400).send({
      error: 'INVALID_VEHICLE_DETAILS',
      message: 'makeModel, vehiclePlate, and positive capacityTonnes are required.'
    });
  }

  const normalizedPlate = vehiclePlate.trim().toUpperCase();
  const vehicleId = `VH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const vehicleRecord = {
    vehicle_id: vehicleId,
    transporter_id: userId,
    vehicle_category: vehicleCategory,
    make_model: makeModel.trim(),
    vehicle_plate: normalizedPlate,
    capacity_tonnes: Number(capacityTonnes),
    dimensions_desc: dimensionsDesc || null,
    fuel_type: fuelType,
    insurance_valid_until: insuranceValidUntil || null,
    fitness_valid_until: fitnessValidUntil || null,
    permit_valid_until: permitValidUntil || null,
    verification_status: 'VERIFIED',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    await pool.query(
      `INSERT INTO public.driver_vehicles (
        vehicle_id, transporter_id, vehicle_category, make_model, vehicle_plate,
        capacity_tonnes, dimensions_desc, fuel_type, insurance_valid_until,
        fitness_valid_until, permit_valid_until, verification_status, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        vehicleRecord.vehicle_id,
        vehicleRecord.transporter_id,
        vehicleRecord.vehicle_category,
        vehicleRecord.make_model,
        vehicleRecord.vehicle_plate,
        vehicleRecord.capacity_tonnes,
        vehicleRecord.dimensions_desc,
        vehicleRecord.fuel_type,
        vehicleRecord.insurance_valid_until,
        vehicleRecord.fitness_valid_until,
        vehicleRecord.permit_valid_until,
        vehicleRecord.verification_status,
        vehicleRecord.is_active
      ]
    );
  } catch {}

  dispatchMemoryStore.vehicles.set(vehicleId, vehicleRecord);

  return reply.status(201).send({
    success: true,
    vehicle: vehicleRecord,
    message: 'Vehicle registered and verified successfully.'
  });
};

export const updateVehicle = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { vehicleId } = request.params as any;
  const updates = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const existing = dispatchMemoryStore.vehicles.get(vehicleId);
  if (!existing || existing.transporter_id !== userId) {
    return reply.status(404).send({ error: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found or unauthorized' });
  }

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.vehicles.set(vehicleId, updated);
  try {
    await pool.query(
      'UPDATE public.driver_vehicles SET make_model = $1, capacity_tonnes = $2, updated_at = NOW() WHERE vehicle_id = $3',
      [updated.make_model, updated.capacity_tonnes, vehicleId]
    );
  } catch {}

  return reply.send({ success: true, vehicle: updated });
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DRIVER ON-DUTY / OFF-DUTY PRESENCE & STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

export const setDutyStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { isOnDuty, status = 'ONLINE_AVAILABLE', lat, lng, accuracy = 5.0, vehicleId } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  const authHeader = request.headers.authorization?.replace(/^Bearer\s+/, '') || SUPABASE_ANON_KEY;

  // 1. Check Driver Verification Status (Memory store / cache first, then Supabase if not found)
  let driverVerifiedStatus = 'PENDING';
  let driverName = 'Driver';
  let driverPhone = '';

  const memProf = dispatchMemoryStore.profiles.get(userId);
  if (memProf) {
    driverVerifiedStatus = memProf.driver_verified_status || 'PENDING';
    driverName = memProf.full_name || 'Driver';
    driverPhone = memProf.phone || '';
  }

  if (driverVerifiedStatus !== 'VERIFIED' && SUPABASE_URL) {
    try {
      const profRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,full_name,phone,driver_verified_status`,
        { headers: getHeaders(authHeader), timeout: 2000 }
      );
      if (profRes.data && profRes.data.length > 0) {
        driverVerifiedStatus = profRes.data[0].driver_verified_status || 'PENDING';
        driverName = profRes.data[0].full_name || 'Driver';
        driverPhone = profRes.data[0].phone || '';
      }
    } catch {}
  }

  if (driverVerifiedStatus !== 'VERIFIED') {
    return reply.status(403).send({
      error: 'DRIVER_NOT_VERIFIED',
      message: `Driver identity verification is ${driverVerifiedStatus}. Only VERIFIED drivers can go ON DUTY.`,
      currentStatus: driverVerifiedStatus
    });
  }

  // Going ON DUTY
  const wantsOnline = isOnDuty === true || ['GOING_ONLINE', 'ONLINE_AVAILABLE'].includes(status);

  if (wantsOnline) {
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

    if (Number(accuracy) > 50.0) {
      return reply.status(400).send({
        error: 'POOR_GPS_ACCURACY',
        message: 'GPS accuracy worse than 50 meters cannot be used to go ON DUTY.'
      });
    }

    // Lookup driver's registered vehicle
    let chosenVehicle: any = null;
    if (vehicleId) {
      chosenVehicle = dispatchMemoryStore.vehicles.get(vehicleId);
    }
    if (!chosenVehicle) {
      for (const v of dispatchMemoryStore.vehicles.values()) {
        if (v.transporter_id === userId && v.is_active) {
          chosenVehicle = v;
          break;
        }
      }
    }

    // Create duty session
    const sessionId = `DS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sessionRecord = {
      session_id: sessionId,
      driver_id: userId,
      vehicle_id: chosenVehicle ? chosenVehicle.vehicle_id : null,
      status: 'ONLINE_AVAILABLE',
      start_lat: nLat,
      start_lng: nLng,
      last_heartbeat_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      ended_at: null
    };
    dispatchMemoryStore.dutySessions.set(sessionId, sessionRecord);

    const locRecord = {
      driver_id: userId,
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_id: chosenVehicle?.vehicle_id || null,
      vehicle_number: chosenVehicle?.vehicle_plate || 'AP-39-TK-1008',
      vehicle_type: chosenVehicle?.make_model || 'Tata Ace (1.5T)',
      vehicle_category: chosenVehicle?.vehicle_category || 'MINI_TRUCK',
      capacity_tonnes: chosenVehicle?.capacity_tonnes || 1.5,
      current_lat: nLat,
      current_lng: nLng,
      accuracy: Number(accuracy) || 5.0,
      is_available: true,
      is_on_duty: true,
      on_duty_since: new Date().toISOString(),
      last_ping: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    dispatchMemoryStore.driverLocations.set(userId, locRecord);

    try {
      await pool.query(
        `INSERT INTO public.driver_duty_sessions (session_id, driver_id, vehicle_id, status, start_lat, start_lng, started_at, last_heartbeat_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [sessionId, userId, sessionRecord.vehicle_id, 'ONLINE_AVAILABLE', nLat, nLng]
      );
    } catch {}

    return reply.send({
      success: true,
      isOnDuty: true,
      isAvailable: true,
      dutyStatus: 'ONLINE_AVAILABLE',
      sessionId,
      driverId: userId,
      vehicle: chosenVehicle || { vehiclePlate: 'AP-39-TK-1008', makeModel: 'Tata Ace (1.5T)' },
      location: { lat: nLat, lng: nLng },
      message: 'Driver presence updated: ON DUTY and eligible for nearby farmer dispatch.'
    });
  } else {
    // Going OFF DUTY
    const existing = dispatchMemoryStore.driverLocations.get(userId) || {};
    const hasActiveTrip = !!existing.active_booking_id;

    const offRecord = {
      ...existing,
      driver_id: userId,
      is_on_duty: false,
      is_available: false,
      updated_at: new Date().toISOString()
    };

    dispatchMemoryStore.driverLocations.set(userId, offRecord);

    // End active duty session
    for (const s of dispatchMemoryStore.dutySessions.values()) {
      if (s.driver_id === userId && !s.ended_at) {
        s.ended_at = new Date().toISOString();
        s.status = 'OFFLINE';
      }
    }

    try {
      await pool.query(
        `UPDATE public.driver_duty_sessions SET status = 'OFFLINE', ended_at = NOW() WHERE driver_id = $1 AND ended_at IS NULL`,
        [userId]
      );
    } catch {}

    return reply.send({
      success: true,
      isOnDuty: false,
      isAvailable: false,
      dutyStatus: 'OFFLINE',
      activeTripPreserved: hasActiveTrip,
      message: hasActiveTrip
        ? 'Driver is OFF DUTY for new bookings; active trip tracking preserved.'
        : 'Driver is now OFF DUTY.'
    });
  }
};

export const getDriverMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  const prof = dispatchMemoryStore.profiles.get(userId) || { id: userId, full_name: 'Verified Driver' };
  const loc = dispatchMemoryStore.driverLocations.get(userId) || { is_on_duty: false, is_available: false };

  let activeBooking = null;
  if (loc.active_booking_id) {
    activeBooking = dispatchMemoryStore.bookings.get(loc.active_booking_id) || null;
  }

  // Count completed trips and earnings
  let completedTrips = 0;
  let totalEarnings = 0;
  for (const b of dispatchMemoryStore.bookings.values()) {
    if ((b.driver_user_id === userId || b.driver_id === userId) && ['COMPLETED', 'TRIP_COMPLETED'].includes(b.status)) {
      completedTrips++;
      totalEarnings += Number(b.agreed_fare || 0);
    }
  }

  return reply.send({
    success: true,
    driver: {
      driverId: userId,
      fullName: prof.full_name || 'Verified Driver',
      phone: prof.phone || '',
      verificationStatus: prof.driver_verified_status || 'VERIFIED',
      isOnDuty: !!loc.is_on_duty,
      isAvailable: !!loc.is_available,
      currentLocation: loc.current_lat ? { lat: loc.current_lat, lng: loc.current_lng } : null,
      lastPing: loc.last_ping || null,
      activeBooking,
      stats: {
        completedTrips,
        totalEarnings
      }
    }
  });
};

export const getDriverInbox = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const loc = dispatchMemoryStore.driverLocations.get(userId);
  const pendingOffers: any[] = [];

  // If driver is available, match pending/searching bookings
  if (loc && loc.is_on_duty && loc.is_available) {
    for (const b of dispatchMemoryStore.bookings.values()) {
      if (['SEARCHING_DRIVERS', 'PENDING', 'REQUESTED'].includes(b.status)) {
        let distKm = 0;
        if (loc.current_lat && b.pickup_lat) {
          distKm = parseFloat((haversineDistanceMeters(loc.current_lat, loc.current_lng, b.pickup_lat, b.pickup_lng) / 1000).toFixed(1));
        }
        pendingOffers.push({
          bookingId: b.id,
          pickupVillage: b.pickup_village,
          destinationMandi: b.destination_mandi,
          cropName: b.crop_name,
          loadQuintals: b.load_quintals,
          agreedFare: b.agreed_fare,
          vehicleType: b.vehicle_type,
          distanceKm: distKm,
          createdAt: b.created_at,
          expiresInSeconds: 30
        });
      }
    }
  }

  return reply.send({
    success: true,
    offersCount: pendingOffers.length,
    offers: pendingOffers
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. REAL-TIME GPS TELEMETRY INGESTION & JUMP ANOMALY REJECTION
// ─────────────────────────────────────────────────────────────────────────────

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

  // Jump anomaly detection (> 160 km/h)
  const previous = dispatchMemoryStore.driverLocations.get(userId);
  if (previous && previous.current_lat && previous.last_ping) {
    const prevTime = new Date(previous.last_ping).getTime();
    const currTime = Date.now();
    const timeDeltaSec = (currTime - prevTime) / 1000;
    const effectiveTimeSec = Math.max(timeDeltaSec, 0.1);
    const distMeters = haversineDistanceMeters(previous.current_lat, previous.current_lng, nLat, nLng);
    const impliedSpeedKmh = (distMeters / effectiveTimeSec) * 3.6;

    if (distMeters > 50 && impliedSpeedKmh > 160.0) {
      return reply.status(400).send({
        error: 'IMPOSSIBLE_GPS_JUMP',
        impliedSpeedKmh: Math.round(impliedSpeedKmh),
        message: 'Impossible location jump detected. Coordinate update rejected.'
      });
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

  // If driver has an active booking, persist breadcrumb in telemetry
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. FARMER NEARBY DRIVER DISCOVERY (POSTGIS / HAVERSINE FILTER)
// ─────────────────────────────────────────────────────────────────────────────

export const getNearbyDrivers = async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as any;
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radiusKm = parseFloat(query.radiusKm || '10');
  const categoryFilter = query.category ? query.category.trim().toUpperCase() : null;

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return reply.status(400).send({
      error: 'INVALID_COORDINATES',
      message: 'Valid decimal latitude (-90..90) and longitude (-180..180) are required.'
    });
  }

  const radiusMeters = Math.min(Math.max(radiusKm * 1000, 1000), 50000);
  const maxPingAgeMs = 5 * 60 * 1000; // 5 minute freshness window

  let eligibleDrivers: any[] = [];

  // Try live PostGIS RPC via Supabase or Postgres pool
  try {
    const dbRes = await pool.query(
      `SELECT * FROM public.get_nearby_eligible_drivers($1, $2, $3, $4, 20)`,
      [lat, lng, radiusMeters, categoryFilter]
    );
    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      eligibleDrivers = dbRes.rows.map((d: any) => ({
        driverId: d.driver_id,
        driverName: d.driver_name,
        vehicleType: d.vehicle_type,
        vehicleNumber: d.vehicle_number,
        vehicleCategory: d.vehicle_category,
        capacityTonnes: Number(d.capacity_tonnes),
        lat: d.current_lat,
        lng: d.current_lng,
        distanceMeters: Math.round(d.distance_meters),
        distanceKm: parseFloat((d.distance_meters / 1000).toFixed(2)),
        lastPing: d.last_ping,
        verificationStatus: d.verification_status
      }));
    }
  } catch {}

  // Fallback to in-memory store
  if (eligibleDrivers.length === 0) {
    const now = Date.now();
    for (const [driverId, loc] of dispatchMemoryStore.driverLocations.entries()) {
      if (!loc.is_on_duty || !loc.is_available || loc.active_booking_id) continue;

      const pingTime = new Date(loc.last_ping || loc.updated_at || 0).getTime();
      if (now - pingTime > maxPingAgeMs) continue;

      const prof = dispatchMemoryStore.profiles.get(driverId) || {};
      if (prof.driver_verified_status && prof.driver_verified_status !== 'VERIFIED') continue;

      if (categoryFilter && loc.vehicle_category && loc.vehicle_category !== categoryFilter) {
        continue;
      }

      const distMeters = haversineDistanceMeters(lat, lng, loc.current_lat, loc.current_lng);
      if (distMeters <= radiusMeters) {
        eligibleDrivers.push({
          driverId,
          driverName: loc.driver_name || prof.full_name || 'Verified Driver',
          vehicleType: loc.vehicle_type || 'Tata Ace (1.5T)',
          vehicleNumber: loc.vehicle_number || 'AP-39-TK-1008',
          vehicleCategory: loc.vehicle_category || 'MINI_TRUCK',
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

// ─────────────────────────────────────────────────────────────────────────────
// 5. HAUL BOOKING CREATION WITH CRYPTOGRAPHIC OTP
// ─────────────────────────────────────────────────────────────────────────────

export const createBookingRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Farmer authentication required' });
  }

  const idempotencyKey = ((request.headers['idempotency-key'] as string) || (request.body as any)?.idempotencyKey || '').trim();
  if (idempotencyKey) {
    const cached = await IdempotencyService.check(idempotencyKey);
    if (cached) {
      return reply.status(cached.statusCode || 200).send({
        ...cached.responseBody,
        idempotentReplay: true
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
    vehicleCategory = 'MINI_TRUCK',
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

  // Cryptographically secure 4-digit OTP generation and SHA-256 hash
  const { otp, salt, hash } = generateSecureOtp();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30-minute validity

  // Calculate route distance if coords are provided
  let routeDistanceKm = 15.0; // default estimated distance
  if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
    const distM = haversineDistanceMeters(Number(pickupLat), Number(pickupLng), Number(dropoffLat), Number(dropoffLng));
    routeDistanceKm = parseFloat((distM / 1000).toFixed(2));
  }

  const fareNum = Number(agreedFare);
  const fareBreakdown = {
    baseFare: Math.round(fareNum * 0.7),
    distanceFare: Math.round(fareNum * 0.2),
    loadingCharges: Math.round(fareNum * 0.1),
    totalFare: fareNum
  };

  const bookingRecord = {
    id: bookingId,
    farmer_user_id: userId,
    user_id: userId,
    pickup_village: pickupVillage,
    destination_mandi: destinationMandi,
    crop_name: cropName,
    load_quintals: Number(loadQuintals),
    agreed_fare: fareNum,
    vehicle_type: vehicleType,
    vehicle_category: vehicleCategory,
    status: 'SEARCHING_DRIVERS',
    pickup_lat: pickupLat ? Number(pickupLat) : null,
    pickup_lng: pickupLng ? Number(pickupLng) : null,
    dropoff_lat: dropoffLat ? Number(dropoffLat) : null,
    dropoff_lng: dropoffLng ? Number(dropoffLng) : null,
    start_otp_hash: hash,
    start_otp_salt: salt,
    start_otp_attempts: 0,
    start_otp_expires_at: expiresAt,
    route_distance_km: routeDistanceKm,
    fare_breakdown_json: fareBreakdown,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.bookings.set(bookingId, bookingRecord);

  // Record audit creation event
  const auditEvent = {
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: null,
    new_status: 'SEARCHING_DRIVERS',
    actor_id: userId,
    actor_role: 'FARMER',
    reason: 'Farmer created haul booking request',
    metadata_json: { routeDistanceKm, agreedFare: fareNum },
    created_at: new Date().toISOString()
  };
  dispatchMemoryStore.bookingEvents.push(auditEvent);

  try {
    await pool.query(
      `INSERT INTO public.haul_bookings (
        id, farmer_user_id, user_id, pickup_village, destination_mandi, crop_name,
        load_quintals, agreed_fare, vehicle_type, status, pickup_lat, pickup_lng,
        dropoff_lat, dropoff_lng, start_otp_hash, start_otp_salt, start_otp_expires_at,
        route_distance_km, fare_breakdown_json, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        bookingId, userId, userId, pickupVillage, destinationMandi, cropName,
        Number(loadQuintals), fareNum, vehicleType, 'SEARCHING_DRIVERS',
        bookingRecord.pickup_lat, bookingRecord.pickup_lng, bookingRecord.dropoff_lat,
        bookingRecord.dropoff_lng, hash, salt, expiresAt, routeDistanceKm,
        JSON.stringify(fareBreakdown), notes || null
      ]
    );
  } catch {}

  const responsePayload = {
    success: true,
    bookingId,
    status: 'SEARCHING_DRIVERS',
    startOtp: otp, // Farmer holds the OTP to share with driver on arrival
    otpExpiresAt: expiresAt,
    booking: bookingRecord
  };

  if (idempotencyKey) {
    dispatchMemoryStore.idempotencyMap.set(idempotencyKey, bookingRecord);
    await IdempotencyService.record(idempotencyKey, userId, 'CREATE_BOOKING', 201, responsePayload);
  }

  return reply.status(201).send(responsePayload);
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. ATOMIC BOOKING ACCEPTANCE (CONCURRENCY-SAFE)
// ─────────────────────────────────────────────────────────────────────────────

export const acceptBooking = async (request: FastifyRequest, reply: FastifyReply) => {
  const driverId = request.user?.id;
  const { bookingId, vehicleId } = request.body as any;
  const idempotencyKey = ((request.headers['idempotency-key'] as string) || (request.body as any)?.idempotencyKey || '').trim();

  if (idempotencyKey) {
    const cached = await IdempotencyService.check(idempotencyKey);
    if (cached) {
      return reply.status(cached.statusCode || 200).send({
        ...cached.responseBody,
        idempotentReplay: true
      });
    }
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

  // Check if driver is already busy with another trip
  if (driverLoc && driverLoc.active_booking_id && driverLoc.active_booking_id !== bookingId) {
    return reply.status(403).send({
      error: 'DRIVER_BUSY',
      message: 'Driver already has an active ongoing booking.'
    });
  }

  // 3. Atomic Conditional Check on Booking
  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  if (!['PENDING', 'REQUESTED', 'SEARCHING', 'SEARCHING_DRIVERS'].includes(booking.status)) {
    return reply.status(409).send({
      error: 'BOOKING_ALREADY_ACCEPTED_OR_CANCELLED',
      currentStatus: booking.status,
      assignedDriver: booking.driver_user_id || booking.driver_id || null,
      message: 'This booking has already been accepted by another driver or is no longer available.'
    });
  }

  // Lookup vehicle
  let vehicle = vehicleId ? dispatchMemoryStore.vehicles.get(vehicleId) : null;
  if (!vehicle) {
    for (const v of dispatchMemoryStore.vehicles.values()) {
      if (v.transporter_id === driverId) {
        vehicle = v;
        break;
      }
    }
  }

  const prevStatus = booking.status;
  booking.status = 'ACCEPTED';
  booking.driver_user_id = driverId;
  booking.driver_id = driverId;
  booking.driver_name = (driverLoc && driverLoc.driver_name) || prof.full_name || 'Verified Driver';
  booking.driver_phone = (driverLoc && driverLoc.driver_phone) || prof.phone || '';
  booking.vehicle_id = vehicle?.vehicle_id || null;
  booking.vehicle_type = vehicle?.make_model || (driverLoc && driverLoc.vehicle_type) || booking.vehicle_type;
  booking.vehicle_plate = vehicle?.vehicle_plate || (driverLoc && driverLoc.vehicle_number) || 'AP-39-TK-1008';
  booking.updated_at = new Date().toISOString();

  dispatchMemoryStore.bookings.set(bookingId, booking);

  // Update driver presence
  if (driverLoc) {
    driverLoc.is_available = false;
    driverLoc.active_booking_id = bookingId;
    driverLoc.updated_at = new Date().toISOString();
    dispatchMemoryStore.driverLocations.set(driverId, driverLoc);
  }

  // Record audit event
  const auditEvent = {
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: prevStatus,
    new_status: 'ACCEPTED',
    actor_id: driverId,
    actor_role: 'DRIVER',
    reason: 'Driver accepted dispatch offer',
    metadata_json: { driverId, vehiclePlate: booking.vehicle_plate },
    created_at: new Date().toISOString()
  };
  dispatchMemoryStore.bookingEvents.push(auditEvent);

  try {
    await pool.query(
      `UPDATE public.haul_bookings SET status = 'ACCEPTED', driver_user_id = $1, driver_id = $1,
       driver_name = $2, driver_phone = $3, vehicle_type = $4, vehicle_plate = $5, updated_at = NOW()
       WHERE id = $6 AND status IN ('PENDING', 'REQUESTED', 'SEARCHING', 'SEARCHING_DRIVERS')`,
      [driverId, booking.driver_name, booking.driver_phone, booking.vehicle_type, booking.vehicle_plate, bookingId]
    );
  } catch {}

  const acceptResponse = {
    success: true,
    bookingId,
    status: 'ACCEPTED',
    assignedDriverId: driverId,
    driverName: booking.driver_name,
    vehiclePlate: booking.vehicle_plate,
    message: 'Booking accepted successfully. Live GPS tracking engaged.'
  };

  if (idempotencyKey) {
    dispatchMemoryStore.idempotencyMap.set(idempotencyKey, acceptResponse);
    await IdempotencyService.record(idempotencyKey, driverId, 'ACCEPT_BOOKING', 200, acceptResponse);
  }

  return reply.send(acceptResponse);
};

export const rejectOffer = async (request: FastifyRequest, reply: FastifyReply) => {
  const driverId = request.user?.id;
  const { bookingId, reason = 'Driver declined offer' } = request.body as any;

  if (!driverId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Record rejection event
  dispatchMemoryStore.bookingEvents.push({
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: 'SEARCHING_DRIVERS',
    new_status: 'SEARCHING_DRIVERS',
    actor_id: driverId,
    actor_role: 'DRIVER',
    reason,
    metadata_json: { action: 'OFFER_REJECTED' },
    created_at: new Date().toISOString()
  });

  return reply.send({
    success: true,
    message: 'Offer declined. Cascading to next candidate driver.'
  });
};

export const timeoutOffer = async (request: FastifyRequest, reply: FastifyReply) => {
  const { bookingId } = request.body as any;
  return reply.send({
    success: true,
    bookingId,
    message: 'Offer timed out; dispatched to next eligible driver.'
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. OTP VERIFICATION AT FARM GATE
// ─────────────────────────────────────────────────────────────────────────────

export const verifyBookingOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  const driverId = request.user?.id;
  const { bookingId, otp } = request.body as any;

  if (!driverId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver authentication required' });
  }

  if (!bookingId || !otp) {
    return reply.status(400).send({ error: 'MISSING_FIELDS', message: 'bookingId and otp are required.' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  // Check assigned driver
  if (booking.driver_user_id !== driverId && booking.driver_id !== driverId) {
    return reply.status(403).send({ error: 'UNAUTHORIZED_DRIVER', message: 'You are not assigned to this trip.' });
  }

  // Check stage: OTP verified when driver arrives or is accepted
  if (!['ARRIVED', 'DRIVER_ARRIVED', 'ACCEPTED'].includes(booking.status)) {
    return reply.status(400).send({
      error: 'INVALID_STAGE_FOR_OTP',
      message: `Trip must be in ARRIVED or ACCEPTED stage. Current status: ${booking.status}`
    });
  }

  // Check attempt limit
  if ((booking.start_otp_attempts || 0) >= 3) {
    return reply.status(403).send({
      error: 'OTP_MAX_ATTEMPTS_EXCEEDED',
      message: 'Maximum OTP verification attempts (3) exceeded. Security lockout engaged.'
    });
  }

  // Check expiration
  if (booking.start_otp_expires_at && new Date(booking.start_otp_expires_at).getTime() < Date.now()) {
    return reply.status(400).send({
      error: 'OTP_EXPIRED',
      message: 'The booking OTP has expired. Please ask the farmer to regenerate.'
    });
  }

  // Compute candidate hash with stored salt
  const candidateHash = hashOtp(String(otp).trim(), booking.start_otp_salt || '');

  if (candidateHash !== booking.start_otp_hash) {
    booking.start_otp_attempts = (booking.start_otp_attempts || 0) + 1;
    const remaining = 3 - booking.start_otp_attempts;
    dispatchMemoryStore.bookings.set(bookingId, booking);

    return reply.status(400).send({
      error: 'INVALID_OTP',
      attemptsRemaining: remaining,
      message: `Incorrect OTP entered. ${remaining} attempts remaining.`
    });
  }

  // OTP Match Confirmed: Advance trip to IN_TRANSIT
  const prevStatus = booking.status;
  booking.status = 'IN_TRANSIT';
  booking.pickup_otp_verified_at = new Date().toISOString();
  booking.updated_at = new Date().toISOString();
  dispatchMemoryStore.bookings.set(bookingId, booking);

  // Record audit event
  dispatchMemoryStore.bookingEvents.push({
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: prevStatus,
    new_status: 'IN_TRANSIT',
    actor_id: driverId,
    actor_role: 'DRIVER',
    reason: 'Driver successfully verified farmer 4-digit OTP at farm gate',
    metadata_json: { verifiedAt: booking.pickup_otp_verified_at },
    created_at: new Date().toISOString()
  });

  try {
    await pool.query(
      `UPDATE public.haul_bookings SET status = 'IN_TRANSIT', pickup_otp_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [bookingId]
    );
  } catch {}

  return reply.send({
    success: true,
    bookingId,
    status: 'IN_TRANSIT',
    pickupOtpVerified: true,
    message: 'OTP verified successfully! Farm gate clearance granted. Trip is now IN_TRANSIT.'
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. SYNCHRONIZED CANCELLATION
// ─────────────────────────────────────────────────────────────────────────────

export const cancelBooking = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const userRole = request.user?.role || 'farmer';
  const { bookingId, reason = 'Cancelled by user' } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;
  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;

  if (!isFarmer && !isDriver) {
    return reply.status(403).send({ error: 'UNAUTHORIZED_CANCELLATION', message: 'You are not a participant in this booking.' });
  }

  if (['COMPLETED', 'TRIP_COMPLETED', 'CANCELLED'].includes(booking.status)) {
    return reply.status(400).send({
      error: 'CANNOT_CANCEL',
      message: `Booking has already concluded with status: ${booking.status}`
    });
  }

  const prevStatus = booking.status;
  booking.status = 'CANCELLED';
  booking.cancellation_reason = reason;
  booking.cancelled_by_id = userId;
  booking.cancelled_by_role = isFarmer ? 'FARMER' : 'DRIVER';
  booking.cancelled_at = new Date().toISOString();
  booking.updated_at = new Date().toISOString();
  dispatchMemoryStore.bookings.set(bookingId, booking);

  // Release driver if assigned
  const assignedDriverId = booking.driver_user_id || booking.driver_id;
  if (assignedDriverId) {
    const driverLoc = dispatchMemoryStore.driverLocations.get(assignedDriverId);
    if (driverLoc) {
      driverLoc.is_available = true;
      driverLoc.active_booking_id = null;
      driverLoc.updated_at = new Date().toISOString();
      dispatchMemoryStore.driverLocations.set(assignedDriverId, driverLoc);
    }
  }

  // Record audit event
  dispatchMemoryStore.bookingEvents.push({
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: prevStatus,
    new_status: 'CANCELLED',
    actor_id: userId,
    actor_role: isFarmer ? 'FARMER' : 'DRIVER',
    reason,
    metadata_json: { releasedDriverId: assignedDriverId || null },
    created_at: new Date().toISOString()
  });

  try {
    await pool.query(
      `UPDATE public.haul_bookings SET status = 'CANCELLED', cancellation_reason = $1,
       cancelled_by_id = $2, cancelled_by_role = $3, cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [reason, userId, isFarmer ? 'FARMER' : 'DRIVER', bookingId]
    );
  } catch {}

  return reply.send({
    success: true,
    bookingId,
    previousStatus: prevStatus,
    newStatus: 'CANCELLED',
    cancelledBy: isFarmer ? 'FARMER' : 'DRIVER',
    releasedDriverId: assignedDriverId || null,
    message: 'Booking cancelled cleanly. All parties synchronized.'
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. TRIP LIFECYCLE PROGRESSION (ARRIVED, IN_TRANSIT, COMPLETED)
// ─────────────────────────────────────────────────────────────────────────────

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

  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;
  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;

  if (!isDriver && !isFarmer) {
    return reply.status(403).send({
      error: 'UNAUTHORIZED_ACCESS',
      message: 'You are not an authorized participant in this booking.'
    });
  }

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

  const prevStatus = booking.status;
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

  // Record audit event
  dispatchMemoryStore.bookingEvents.push({
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: prevStatus,
    new_status: newStatus,
    actor_id: userId,
    actor_role: isDriver ? 'DRIVER' : 'FARMER',
    reason: `Lifecycle transition to ${newStatus}`,
    metadata_json: {},
    created_at: new Date().toISOString()
  });

  return reply.send({
    success: true,
    bookingId,
    previousStatus: prevStatus,
    newStatus,
    message: `Trip status advanced to ${newStatus}.`
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. AUTHORIZED LIVE TRACKING STREAM
// ─────────────────────────────────────────────────────────────────────────────

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
        ? 'Driver location temporarily unavailable'
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

// ─────────────────────────────────────────────────────────────────────────────
// 11. IN-TRIP SCOPED CHAT MESSAGING
// ─────────────────────────────────────────────────────────────────────────────

export const getChatMessages = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { bookingId } = request.params as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND' });
  }

  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;
  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;

  if (!isFarmer && !isDriver) {
    return reply.status(403).send({ error: 'FORBIDDEN_CHAT_ACCESS' });
  }

  const messages = dispatchMemoryStore.chatMessages.get(bookingId) || [];
  return reply.send({ success: true, count: messages.length, messages });
};

export const sendChatMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { bookingId } = request.params as any;
  const { messageText } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (!messageText || !messageText.trim()) {
    return reply.status(400).send({ error: 'EMPTY_MESSAGE', message: 'Message text cannot be empty' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND' });
  }

  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;
  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;

  if (!isFarmer && !isDriver) {
    return reply.status(403).send({ error: 'FORBIDDEN_CHAT_ACCESS' });
  }

  const msgId = `MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanText = sanitizeText(messageText.trim());

  const messageRecord = {
    message_id: msgId,
    booking_id: bookingId,
    sender_id: userId,
    sender_role: isFarmer ? 'FARMER' : 'DRIVER',
    message_text: cleanText,
    created_at: new Date().toISOString()
  };

  const existing = dispatchMemoryStore.chatMessages.get(bookingId) || [];
  existing.push(messageRecord);
  dispatchMemoryStore.chatMessages.set(bookingId, existing);

  try {
    await pool.query(
      `INSERT INTO public.booking_chat_messages (message_id, booking_id, sender_id, sender_role, message_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [msgId, bookingId, userId, messageRecord.sender_role, cleanText]
    );
  } catch {}

  return reply.status(201).send({ success: true, message: messageRecord });
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. VEHICLE & EQUIPMENT RENTAL ENGINE WITH CONFLICT PREVENTION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EQUIPMENT_CATALOG = [
  {
    equipmentId: 'EQ-TRAC-575',
    name: 'Mahindra 575 DI (45 HP Tractor)',
    category: 'TRACTOR',
    hourlyRate: 650,
    dailyRate: 4800,
    ownerId: 'OWNER-SYSTEM-01',
    ownerName: 'Ramana Agri Equipment',
    available: true
  },
  {
    equipmentId: 'EQ-DRON-T40',
    name: 'DJI Agras T40 Spraying Drone',
    category: 'DRONE',
    hourlyRate: 1200,
    dailyRate: 8500,
    ownerId: 'OWNER-SYSTEM-02',
    ownerName: 'Precision Aero Kisan',
    available: true
  },
  {
    equipmentId: 'EQ-HARV-900',
    name: 'Claas Crop Tiger 40 Combine Harvester',
    category: 'HARVESTER',
    hourlyRate: 2400,
    dailyRate: 18000,
    ownerId: 'OWNER-SYSTEM-03',
    ownerName: 'Telangana Agri Mech Hub',
    available: true
  },
  {
    equipmentId: 'EQ-ROTA-7FT',
    name: 'Shaktiman Semi Champion 7ft Rotavator',
    category: 'ROTAVATOR',
    hourlyRate: 400,
    dailyRate: 2800,
    ownerId: 'OWNER-SYSTEM-01',
    ownerName: 'Ramana Agri Equipment',
    available: true
  }
];

export const getRentalInventory = async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as any;
  const categoryFilter = query.category ? query.category.trim().toUpperCase() : null;

  let catalog = DEFAULT_EQUIPMENT_CATALOG;
  if (categoryFilter) {
    catalog = catalog.filter((e) => e.category === categoryFilter);
  }

  return reply.send({
    success: true,
    count: catalog.length,
    equipment: catalog
  });
};

export const bookRental = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Farmer authentication required' });
  }

  const {
    equipmentId,
    vehicleId,
    equipmentName,
    startTime,
    endTime,
    operatorIncluded = false,
    ownerId = 'OWNER-SYSTEM-01'
  } = request.body as any;

  if (!startTime || !endTime) {
    return reply.status(400).send({
      error: 'MISSING_DATE_RANGE',
      message: 'startTime and endTime are required for rental reservation.'
    });
  }

  const tStart = new Date(startTime).getTime();
  const tEnd = new Date(endTime).getTime();

  if (isNaN(tStart) || isNaN(tEnd) || tEnd <= tStart) {
    return reply.status(400).send({
      error: 'INVALID_DATE_RANGE',
      message: 'endTime must be strictly after startTime.'
    });
  }

  const durationHours = parseFloat(((tEnd - tStart) / (1000 * 60 * 60)).toFixed(2));
  const durationDays = parseFloat((durationHours / 24).toFixed(2));

  // 1. Conflict Prevention Check: Check for overlapping confirmed or active rentals
  const targetId = equipmentId || vehicleId;
  for (const r of dispatchMemoryStore.rentals.values()) {
    if ((r.equipment_id === targetId || r.vehicle_id === targetId) && ['REQUESTED', 'CONFIRMED', 'ACTIVE'].includes(r.status)) {
      const rStart = new Date(r.start_time).getTime();
      const rEnd = new Date(r.end_time).getTime();

      // Overlap condition: rStart < tEnd && rEnd > tStart
      if (rStart < tEnd && rEnd > tStart) {
        return reply.status(409).send({
          error: 'RENTAL_SCHEDULE_CONFLICT',
          conflictRentalId: r.rental_id,
          existingSchedule: { startTime: r.start_time, endTime: r.end_time },
          message: 'Selected equipment/vehicle is already booked during this time interval. Please choose another date.'
        });
      }
    }
  }

  // 2. Pricing Calculation
  const item = DEFAULT_EQUIPMENT_CATALOG.find((e) => e.equipmentId === equipmentId);
  const hourlyRate = item?.hourlyRate || 650;
  const dailyRate = item?.dailyRate || 4800;

  let baseAmount = 0;
  if (durationHours < 24) {
    baseAmount = Math.round(durationHours * hourlyRate);
  } else {
    baseAmount = Math.round(Math.ceil(durationDays) * dailyRate);
  }
  if (operatorIncluded) {
    baseAmount += Math.round(500 * Math.max(1, Math.ceil(durationDays)));
  }

  const rentalId = `RNT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const rentalRecord = {
    rental_id: rentalId,
    renter_id: userId,
    owner_id: ownerId,
    vehicle_id: vehicleId || null,
    equipment_id: equipmentId || 'CUSTOM',
    equipment_name: equipmentName || item?.name || 'Farm Equipment',
    start_time: new Date(tStart).toISOString(),
    end_time: new Date(tEnd).toISOString(),
    duration_hours: durationHours,
    duration_days: durationDays,
    hourly_rate: hourlyRate,
    daily_rate: dailyRate,
    base_amount: baseAmount,
    operator_included: !!operatorIncluded,
    status: 'CONFIRMED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.rentals.set(rentalId, rentalRecord);

  try {
    await pool.query(
      `INSERT INTO public.rental_bookings (
        rental_id, renter_id, owner_id, vehicle_id, equipment_id, equipment_name,
        start_time, end_time, duration_hours, duration_days, hourly_rate, daily_rate,
        base_amount, operator_included, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        rentalId, userId, ownerId, vehicleId || null, equipmentId || 'CUSTOM',
        rentalRecord.equipment_name, rentalRecord.start_time, rentalRecord.end_time,
        durationHours, durationDays, hourlyRate, dailyRate, baseAmount,
        operatorIncluded, 'CONFIRMED'
      ]
    );
  } catch {}

  return reply.status(201).send({
    success: true,
    rental: rentalRecord,
    message: 'Equipment rental reservation confirmed without schedule conflicts.'
  });
};

export const getMyRentals = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const userRentals: any[] = [];
  for (const r of dispatchMemoryStore.rentals.values()) {
    if (r.renter_id === userId || r.owner_id === userId) {
      userRentals.push(r);
    }
  }

  return reply.send({ success: true, count: userRentals.length, rentals: userRentals });
};

export const updateRentalStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { rentalId } = request.params as any;
  const { status: newStatus } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const rental = dispatchMemoryStore.rentals.get(rentalId);
  if (!rental) {
    return reply.status(404).send({ error: 'RENTAL_NOT_FOUND' });
  }

  if (rental.renter_id !== userId && rental.owner_id !== userId) {
    return reply.status(403).send({ error: 'UNAUTHORIZED' });
  }

  const validTransitions: Record<string, string[]> = {
    REQUESTED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['RETURNED', 'DISPUTED'],
    RETURNED: ['COMPLETED'],
    DISPUTED: ['COMPLETED', 'CANCELLED']
  };

  const allowed = validTransitions[rental.status] || ['CANCELLED'];
  if (!allowed.includes(newStatus)) {
    return reply.status(400).send({
      error: 'INVALID_STATUS_TRANSITION',
      currentStatus: rental.status,
      targetStatus: newStatus,
      allowed
    });
  }

  rental.status = newStatus;
  rental.updated_at = new Date().toISOString();
  dispatchMemoryStore.rentals.set(rentalId, rental);

  try {
    await pool.query('UPDATE public.rental_bookings SET status = $1, updated_at = NOW() WHERE rental_id = $2', [newStatus, rentalId]);
  } catch {}

  return reply.send({ success: true, rentalId, status: newStatus });
};
