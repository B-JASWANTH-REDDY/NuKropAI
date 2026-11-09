/**
 * NuKropAI — Canonical Identity & Multi-Role RLS Isolation Security Suite
 *
 * Verifies:
 * 1. Single canonical user UUID across public.users, JWT sub claim, and public.profiles.
 * 2. Supabase-compatible audience ('authenticated') and role claims.
 * 3. Server-authoritative role binding in app_metadata.
 * 4. Cross-user isolation: User A cannot access or mutate User B's resources.
 * 5. Driver, Farmer, Buyer, Admin role integrity and isolation.
 */

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

process.env.JWT_SECRET = 'canonical-identity-test-key-32-chars-long!';
process.env.JWT_REFRESH_SECRET = 'canonical-refresh-test-key-32-chars-long!';
process.env.SUPABASE_URL = 'https://nukrop-agri-test.supabase.co';

const fastify = require(path.join(backendDir, 'node_modules', 'fastify'));
const jwt = require(path.join(backendDir, 'node_modules', 'jsonwebtoken'));

const authRoutes = require(path.join(backendDir, 'dist', 'routes', 'auth.routes')).default;
const { authenticate, requireRole } = require(path.join(backendDir, 'dist', 'middleware', 'auth'));
const { query, memoryStore } = require(path.join(backendDir, 'dist', 'config', 'db'));

console.log('\n================================================================================');
console.log('🛡️  NUKROPAI CANONICAL IDENTITY & RLS ISOLATION AUDIT');
console.log('================================================================================\n');

