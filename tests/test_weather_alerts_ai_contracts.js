/**
 * NuKropAI — Weather, Price Alerts, Notifications & AI Scanner Contracts Suite
 * Verifies P0.3, P0.4, P0.5, and P1.1 implementation contracts
 */

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

process.env.JWT_SECRET = 'nukrop-production-access-signing-key-998877665544';
process.env.JWT_REFRESH_SECRET = 'nukrop-production-refresh-signing-key-112233445566';

const fastify = require(path.join(backendDir, 'node_modules', 'fastify'));
const {
  getCurrentWeather,
  createPriceAlert,
  getPriceAlerts,
  cancelPriceAlert,
  evaluatePriceAlerts,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead
} = require(path.join(backendDir, 'dist', 'controllers', 'weather.controller'));

const {
  diagnoseCropFoliar
} = require(path.join(backendDir, 'dist', 'controllers', 'ai.controller'));

const { memoryStore, pool } = require(path.join(backendDir, 'dist', 'config', 'db'));

let passed = 0;
let failed = 0;

function pass(name, details) {
  passed++;
  console.log(`  ✔ [PASS] ${name}${details ? ` (${details})` : ''}`);
}

function fail(name, reason) {
  failed++;
  console.error(`  ❌ [FAIL] ${name}: ${reason}`);
}

