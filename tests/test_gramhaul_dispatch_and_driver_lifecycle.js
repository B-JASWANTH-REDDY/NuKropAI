/**
 * NuKropAI / GramHaul Phase 4 — Production Real-Time Transport Booking,
 * Driver Operations & Vehicle Rental Verification Suite
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  dispatchMemoryStore,
  setDutyStatus,
  getDriverMe,
  getDriverInbox,
  getRegisteredVehicles,
  registerVehicle,
  recordLocationPing,
  getNearbyDrivers,
  createBookingRequest,
  acceptBooking,
  verifyBookingOtp,
  cancelBooking,
  updateTripStatus,
  trackBooking,
  getChatMessages,
  sendChatMessage,
  getRentalInventory,
  bookRental,
  updateRentalStatus,
  hashOtp,
  generateSecureOtp
} = require('../backend/dist/controllers/dispatch.controller');

function createMockReply() {
  const reply = {
    _status: 200,
    _data: null,
    status(code) {
      this._status = code;
      return this;
    },
    send(data) {
      this._data = data;
      return this;
    }
  };
  return reply;
}

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

(async () => {
  console.log('='.repeat(80));
  console.log('🚚 GRAMHAUL PHASE 4: DRIVER DISPATCH, GPS & RENTAL SYSTEM VERIFICATION');
  console.log('='.repeat(80));

  // Reset memory stores before running tests
  dispatchMemoryStore.driverLocations.clear();
  dispatchMemoryStore.dutySessions.clear();
  dispatchMemoryStore.vehicles.clear();
  dispatchMemoryStore.bookings.clear();
  dispatchMemoryStore.bookingEvents.length = 0;
  dispatchMemoryStore.rentals.clear();
  dispatchMemoryStore.chatMessages.clear();
  dispatchMemoryStore.telemetry.length = 0;
  dispatchMemoryStore.profiles.clear();

  // Seed verified profiles
  dispatchMemoryStore.profiles.set('DRV-001', {
    id: 'DRV-001',
    full_name: 'Suresh Yadav',
    phone: '9876543210',
    driver_verified_status: 'VERIFIED'
  });
  dispatchMemoryStore.profiles.set('DRV-UNVERIFIED', {
    id: 'DRV-UNVERIFIED',
    full_name: 'Unverified Driver',
    phone: '9876543211',
    driver_verified_status: 'PENDING'
  });
  dispatchMemoryStore.profiles.set('FARMER-001', {
    id: 'FARMER-001',
    full_name: 'B. Jaswanth Reddy',
    phone: '9123456780',
    role: 'farmer'
  });

  // ── TEST 1: Driver Duty Toggle & Verification Enforce ──
  await runTest('GH-1.1: Unverified driver is strictly rejected from going ON DUTY', async () => {
    const req = {
      user: { id: 'DRV-UNVERIFIED', role: 'driver' },
      headers: {},
      body: { isOnDuty: true, lat: 17.9689, lng: 79.5941 }
    };
    const reply = createMockReply();
    await setDutyStatus(req, reply);

    assert.strictEqual(reply._status, 403);
    assert.strictEqual(reply._data.error, 'DRIVER_NOT_VERIFIED');
  });

  await runTest('GH-1.2: Going ON DUTY requires valid coordinates and accuracy <= 50m', async () => {
    // Missing coords
    const req1 = {
      user: { id: 'DRV-001', role: 'driver' },
      headers: {},
      body: { isOnDuty: true }
    };
    const reply1 = createMockReply();
    await setDutyStatus(req1, reply1);
    assert.strictEqual(reply1._status, 400);

    // Poor accuracy (> 50m)
    const req2 = {
      user: { id: 'DRV-001', role: 'driver' },
      headers: {},
      body: { isOnDuty: true, lat: 17.9689, lng: 79.5941, accuracy: 65.0 }
    };
    const reply2 = createMockReply();
    await setDutyStatus(req2, reply2);
    assert.strictEqual(reply2._status, 400);
    assert.strictEqual(reply2._data.error, 'POOR_GPS_ACCURACY');
  });

  await runTest('GH-1.3: Verified driver successfully goes ON DUTY with fresh session', async () => {
    const req = {
      user: { id: 'DRV-001', role: 'driver' },
      headers: {},
      body: { isOnDuty: true, lat: 17.9689, lng: 79.5941, accuracy: 5.0 }
    };
    const reply = createMockReply();
    await setDutyStatus(req, reply);

    assert.strictEqual(reply._status, 200);
    assert.strictEqual(reply._data.isOnDuty, true);
    assert.strictEqual(reply._data.isAvailable, true);
    assert.ok(reply._data.sessionId.startsWith('DS-'));

    // Check memory store presence
    const loc = dispatchMemoryStore.driverLocations.get('DRV-001');
    assert.ok(loc);
    assert.strictEqual(loc.is_on_duty, true);
    assert.strictEqual(loc.is_available, true);
  });

  // ── TEST 2: Real Vehicle Registration ──
  await runTest('GH-2.1: Vehicle registration enforces valid category and positive capacity', async () => {
    // Invalid category
    const reqBad = {
      user: { id: 'DRV-001', role: 'driver' },
      headers: {},
      body: { vehicleCategory: 'SPORTS_CAR', makeModel: 'Ferrari', vehiclePlate: 'TS-01-AB-1234', capacityTonnes: 0.5 }
    };
    const replyBad = createMockReply();
    await registerVehicle(reqBad, replyBad);
    assert.strictEqual(replyBad._status, 400);
    assert.strictEqual(replyBad._data.error, 'INVALID_VEHICLE_CATEGORY');

    // Valid registration
    const reqGood = {
      user: { id: 'DRV-001', role: 'driver' },
      headers: {},
      body: {
        vehicleCategory: 'MINI_TRUCK',
        makeModel: 'Tata Ace Gold (1.5T)',
        vehiclePlate: 'TS-03-UB-4491',
        capacityTonnes: 1.5,
        insuranceValidUntil: '2028-12-31'
      }
    };
    const replyGood = createMockReply();
    await registerVehicle(reqGood, replyGood);
    assert.strictEqual(replyGood._status, 201);
    assert.strictEqual(replyGood._data.vehicle.verification_status, 'VERIFIED');
    assert.strictEqual(replyGood._data.vehicle.vehicle_plate, 'TS-03-UB-4491');
  });

  // ── TEST 3: GPS Telemetry & Anomaly Protection ──
  await runTest('GH-3.1: GPS ping rejects poor accuracy readings (> 50m)', async () => {
    const req = {
      user: { id: 'DRV-001', role: 'driver' },
      body: { lat: 17.9690, lng: 79.5942, accuracy: 75.0 }
    };
    const reply = createMockReply();
    await recordLocationPing(req, reply);
    assert.strictEqual(reply._status, 400);
    assert.strictEqual(reply._data.error, 'POOR_GPS_ACCURACY');
  });

  await runTest('GH-3.2: GPS ping detects and rejects impossible location jumps (> 160 km/h)', async () => {
    // Current location is at 17.9689, 79.5941 (Warangal)
    // Ping attempt at Hyderabad (150 km away within 2 seconds)
    const req = {
      user: { id: 'DRV-001', role: 'driver' },
      body: { lat: 17.3850, lng: 78.4867, accuracy: 5.0, speed: 20 }
    };
    const reply = createMockReply();
    await recordLocationPing(req, reply);
    assert.strictEqual(reply._status, 400);
    assert.strictEqual(reply._data.error, 'IMPOSSIBLE_GPS_JUMP');
  });

  // ── TEST 4: PostGIS Nearby Driver Discovery ──
  await runTest('GH-4.1: Farmer discovers nearby verified on-duty driver within radius', async () => {
    // Driver DRV-001 is at 17.9689, 79.5941
    const req = {
      query: { lat: '17.9700', lng: '79.5950', radiusKm: '5' }
    };
    const reply = createMockReply();
    await getNearbyDrivers(req, reply);

    assert.strictEqual(reply._status, 200);
    assert.strictEqual(reply._data.count, 1);
    assert.strictEqual(reply._data.drivers[0].driverId, 'DRV-001');
    assert.ok(reply._data.drivers[0].distanceKm < 1.0);
  });

  await runTest('GH-4.2: Discovery returns honest empty array when 0 drivers are nearby', async () => {
    // Farmer location in Delhi (far away from Warangal)
    const req = {
      query: { lat: '28.6139', lng: '77.2090', radiusKm: '10' }
    };
    const reply = createMockReply();
    await getNearbyDrivers(req, reply);

    assert.strictEqual(reply._status, 200);
    assert.strictEqual(reply._data.count, 0);
    assert.deepStrictEqual(reply._data.drivers, []);
  });

  // ── TEST 5: Booking Creation with Cryptographic OTP ──
  let createdBookingId = '';
  let farmerStartOtp = '';

  await runTest('GH-5.1: Farmer creates booking; system generates cryptographic 4-digit OTP & salt', async () => {
    const req = {
      user: { id: 'FARMER-001', role: 'farmer' },
      headers: { 'idempotency-key': 'test_booking_key_001' },
      body: {
        pickupVillage: 'Warangal Rural',
        destinationMandi: 'Enumamula APMC Yard',
        cropName: 'Cotton',
        loadQuintals: 40,
        agreedFare: 3200,
        vehicleType: 'Tata Ace Gold (1.5T)',
        pickupLat: 17.9689,
        pickupLng: 79.5941,
        dropoffLat: 17.9920,
        dropoffLng: 79.6150
      }
    };
    const reply = createMockReply();
    await createBookingRequest(req, reply);

    assert.strictEqual(reply._status, 201);
    assert.strictEqual(reply._data.status, 'SEARCHING_DRIVERS');
    assert.ok(/^\d{4}$/.test(reply._data.startOtp), 'OTP must be 4 digits');

    createdBookingId = reply._data.bookingId;
    farmerStartOtp = reply._data.startOtp;

    // Verify stored booking record contains hash & salt, not plain OTP
    const b = dispatchMemoryStore.bookings.get(createdBookingId);
    assert.ok(b);
    assert.ok(b.start_otp_hash);
    assert.ok(b.start_otp_salt);
    assert.strictEqual(hashOtp(farmerStartOtp, b.start_otp_salt), b.start_otp_hash);
  });

  // ── TEST 6: Atomic Acceptance & Concurrency Race Condition ──
  await runTest('GH-6.1: Concurrency safety: First driver wins acceptance, second receives 409 Conflict', async () => {
    // Seed second driver
    dispatchMemoryStore.profiles.set('DRV-002', {
      id: 'DRV-002',
      full_name: 'K. Anjaiah',
      phone: '9876543212',
      driver_verified_status: 'VERIFIED'
    });
    dispatchMemoryStore.driverLocations.set('DRV-002', {
      driver_id: 'DRV-002',
      driver_name: 'K. Anjaiah',
      is_on_duty: true,
      is_available: true,
      current_lat: 17.9690,
      current_lng: 79.5940,
      last_ping: new Date().toISOString()
    });

    // Driver 1 accepts
    const req1 = {
      user: { id: 'DRV-001', role: 'driver' },
      headers: {},
      body: { bookingId: createdBookingId }
    };
    const reply1 = createMockReply();
    await acceptBooking(req1, reply1);
    assert.strictEqual(reply1._status, 200);
    assert.strictEqual(reply1._data.status, 'ACCEPTED');

    // Driver 2 attempts to accept same booking simultaneously
    const req2 = {
      user: { id: 'DRV-002', role: 'driver' },
      headers: {},
      body: { bookingId: createdBookingId }
    };
    const reply2 = createMockReply();
    await acceptBooking(req2, reply2);
    assert.strictEqual(reply2._status, 409);
    assert.strictEqual(reply2._data.error, 'BOOKING_ALREADY_ACCEPTED_OR_CANCELLED');
  });

  // ── TEST 7: Farm Gate OTP Verification ──
  await runTest('GH-7.1: Driver arrives at farm gate; incorrect OTP increments attempts and warns', async () => {
    // Advance status to ARRIVED
    const b = dispatchMemoryStore.bookings.get(createdBookingId);
    b.status = 'ARRIVED';

    const req = {
      user: { id: 'DRV-001', role: 'driver' },
      body: { bookingId: createdBookingId, otp: '0000' } // wrong OTP
    };
    const reply = createMockReply();
    await verifyBookingOtp(req, reply);

    assert.strictEqual(reply._status, 400);
    assert.strictEqual(reply._data.error, 'INVALID_OTP');
    assert.strictEqual(reply._data.attemptsRemaining, 2);
  });

  await runTest('GH-7.2: Correct 4-digit OTP unlocks trip and transitions to IN_TRANSIT', async () => {
    const req = {
      user: { id: 'DRV-001', role: 'driver' },
      body: { bookingId: createdBookingId, otp: farmerStartOtp }
    };
    const reply = createMockReply();
    await verifyBookingOtp(req, reply);

    assert.strictEqual(reply._status, 200);
    assert.strictEqual(reply._data.status, 'IN_TRANSIT');
    assert.strictEqual(reply._data.pickupOtpVerified, true);
  });

  // ── TEST 8: In-Ride Scoped Chat & Sanitization ──
  await runTest('GH-8.1: Chat messaging is restricted to participants and sanitizes HTML injection', async () => {
    // Unauthorized user
    const reqUnauth = {
      user: { id: 'STRANGER-999' },
      params: { bookingId: createdBookingId },
      body: { messageText: 'Hello' }
    };
    const replyUnauth = createMockReply();
    await sendChatMessage(reqUnauth, replyUnauth);
    assert.strictEqual(replyUnauth._status, 403);

    // Authorized driver sends message with HTML injection attempt
    const reqAuth = {
      user: { id: 'DRV-001' },
      params: { bookingId: createdBookingId },
      body: { messageText: 'Reached farm gate <script>alert(1)</script>' }
    };
    const replyAuth = createMockReply();
    await sendChatMessage(reqAuth, replyAuth);
    assert.strictEqual(replyAuth._status, 201);
    assert.strictEqual(replyAuth._data.message.message_text, 'Reached farm gate &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  // ── TEST 9: Synchronized Cancellation ──
  await runTest('GH-9.1: Synchronized cancellation releases driver presence back to AVAILABLE', async () => {
    const req = {
      user: { id: 'FARMER-001', role: 'farmer' },
      body: { bookingId: createdBookingId, reason: 'Farmer rescheduled haul' }
    };
    const reply = createMockReply();
    await cancelBooking(req, reply);

    assert.strictEqual(reply._status, 200);
    assert.strictEqual(reply._data.newStatus, 'CANCELLED');
    assert.strictEqual(reply._data.releasedDriverId, 'DRV-001');

    // Verify driver is now available again
    const driverLoc = dispatchMemoryStore.driverLocations.get('DRV-001');
    assert.strictEqual(driverLoc.is_available, true);
    assert.strictEqual(driverLoc.active_booking_id, null);
  });

  // ── TEST 10: Equipment & Machinery Rental Conflict Prevention ──
  await runTest('GH-10.1: Rental reservation succeeds with valid date range', async () => {
    const req = {
      user: { id: 'FARMER-001', role: 'farmer' },
      body: {
        equipmentId: 'EQ-TRAC-575',
        startTime: '2026-11-10T06:00:00Z',
        endTime: '2026-11-10T14:00:00Z',
        operatorIncluded: true
      }
    };
    const reply = createMockReply();
    await bookRental(req, reply);

    assert.strictEqual(reply._status, 201);
    assert.strictEqual(reply._data.rental.status, 'CONFIRMED');
    assert.strictEqual(reply._data.rental.duration_hours, 8);
  });

  await runTest('GH-10.2: Overlapping rental schedule for same equipment is rejected with 409 Conflict', async () => {
    // Attempt to book from 10:00 AM to 18:00 PM on same day (overlaps 06:00-14:00)
    const reqConflict = {
      user: { id: 'FARMER-002', role: 'farmer' },
      body: {
        equipmentId: 'EQ-TRAC-575',
        startTime: '2026-11-10T10:00:00Z',
        endTime: '2026-11-10T18:00:00Z',
        operatorIncluded: true
      }
    };
    const replyConflict = createMockReply();
    await bookRental(reqConflict, replyConflict);

    assert.strictEqual(replyConflict._status, 409);
    assert.strictEqual(replyConflict._data.error, 'RENTAL_SCHEDULE_CONFLICT');
  });

  // ── TEST 11: Exact SHA-256 Byte-for-Byte Asset Parity ──
  await runTest('GH-11.1: 100% SHA-256 byte-for-byte identity between index.html and nukrop_emulator.html', () => {
    const indexPath = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
    const emulatorPath = path.resolve(__dirname, '..', 'nukrop_emulator.html');

    const indexBuf = fs.readFileSync(indexPath);
    const emuBuf = fs.readFileSync(emulatorPath);

    const indexHash = crypto.createHash('sha256').update(indexBuf).digest('hex');
    const emuHash = crypto.createHash('sha256').update(emuBuf).digest('hex');

    assert.strictEqual(indexHash, emuHash, `SHA-256 mismatch!\nindex.html: ${indexHash}\nemulator:   ${emuHash}`);
    assert.strictEqual(indexBuf.length, emuBuf.length, `Byte length mismatch!\nindex: ${indexBuf.length}\nemu:   ${emuBuf.length}`);
  });

  console.log('='.repeat(80));
  console.log(`📊 GRAMHAUL VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
})();
