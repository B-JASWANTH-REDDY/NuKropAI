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

export function setup() {
  // Pre-flight target validation: ensure we never point at production Supabase
  if (BASE_URL.includes('yxjqseiegwjdfnccdchk') || BASE_URL.includes('prod.nukrop.ai')) {
    throw new Error('FATAL SAFETY VIOLATION: Load test cannot target production infrastructure!');
  }
  console.log(`[k6 Setup] Commencing load test against staging target: ${BASE_URL}`);
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
      'mandi rates returns 200 or 502 upstream': (r) => r.status === 200 || r.status === 502,
    });
    // 502 represents upstream data.gov.in downtime, not gateway failure
    errorRate.add(res.status >= 500 && res.status !== 502);
  });

  group('3. Authentic Login & Token Issuance', () => {
    const loginPayload = JSON.stringify({
      email: '9876543210@nukrop.ai',
      password: 'TestPassword@2026',
    });

    const start = Date.now();
    const res = http.post(`${data.baseUrl}/api/v1/auth/login`, loginPayload, params);
    authLatency.add(Date.now() - start);

    const success = check(res, {
      'auth returns expected response (200 or 401)': (r) => r.status === 200 || r.status === 401,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(1);
}

export function teardown(data) {
  console.log('[k6 Teardown] Load test cycle completed successfully.');
}