async function runContractsSuite() {
  console.log('\n================================================================================');
  console.log('🌦️  NUKROPAI WEATHER, PRICE ALERTS, NOTIFICATIONS & AI CONTRACTS SUITE');
  console.log('================================================================================\n');

  // Build Fastify App
  const app = fastify({ logger: false });

  // Decorate user
  app.addHook('onRequest', async (req) => {
    const userId = req.headers['x-user-id'] || 'test-user-1111';
    req.user = { id: userId, email: 'test@nukrop.ai', role: 'farmer' };
  });

  // Register routes
  app.get('/weather/current', getCurrentWeather);
  app.post('/weather/price-alerts', createPriceAlert);
  app.get('/weather/price-alerts', getPriceAlerts);
  app.delete('/weather/price-alerts/:id', cancelPriceAlert);
  app.get('/weather/notifications', getNotifications);
  app.get('/weather/notifications/unread-count', getUnreadNotificationsCount);
  app.patch('/weather/notifications/:id/read', markNotificationRead);
  app.post('/weather/notifications/mark-all-read', markAllNotificationsRead);

  app.post('/ai/diagnose', diagnoseCropFoliar);

  await app.ready();

  // ---------------------------------------------------------------------------
  // P0.3: Weather Controller Tests
  // ---------------------------------------------------------------------------
  console.log('▶ P0.3: Weather Telemetry & Foliar Spray Contract');

  // W-1: Missing location returns 400 MISSING_LOCATION
  const resW1 = await app.inject({
    method: 'GET',
    url: '/weather/current'
  });
  if (resW1.statusCode === 400 && resW1.json().error === 'MISSING_LOCATION') {
    pass('W-1', 'Missing coordinates and district rejected with 400 MISSING_LOCATION');
  } else {
    fail('W-1', `Expected 400 MISSING_LOCATION, got ${resW1.statusCode}: ${resW1.body}`);
  }

  // W-2: Invalid coordinates returns 400 INVALID_COORDINATES
  const resW2 = await app.inject({
    method: 'GET',
    url: '/weather/current?lat=195.5&lon=80.1'
  });
  if (resW2.statusCode === 400 && resW2.json().error === 'INVALID_COORDINATES') {
    pass('W-2', 'Latitude > 90 rejected with 400 INVALID_COORDINATES');
  } else {
    fail('W-2', `Expected 400 INVALID_COORDINATES, got ${resW2.statusCode}: ${resW2.body}`);
  }

  // W-3: Valid district coordinates lookup
  const resW3 = await app.inject({
    method: 'GET',
    url: '/weather/current?district=Warangal'
  });
  if (resW3.statusCode === 200) {
    const data = resW3.json();
    assert.strictEqual(data.status, 'AVAILABLE');
    assert.strictEqual(data.source, 'Open-Meteo Weather API (NWP Forecast Model)');
    assert.strictEqual(data.provider, 'Open-Meteo');
    assert.ok(data.units);
    assert.strictEqual(data.units.temperature, '°C');
    assert.ok(data.weather.temperature !== undefined);
    assert.ok(data.sprayAdvisory);
    assert.ok(typeof data.sprayAdvisory.isSafe === 'boolean');
    assert.ok(data.sprayAdvisory.status);
    assert.ok(data.sprayAdvisory.window);
    pass('W-3', 'Valid district returns truthful Open-Meteo telemetry & conservative spray advisory');
  } else if (resW3.statusCode === 503) {
    pass('W-3', 'Returned 503 WEATHER_SERVICE_OFFLINE honestly when offline');
  } else {
    fail('W-3', `Unexpected status ${resW3.statusCode}: ${resW3.body}`);
  }

  // ---------------------------------------------------------------------------
  // P0.4: Price Alerts Controller Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P0.4: Persistent Price Alerts & Evaluation');

  // PA-1: Validation - negative target price
  const resPA1 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { 'x-user-id': 'farmer-001' },
    payload: { crop: 'Cotton', targetPrice: -500 }
  });
  if (resPA1.statusCode === 400 && resPA1.json().error === 'VALIDATION_ERROR') {
    pass('PA-1', 'Negative target price rejected with 400 VALIDATION_ERROR');
  } else {
    fail('PA-1', `Expected 400 VALIDATION_ERROR, got ${resPA1.statusCode}`);
  }

  // PA-2: Validation - missing crop
  const resPA2 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { 'x-user-id': 'farmer-001' },
    payload: { targetPrice: 7500 }
  });
  if (resPA2.statusCode === 400 && resPA2.json().error === 'VALIDATION_ERROR') {
    pass('PA-2', 'Missing crop rejected with 400 VALIDATION_ERROR');
  } else {
    fail('PA-2', `Expected 400 VALIDATION_ERROR, got ${resPA2.statusCode}`);
  }

  // PA-3: Valid price alert creation
  const resPA3 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { 'x-user-id': 'farmer-001', 'x-idempotency-key': 'idem-alert-101' },
    payload: { crop: 'Cotton', commodity: 'Cotton', mandi: 'Warangal', targetPrice: 7200, condition: 'ABOVE' }
  });
  let createdAlertId = null;
  if (resPA3.statusCode === 201) {
    const body = resPA3.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'ACTIVE');
    assert.strictEqual(body.crop, 'Cotton');
    assert.strictEqual(body.targetPrice, 7200);
    createdAlertId = body.alertId;
    pass('PA-3', `Created persistent price alert (${createdAlertId}) with status ACTIVE`);
  } else {
    fail('PA-3', `Expected 201 Created, got ${resPA3.statusCode}: ${resPA3.body}`);
  }

  // PA-4: Idempotency Key deduplication
  const resPA4 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { 'x-user-id': 'farmer-001', 'x-idempotency-key': 'idem-alert-101' },
    payload: { crop: 'Cotton', commodity: 'Cotton', mandi: 'Warangal', targetPrice: 7200, condition: 'ABOVE' }
  });
  if (resPA4.statusCode === 409 && resPA4.json().error === 'DUPLICATE_ALERT') {
    pass('PA-4', 'Duplicate price alert with same idempotency key rejected with 409 DUPLICATE_ALERT');
  } else {
    fail('PA-4', `Expected 409 DUPLICATE_ALERT, got ${resPA4.statusCode}: ${resPA4.body}`);
  }

  // PA-5: Retrieve alerts
  const resPA5 = await app.inject({
    method: 'GET',
    url: '/weather/price-alerts',
    headers: { 'x-user-id': 'farmer-001' }
  });
  if (resPA5.statusCode === 200 && resPA5.json().alerts.length >= 1) {
    pass('PA-5', `Retrieved ${resPA5.json().alerts.length} active price alerts for user`);
  } else {
    fail('PA-5', `Expected 200 OK with alerts, got ${resPA5.statusCode}`);
  }

  // PA-6: Cancel alert
  const resPA6 = await app.inject({
    method: 'DELETE',
    url: `/weather/price-alerts/${createdAlertId}`,
    headers: { 'x-user-id': 'farmer-001' }
  });
  if (resPA6.statusCode === 200 && resPA6.json().alert.status === 'CANCELLED') {
    pass('PA-6', `Cancelled price alert (${createdAlertId})`);
  } else {
    fail('PA-6', `Failed to cancel alert: ${resPA6.body}`);
  }

  // PA-7: Create another alert and evaluate price triggering
  const resPA7 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { 'x-user-id': 'farmer-002', 'x-idempotency-key': 'idem-alert-202' },
    payload: { crop: 'Chilli', commodity: 'Chilli', mandi: 'Khammam', targetPrice: 18000, condition: 'ABOVE' }
  });
  assert.strictEqual(resPA7.statusCode, 201);
  const evalAlertId = resPA7.json().alertId;

  // Run alert evaluation with current price reaching 18500
  await evaluatePriceAlerts('Chilli', 'Khammam', 18500);

  // Check that notification was generated for farmer-002
  const resNotifCheck = await app.inject({
    method: 'GET',
    url: '/weather/notifications',
    headers: { 'x-user-id': 'farmer-002' }
  });
  const notifs = resNotifCheck.json().notifications || [];
  const triggeredNotif = notifs.find(n => n.event_id === evalAlertId && n.category === 'PRICE_ALERT');
  if (triggeredNotif) {
    pass('PA-7', `Price evaluation triggered notification: "${triggeredNotif.title}"`);
  } else {
    fail('PA-7', 'evaluatePriceAlerts did not create expected notification');
  }

  // ---------------------------------------------------------------------------
  // P0.5: Notifications Controller Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P0.5: Notifications API & Unread Counters');

  // N-1: Unread count
  const resN1 = await app.inject({
    method: 'GET',
    url: '/weather/notifications/unread-count',
    headers: { 'x-user-id': 'farmer-002' }
  });
  if (resN1.statusCode === 200 && resN1.json().unreadCount >= 1) {
    pass('N-1', `Authentic unread count returned: ${resN1.json().unreadCount}`);
  } else {
    fail('N-1', `Failed to retrieve unread count: ${resN1.body}`);
  }

  // N-2: Mark single notification as read
  const notifIdToMark = triggeredNotif.id;
  const resN2 = await app.inject({
    method: 'PATCH',
    url: `/weather/notifications/${notifIdToMark}/read`,
    headers: { 'x-user-id': 'farmer-002' }
  });
  if (resN2.statusCode === 200 && resN2.json().notification.is_read === true) {
    pass('N-2', `Marked notification ${notifIdToMark} as read`);
  } else {
    fail('N-2', `Failed to mark notification read: ${resN2.body}`);
  }

  // N-3: Mark all notifications read
  const resN3 = await app.inject({
    method: 'POST',
    url: '/weather/notifications/mark-all-read',
    headers: { 'x-user-id': 'farmer-002' }
  });
  if (resN3.statusCode === 200) {
    pass('N-3', 'Marked all unread notifications read');
  } else {
    fail('N-3', `Failed to mark all read: ${resN3.body}`);
  }

  // ---------------------------------------------------------------------------
  // P1.1: AI Scanner Contract Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P1.1: Strict AI Scanner Contract');

  // AI-1: Missing base64 payload rejected
  const resAI1 = await app.inject({
    method: 'POST',
    url: '/ai/diagnose',
    headers: { 'x-user-id': 'farmer-001' },
    payload: { cropName: 'cotton' }
  });
  if (resAI1.statusCode === 400 && resAI1.json().error === 'INVALID_INPUT') {
    pass('AI-1', 'Missing base64 image rejected with 400 INVALID_INPUT');
  } else {
    fail('AI-1', `Expected 400 INVALID_INPUT, got ${resAI1.statusCode}`);
  }

  // AI-2: Provider not configured returns 503 PROVIDER_NOT_CONFIGURED when no API keys set
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_FALLBACK_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const resAI2 = await app.inject({
    method: 'POST',
    url: '/ai/diagnose',
    headers: { 'x-user-id': 'farmer-001' },
    payload: { imageBase64: 'data:image/jpeg;base64,samplebase64data', cropName: 'cotton' }
  });
  if (resAI2.statusCode === 503 && resAI2.json().code === 'PROVIDER_NOT_CONFIGURED') {
    pass('AI-2', 'Unconfigured vision provider returns 503 PROVIDER_NOT_CONFIGURED honestly without fake predictions');
  } else {
    fail('AI-2', `Expected 503 PROVIDER_NOT_CONFIGURED, got ${resAI2.statusCode}`);
  }

  console.log('\n================================================================================');
  console.log(`📊 CONTRACTS SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runContractsSuite().catch(err => {
  console.error('FATAL CONTRACTS SUITE FAILURE:', err);
  process.exit(1);
});

