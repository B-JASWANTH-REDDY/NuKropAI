/**
 * NuKropAI — Backend Production Controller-to-Middleware Real JWT Integration Suite
 *
 * Invokes the ACTUAL production controllers and route handlers:
 * - backend/src/controllers/auth.controller.ts (register, login, refresh, logout)
 * - backend/src/middleware/auth.ts (authenticate, requireRole, verifyAuthToken)
 * - backend/src/routes/auth.routes.ts
 *
 * Verifies via real Fastify HTTP request injection:
 * 1. Real Register -> receives controller-issued access token -> passes real auth middleware (200 OK)
 * 2. Real Login -> receives controller-issued access token -> passes real auth middleware (200 OK)
 * 3. Real Token Rotation -> receives rotated tokens -> new access token passes auth middleware (200 OK)
 * 4. Token Replay Protection -> attempting to reuse an already-revoked refresh token triggers session purge (403 Forbidden)
 * 5. Refresh token passed as Bearer token to protected endpoint is strictly rejected (401 Unauthorized)
 * 6. Real Logout -> revokes session -> subsequent refresh attempt fails
 * 7. Token with invalid audience is rejected by middleware (401 Unauthorized)
 * 8. Token with invalid issuer is rejected by middleware (401 Unauthorized)
 * 9. Expired token is rejected by middleware (401 Unauthorized)
 * 10. Tampered token signature is rejected by middleware (401 Unauthorized)
 * 11. Real Controller rejects self-registration with 'admin' role (403 Forbidden)
 * 12. Real Middleware blocks client user_metadata privilege escalation to 'admin' (403 Forbidden)
 */

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

// Configure isolated test environment
process.env.JWT_SECRET = 'nukrop-production-access-signing-key-998877665544';
process.env.JWT_REFRESH_SECRET = 'nukrop-production-refresh-signing-key-112233445566';
process.env.SUPABASE_URL = 'https://nukrop-agri-test.supabase.co';
delete process.env.JWT_ISSUER;
delete process.env.SUPABASE_JWT_AUDIENCE;

const fastify = require(path.join(backendDir, 'node_modules', 'fastify'));
const jwt = require(path.join(backendDir, 'node_modules', 'jsonwebtoken'));

// Import REAL production routes and middleware
const authRoutes = require(path.join(backendDir, 'dist', 'routes', 'auth.routes')).default;
const {
  getJwtSecret,
  getJwtRefreshSecret,
  getJwtIssuer,
  getJwtAudience,
  authenticate,
  requireRole
} = require(path.join(backendDir, 'dist', 'middleware', 'auth'));
const {
  register: realRegisterController,
  login: realLoginController,
  refresh: realRefreshController,
  logout: realLogoutController
} = require(path.join(backendDir, 'dist', 'controllers', 'auth.controller'));
const { memoryStore } = require(path.join(backendDir, 'dist', 'config', 'db'));

console.log('\n================================================================================');
console.log('🛡️  NUKROPAI REAL CONTROLLER-TO-MIDDLEWARE AUTHENTICATION INTEGRATION SUITE');
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

async function buildTestApp() {
  const app = fastify({ logger: false });

  // Register real production auth routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Register real protected endpoints using real middleware
  app.get('/api/protected', { preHandler: [authenticate] }, async (req, reply) => {
    return reply.status(200).send({ status: 'ok', user: req.user });
  });

  app.get('/api/admin-dashboard', { preHandler: [authenticate, requireRole(['admin'])] }, async (req, reply) => {
    return reply.status(200).send({ status: 'ok', adminUser: req.user });
  });

  await app.ready();
  return app;
}