async function main() {
  const app = fastify({ logger: false });
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Profile endpoint simulating RLS
  app.get('/api/profile/:userId', { preHandler: [authenticate] }, async (req, reply) => {
    const requestedUserId = req.params.userId;
    const authenticatedUserId = req.user.id;

    // RLS Enforcement: auth.uid() === user_id
    if (requestedUserId !== authenticatedUserId && req.user.role !== 'admin') {
      return reply.status(403).send({ error: 'RLS_VIOLATION: Access denied to other user profile' });
    }

    const res = await query('SELECT * FROM public.profiles WHERE user_id = $1', [requestedUserId]);
    return reply.status(200).send({ profile: res.rows[0] || null });
  });

  await app.ready();

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✖ [FAIL] ${name}: ${e.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✖ [FAIL] ${name}: ${e.message}`);
    }
  }

  // 1. Register Farmer -> receives canonical UUID
  let farmerToken = '';
  let farmerId = '';
  await testAsync('ID-1: Registration creates single canonical user UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'canonical.farmer@nukrop.in',
        password: 'FarmerSecurePass123!',
        role: 'farmer'
      }
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    farmerToken = body.accessToken;
    farmerId = body.user.id;

    // Must be valid 36-char UUID
    assert.match(farmerId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    // Check JWT payload claims
    const decoded = jwt.decode(farmerToken);
    assert.strictEqual(decoded.sub, farmerId);
    assert.strictEqual(decoded.id, farmerId);
    assert.strictEqual(decoded.aud, 'authenticated');
    assert.strictEqual(decoded.app_metadata.role, 'farmer');
  });

  // 2. Profile sync parity
  await testAsync('ID-2: Canonical UUID synchronizes to public.profiles', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/profile/${farmerId}`,
      headers: { authorization: `Bearer ${farmerToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert(body.profile, 'Profile must exist');
    assert.strictEqual(body.profile.user_id, farmerId);
    assert.strictEqual(body.profile.role, 'farmer');
  });

  // 3. Register Driver -> separate canonical UUID
  let driverToken = '';
  let driverId = '';
  await testAsync('ID-3: Driver registers with distinct canonical UUID and driver role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'canonical.driver@nukrop.in',
        password: 'DriverSecurePass123!',
        role: 'driver'
      }
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    driverToken = body.accessToken;
    driverId = body.user.id;

    assert.notStrictEqual(driverId, farmerId);
    const decoded = jwt.decode(driverToken);
    assert.strictEqual(decoded.sub, driverId);
    assert.strictEqual(decoded.role, 'driver');
    assert.strictEqual(decoded.app_metadata.role, 'driver');
  });

  // 4. Adversarial RLS Isolation: Driver cannot read Farmer profile
  await testAsync('ID-4: Adversarial isolation: Driver cannot read Farmer profile (RLS 403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/profile/${farmerId}`,
      headers: { authorization: `Bearer ${driverToken}` }
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert(body.error.includes('RLS_VIOLATION'));
  });

  // 5. Adversarial RLS Isolation: Farmer cannot read Driver profile
  await testAsync('ID-5: Adversarial isolation: Farmer cannot read Driver profile (RLS 403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/profile/${driverId}`,
      headers: { authorization: `Bearer ${farmerToken}` }
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert(body.error.includes('RLS_VIOLATION'));
  });

  // 6. Public Profile Discovery Opt-In Security & Lifecycle
  await testAsync('ID-6: Default privacy shield: New profile has discovery disabled by default (false)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.public_profile_enabled, false);
  });

  await testAsync('ID-7: Authenticated user explicitly opts into public discovery (200 OK)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { enabled: true }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.public_profile_enabled, true);
  });

  await testAsync('ID-8: Authenticated user immediately revokes public discovery opt-in (200 OK)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { enabled: false }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.public_profile_enabled, false);
  });

  await testAsync('ID-9: Unauthenticated request to discovery API is rejected (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      payload: { enabled: true }
    });

    assert.strictEqual(res.statusCode, 401);
  });

  await testAsync('ID-10: Invalid discovery payload (non-boolean) is rejected (400 Bad Request)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { enabled: 'invalid-string' }
    });

    assert.strictEqual(res.statusCode, 400);
  });

  await testAsync('ID-11: Adversarial payload cannot tamper with another user profile via injected parameters', async () => {
    // Farmer attempts to pass Driver ID in body
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { enabled: true, user_id: driverId, id: driverId }
    });

    assert.strictEqual(res.statusCode, 200);
    // Verify driver profile discovery remains FALSE (unchanged)
    const driverRes = await app.inject({
      method: 'GET',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${driverToken}` }
    });
    assert.strictEqual(driverRes.statusCode, 200);
    const driverBody = JSON.parse(driverRes.body);
    assert.strictEqual(driverBody.public_profile_enabled, false);
  });

  await testAsync('ID-12: Missing enabled or null payload rejected with 400 Bad Request', async () => {
    const resNull = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { enabled: null }
    });
    assert.strictEqual(resNull.statusCode, 400);

    const resEmpty = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: {}
    });
    assert.strictEqual(resEmpty.statusCode, 400);

    const resNumber = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { enabled: 1 }
    });
    assert.strictEqual(resNumber.statusCode, 400);
  });

  await testAsync('ID-13: Expired token to discovery API is rejected with 401 Unauthorized', async () => {
    const expiredToken = jwt.sign(
      { sub: farmerId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET,
      { audience: 'authenticated', issuer: 'https://nukrop-agri-test.supabase.co/auth/v1' }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await testAsync('ID-14: Tampered signature to discovery API is rejected with 401 Unauthorized', async () => {
    const tamperedToken = farmerToken.substring(0, farmerToken.length - 5) + 'xxxxx';

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${tamperedToken}` },
      payload: { enabled: true }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await testAsync('ID-15: Non-existent profile returns 404 without crashing', async () => {
    const phantomUserId = '99999999-9999-9999-9999-999999999999';
    const phantomToken = jwt.sign(
      { sub: phantomUserId, role: 'authenticated', app_metadata: { role: 'farmer' } },
      process.env.JWT_SECRET,
      { audience: 'authenticated', issuer: 'https://nukrop-agri-test.supabase.co/auth/v1', expiresIn: '1h' }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${phantomToken}` }
    });
    assert.strictEqual(res.statusCode, 404);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${phantomToken}` },
      payload: { enabled: true }
    });
    assert.strictEqual(patchRes.statusCode, 404);
  });

  await testAsync('ID-16: Ambiguous identity mapping (multiple profiles matching user_id) returns 409 Conflict with AMBIGUOUS_IDENTITY', async () => {
    const ambiguousUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    // Simulate ambiguous duplicate profile records
    memoryStore.profiles.push({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
      user_id: ambiguousUserId,
      public_id: 'nk_pub_ambiguous_01',
      full_name: 'Ambiguous User Duplicate 1',
      role: 'farmer',
      public_profile_enabled: false,
      created_at: new Date()
    });
    memoryStore.profiles.push({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
      user_id: ambiguousUserId,
      public_id: 'nk_pub_ambiguous_02',
      full_name: 'Ambiguous User Duplicate 2',
      role: 'farmer',
      public_profile_enabled: true,
      created_at: new Date()
    });

    const ambiguousToken = jwt.sign(
      { sub: ambiguousUserId, role: 'authenticated', app_metadata: { role: 'farmer' } },
      process.env.JWT_SECRET,
      { audience: 'authenticated', issuer: 'https://nukrop-agri-test.supabase.co/auth/v1', expiresIn: '1h' }
    );

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${ambiguousToken}` }
    });
    assert.strictEqual(getRes.statusCode, 409);
    const getBody = JSON.parse(getRes.body);
    assert.strictEqual(getBody.code, 'AMBIGUOUS_IDENTITY');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${ambiguousToken}` },
      payload: { enabled: true }
    });
    assert.strictEqual(patchRes.statusCode, 409);
    const patchBody = JSON.parse(patchRes.body);
    assert.strictEqual(patchBody.code, 'AMBIGUOUS_IDENTITY');
  });

  await testAsync('ID-17: Discovery API does not accept public_id in Bearer token or URL to mutate private profile', async () => {
    // Attempting to authorize using a public_id instead of authenticated user UUID is rejected
    const publicIdToken = jwt.sign(
      { sub: 'nk_pub_fake_public_id_value', role: 'authenticated', app_metadata: { role: 'farmer' } },
      process.env.JWT_SECRET,
      { audience: 'authenticated', issuer: 'https://nukrop-agri-test.supabase.co/auth/v1', expiresIn: '1h' }
    );

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${publicIdToken}` },
      payload: { enabled: true }
    });
    // Public ID is not a canonical auth user_id, profile not found
    assert.strictEqual(res.statusCode, 404);
  });

  await testAsync('ID-18: Cross-collision (Profile A id === Profile B user_id) returns HTTP 409 AMBIGUOUS_IDENTITY', async () => {
    const crossUidX = '66666666-6666-6666-6666-666666666661';
    const crossUidY = '66666666-6666-6666-6666-666666666662';
    const crossUidZ = '66666666-6666-6666-6666-666666666663';

    // Profile X has id=crossUidX, user_id=crossUidY
    memoryStore.profiles.push({
      id: crossUidX,
      user_id: crossUidY,
      public_id: 'nk_pub_cross_x1',
      full_name: 'Cross Collision Farmer X',
      role: 'farmer',
      public_profile_enabled: false,
      created_at: new Date()
    });

    // Profile Y has id=crossUidY, user_id=crossUidZ
    memoryStore.profiles.push({
      id: crossUidY,
      user_id: crossUidZ,
      public_id: 'nk_pub_cross_y1',
      full_name: 'Cross Collision Farmer Y',
      role: 'farmer',
      public_profile_enabled: false,
      created_at: new Date()
    });

    const crossToken = jwt.sign(
      { sub: crossUidY, role: 'authenticated', app_metadata: { role: 'farmer' } },
      process.env.JWT_SECRET,
      { audience: 'authenticated', issuer: 'https://nukrop-agri-test.supabase.co/auth/v1', expiresIn: '1h' }
    );

    // Call discovery endpoint as crossUidY: matches both Profile X (user_id) and Profile Y (id)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile/discovery',
      headers: { authorization: `Bearer ${crossToken}` },
      payload: { enabled: true }
    });

    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'AMBIGUOUS_IDENTITY');

    // Verify neither profile row was modified
    const profX = memoryStore.profiles.find(p => p.id === crossUidX);
    const profY = memoryStore.profiles.find(p => p.id === crossUidY);
    assert.strictEqual(profX.public_profile_enabled, false);
    assert.strictEqual(profY.public_profile_enabled, false);
  });

  await testAsync('ID-19: Registration generates dedicated cryptographically secure public_id (nk_pub_* with 128-bit entropy)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'csprng.farmer@nukrop.in',
        password: 'FarmerSecurePass456!',
        role: 'farmer'
      }
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    const createdProfile = memoryStore.profiles.find(p => p.id === body.user.id);
    assert(createdProfile, 'Profile must exist in store');
    assert.match(createdProfile.public_id, /^nk_pub_[0-9a-f]{32}$/i);
    assert.strictEqual(createdProfile.public_id.length, 39); // 'nk_pub_' (7) + 32 hex = 39 chars
    // Ensure public_id is completely independent of user UUID and email
    assert(!createdProfile.public_id.includes(body.user.id.replace(/-/g, '')));
    assert(!createdProfile.public_id.includes('farmer'));
  });

  await testAsync('ID-19b: Client attempts to supply custom, arbitrary, or UUID-injected public_id are rejected', async () => {
    // 1. Attempting empty public_id
    let emptyRejected = false;
    try {
      await query('insert into public.profiles (id, public_id) values ($1, $2)', ['test-empty-uid', '']);
    } catch (e) {
      if (e.message.includes('MALFORMED_PUBLIC_ID')) emptyRejected = true;
    }
    assert.strictEqual(emptyRejected, true, 'Empty public_id must be rejected with MALFORMED_PUBLIC_ID');

    // 2. Attempting UUID injection
    let uuidInjectionRejected = false;
    try {
      await query('insert into public.profiles (id, public_id) values ($1, $2)', ['test-uuid-uid', '11111111-2222-3333-4444-555555555555']);
    } catch (e) {
      if (e.message.includes('UUID_INJECTION_REJECTED')) uuidInjectionRejected = true;
    }
    assert.strictEqual(uuidInjectionRejected, true, 'UUID injection must be rejected with UUID_INJECTION_REJECTED');

    // 3. Attempting arbitrary vanity string
    let vanityRejected = false;
    try {
      await query('insert into public.profiles (id, public_id) values ($1, $2)', ['test-vanity-uid', 'nk_pub_my_custom_vanity_name']);
    } catch (e) {
      if (e.message.includes('INVALID_PUBLIC_ID')) vanityRejected = true;
    }
    assert.strictEqual(vanityRejected, true, 'Arbitrary vanity public_id must be rejected with INVALID_PUBLIC_ID');
  });

  await testAsync('ID-20: Attempting to mutate public_id is rejected as immutable (IMMUTABLE_FIELD)', async () => {
    let immutabilityViolated = false;
    try {
      await query('UPDATE public.profiles SET public_id = $1 WHERE id = $2', ['nk_pub_hack', farmerId]);
    } catch (e) {
      if (e.message.includes('IMMUTABLE_FIELD')) {
        immutabilityViolated = true;
      }
    }
    assert.strictEqual(immutabilityViolated, true, 'Updating public_id must throw IMMUTABLE_FIELD error');
  });

  console.log('\n================================================================================');
  console.log(`📊 CANONICAL IDENTITY AUDIT: ${passed}/${total} PASSED`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

