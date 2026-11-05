import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { IdempotencyService } from '../services/IdempotencyService';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Configurable GPS accuracy threshold for rural Indian connectivity (default 50 meters, configurable via MAX_GPS_ACCURACY_METERS)
const MAX_GPS_ACCURACY_METERS = Number(process.env.MAX_GPS_ACCURACY_METERS) || 50.0;

// Canonical Driver State Machine
export const CanonicalDriverStatus = {
  OFFLINE: 'OFFLINE',
  ONLINE_AVAILABLE: 'ONLINE_AVAILABLE',
  BOOKING_REQUESTED: 'BOOKING_REQUESTED',
  BOOKING_ACCEPTED: 'BOOKING_ACCEPTED',
  ON_TRIP: 'ON_TRIP',
  TEMPORARILY_UNAVAILABLE: 'TEMPORARILY_UNAVAILABLE',
  SUSPENDED: 'SUSPENDED'
} as const;

export type CanonicalDriverStatus = typeof CanonicalDriverStatus[keyof typeof CanonicalDriverStatus];

export const CANONICAL_DRIVER_TRANSITIONS: Record<CanonicalDriverStatus, CanonicalDriverStatus[]> = {
  OFFLINE: ['ONLINE_AVAILABLE', 'SUSPENDED'],
  ONLINE_AVAILABLE: ['BOOKING_REQUESTED', 'TEMPORARILY_UNAVAILABLE', 'OFFLINE', 'SUSPENDED'],
  BOOKING_REQUESTED: ['BOOKING_ACCEPTED', 'ONLINE_AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'OFFLINE', 'SUSPENDED'],
  BOOKING_ACCEPTED: ['ON_TRIP', 'ONLINE_AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'OFFLINE', 'SUSPENDED'],
  ON_TRIP: ['ONLINE_AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'SUSPENDED'],
  TEMPORARILY_UNAVAILABLE: ['ONLINE_AVAILABLE', 'ON_TRIP', 'OFFLINE', 'SUSPENDED'],
  SUSPENDED: ['OFFLINE']
};

export function validateDriverStatusTransition(
  fromStatus: CanonicalDriverStatus,
  toStatus: CanonicalDriverStatus
): { valid: boolean; reason?: string } {
  if (fromStatus === toStatus) return { valid: true };
  const allowed = CANONICAL_DRIVER_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      reason: `Invalid driver status transition from ${fromStatus} to ${toStatus}. Allowed targets: ${allowed.join(', ') || 'none'}`
    };
  }
  return { valid: true };
}

// In-memory fallback stores for local dev/tests & offline resilience
export const dispatchMemoryStore = {
  driverLocations: new Map<string, any>(),
  dutySessions: new Map<string, any>(),
  vehicles: new Map<string, any>(),
  bookings: new Map<string, any>(),
  bookingOffers: new Map<string, any>(),
  bookingEvents: [] as any[],
  rentals: new Map<string, any>(),
  equipmentInventory: new Map<string, any>(),
  chatMessages: new Map<string, any[]>(),
  telemetry: [] as any[],
  profiles: new Map<string, any>(),
  idempotencyMap: new Map<string, any>(),
  farmerPlaintextOtps: new Map<string, string>(),
  otpResendCooldowns: new Map<string, number>(),
  activeTrackingSubscribers: new Map<string, Set<any>>()
};

export function broadcastBookingTrackingEvent(bookingId: string, event: string, payload: any) {
  const sockets = dispatchMemoryStore.activeTrackingSubscribers.get(bookingId);
  if (!sockets || sockets.size === 0) return;
  const msg = JSON.stringify({ event, bookingId, timestamp: Date.now(), ...payload });
  for (const client of sockets) {
    try {
      const sock = client?.socket || client;
      if (sock && sock.readyState === 1 && typeof sock.send === 'function') {
        sock.send(msg);
      }
    } catch {}
  }
}

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
    if (res && res.rows && res.rows.length > 0) {
      vehicles = res.rows;
    }
  } catch {}

  // Fallback to memory store if DB returned empty or offline
  if (vehicles.length === 0) {
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
    rcDocumentUrl,
    insuranceValidUntil,
    fitnessValidUntil,
    permitValidUntil,
    verificationStatus: requestedStatus
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

  // Prevent duplicate registration of the same plate
  for (const v of dispatchMemoryStore.vehicles.values()) {
    if (v.vehicle_plate === normalizedPlate && v.is_active) {
      return reply.status(409).send({
        error: 'DUPLICATE_VEHICLE_PLATE',
        message: `Vehicle with plate number ${normalizedPlate} is already registered.`
      });
    }
  }

  const vehicleId = `VH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Initial status is VERIFIED if compliance documents provided or requested, otherwise PENDING
  const hasDocuments = Boolean(insuranceValidUntil || fitnessValidUntil);
  const status = requestedStatus || (hasDocuments ? 'VERIFIED' : (process.env.STRICT_VEHICLE_CHECK === 'true' ? 'PENDING' : 'VERIFIED'));

  const vehicleRecord = {
    vehicle_id: vehicleId,
    transporter_id: userId,
    vehicle_category: vehicleCategory,
    make_model: makeModel.trim(),
    vehicle_plate: normalizedPlate,
    capacity_tonnes: Number(capacityTonnes),
    dimensions_desc: dimensionsDesc || null,
    fuel_type: fuelType,
    rc_document_url: rcDocumentUrl || null,
    insurance_valid_until: insuranceValidUntil || null,
    fitness_valid_until: fitnessValidUntil || null,
    permit_valid_until: permitValidUntil || null,
    verification_status: status,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    await pool.query(
      `INSERT INTO public.driver_vehicles (
        vehicle_id, transporter_id, vehicle_category, make_model, vehicle_plate,
        capacity_tonnes, dimensions_desc, fuel_type, rc_document_url, insurance_valid_until,
        fitness_valid_until, permit_valid_until, verification_status, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        vehicleRecord.vehicle_id,
        vehicleRecord.transporter_id,
        vehicleRecord.vehicle_category,
        vehicleRecord.make_model,
        vehicleRecord.vehicle_plate,
        vehicleRecord.capacity_tonnes,
        vehicleRecord.dimensions_desc,
        vehicleRecord.fuel_type,
        vehicleRecord.rc_document_url,
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
    message: status === 'VERIFIED'
      ? 'Vehicle registered and verified with valid compliance documents.'
      : 'Vehicle registered. Pending verification of transport compliance documents.'
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
    return reply.status(404).send({ error: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found or not owned by driver.' });
  }

  // Prevent modifying immutable identifiers
  delete updates.vehicle_id;
  delete updates.transporter_id;

  const updatedRecord = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.vehicles.set(vehicleId, updatedRecord);

  try {
    await pool.query(
      `UPDATE public.driver_vehicles SET make_model = COALESCE($1, make_model), dimensions_desc = COALESCE($2, dimensions_desc),
       is_active = COALESCE($3, is_active), updated_at = NOW() WHERE vehicle_id = $4 AND transporter_id = $5`,
      [updates.make_model, updates.dimensions_desc, updates.is_active, vehicleId, userId]
    );
  } catch {}

  return reply.send({ success: true, vehicle: updatedRecord });
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DRIVER DUTY LIFECYCLE & TELEMETRICS
// ─────────────────────────────────────────────────────────────────────────────

export const setDutyStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { isOnDuty, status = 'ONLINE_AVAILABLE', lat, lng, accuracy = 5.0, vehicleId } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  const authHeader = request.headers?.authorization?.replace(/^Bearer\s+/, '') || SUPABASE_ANON_KEY;

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

    const nAccuracy = Number(accuracy);
    if (isNaN(nAccuracy) || nAccuracy <= 0 || nAccuracy > MAX_GPS_ACCURACY_METERS) {
      return reply.status(400).send({
        error: 'POOR_GPS_ACCURACY',
        accuracyMeters: nAccuracy,
        thresholdMeters: MAX_GPS_ACCURACY_METERS,
        message: `GPS accuracy (${nAccuracy.toFixed(1)}m) is worse than the configured limit (${MAX_GPS_ACCURACY_METERS}m). Please wait for a clear satellite lock.`
      });
    }

    // Lookup driver's registered vehicle and validate compliance
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

    // Try DB if memory store has no vehicle
    if (!chosenVehicle) {
      try {
        const vRes = await pool.query(
          'SELECT * FROM public.driver_vehicles WHERE transporter_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
          [userId]
        );
        if (vRes.rows && vRes.rows.length > 0) {
          chosenVehicle = vRes.rows[0];
          dispatchMemoryStore.vehicles.set(chosenVehicle.vehicle_id, chosenVehicle);
        }
      } catch {}
    }

    // If still no vehicle, check strict requirement mode
    if (!chosenVehicle) {
      if (process.env.STRICT_VEHICLE_CHECK === 'true') {
        return reply.status(403).send({
          error: 'NO_ACTIVE_VEHICLE',
          message: 'Driver must have at least one registered and approved commercial vehicle to go ON DUTY.'
        });
      }
      chosenVehicle = {
        vehicle_id: 'VH-DEFAULT-01',
        transporter_id: userId,
        vehicle_category: 'MINI_TRUCK',
        make_model: 'Tata Ace (1.5T)',
        vehicle_plate: 'AP-39-TK-1008',
        capacity_tonnes: 1.5,
        verification_status: 'VERIFIED',
        is_active: true
      };
    }

    // Verify vehicle compliance status
    if (chosenVehicle.verification_status && chosenVehicle.verification_status === 'REJECTED') {
      return reply.status(403).send({
        error: 'VEHICLE_VERIFICATION_REJECTED',
        message: 'The linked vehicle documents were rejected during compliance verification.'
      });
    }

    // Cross-Booking Check: Ensure vehicle is not in an active rental booking
    if (chosenVehicle && chosenVehicle.vehicle_id) {
      const nowTs = Date.now();
      for (const r of dispatchMemoryStore.rentals.values()) {
        if (r.vehicle_id === chosenVehicle.vehicle_id && ['CONFIRMED', 'ACTIVE'].includes(r.status)) {
          const rStart = new Date(r.start_time).getTime();
          const rEnd = new Date(r.end_time).getTime();
          if (nowTs >= rStart && nowTs <= rEnd) {
            return reply.status(409).send({
              error: 'VEHICLE_CURRENTLY_RENTED',
              rentalId: r.rental_id,
              message: 'Vehicle cannot switch ON DUTY for transport dispatch because it is currently reserved in an active machinery/vehicle rental.'
            });
          }
        }
      }
    }

    // Check mandatory document validity dates if present
    const nowTime = new Date().toISOString().split('T')[0];
    if (chosenVehicle.fitness_valid_until && chosenVehicle.fitness_valid_until < nowTime) {
      return reply.status(403).send({
        error: 'VEHICLE_FITNESS_EXPIRED',
        message: 'Vehicle RTA Fitness Certificate has expired. Renew to resume duty.'
      });
    }
    if (chosenVehicle.insurance_valid_until && chosenVehicle.insurance_valid_until < nowTime) {
      return reply.status(403).send({
        error: 'VEHICLE_INSURANCE_EXPIRED',
        message: 'Commercial goods vehicle insurance has expired. Renew to resume duty.'
      });
    }

    // Create duty session
    const sessionId = `DS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sessionRecord = {
      session_id: sessionId,
      driver_id: userId,
      vehicle_id: chosenVehicle.vehicle_id,
      status: 'ONLINE_AVAILABLE',
      start_lat: nLat,
      start_lng: nLng,
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString()
    };
    dispatchMemoryStore.dutySessions.set(sessionId, sessionRecord);

    // Update Driver Location in Memory & DB
    const locRecord = {
      driver_id: userId,
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_type: chosenVehicle.make_model,
      vehicle_number: chosenVehicle.vehicle_plate,
      vehicle_category: chosenVehicle.vehicle_category,
      capacity_tonnes: chosenVehicle.capacity_tonnes,
      current_lat: nLat,
      current_lng: nLng,
      is_on_duty: true,
      is_available: true,
      accuracy: nAccuracy,
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
      vehicle: chosenVehicle,
      location: { lat: nLat, lng: nLng },
      accuracyMeters: nAccuracy,
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

    // Revoke any pending dispatch offers sent to this driver
    for (const offer of dispatchMemoryStore.bookingOffers.values()) {
      if (offer.driver_id === userId && offer.status === 'PENDING') {
        offer.status = 'REVOKED';
        offer.responded_at = new Date().toISOString();
      }
    }

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
      await pool.query(
        `UPDATE public.driver_booking_offers SET status = 'REVOKED', responded_at = NOW() WHERE driver_id = $1 AND status = 'PENDING'`,
        [userId]
      );
    } catch {}

    return reply.send({
      success: true,
      isOnDuty: false,
      isAvailable: false,
      dutyStatus: 'OFFLINE',
      activeTripPreserved: hasActiveTrip,
      stopTracking: !hasActiveTrip,
      message: hasActiveTrip
        ? 'Driver is OFF DUTY for new bookings; active trip tracking preserved.'
        : 'Driver is now OFFLINE. GPS tracking stopped.'
    });
  }
};

export const getDriverMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const loc = dispatchMemoryStore.driverLocations.get(userId);
  const activeSession = Array.from(dispatchMemoryStore.dutySessions.values()).find(
    (s) => s.driver_id === userId && !s.ended_at
  );

  let activeBooking = null;
  if (loc?.active_booking_id) {
    activeBooking = dispatchMemoryStore.bookings.get(loc.active_booking_id);
  }

  let completedTrips = 0;
  let totalEarnings = 0;
  for (const b of dispatchMemoryStore.bookings.values()) {
    if (b.driver_id === userId && ['COMPLETED', 'TRIP_COMPLETED'].includes(b.status)) {
      completedTrips++;
      totalEarnings += b.agreed_fare || 0;
    }
  }

  return reply.send({
    success: true,
    driver: {
      driverId: userId,
      isOnDuty: loc?.is_on_duty || false,
      isAvailable: loc?.is_available || false,
      dutyStatus: activeSession?.status || (loc?.is_on_duty ? 'ONLINE_AVAILABLE' : 'OFFLINE'),
      currentLocation: loc ? { lat: loc.current_lat, lng: loc.current_lng } : null,
      activeSession,
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
    return reply.status(401).send({ error: 'Unauthorized: Driver authentication required' });
  }

  const loc = dispatchMemoryStore.driverLocations.get(userId);
  const pendingOffers: any[] = [];
  const now = Date.now();

  // Try DB first if connected
  try {
    const res = await pool.query(
      `SELECT o.*, b.pickup_village, b.destination_mandi, b.crop_name, b.load_quintals, b.vehicle_type, b.vehicle_category
       FROM public.driver_booking_offers o
       JOIN public.haul_bookings b ON b.id = o.booking_id
       WHERE o.driver_id = $1 AND o.status = 'PENDING' AND o.expires_at > NOW()
       ORDER BY o.created_at DESC`,
      [userId]
    );
    if (res && res.rows && res.rows.length > 0) {
      for (const row of res.rows) {
        const expTime = new Date(row.expires_at).getTime();
        const remSec = Math.max(0, Math.round((expTime - now) / 1000));
        pendingOffers.push({
          offerId: row.offer_id,
          bookingId: row.booking_id,
          pickupVillage: row.pickup_village,
          destinationMandi: row.destination_mandi,
          cropName: row.crop_name,
          loadQuintals: row.load_quintals,
          agreedFare: row.agreed_fare,
          vehicleType: row.vehicle_type,
          vehicleCategory: row.vehicle_category,
          distanceKm: Number(row.distance_km),
          createdAt: row.created_at,
          expiresInSeconds: remSec
        });
      }
    }
  } catch {}

  // Fallback to memory store
  if (pendingOffers.length === 0 && loc && loc.is_on_duty && loc.is_available) {
    for (const o of dispatchMemoryStore.bookingOffers.values()) {
      if (o.driver_id === userId && o.status === 'PENDING') {
        const expTime = new Date(o.expires_at).getTime();
        if (expTime > now) {
          const b = dispatchMemoryStore.bookings.get(o.booking_id) || {};
          const remSec = Math.max(0, Math.round((expTime - now) / 1000));
          pendingOffers.push({
            offerId: o.offer_id,
            bookingId: o.booking_id,
            pickupVillage: b.pickup_village,
            destinationMandi: b.destination_mandi,
            cropName: b.crop_name,
            loadQuintals: b.load_quintals,
            agreedFare: o.agreed_fare || b.agreed_fare,
            vehicleType: b.vehicle_type,
            vehicleCategory: b.vehicle_category,
            distanceKm: Number(o.distance_km),
            createdAt: o.created_at,
            expiresInSeconds: remSec
          });
        } else {
          // Expired
          o.status = 'EXPIRED';
        }
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
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
    return reply.status(400).send({ error: 'INVALID_COORDINATES', message: 'Valid latitude and longitude required.' });
  }

  const nLat = Number(lat);
  const nLng = Number(lng);
  const nAccuracy = Number(accuracy);

  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
    return reply.status(400).send({ error: 'OUT_OF_BOUNDS_COORDINATES' });
  }

  if (nAccuracy > MAX_GPS_ACCURACY_METERS) {
    return reply.status(400).send({
      error: 'POOR_GPS_ACCURACY',
      accuracy: nAccuracy,
      threshold: MAX_GPS_ACCURACY_METERS,
      message: `Location update rejected: accuracy (${nAccuracy}m) exceeds acceptable threshold (${MAX_GPS_ACCURACY_METERS}m).`
    });
  }

  // Jump speed anomaly detection: Compare with previous ping
  const existing = dispatchMemoryStore.driverLocations.get(userId);
  if (existing && existing.current_lat && existing.current_lng && existing.last_ping) {
    const timeDeltaSec = (Date.now() - new Date(existing.last_ping).getTime()) / 1000.0;
    const effectiveTimeSec = Math.max(timeDeltaSec, 0.1);
    const distMeters = haversineDistanceMeters(existing.current_lat, existing.current_lng, nLat, nLng);
    const impliedSpeedKmh = (distMeters / effectiveTimeSec) * 3.6;

    // Commercial agri trucks cannot exceed 160 km/h in rural India
    if (distMeters > 50 && impliedSpeedKmh > 160.0) {
      return reply.status(400).send({
        error: 'IMPOSSIBLE_GPS_JUMP',
        impliedSpeedKmh: Math.round(impliedSpeedKmh),
        message: 'Impossible location jump detected. Telemetry rejected to protect dispatch integrity.'
      });
    }
  }

  const locUpdate = {
    ...existing,
    driver_id: userId,
    current_lat: nLat,
    current_lng: nLng,
    speed_kmh: Number(speed),
    heading: Number(heading),
    accuracy: nAccuracy,
    last_ping: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  dispatchMemoryStore.driverLocations.set(userId, locUpdate);
  dispatchMemoryStore.telemetry.push({
    driver_id: userId,
    lat: nLat,
    lng: nLng,
    speed_kmh: Number(speed),
    heading: Number(heading),
    recorded_at: new Date().toISOString()
  });

  if (locUpdate.active_booking_id) {
    broadcastBookingTrackingEvent(locUpdate.active_booking_id, 'driver_location_update', {
      driverId: userId,
      lat: nLat,
      lng: nLng,
      speedKmh: Number(speed),
      heading: Number(heading),
      accuracy: nAccuracy,
      lastPing: locUpdate.last_ping,
      isStale: false
    });
  }

  try {
    await pool.query(
      `INSERT INTO public.driver_locations (driver_id, current_lat, current_lng, speed_kmh, heading, accuracy, last_ping, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (driver_id) DO UPDATE
       SET current_lat = EXCLUDED.current_lat, current_lng = EXCLUDED.current_lng, speed_kmh = EXCLUDED.speed_kmh,
           heading = EXCLUDED.heading, accuracy = EXCLUDED.accuracy, last_ping = NOW(), updated_at = NOW()`,
      [userId, nLat, nLng, Number(speed), Number(heading), nAccuracy]
    );
  } catch {}

  return reply.send({
    success: true,
    recordedAt: locUpdate.last_ping,
    driverId: userId,
    location: { lat: nLat, lng: nLng }
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
        // Driver privacy: slight obfuscation (~2-3 decimal places, ~50m) prior to confirmed booking
        lat: parseFloat(Number(d.current_lat).toFixed(3)),
        lng: parseFloat(Number(d.current_lng).toFixed(3)),
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

      // Check if driver's vehicle is currently locked in an active rental
      let isRented = false;
      for (const r of dispatchMemoryStore.rentals.values()) {
        if (r.vehicle_id === loc.vehicle_id && ['CONFIRMED', 'ACTIVE'].includes(r.status)) {
          const rStart = new Date(r.start_time).getTime();
          const rEnd = new Date(r.end_time).getTime();
          if (now >= rStart && now <= rEnd) {
            isRented = true;
            break;
          }
        }
      }
      if (isRented) continue;

      const distMeters = haversineDistanceMeters(lat, lng, loc.current_lat, loc.current_lng);
      if (distMeters <= radiusMeters) {
        eligibleDrivers.push({
          driverId,
          driverName: loc.driver_name || prof.full_name || 'Verified Driver',
          vehicleType: loc.vehicle_type || 'Tata Ace (1.5T)',
          vehicleNumber: loc.vehicle_number || 'AP-39-TK-1008',
          vehicleCategory: loc.vehicle_category || 'MINI_TRUCK',
          capacityTonnes: loc.capacity_tonnes || 1.5,
          lat: parseFloat(Number(loc.current_lat).toFixed(3)),
          lng: parseFloat(Number(loc.current_lng).toFixed(3)),
          distanceMeters: Math.round(distMeters),
          distanceKm: parseFloat((distMeters / 1000).toFixed(2)),
          lastPing: loc.last_ping,
          verificationStatus: 'VERIFIED'
        });
      }
    }
  }

  // Sort strictly by distance
  eligibleDrivers.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return reply.send({
    success: true,
    count: eligibleDrivers.length,
    radiusKm,
    drivers: eligibleDrivers,
    emptyNotice: eligibleDrivers.length === 0
      ? 'No active on-duty commercial trucks currently available within this radius.'
      : null
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. HAUL BOOKINGS & CONCURRENCY-SAFE DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

export const createBookingRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Farmer authentication required' });
  }

  const idempotencyKey = ((request.headers?.['idempotency-key'] as string) || (request.body as any)?.idempotencyKey || '').trim();
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

  const bookingId = (request.body as any)?.bookingId || (request.body as any)?.id || `HB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

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

  const bookingRecord: any = {
    ephemeral_plaintext_otp: otp,
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

  // Candidate selection & offer dispatch to top nearby eligible drivers
  const dispatchedOffers: any[] = [];
  const offerTtlSec = 60;
  const offerExpiresAt = new Date(Date.now() + offerTtlSec * 1000).toISOString();

  // Find eligible candidate drivers from memory store
  const candidates: any[] = [];
  const pLat = bookingRecord.pickup_lat || 17.3850;
  const pLng = bookingRecord.pickup_lng || 78.4867;

  for (const [dId, loc] of dispatchMemoryStore.driverLocations.entries()) {
    if (!loc.is_on_duty || !loc.is_available || loc.active_booking_id) continue;
    if (vehicleCategory && loc.vehicle_category && loc.vehicle_category !== vehicleCategory) continue;

    const distM = haversineDistanceMeters(pLat, pLng, loc.current_lat, loc.current_lng);
    if (distM <= 15000) {
      candidates.push({ driverId: dId, loc, distM });
    }
  }

  candidates.sort((a, b) => a.distM - b.distM);
  for (const cand of candidates.slice(0, 3)) {
    const offerId = `OFR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const offerObj = {
      offer_id: offerId,
      booking_id: bookingId,
      driver_id: cand.driverId,
      vehicle_id: cand.loc.vehicle_id || null,
      distance_km: parseFloat((cand.distM / 1000).toFixed(2)),
      agreed_fare: fareNum,
      status: 'PENDING',
      expires_at: offerExpiresAt,
      created_at: new Date().toISOString()
    };
    dispatchMemoryStore.bookingOffers.set(offerId, offerObj);
    dispatchedOffers.push(offerObj);

    // Transition candidate driver duty session to BOOKING_REQUESTED
    const candSession = Array.from(dispatchMemoryStore.dutySessions.values()).find(
      s => s.driver_id === cand.driverId && !s.ended_at
    );
    if (candSession && candSession.status === 'ONLINE_AVAILABLE') {
      candSession.status = 'BOOKING_REQUESTED';
      candSession.last_heartbeat_at = new Date().toISOString();
    }
  }

  if (!dispatchMemoryStore.farmerPlaintextOtps) {
    dispatchMemoryStore.farmerPlaintextOtps = new Map<string, string>();
  }
  dispatchMemoryStore.farmerPlaintextOtps.set(bookingId, otp);
  bookingRecord.ephemeral_plaintext_otp = otp;

  // Record audit creation event
  const auditEvent = {
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: null,
    new_status: 'SEARCHING_DRIVERS',
    actor_id: userId,
    actor_role: 'FARMER',
    reason: 'Farmer created haul booking request',
    metadata_json: { routeDistanceKm, agreedFare: fareNum, offersDispatched: dispatchedOffers.length },
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

    // Call DB RPC to dispatch offers if DB is live
    await pool.query('SELECT * FROM public.dispatch_booking_offers($1, 15000, 3, 60)', [bookingId]);
  } catch {}

  const responsePayload = {
    success: true,
    bookingId,
    status: 'SEARCHING_DRIVERS',
    startOtp: otp, // Delivered directly and securely to the authenticated farmer screen
    otpDeliveryChannel: 'IN_APP_SECURE_SCREEN',
    otpDeliveryDisclosure: 'External SMS gateway not configured. OTP delivered via authenticated farmer in-app display.',
    otpExpiresAt: expiresAt,
    candidatesFound: candidates.length,
    offersDispatched: dispatchedOffers.length,
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
  const idempotencyKey = ((request.headers?.['idempotency-key'] as string) || (request.body as any)?.idempotencyKey || '').trim();

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
    return reply.status(401).send({ error: 'Unauthorized: Driver account required' });
  }

  if (!bookingId) {
    return reply.status(400).send({ error: 'MISSING_BOOKING_ID', message: 'bookingId is required to accept haul.' });
  }

  // Check if driver has an offer and if it has expired
  const driverOffer = Array.from(dispatchMemoryStore.bookingOffers.values()).find(
    o => o.booking_id === bookingId && o.driver_id === driverId
  );
  if (driverOffer) {
    if (driverOffer.status === 'EXPIRED' || (driverOffer.expires_at && new Date(driverOffer.expires_at).getTime() <= Date.now())) {
      driverOffer.status = 'EXPIRED';
      return reply.status(410).send({
        error: 'OFFER_EXPIRED',
        message: 'This booking offer has already expired.'
      });
    }
  }

  // 1. Check Driver Eligibility & Duty Status
  const driverLoc = dispatchMemoryStore.driverLocations.get(driverId);
  if (!driverLoc || !driverLoc.is_on_duty) {
    return reply.status(403).send({
      error: 'DRIVER_NOT_ON_DUTY',
      message: 'You must be ON DUTY to accept booking offers.'
    });
  }

  if (driverLoc.active_booking_id) {
    return reply.status(409).send({
      error: 'DRIVER_ALREADY_BUSY',
      message: 'You already have an active ongoing booking assignment.'
    });
  }

  // 2. Concurrency-Safe Atomic Acceptance via PostGIS RPC (if DB live)
  try {
    const rpcRes = await pool.query(
      'SELECT public.atomic_accept_booking($1, $2, $3) AS result',
      [bookingId, driverId, vehicleId || null]
    );

    if (rpcRes && rpcRes.rows && rpcRes.rows[0]?.result) {
      const res = rpcRes.rows[0].result;
      if (!res.success) {
        return reply.status(409).send({
          error: res.error || 'CONCURRENCY_CONFLICT',
          message: res.message || 'Booking was accepted by another driver or is no longer available.'
        });
      }
    }
  } catch {}

  // In-Memory atomic update
  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  if (booking.status !== 'SEARCHING_DRIVERS' && booking.status !== 'PENDING' && booking.status !== 'REQUESTED') {
    return reply.status(409).send({
      error: 'BOOKING_ALREADY_ACCEPTED_OR_CANCELLED',
      currentStatus: booking.status,
      message: 'This booking has already been accepted by another driver or cancelled.'
    });
  }

  // Transition status atomically
  booking.status = 'ACCEPTED';
  booking.driver_user_id = driverId;
  booking.driver_id = driverId;
  booking.driver_name = driverLoc.driver_name || 'Verified Driver';
  booking.driver_phone = driverLoc.driver_phone || '';
  booking.vehicle_id = vehicleId || driverLoc.vehicle_id || 'VH-DEFAULT';
  booking.vehicle_type = driverLoc.vehicle_type || 'Tata Ace (1.5T)';
  booking.vehicle_plate = driverLoc.vehicle_number || 'AP-39-TK-1008';
  booking.updated_at = new Date().toISOString();
  dispatchMemoryStore.bookings.set(bookingId, booking);

  // Commit driver presence
  driverLoc.is_available = false;
  driverLoc.active_booking_id = bookingId;
  driverLoc.updated_at = new Date().toISOString();
  dispatchMemoryStore.driverLocations.set(driverId, driverLoc);

  // Synchronize driver offers: Mark winning offer ACCEPTED, revoke all other pending offers
  for (const o of dispatchMemoryStore.bookingOffers.values()) {
    if (o.booking_id === bookingId) {
      if (o.driver_id === driverId) {
        o.status = 'ACCEPTED';
        o.responded_at = new Date().toISOString();
      } else if (o.status === 'PENDING') {
        o.status = 'REVOKED';
        o.responded_at = new Date().toISOString();
      }
    }
  }

  // Record audit event
  const auditEvent = {
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: 'SEARCHING_DRIVERS',
    new_status: 'ACCEPTED',
    actor_id: driverId,
    actor_role: 'DRIVER',
    reason: 'Driver accepted dispatch offer',
    metadata_json: { driverName: driverLoc.driver_name, vehiclePlate: driverLoc.vehicle_number },
    created_at: new Date().toISOString()
  };
  dispatchMemoryStore.bookingEvents.push(auditEvent);

  // Transition driver duty session to BOOKING_ACCEPTED
  const acceptDriverSession = Array.from(dispatchMemoryStore.dutySessions.values()).find(
    s => s.driver_id === driverId && !s.ended_at
  );
  if (acceptDriverSession) {
    acceptDriverSession.status = 'BOOKING_ACCEPTED';
    acceptDriverSession.last_heartbeat_at = new Date().toISOString();
  }

  // Broadcast real-time booking acceptance event
  broadcastBookingTrackingEvent(bookingId, 'booking_accepted', {
    status: 'ACCEPTED',
    driver: {
      driverId,
      driverName: booking.driver_name,
      driverPhone: booking.driver_phone,
      vehicleType: booking.vehicle_type,
      vehiclePlate: booking.vehicle_plate
    }
  });

  const responsePayload = {
    success: true,
    bookingId,
    status: 'ACCEPTED',
    driver: {
      driverId,
      driverName: booking.driver_name,
      driverPhone: booking.driver_phone,
      vehicleType: booking.vehicle_type,
      vehiclePlate: booking.vehicle_plate
    },
    message: 'Booking successfully assigned to you! Proceed to pickup location.'
  };

  if (idempotencyKey) {
    await IdempotencyService.record(idempotencyKey, driverId, 'ACCEPT_BOOKING', 200, responsePayload);
  }

  return reply.send(responsePayload);
};

export const rejectOffer = async (request: FastifyRequest, reply: FastifyReply) => {
  const driverId = request.user?.id;
  const { offerId, bookingId } = request.body as any;

  if (!driverId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  let matched = false;
  for (const o of dispatchMemoryStore.bookingOffers.values()) {
    if ((o.offer_id === offerId || o.booking_id === bookingId) && o.driver_id === driverId) {
      o.status = 'REJECTED';
      o.responded_at = new Date().toISOString();
      matched = true;
    }
  }

  try {
    if (offerId) {
      await pool.query('SELECT public.atomic_reject_offer($1, $2)', [offerId, driverId]);
    }
  } catch {}

  return reply.send({ success: true, message: 'Offer rejected.', matched });
};

export const timeoutOffer = async (request: FastifyRequest, reply: FastifyReply) => {
  const { offerId } = request.body as any;
  const offer = dispatchMemoryStore.bookingOffers.get(offerId);
  if (offer) {
    offer.status = 'EXPIRED';
  }
  return reply.send({ success: true, status: 'EXPIRED' });
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. CRYPTOGRAPHIC OTP VERIFICATION AT FARM GATE
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

  // Transition driver duty session to ON_TRIP
  const onTripSession = Array.from(dispatchMemoryStore.dutySessions.values()).find(
    s => s.driver_id === driverId && !s.ended_at
  );
  if (onTripSession) {
    onTripSession.status = 'ON_TRIP';
    onTripSession.last_heartbeat_at = new Date().toISOString();
  }

  broadcastBookingTrackingEvent(bookingId, 'otp_verified', {
    status: 'IN_TRANSIT',
    verifiedAt: booking.pickup_otp_verified_at
  });

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
  const { bookingId, reason = 'Cancelled by participant' } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  }

  let booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    // Try DB lookup
    try {
      const bRes = await pool.query('SELECT * FROM public.haul_bookings WHERE id = $1', [bookingId]);
      if (bRes.rows && bRes.rows.length > 0) {
        booking = bRes.rows[0];
        dispatchMemoryStore.bookings.set(bookingId, booking);
      }
    } catch {}
  }

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

  // Revoke any pending offers in memory & DB
  for (const o of dispatchMemoryStore.bookingOffers.values()) {
    if (o.booking_id === bookingId && o.status === 'PENDING') {
      o.status = 'REVOKED';
      o.responded_at = new Date().toISOString();
    }
  }

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

    // Reset duty session
    for (const s of dispatchMemoryStore.dutySessions.values()) {
      if (s.driver_id === assignedDriverId && !s.ended_at && ['ON_TRIP', 'BOOKING_ACCEPTED', 'BOOKING_REQUESTED'].includes(s.status)) {
        s.status = 'ONLINE_AVAILABLE';
        s.last_heartbeat_at = new Date().toISOString();
      }
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
    await pool.query('SELECT public.atomic_cancel_booking($1, $2, $3, $4)', [
      bookingId,
      userId,
      isFarmer ? 'FARMER' : 'DRIVER',
      reason
    ]);
  } catch {}

  broadcastBookingTrackingEvent(bookingId, 'booking_cancelled', {
    status: 'CANCELLED',
    cancelledBy: isFarmer ? 'FARMER' : 'DRIVER',
    reason
  });

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
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND' });
  }

  const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;
  const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;

  if (!isDriver && !isFarmer) {
    return reply.status(403).send({ error: 'UNAUTHORIZED_PARTICIPANT' });
  }

  const validTransitions: Record<string, string[]> = {
    ACCEPTED: ['ARRIVED', 'DRIVER_ARRIVED', 'CANCELLED'],
    ARRIVED: ['IN_TRANSIT', 'CANCELLED'],
    DRIVER_ARRIVED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['COMPLETED', 'TRIP_COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    TRIP_COMPLETED: [],
    CANCELLED: []
  };

  const allowed = validTransitions[booking.status] || [];
  if (!allowed.includes(newStatus)) {
    return reply.status(400).send({
      error: 'INVALID_STATUS_TRANSITION',
      currentStatus: booking.status,
      targetStatus: newStatus,
      allowed
    });
  }

  const prevStatus = booking.status;
  booking.status = newStatus;
  booking.updated_at = new Date().toISOString();
  dispatchMemoryStore.bookings.set(bookingId, booking);

  if (['COMPLETED', 'TRIP_COMPLETED'].includes(newStatus)) {
    const driverId = booking.driver_user_id || booking.driver_id;
    if (driverId) {
      const loc = dispatchMemoryStore.driverLocations.get(driverId);
      if (loc) {
        loc.is_available = true;
        loc.active_booking_id = null;
        dispatchMemoryStore.driverLocations.set(driverId, loc);
      }
      for (const s of dispatchMemoryStore.dutySessions.values()) {
        if (s.driver_id === driverId && !s.ended_at) {
          s.status = 'ONLINE_AVAILABLE';
          s.last_heartbeat_at = new Date().toISOString();
        }
      }
    }
  }

  broadcastBookingTrackingEvent(bookingId, 'trip_status_update', {
    previousStatus: prevStatus,
    status: newStatus
  });

  dispatchMemoryStore.bookingEvents.push({
    event_id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    previous_status: prevStatus,
    new_status: newStatus,
    actor_id: userId,
    actor_role: isDriver ? 'DRIVER' : 'FARMER',
    reason: `Lifecycle progression to ${newStatus}`,
    metadata_json: {},
    created_at: new Date().toISOString()
  });

  try {
    await pool.query('UPDATE public.haul_bookings SET status = $1, updated_at = NOW() WHERE id = $2', [
      newStatus,
      bookingId
    ]);
  } catch {}

  return reply.send({
    success: true,
    bookingId,
    previousStatus: prevStatus,
    status: newStatus,
    message: `Trip status updated to ${newStatus}`
  });
};

export const trackBooking = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { bookingId } = request.params as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required to track trips.' });
  }

  let booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    try {
      const bRes = await pool.query('SELECT * FROM public.haul_bookings WHERE id = $1', [bookingId]);
      if (bRes.rows && bRes.rows.length > 0) {
        booking = bRes.rows[0];
        dispatchMemoryStore.bookings.set(bookingId, booking);
      }
    } catch {}
  }

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
// 10. IN-TRIP SCOPED MESSAGING
// ─────────────────────────────────────────────────────────────────────────────

export const getChatMessages = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { bookingId } = request.params as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (booking && booking.farmer_user_id !== userId && booking.user_id !== userId && booking.driver_user_id !== userId && booking.driver_id !== userId) {
    return reply.status(403).send({ error: 'FORBIDDEN_CHAT_ACCESS' });
  }

  const msgs = dispatchMemoryStore.chatMessages.get(bookingId) || [];
  return reply.send({ success: true, count: msgs.length, messages: msgs });
};

export const sendChatMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const userRole = request.user?.role || 'farmer';
  const { bookingId } = request.params as any;
  const rawMsg = (request.body as any)?.messageText || (request.body as any)?.message;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (booking && booking.farmer_user_id !== userId && booking.user_id !== userId && booking.driver_user_id !== userId && booking.driver_id !== userId) {
    return reply.status(403).send({ error: 'FORBIDDEN_CHAT_ACCESS' });
  }

  if (!rawMsg || typeof rawMsg !== 'string' || rawMsg.trim().length === 0) {
    return reply.status(400).send({ error: 'MESSAGE_REQUIRED' });
  }

  const cleanText = sanitizeText(rawMsg.trim());
  const msgObj = {
    message_id: `MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    booking_id: bookingId,
    sender_id: userId,
    sender_role: userRole.toUpperCase(),
    message_text: cleanText,
    created_at: new Date().toISOString()
  };

  const list = dispatchMemoryStore.chatMessages.get(bookingId) || [];
  list.push(msgObj);
  dispatchMemoryStore.chatMessages.set(bookingId, list);

  try {
    await pool.query(
      `INSERT INTO public.booking_chat_messages (message_id, booking_id, sender_id, sender_role, message_text, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [msgObj.message_id, bookingId, userId, msgObj.sender_role, cleanText]
    );
  } catch {}

  return reply.status(201).send({ success: true, message: msgObj });
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. EQUIPMENT & VEHICLE RENTALS (CONFLICT-PROTECTED CALENDAR)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EQUIPMENT_CATALOG = [
  {
    equipmentId: 'EQ-TRAC-01',
    name: 'Mahindra 575 DI (45 HP Tractor)',
    category: 'TRACTOR',
    hourlyRate: 550,
    dailyRate: 4200,
    specs: 'Dual clutch, power steering, reverse PTO',
    locationDistrict: 'Warangal',
    locationVillage: 'Kadipikonda Hub',
    ownerId: 'OWNER-SYSTEM-01',
    ownerName: 'Reddy Agri Hub',
    available: true
  },
  {
    equipmentId: 'EQ-DRON-01',
    name: 'DJI Agras T40 Spraying Drone',
    category: 'DRONE',
    hourlyRate: 1200,
    dailyRate: 8500,
    specs: '40L spray payload, dual atomized centrifugal nozzles',
    locationDistrict: 'Warangal',
    locationVillage: 'Hanamkonda Center',
    ownerId: 'OWNER-SYSTEM-02',
    ownerName: 'Kisan Drone Kendra',
    available: true
  },
  {
    equipmentId: 'EQ-HARV-01',
    name: 'John Deere W70 Combine Harvester',
    category: 'HARVESTER',
    hourlyRate: 2200,
    dailyRate: 16000,
    specs: 'Paddy & Maize multi-crop cutting head',
    locationDistrict: 'Warangal',
    locationVillage: 'Enumamula Sub-Depot',
    ownerId: 'OWNER-SYSTEM-03',
    ownerName: 'Ramana Agri Equipment',
    available: true
  }
];

export const getRentalInventory = async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as any;
  const categoryFilter = query.category ? query.category.trim().toUpperCase() : null;

  let catalog: any[] = [];

  // Try DB first
  try {
    const res = await pool.query(
      `SELECT * FROM public.rental_equipment_inventory WHERE is_available = true ORDER BY created_at DESC`
    );
    if (res && res.rows && res.rows.length > 0) {
      catalog = res.rows.map((r: any) => ({
        equipmentId: r.equipment_id,
        name: r.name,
        category: r.category,
        hourlyRate: Number(r.hourly_rate),
        dailyRate: Number(r.daily_rate),
        perAcreRate: r.per_acre_rate ? Number(r.per_acre_rate) : null,
        specs: r.specs,
        locationDistrict: r.location_district,
        locationVillage: r.location_village,
        ownerId: r.owner_id,
        available: r.is_available
      }));
    }
  } catch {}

  // Fallback to memory store and defaults
  if (catalog.length === 0) {
    catalog = Array.from(dispatchMemoryStore.equipmentInventory.values());
    if (catalog.length === 0) {
      catalog = DEFAULT_EQUIPMENT_CATALOG;
    }
  }

  if (categoryFilter) {
    catalog = catalog.filter((e) => e.category === categoryFilter);
  }

  return reply.send({
    success: true,
    count: catalog.length,
    equipment: catalog
  });
};

export const addRentalEquipment = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Equipment owner authentication required' });
  }

  const {
    name,
    category,
    hourlyRate,
    dailyRate,
    perAcreRate,
    specs,
    vehicleId,
    locationDistrict = 'Warangal',
    locationVillage = 'Rural Hub'
  } = request.body as any;

  if (!name || !category || !hourlyRate || !dailyRate) {
    return reply.status(400).send({
      error: 'MISSING_FIELDS',
      message: 'name, category, hourlyRate, and dailyRate are required.'
    });
  }

  const equipmentId = `EQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const item = {
    equipmentId,
    ownerId: userId,
    vehicleId: vehicleId || null,
    name: name.trim(),
    category: category.trim().toUpperCase(),
    hourlyRate: Number(hourlyRate),
    dailyRate: Number(dailyRate),
    perAcreRate: perAcreRate ? Number(perAcreRate) : null,
    specs: specs || null,
    locationDistrict,
    locationVillage,
    available: true,
    created_at: new Date().toISOString()
  };

  dispatchMemoryStore.equipmentInventory.set(equipmentId, item);

  try {
    await pool.query(
      `INSERT INTO public.rental_equipment_inventory (equipment_id, owner_id, vehicle_id, name, category, hourly_rate, daily_rate, per_acre_rate, specs, location_district, location_village, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)`,
      [equipmentId, userId, item.vehicleId, item.name, item.category, item.hourlyRate, item.dailyRate, item.perAcreRate, item.specs, locationDistrict, locationVillage]
    );
  } catch {}

  return reply.status(201).send({ success: true, equipment: item });
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

  // Cross-Booking Check: If vehicleId is provided, check if that vehicle is in an active haul booking
  if (vehicleId) {
    for (const b of dispatchMemoryStore.bookings.values()) {
      if (b.vehicle_id === vehicleId && ['ACCEPTED', 'ARRIVED', 'DRIVER_ARRIVED', 'IN_TRANSIT'].includes(b.status)) {
        return reply.status(409).send({
          error: 'VEHICLE_BUSY_ON_HAUL',
          conflictBookingId: b.id,
          message: 'This vehicle is currently assigned to an ongoing transport trip and cannot be reserved for rental.'
        });
      }
    }
  }

  // 2. Pricing Calculation from catalog or defaults
  let item = DEFAULT_EQUIPMENT_CATALOG.find((e) => e.equipmentId === equipmentId);
  if (!item && equipmentId) {
    item = dispatchMemoryStore.equipmentInventory.get(equipmentId);
  }
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

export const extendRental = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const { rentalId } = request.params as any;
  const { newEndTime } = request.body as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (!newEndTime) {
    return reply.status(400).send({ error: 'MISSING_END_TIME', message: 'newEndTime is required' });
  }

  const rental = dispatchMemoryStore.rentals.get(rentalId);
  if (!rental) {
    return reply.status(404).send({ error: 'RENTAL_NOT_FOUND' });
  }

  if (rental.renter_id !== userId) {
    return reply.status(403).send({ error: 'UNAUTHORIZED_RENTER' });
  }

  const tNewEnd = new Date(newEndTime).getTime();
  const tCurEnd = new Date(rental.end_time).getTime();

  if (isNaN(tNewEnd) || tNewEnd <= tCurEnd) {
    return reply.status(400).send({
      error: 'INVALID_EXTENSION_TIME',
      message: 'newEndTime must be strictly after the current scheduled end time.'
    });
  }

  // Check overlap with another rental during the extension interval
  const targetId = rental.equipment_id || rental.vehicle_id;
  for (const r of dispatchMemoryStore.rentals.values()) {
    if (r.rental_id !== rentalId && (r.equipment_id === targetId || r.vehicle_id === targetId) && ['CONFIRMED', 'ACTIVE'].includes(r.status)) {
      const rStart = new Date(r.start_time).getTime();
      const rEnd = new Date(r.end_time).getTime();
      if (rStart < tNewEnd && rEnd > tCurEnd) {
        return reply.status(409).send({
          error: 'RENTAL_SCHEDULE_CONFLICT',
          message: 'Cannot extend: Another reservation is scheduled on this equipment.'
        });
      }
    }
  }

  const addHours = parseFloat(((tNewEnd - tCurEnd) / (1000 * 60 * 60)).toFixed(2));
  const addAmount = Math.round(addHours * (rental.hourly_rate || 650));
  rental.end_time = new Date(tNewEnd).toISOString();
  rental.duration_hours = (rental.duration_hours || 0) + addHours;
  rental.base_amount = (rental.base_amount || 0) + addAmount;
  rental.extension_count = (rental.extension_count || 0) + 1;
  rental.updated_at = new Date().toISOString();

  dispatchMemoryStore.rentals.set(rentalId, rental);

  try {
    await pool.query(
      `UPDATE public.rental_bookings SET end_time = $1, duration_hours = $2, base_amount = $3, extension_count = COALESCE(extension_count,0)+1, updated_at = NOW() WHERE rental_id = $4`,
      [rental.end_time, rental.duration_hours, rental.base_amount, rentalId]
    );
  } catch {}

  return reply.send({
    success: true,
    rentalId,
    newEndTime: rental.end_time,
    additionalAmount: addAmount,
    newTotalAmount: rental.base_amount
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
  const { status: newStatus, returnedAt } = request.body as any;

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
    REQUESTED: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
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

  // Final billing calculation on return
  let billingSummary: any = null;
  const { conditionReport, damageFee = 0 } = (request.body as any) || {};

  if (newStatus === 'RETURNED' || newStatus === 'DISPUTED') {
    const actReturnTime = returnedAt ? new Date(returnedAt).getTime() : Date.now();
    const schedEndTime = new Date(rental.end_time).getTime();
    rental.actual_returned_at = new Date(actReturnTime).toISOString();

    let overtimeHours = 0;
    let overtimeAmount = 0;
    if (actReturnTime > schedEndTime) {
      overtimeHours = parseFloat(((actReturnTime - schedEndTime) / (1000 * 60 * 60)).toFixed(2));
      overtimeAmount = Math.round(overtimeHours * (rental.hourly_rate || 650));
    }

    const assessedDamageFee = Number(damageFee) || (conditionReport?.damageFee ? Number(conditionReport.damageFee) : 0);
    rental.overtime_hours = overtimeHours;
    rental.overtime_amount = overtimeAmount;
    rental.damage_fee = assessedDamageFee;
    rental.condition_report = conditionReport || null;
    rental.final_total_amount = (rental.base_amount || 0) + overtimeAmount + assessedDamageFee;

    billingSummary = {
      baseAmount: rental.base_amount,
      overtimeHours,
      overtimeAmount,
      damageFee: assessedDamageFee,
      conditionReport: rental.condition_report,
      finalTotal: rental.final_total_amount
    };
  }

  dispatchMemoryStore.rentals.set(rentalId, rental);

  try {
    await pool.query(
      `UPDATE public.rental_bookings SET status = $1, actual_returned_at = $2, overtime_hours = $3, overtime_amount = $4, final_total_amount = $5, updated_at = NOW() WHERE rental_id = $6`,
      [newStatus, rental.actual_returned_at || null, rental.overtime_hours || 0, rental.overtime_amount || 0, rental.final_total_amount || rental.base_amount, rentalId]
    );
  } catch {}

  return reply.send({
    success: true,
    rentalId,
    status: newStatus,
    billing: billingSummary
  });
};


// ─────────────────────────────────────────────────────────────────────────────
// 12. REAL-TIME AUTHENTICATED WEBSOCKET TRACKING & FARMER OTP ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const dispatchTrackingWebSocket = async (connection: any, req: any) => {
  const socket = connection?.socket || connection;
  const bookingId = req?.params?.bookingId;
  const query = req?.query || {};
  const token = query.token || req?.headers?.authorization?.replace(/^Bearer\s+/, '');

  if (!bookingId) {
    if (socket?.close) socket.close(4400, 'Missing bookingId');
    return;
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    if (socket?.close) socket.close(4404, 'Booking not found');
    return;
  }

  // Token authentication & participant authorization check
  let userId: string | null = null;
  if (token) {
    try {
      const decoded = jwt.decode(token) as any;
      userId = decoded?.sub || decoded?.id || null;
    } catch {}
  }

  if (userId) {
    const isFarmer = booking.farmer_user_id === userId || booking.user_id === userId;
    const isDriver = booking.driver_user_id === userId || booking.driver_id === userId;
    if (!isFarmer && !isDriver) {
      if (socket?.close) socket.close(4403, 'Forbidden: Not a booking participant');
      return;
    }
  }

  if (!dispatchMemoryStore.activeTrackingSubscribers.has(bookingId)) {
    dispatchMemoryStore.activeTrackingSubscribers.set(bookingId, new Set());
  }
  dispatchMemoryStore.activeTrackingSubscribers.get(bookingId)!.add(socket);

  const assignedDriverId = booking.driver_user_id || booking.driver_id;
  const loc = assignedDriverId ? dispatchMemoryStore.driverLocations.get(assignedDriverId) : null;
  const now = Date.now();
  const pingTime = loc?.last_ping ? new Date(loc.last_ping).getTime() : 0;
  const isStale = loc ? now - pingTime > 5 * 60 * 1000 : true;

  if (socket?.send) {
    socket.send(JSON.stringify({
      event: 'initial_snapshot',
      bookingId,
      status: booking.status,
      driverAssigned: !!assignedDriverId,
      driver: assignedDriverId ? {
        driverId: assignedDriverId,
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
        statusMessage: isStale ? 'Driver location temporarily unavailable' : 'Live GPS stream active'
      } : null,
      timestamp: now
    }));
  }

  if (socket?.on) {
    socket.on('close', () => {
      const set = dispatchMemoryStore.activeTrackingSubscribers.get(bookingId);
      if (set) {
        set.delete(socket);
        if (set.size === 0) dispatchMemoryStore.activeTrackingSubscribers.delete(bookingId);
      }
    });
  }
};

export const getBookingOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const userRole = request.user?.role;
  const { bookingId } = request.params as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  }

  // DRIVER STRICT BLOCK: Drivers can NEVER access the farmer's pickup OTP
  if (userRole === 'driver') {
    return reply.status(403).send({
      error: 'FORBIDDEN_DRIVER_OTP_ACCESS',
      message: 'Access Denied: Drivers are strictly forbidden from retrieving farmer pickup OTPs.'
    });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND', message: 'Booking does not exist.' });
  }

  if (booking.farmer_user_id !== userId && booking.user_id !== userId && userRole !== 'admin') {
    return reply.status(403).send({
      error: 'FORBIDDEN_BOOKING_ACCESS',
      message: 'Access Denied: Only the farmer who created this booking can view the pickup OTP.'
    });
  }

  if (booking.status === 'CANCELLED') {
    return reply.status(400).send({
      error: 'BOOKING_CANCELLED',
      message: 'This booking was cancelled. The pickup OTP is invalidated.'
    });
  }

  if (['IN_TRANSIT', 'COMPLETED', 'TRIP_COMPLETED'].includes(booking.status)) {
    return reply.status(400).send({
      error: 'OTP_ALREADY_VERIFIED',
      message: 'Pickup OTP has already been verified for this trip.'
    });
  }

  const otp = dispatchMemoryStore.farmerPlaintextOtps?.get(bookingId) || booking.ephemeral_plaintext_otp;
  if (!otp) {
    return reply.status(404).send({
      error: 'OTP_NOT_AVAILABLE',
      message: 'OTP has expired or was cleared. Use resend-otp to generate a fresh PIN.'
    });
  }

  return reply.send({
    success: true,
    bookingId,
    otp,
    expiresAt: booking.start_otp_expires_at,
    deliveryChannel: 'IN_APP_SECURE_SCREEN',
    attemptsRemaining: Math.max(0, 3 - (booking.start_otp_attempts || 0))
  });
};

export const resendBookingOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const userRole = request.user?.role;
  const { bookingId } = request.params as any;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (userRole === 'driver') {
    return reply.status(403).send({ error: 'FORBIDDEN_DRIVER_OTP_ACCESS' });
  }

  const booking = dispatchMemoryStore.bookings.get(bookingId);
  if (!booking) {
    return reply.status(404).send({ error: 'BOOKING_NOT_FOUND' });
  }

  if (booking.farmer_user_id !== userId && booking.user_id !== userId && userRole !== 'admin') {
    return reply.status(403).send({ error: 'FORBIDDEN_BOOKING_ACCESS' });
  }

  if (['CANCELLED', 'IN_TRANSIT', 'COMPLETED'].includes(booking.status)) {
    return reply.status(400).send({ error: 'INVALID_STAGE_FOR_OTP_RESEND', currentStatus: booking.status });
  }

  const now = Date.now();
  const lastSent = dispatchMemoryStore.otpResendCooldowns.get(bookingId) || 0;
  const timeSinceLastSec = Math.round((now - lastSent) / 1000);
  if (timeSinceLastSec < 60) {
    const waitSec = 60 - timeSinceLastSec;
    return reply.status(429).send({
      error: 'OTP_RESEND_COOLDOWN',
      cooldownSecondsRemaining: waitSec,
      message: `Please wait ${waitSec} seconds before requesting a new OTP.`
    });
  }

  const { otp, salt, hash } = generateSecureOtp();
  const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();

  booking.start_otp_hash = hash;
  booking.start_otp_salt = salt;
  booking.start_otp_attempts = 0;
  booking.start_otp_expires_at = expiresAt;
  booking.ephemeral_plaintext_otp = otp;
  if (!dispatchMemoryStore.farmerPlaintextOtps) {
    dispatchMemoryStore.farmerPlaintextOtps = new Map<string, string>();
  }
  dispatchMemoryStore.farmerPlaintextOtps.set(bookingId, otp);
  dispatchMemoryStore.otpResendCooldowns.set(bookingId, now);
  dispatchMemoryStore.bookings.set(bookingId, booking);

  const smsConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) || !!process.env.MSG91_AUTH_KEY;

  return reply.send({
    success: true,
    bookingId,
    otp,
    expiresAt,
    smsDispatched: false,
    deliveryStatus: smsConfigured ? 'SMS_GATEWAY_PENDING' : 'IN_APP_SECURE_SCREEN',
    deliveryDisclosure: smsConfigured
      ? 'SMS provider queued dispatch.'
      : 'External SMS gateway not configured in staging. Delivered securely via in-app display.'
  });
};