async function main() {
  // Confirm real controller exports are genuine functions
  assert.strictEqual(typeof realRegisterController, 'function', 'realRegisterController must be a function');
  assert.strictEqual(typeof realLoginController, 'function', 'realLoginController must be a function');
  assert.strictEqual(typeof realRefreshController, 'function', 'realRefreshController must be a function');
  assert.strictEqual(typeof realLogoutController, 'function', 'realLogoutController must be a function');

  const app = await buildTestApp();

  let registeredUserEmail = 'real.farmer@warangal.nukrop.in';
  let registeredUserPassword = 'FarmSecurePass2026!';
  let activeAccessToken = '';
  let activeRefreshToken = '';
  let activeUserId = '';

  // 1. Real Register -> receives controller-issued access token -> passes real auth middleware
  await runTestCase('TEST 1: Real Register controller execution -> protected endpoint (200 OK)', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: registeredUserEmail,
        password: registeredUserPassword,
        role: 'farmer'
      }
    });

    assert.strictEqual(regRes.statusCode, 201, `Expected 201 from real register, got ${regRes.statusCode}: ${regRes.body}`);
    const body = JSON.parse(regRes.body);
    assert(body.accessToken, 'Access token must be present');
    assert(body.refreshToken, 'Refresh token must be present');
    assert(body.user && body.user.id, 'User record must be returned');

    activeAccessToken = body.accessToken;
    activeRefreshToken = body.refreshToken;
    activeUserId = body.user.id;

    // Verify token payload claims match production contract
    const decoded = jwt.decode(activeAccessToken);
    assert.strictEqual(decoded.aud, 'authenticated');
    assert.strictEqual(decoded.sub, activeUserId);
    assert.strictEqual(decoded.role, 'farmer');
    assert.strictEqual(decoded.app_metadata.role, 'farmer');

    // Call real protected endpoint with controller-issued token
    const protRes = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${activeAccessToken}` }
    });
    assert.strictEqual(protRes.statusCode, 200);
    const protBody = JSON.parse(protRes.body);
    assert.strictEqual(protBody.user.id, activeUserId);
    assert.strictEqual(protBody.user.role, 'farmer');
  });

  // 2. Real Login -> receives controller-issued access token -> passes real auth middleware
  await runTestCase('TEST 2: Real Login controller execution -> protected endpoint (200 OK)', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: registeredUserEmail,
        password: registeredUserPassword
      }
    });

    assert.strictEqual(loginRes.statusCode, 200, `Expected 200 from real login, got ${loginRes.statusCode}`);
    const body = JSON.parse(loginRes.body);
    assert(body.accessToken, 'Login must yield accessToken');
    assert(body.refreshToken, 'Login must yield refreshToken');

    const protRes = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${body.accessToken}` }
    });
    assert.strictEqual(protRes.statusCode, 200);
    const protBody = JSON.parse(protRes.body);
    assert.strictEqual(protBody.user.id, activeUserId);

    // Update active tokens
    activeAccessToken = body.accessToken;
    activeRefreshToken = body.refreshToken;
  });

  // 3. Real Token Rotation -> receives rotated tokens -> new access token passes auth middleware
  let rotatedRefreshToken = '';
  await runTestCase('TEST 3: Real Refresh controller execution -> token rotation (200 OK)', async () => {
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: activeRefreshToken }
    });

    assert.strictEqual(refreshRes.statusCode, 200, `Expected 200 from real refresh, got ${refreshRes.statusCode}`);
    const body = JSON.parse(refreshRes.body);
    assert(body.accessToken, 'Rotated access token must be returned');
    assert(body.refreshToken, 'Rotated refresh token must be returned');
    assert.notStrictEqual(body.refreshToken, activeRefreshToken, 'Rotated refresh token must differ from old token');

    rotatedRefreshToken = body.refreshToken;

    // Verify newly rotated access token works against real protected endpoint
    const protRes = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${body.accessToken}` }
    });
    assert.strictEqual(protRes.statusCode, 200);
  });

  // 4. Token Replay Protection -> attempting to reuse an already-revoked refresh token triggers session purge (403)
  await runTestCase('TEST 4: Refresh token replay attack triggers session revocation (403 Forbidden)', async () => {
    // Replay the OLD refresh token that was already rotated in Test 3
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: activeRefreshToken }
    });

    assert.strictEqual(replayRes.statusCode, 403, `Expected 403 on token reuse, got ${replayRes.statusCode}`);
    const body = JSON.parse(replayRes.body);
    assert(body.error.includes('Token reuse detected'), 'Must alert on token reuse');

    // Confirm that the entire session was revoked: even the rotatedRefreshToken is now invalid
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: rotatedRefreshToken }
    });
    assert.strictEqual(invalidRes.statusCode, 403, 'Subsequent requests with sibling tokens must be revoked');
  });

  // 5. Refresh token passed as Bearer token to protected endpoint is strictly rejected (401)
  await runTestCase('TEST 5: Refresh token passed as Bearer token rejected by auth middleware (401 Unauthorized)', async () => {
    // Issue a fresh token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: registeredUserEmail, password: registeredUserPassword }
    });
    const { refreshToken } = JSON.parse(loginRes.body);

    const badBearerRes = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${refreshToken}` }
    });
    assert.strictEqual(badBearerRes.statusCode, 401, `Expected 401 when using refresh token as access token, got ${badBearerRes.statusCode}`);
  });

  // 6. Real Logout -> revokes session -> subsequent refresh attempt fails
  await runTestCase('TEST 6: Real Logout controller revokes session', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: registeredUserEmail, password: registeredUserPassword }
    });
    const { refreshToken } = JSON.parse(loginRes.body);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken }
    });
    assert.strictEqual(logoutRes.statusCode, 200);

    const postLogoutRefresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken }
    });
    assert.strictEqual(postLogoutRefresh.statusCode, 403, 'Logged out token must be rejected on refresh');
  });

  // 7. Token with invalid audience is rejected by middleware (401)
  await runTestCase('TEST 7: Token with invalid audience rejected by middleware (401)', async () => {
    const badAudToken = jwt.sign(
      { sub: activeUserId, role: 'farmer' },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: 'malicious-client-aud', issuer: getJwtIssuer() }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${badAudToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 8. Token with invalid issuer is rejected by middleware (401)
  await runTestCase('TEST 8: Token with invalid issuer rejected by middleware (401)', async () => {
    const badIssToken = jwt.sign(
      { sub: activeUserId, role: 'farmer' },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: 'https://phishing-site.co/auth/v1' }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${badIssToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 9. Expired token is rejected by middleware (401)
  await runTestCase('TEST 9: Expired token rejected by middleware (401)', async () => {
    const expiredToken = jwt.sign(
      { sub: activeUserId, role: 'farmer' },
      getJwtSecret(),
      { expiresIn: '-10s', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 10. Tampered token signature is rejected by middleware (401)
  await runTestCase('TEST 10: Tampered token signature rejected by middleware (401)', async () => {
    const tamperedToken = activeAccessToken.substring(0, activeAccessToken.length - 8) + 'abcdefgh';
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${tamperedToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 11. Real Controller rejects self-registration with 'admin' role (403)
  await runTestCase('TEST 11: Real Controller blocks self-registration with admin role (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'attacker@nukrop.in',
        password: 'Password123!',
        role: 'admin'
      }
    });
    assert.strictEqual(res.statusCode, 403, `Expected 403 on admin registration, got ${res.statusCode}`);
    assert(res.body.includes('Self-registration for administrative roles is prohibited'));
  });

  // 12. Real Middleware blocks client user_metadata privilege escalation to 'admin' (403)
  await runTestCase('TEST 12: Client user_metadata role forgery blocked by requireRole (403 Forbidden)', async () => {
    // Forged token containing client-crafted user_metadata: { role: 'admin' }
    const forgedToken = jwt.sign(
      {
        sub: 'forged-attacker-id',
        role: 'farmer',
        user_metadata: { role: 'admin' }
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );

    const forgedRes = await app.inject({
      method: 'GET',
      url: '/api/admin-dashboard',
      headers: { authorization: `Bearer ${forgedToken}` }
    });
    assert.strictEqual(forgedRes.statusCode, 403, `Client user_metadata forgery must be denied with 403, got ${forgedRes.statusCode}`);

    // Legitimate server-authoritative app_metadata: { role: 'admin' }
    const legitAdminToken = jwt.sign(
      {
        sub: 'legit-admin-id',
        email: 'director@nukrop.gov.in',
        app_metadata: { role: 'admin' }
      },
      getJwtSecret(),
      { expiresIn: '15m', algorithm: 'HS256', audience: getJwtAudience(), issuer: getJwtIssuer() }
    );

    const legitRes = await app.inject({
      method: 'GET',
      url: '/api/admin-dashboard',
      headers: { authorization: `Bearer ${legitAdminToken}` }
    });
    assert.strictEqual(legitRes.statusCode, 200, `Server app_metadata admin must succeed with 200, got ${legitRes.statusCode}`);
  });

  console.log('\n================================================================================');
  console.log(`📊 REAL CONTROLLER INTEGRATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal integration test failure:', err);
  process.exit(1);
});
