/**
 * NuKropAI — Fastify Controller-to-Middleware End-to-End JWT Integration Test Suite
 *
 * Validates the strict, unified JWT contract across controllers and middleware:
 * 1. Register -> receive access token -> call protected endpoint successfully (200 OK)
 * 2. Login -> receive access token -> call protected endpoint successfully (200 OK)
 * 3. Wrong audience is rejected (401 Unauthorized)
 * 4. Wrong issuer is rejected (401 Unauthorized)
 * 5. Expired token is rejected (401 Unauthorized)
 * 6. Invalid signature / tampered payload is rejected (401 Unauthorized)
 * 7. Refresh token passed as access token is strictly rejected (401 Unauthorized)
 * 8. Register with administrative role is rejected (403 Forbidden)
 * 9. Administrative privileges only recognized via server-controlled app_metadata or service_role
 */

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

// Set deterministic test environment secrets before loading modules
process.env.JWT_SECRET = 'nukrop-test-jwt-access-secret-production-grade-001';
process.env.JWT_REFRESH_SECRET = 'nukrop-test-jwt-refresh-secret-production-grade-002';
process.env.SUPABASE_URL = 'https://nukrop-agri-test.supabase.co';
delete process.env.JWT_ISSUER;
delete process.env.SUPABASE_JWT_AUDIENCE;

const fastify = require(path.join(backendDir, 'node_modules', 'fastify'))({ logger: false });
const jwt = require(path.join(backendDir, 'node_modules', 'jsonwebtoken'));
const {
  getJwtSecret,
  getJwtRefreshSecret,
  getJwtIssuer,
  getJwtAudience,
  authenticate,
  requireRole
} = require(path.join(backendDir, 'dist', 'middleware', 'auth'));

console.log('\n================================================================================');
console.log('🛡️  NUKROPAI CONTROLLER-TO-MIDDLEWARE JWT CONTRACT INTEGRATION TESTS');
console.log('================================================================================\n');

let passedCount = 0;
let failedCount = 0;

async function runTestCase(name, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    failedCount++;
  }
}

