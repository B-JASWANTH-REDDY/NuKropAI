/**
 * ==============================================================================
 * NuKropAI Enterprise Platform — k6 Backend Load & Scalability Test
 * Target Contract: Fastify API Gateway (:3000 / api.staging.nukropai.com)
 * Target Validator: Localhost or verified staging cluster only (Zero production hit)
 * ==============================================================================
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom Metrics
const errorRate = new Rate('nukrop_error_rate');
const mandiLatency = new Trend('nukrop_mandi_latency_ms');
const authLatency = new Trend('nukrop_auth_latency_ms');

// Test Configuration: Realistic Ramping Stages
export const options = {
  maxRedirects: 0, // Strictly reject following HTTP redirects to prevent redirection to production
  stages: [
    { duration: '30s', target: 50 },    // Warm-up to 50 VUs
    { duration: '1m', target: 200 },    // Ramp to 200 concurrent farmers
    { duration: '2m', target: 500 },    // Sustained peak at 500 concurrent users
    { duration: '30s', target: 0 },     // Graceful ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'], // 95% of requests under 300ms
    nukrop_error_rate: ['rate<0.01'],               // Less than 1% errors
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

const ALLOWED_TARGET_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '::1',
  'api.staging.nukropai.com',
  'staging.nukropai.com',
];

const DISALLOWED_PATTERNS = [
  'api.nukropai.com',
  'prod.nukrop.ai',
  'nukrop.ai',
  'yxjqseiegwjdfnccdchk',
  'supabase.co',
];

function validateTargetUrl(rawUrl) {
  // Reject production patterns
  for (const pattern of DISALLOWED_PATTERNS) {
    if (rawUrl.toLowerCase().includes(pattern.toLowerCase())) {
      throw new Error(`FATAL SAFETY VIOLATION: Load test target "${rawUrl}" contains prohibited production pattern "${pattern}"!`);
    }
  }

  // Extract hostname
  const match = rawUrl.match(/^https?:\/\/([^/:]+)/i);
  if (!match) {
    throw new Error(`FATAL SAFETY VIOLATION: Malformed load test target URL "${rawUrl}"!`);
  }
  const hostname = match[1].toLowerCase();

  if (!ALLOWED_TARGET_HOSTNAMES.includes(hostname)) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Target host "${hostname}" is not in the explicit staging allowlist: [${ALLOWED_TARGET_HOSTNAMES.join(', ')}].`,
    );
  }
}

export function setup() {
  // Pre-flight target validation: ensure we never point at production or unauthorized hosts
  validateTargetUrl(BASE_URL);
  console.log(`[k6 Setup] Commencing load test against verified staging target: ${BASE_URL}`);

  // Provision load test user account once before VU execution to guarantee authentic 200 authentications
  const userPayload = JSON.stringify({
    name: 'Load Test Farmer',
    email: 'k6_farmer_test@nukrop.ai',
    password: 'TestPassword@2026',
    phone: '9876543210',
    role: 'farmer',
    state: 'Telangana',
    district: 'Warangal'
  });
  http.post(`${BASE_URL}/api/v1/auth/register`, userPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s'
  });

  return { baseUrl: BASE_URL };
}

export default function (data) {
  const correlationId = `k6_corr_${__VU}_${__ITER}_${Date.now()}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-Id': correlationId,
    },
    timeout: '5s',
  };

  group('1. Health & Telemetry Probes', () => {
    const res = http.get(`${data.baseUrl}/health`, params);
    const success = check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  group('2. Live APMC Mandi Spatial Rate Queries', () => {
    const start = Date.now();
    const res = http.get(
      `${data.baseUrl}/api/v1/mandi/rates?state=Telangana&commodity=Cotton`,
      params
    );
    mandiLatency.add(Date.now() - start);

    const success = check(res, {
      'mandi rates returns 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  group('3. Authentic Login & Token Issuance', () => {
    const loginPayload = JSON.stringify({
      email: 'k6_farmer_test@nukrop.ai',
      password: 'TestPassword@2026',
    });

    const start = Date.now();
    const res = http.post(`${data.baseUrl}/api/v1/auth/login`, loginPayload, params);
    authLatency.add(Date.now() - start);

    const success = check(res, {
      'auth returns 200 with tokens': (r) => r.status === 200 && r.json('accessToken') !== undefined,
    });
    errorRate.add(!success);
  });

  sleep(1);
}

export function teardown(data) {
  console.log('[k6 Teardown] Load test cycle completed successfully.');
}

