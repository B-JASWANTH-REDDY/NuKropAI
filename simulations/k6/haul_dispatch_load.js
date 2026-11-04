/**
 * NuKropAI — k6 Staging Load & Concurrency Test Engine
 * Executes Realistic High-Concurrency Traffic Derived from MiroFish Swarm Scenarios
 *
 * Responsibilities:
 * - MiroFish: Generates behavioural personas, decisions, arrival rates & distributions
 * - k6: Measures request concurrency, latency percentiles (p50, p95, p99), throughput (RPS), error rates
 *
 * Usage:
 *   & "C:\Program Files\k6\k6.exe" run simulations/k6/haul_dispatch_load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const radarLatency = new Trend('radar_query_latency_ms');
const gpsPingLatency = new Trend('gps_ping_latency_ms');
const bookingLatency = new Trend('booking_creation_latency_ms');
const concurrencyConflicts = new Counter('concurrency_race_conflicts_409');
const successfulTrips = new Counter('successful_dispatch_trips');
const errorRate = new Rate('simulation_error_rate');

// Test Configuration
export const options = {
  scenarios: {
    // Normal Day to Harvest Peak Ramp
    marketplace_load: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '5s', target: 10 },   // Warmup baseline
        { duration: '10s', target: 30 },  // Normal Day rush
        { duration: '10s', target: 50 },  // Peak Harvest surge
        { duration: '5s', target: 0 },    // Cooldown
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'], // 95% of requests under 800ms
    simulation_error_rate: ['rate<0.05'],           // Error rate strictly below 5%
    radar_query_latency_ms: ['p(95)<500'],          // PostGIS spatial query latency SLA
  },
};

// ── FAIL-CLOSED ENVIRONMENT SAFETY GUARD ─────────────────────────────────────
// The production Supabase project (yxjqseiegwjdfnccdchk) must NEVER be reachable
// through load-test execution under ANY circumstances, flags, or overrides.
// All bypasses have been permanently removed.
import { fail } from 'k6';

const PRODUCTION_PROJECT_REF = 'yxjqseiegwjdfnccdchk';

// Target URL must come from an explicitly configured test environment
const BASE_URL = (__ENV.TEST_SUPABASE_URL || __ENV.SUPABASE_URL || '').trim();
const ANON_KEY = (__ENV.TEST_SUPABASE_ANON_KEY || __ENV.SUPABASE_ANON_KEY || '').trim();

if (!BASE_URL) {
  fail(
    '[SAFETY BLOCK] Target Supabase URL is missing or empty. ' +
    'Load tests require an explicitly configured isolated test environment. ' +
    'Please configure TEST_SUPABASE_URL (e.g. https://your-test-project.supabase.co or http://localhost:54321).'
  );
}

if (!BASE_URL.startsWith('http://') && !BASE_URL.startsWith('https://')) {
  fail('[SAFETY BLOCK] Invalid target URL format: "' + BASE_URL + '". Must start with http:// or https://.');
}

if (BASE_URL.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
  fail(
    '[SAFETY BLOCK: CRITICAL] BASE_URL targets the production Supabase project (' + PRODUCTION_PROJECT_REF + '). ' +
    'Load testing against production is strictly prohibited. All bypass flags have been permanently removed. ' +
    'You MUST specify an independently configured, isolated test project.'
  );
}

if (!ANON_KEY) {
  fail(
    '[SAFETY BLOCK] Isolated test anon key is missing. ' +
    'Please configure TEST_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY for your isolated test environment.'
  );
}

if (ANON_KEY.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
  fail(
    '[SAFETY BLOCK: CRITICAL] The provided API key references the production project (' + PRODUCTION_PROJECT_REF + '). ' +
    'Production API keys cannot be used in load tests.'
  );
}

// Target verified successfully (sanitized output, zero secrets logged)
console.log('----------------------------------------------------------------------');
console.log('🛡️  k6 TARGET SAFETY VALIDATION: PASSED');
console.log('  • Target URL:     ' + BASE_URL);
console.log('  • Production Ref: ' + PRODUCTION_PROJECT_REF + ' (PROTECTED / BLOCKED)');
console.log('----------------------------------------------------------------------');
// ─────────────────────────────────────────────────────────────────────────────

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Prefer': 'return=representation',
};

// Hub locations centered around Telangana agriculture
const HUBS = [
  { lat: 17.4700, lng: 78.4850, name: 'Bowenpally' },
  { lat: 17.4400, lng: 78.4980, name: 'Secunderabad' },
  { lat: 17.4600, lng: 78.3650, name: 'Kothaguda' },
  { lat: 17.2500, lng: 78.4300, name: 'Shamshabad' },
];

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const hub = HUBS[vuId % HUBS.length];

  // ── STEP 1: FARMER QUERIES NEARBY RADAR (PostGIS ST_DWithin) ──
  const radarPayload = JSON.stringify({
    user_lon: hub.lng + (Math.random() * 0.01 - 0.005),
    user_lat: hub.lat + (Math.random() * 0.01 - 0.005),
    radius_meters: 10000.0,
    max_drivers: 10,
  });

  const radarStart = Date.now();
  const radarResp = http.post(`${BASE_URL}/rest/v1/rpc/get_nearest_drivers`, radarPayload, { headers: HEADERS });
  radarLatency.add(Date.now() - radarStart);

  const radarSuccess = check(radarResp, {
    'Radar returned 200 OK': (r) => r.status === 200,
  });
  errorRate.add(!radarSuccess);

  sleep(0.5);

  // ── STEP 2: DRIVER STREAMS REAL-TIME GPS PING ──
  const driverId = `sim_k6_drv_${vuId % 10}`;
  const gpsPayload = JSON.stringify({
    p_driver_id: driverId,
    p_lat: hub.lat + (Math.random() * 0.005),
    p_lng: hub.lng + (Math.random() * 0.005),
    p_speed: 25.0 + (Math.random() * 15.0),
    p_heading: 45.0,
    p_accuracy: 5.5,
  });

  const gpsStart = Date.now();
  const gpsResp = http.post(`${BASE_URL}/rest/v1/rpc/record_driver_gps_ping`, gpsPayload, { headers: HEADERS });
  gpsPingLatency.add(Date.now() - gpsStart);

  const gpsSuccess = check(gpsResp, {
    'GPS ping returned 200 OK': (r) => r.status === 200,
  });
  errorRate.add(!gpsSuccess);

  sleep(0.5);

  // ── STEP 3: FARMER CREATES HAUL BOOKING ──
  const farmerId = `sim_k6_farmer_${vuId}_${iterId}`;
  const bookingPayload = JSON.stringify({
    user_id: farmerId,
    farmer_user_id: farmerId,
    pickup_village: `${hub.name} Sector ${vuId}`,
    pickup_lat: hub.lat,
    pickup_lng: hub.lng,
    destination_mandi: 'Bowenpally Agriculture Market',
    crop_name: 'Organic Tomatoes',
    load_quintals: 10.0 + (vuId % 15),
    agreed_fare: 1200.0 + (vuId * 20),
    status: 'PENDING',
  });

  const bStart = Date.now();
  const bResp = http.post(`${BASE_URL}/rest/v1/haul_bookings`, bookingPayload, { headers: HEADERS });
  bookingLatency.add(Date.now() - bStart);

  let bookingId = null;
  if (bResp.status === 201 || bResp.status === 200) {
    try {
      const parsed = JSON.parse(bResp.body);
      if (Array.isArray(parsed) && parsed.length > 0) {
        bookingId = parsed[0].id;
      }
    } catch (e) {}
  }

  // ── STEP 4: DRIVER ATOMIC ACCEPTANCE CONCURRENCY ──
  if (bookingId) {
    const acceptPayload = JSON.stringify({
      status: 'ACCEPTED',
      driver_user_id: driverId,
      driver_id: driverId,
    });

    const acceptResp = http.patch(
      `${BASE_URL}/rest/v1/haul_bookings?id=eq.${bookingId}&status=eq.PENDING`,
      acceptPayload,
      { headers: HEADERS }
    );

    if (acceptResp.status === 200 || acceptResp.status === 204) {
      successfulTrips.add(1);
    } else if (acceptResp.status === 409) {
      concurrencyConflicts.add(1);
    }

    // Cleanup synthetic booking
    http.del(`${BASE_URL}/rest/v1/haul_bookings?id=eq.${bookingId}`, null, { headers: HEADERS });
  }

  sleep(1);
}