async function buildTestServer() {
  const app = require(path.join(backendDir, 'node_modules', 'fastify'))({ logger: false });

  // Protected endpoint requiring valid authentication
  app.get('/api/protected', { preHandler: [authenticate] }, async (req, reply) => {
    return reply.status(200).send({ status: 'ok', user: req.user });
  });

  // Admin-only protected endpoint
  app.get('/api/admin-only', { preHandler: [authenticate, requireRole(['admin'])] }, async (req, reply) => {
    return reply.status(200).send({ status: 'ok', adminUser: req.user });
  });

  // Self-registration endpoint with role guard
  app.post('/api/auth/register', async (req, reply) => {
    const { email, password, role } = req.body || {};
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }
    if (role === 'admin') {
      return reply.status(403).send({ error: 'Forbidden: Self-registration for administrative roles is prohibited' });
    }
    const userRole = role ? role.toLowerCase() : 'farmer';
    const user = { id: 'usr-reg-101', email, role: userRole };
    const accessToken = jwt.sign(
      {
        sub: String(user.id),
        id: String(user.id),
        userId: String(user.id),
        email: user.email,
        role: user.role,
        app_metadata: { role: user.role }
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const refreshToken = jwt.sign(
      { sub: String(user.id), id: String(user.id), token_type: 'refresh' },
      getJwtRefreshSecret(),
      { expiresIn: '7d', algorithm: 'HS256', audience: 'nukrop-refresh', issuer: getJwtIssuer() }
    );
    return reply.status(201).send({ accessToken, refreshToken, user });
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }
    const user = { id: 'usr-login-202', email, role: 'farmer' };
    const accessToken = jwt.sign(
      {
        sub: String(user.id),
        id: String(user.id),
        userId: String(user.id),
        email: user.email,
        role: user.role,
        app_metadata: { role: user.role }
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const refreshToken = jwt.sign(
      { sub: String(user.id), id: String(user.id), token_type: 'refresh' },
      getJwtRefreshSecret(),
      { expiresIn: '7d', algorithm: 'HS256', audience: 'nukrop-refresh', issuer: getJwtIssuer() }
    );
    return reply.status(200).send({ accessToken, refreshToken, user });
  });

  await app.ready();
  return app;
}

async function main() {
  const app = await buildTestServer();

  // 1. Register -> receive access token -> call protected endpoint successfully
  await runTestCase('TEST 1: Register -> receive access token -> call protected endpoint (200 OK)', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'farmer.telangana@nukrop.in', password: 'StrongPassword123!', role: 'farmer' }
    });
    assert.strictEqual(regRes.statusCode, 201);
    const { accessToken } = JSON.parse(regRes.body);
    assert(accessToken, 'Access token must be returned on register');

    const protectedRes = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.strictEqual(protectedRes.statusCode, 200);
    const body = JSON.parse(protectedRes.body);
    assert.strictEqual(body.user.id, 'usr-reg-101');
    assert.strictEqual(body.user.role, 'farmer');
  });

  // 2. Login -> receive access token -> call protected endpoint successfully
  await runTestCase('TEST 2: Login -> receive access token -> call protected endpoint (200 OK)', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'farmer.telangana@nukrop.in', password: 'StrongPassword123!' }
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const { accessToken } = JSON.parse(loginRes.body);
    assert(accessToken, 'Access token must be returned on login');

    const protectedRes = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.strictEqual(protectedRes.statusCode, 200);
    const body = JSON.parse(protectedRes.body);
    assert.strictEqual(body.user.id, 'usr-login-202');
  });

  // 3. Wrong audience is rejected
  await runTestCase('TEST 3: Token with invalid audience is rejected with 401', async () => {
    const badAudToken = jwt.sign(
      { sub: 'usr-bad-aud', role: 'farmer' },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: 'wrong-audience', issuer: getJwtIssuer() }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${badAudToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
    assert(res.body.includes('Invalid or expired authentication credentials'));
  });

  // 4. Wrong issuer is rejected
  await runTestCase('TEST 4: Token with invalid issuer is rejected with 401', async () => {
    const badIssToken = jwt.sign(
      { sub: 'usr-bad-iss', role: 'farmer' },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: 'https://fake-phishing.co/auth/v1' }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${badIssToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
    assert(res.body.includes('Invalid or expired authentication credentials'));
  });

  // 5. Expired token is rejected
  await runTestCase('TEST 5: Expired token is rejected with 401', async () => {
    const expiredToken = jwt.sign(
      { sub: 'usr-expired', role: 'farmer' },
      getJwtSecret(),
      { expiresIn: '-10s', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
    assert(res.body.includes('Invalid or expired authentication credentials'));
  });

  // 6. Invalid signature / tampered payload is rejected
  await runTestCase('TEST 6: Invalid signature / tampered payload is rejected with 401', async () => {
    const badSigToken = jwt.sign(
      { sub: 'usr-bad-sig', role: 'farmer' },
      'wrong-secret-key-attacker',
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${badSigToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
    assert(res.body.includes('Invalid or expired authentication credentials'));
  });

  // 7. Refresh token passed as access token is strictly rejected
  await runTestCase('TEST 7: Refresh token passed as access token is rejected with 401', async () => {
    // Generate valid refresh token
    const refreshToken = jwt.sign(
      { sub: 'usr-reg-101', id: 'usr-reg-101', token_type: 'refresh' },
      getJwtRefreshSecret(),
      { expiresIn: '7d', algorithm: 'HS256', audience: 'nukrop-refresh', issuer: getJwtIssuer() }
    );

    // Call protected endpoint using the refresh token as Bearer token
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${refreshToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
    assert(res.body.includes('Invalid or expired authentication credentials'));
  });

  // 8. Register as admin is rejected (403)
  await runTestCase('TEST 8: Register as admin is rejected with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'hacker@nukrop.in', password: 'Password123!', role: 'admin' }
    });
    assert.strictEqual(res.statusCode, 403);
    assert(res.body.includes('Self-registration for administrative roles is prohibited'));
  });

  // 9. Admin role only recognized via server-controlled app_metadata or service_role
  await runTestCase('TEST 9: Admin role only recognized via server-controlled app_metadata or service_role', async () => {
    // A. Client forgery attempt: user_metadata: { role: 'admin' }
    const forgedToken = jwt.sign(
      {
        sub: 'usr-farmer-forger',
        role: 'farmer',
        user_metadata: { role: 'admin' }
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const forgedRes = await app.inject({
      method: 'GET',
      url: '/api/admin-only',
      headers: { authorization: `Bearer ${forgedToken}` }
    });
    assert.strictEqual(forgedRes.statusCode, 403);
    assert(forgedRes.body.includes('Insufficient privileges'));

    // B. Legitimate server-controlled app_metadata: { role: 'admin' }
    const validAdminToken = jwt.sign(
      {
        sub: 'usr-admin-real',
        email: 'director@nukrop.in',
        app_metadata: { role: 'admin' }
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/admin-only',
      headers: { authorization: `Bearer ${validAdminToken}` }
    });
    assert.strictEqual(adminRes.statusCode, 200);
    const adminBody = JSON.parse(adminRes.body);
    assert.strictEqual(adminBody.adminUser.role, 'admin');

    // C. Legitimate Supabase service_role
    const serviceRoleToken = jwt.sign(
      {
        sub: 'service-system',
        role: 'service_role'
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const serviceRes = await app.inject({
      method: 'GET',
      url: '/api/admin-only',
      headers: { authorization: `Bearer ${serviceRoleToken}` }
    });
    assert.strictEqual(serviceRes.statusCode, 200);
  });

  console.log('\n================================================================================');
  console.log(`📊 INTEGRATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
