/**
 * NuKropAI — Weather, Price Alerts, Notifications & AI Scanner Contracts Suite
 * Verifies P0.1, P0.3, P0.4, P0.5, P0.6, and P1.1 implementation contracts
 */

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

const JWT_SECRET = 'nukrop-production-access-signing-key-998877665544';
process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = 'nukrop-production-refresh-signing-key-112233445566';

const fastify = require(path.join(backendDir, 'node_modules', 'fastify'));
const jwt = require(path.join(backendDir, 'node_modules', 'jsonwebtoken'));
const axios = require(path.join(backendDir, 'node_modules', 'axios'));

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

const { authenticate, getJwtSecret, getJwtIssuer, getJwtAudience } = require(path.join(backendDir, 'dist', 'middleware', 'auth'));
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

function createTestToken(userId, role = 'farmer', options = {}) {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      sub: userId,
      email: `${userId}@nukrop.ai`,
      role: role,
      aud: getJwtAudience(),
      iss: getJwtIssuer()
    },
    secret,
    {
      expiresIn: options.expiresIn || '1h',
      algorithm: 'HS256'
    }
  );
}

async function runContractsSuite() {
  console.log('\n================================================================================');
  console.log('🌦️  NUKROPAI WEATHER, PRICE ALERTS, NOTIFICATIONS & AI CONTRACTS SUITE');
  console.log('================================================================================\n');

  // Build Fastify App with Genuine Auth Middleware
  const app = fastify({ logger: false });

  // Public Routes
  app.get('/weather/current', getCurrentWeather);

  // Protected AI Diagnostics
  app.post('/ai/diagnose', { preHandler: [authenticate] }, diagnoseCropFoliar);

  // Protected Price Alerts
  app.post('/weather/price-alerts', { preHandler: [authenticate] }, createPriceAlert);
  app.get('/weather/price-alerts', { preHandler: [authenticate] }, getPriceAlerts);
  app.delete('/weather/price-alerts/:id', { preHandler: [authenticate] }, cancelPriceAlert);

  // Protected Notifications
  app.get('/weather/notifications', { preHandler: [authenticate] }, getNotifications);
  app.get('/weather/notifications/unread-count', { preHandler: [authenticate] }, getUnreadNotificationsCount);
  app.patch('/weather/notifications/:id/read', { preHandler: [authenticate] }, markNotificationRead);
  app.post('/weather/notifications/mark-all-read', { preHandler: [authenticate] }, markAllNotificationsRead);

  await app.ready();

  const farmer1Id = 'farmer-uuid-001';
  const farmer2Id = 'farmer-uuid-002';
  const farmer1Token = createTestToken(farmer1Id, 'farmer');
  const farmer2Token = createTestToken(farmer2Id, 'farmer');

  // ---------------------------------------------------------------------------
  // P0.1: Adversarial Authentication & Route Guard Tests
  // ---------------------------------------------------------------------------
  console.log('▶ P0.1: Adversarial Route Authentication & Spoofing Defense');

  // AUTH-1: No token on private route returns 401
  const resNoAuth = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    payload: { crop: 'Cotton', targetPrice: 7000 }
  });
  if (resNoAuth.statusCode === 401) {
    pass('AUTH-1', 'Missing authorization header rejected with 401 Unauthorized');
  } else {
    fail('AUTH-1', `Expected 401, got ${resNoAuth.statusCode}: ${resNoAuth.body}`);
  }

  // AUTH-2: Invalid token returns 401
  const resInvalidAuth = await app.inject({
    method: 'GET',
    url: '/weather/price-alerts',
    headers: { authorization: 'Bearer invalid.token.value' }
  });
  if (resInvalidAuth.statusCode === 401) {
    pass('AUTH-2', 'Malformed token rejected with 401 Unauthorized');
  } else {
    fail('AUTH-2', `Expected 401, got ${resInvalidAuth.statusCode}`);
  }

  // AUTH-3: Expired token returns 401
  const expiredToken = createTestToken(farmer1Id, 'farmer', { expiresIn: '-10s' });
  const resExpired = await app.inject({
    method: 'GET',
    url: '/weather/notifications',
    headers: { authorization: `Bearer ${expiredToken}` }
  });
  if (resExpired.statusCode === 401) {
    pass('AUTH-3', 'Expired JWT rejected with 401 Unauthorized');
  } else {
    fail('AUTH-3', `Expected 401, got ${resExpired.statusCode}`);
  }

  // AUTH-4: Spoofed x-user-id header is ignored; identity derived strictly from JWT
  const resSpoofed = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: {
      authorization: `Bearer ${farmer1Token}`,
      'x-user-id': farmer2Id, // Attacker tries to impersonate farmer2
      'x-idempotency-key': 'alert-spoof-defense-001'
    },
    payload: { crop: 'Cotton', commodity: 'Cotton', mandi: 'Warangal', targetPrice: 7100, condition: 'ABOVE' }
  });
  if (resSpoofed.statusCode === 201) {
    const created = resSpoofed.json();
    assert.strictEqual(created.success, true);
    // Verify farmer2 does NOT see this alert
    const resFarmer2Alerts = await app.inject({
      method: 'GET',
      url: '/weather/price-alerts',
      headers: { authorization: `Bearer ${farmer2Token}` }
    });
    const f2HasAlert = resFarmer2Alerts.json().alerts?.some(a => a.id === created.alertId);
    if (!f2HasAlert) {
      pass('AUTH-4', 'Spoofed x-user-id header safely ignored; alert bound strictly to authenticated JWT subject');
    } else {
      fail('AUTH-4', 'Spoofed x-user-id header contaminated alert ownership');
    }
  } else {
    fail('AUTH-4', `Alert creation failed: ${resSpoofed.statusCode}: ${resSpoofed.body}`);
  }

  // ---------------------------------------------------------------------------
  // P0.3: Weather Controller Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P0.3: Weather Telemetry & Foliar Spray Contract');

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

  // W-3: Valid district coordinates lookup & NWP attribution
  const resW3 = await app.inject({
    method: 'GET',
    url: '/weather/current?district=Warangal'
  });
  if (resW3.statusCode === 200) {
    const data = resW3.json();
    assert.strictEqual(data.status, 'AVAILABLE');
    assert.strictEqual(data.source, 'Open-Meteo Weather API (NWP Numerical Forecast Model)');
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
  // P0.1 & P1.2: Foliar Spray Fail-Closed & Provenance Suite
  // ---------------------------------------------------------------------------
  console.log('\n▶ P0.1 & P1.2: Foliar Spray Fail-Closed & Provenance Verification');

  const originalAxiosGet = axios.get;

  const validTelemetry = {
    temperature_2m: 24.5,
    relative_humidity_2m: 60,
    wind_speed_10m: 8.0,
    wind_gusts_10m: 12.0,
    precipitation: 0.0,
    weather_code: 0,
    time: new Date().toISOString()
  };

  function mockWeatherTelemetry(override) {
    axios.get = async () => ({
      data: {
        current: {
          ...validTelemetry,
          ...override
        }
      }
    });
  }

  try {
    // FC-1: Missing precipitation -> fail closed (isSafe: false, ADVISORY_UNAVAILABLE)
    // Never interpret missing precipitation as zero!
    mockWeatherTelemetry({ precipitation: undefined });
    const resFC1 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC1 = resFC1.json();
    if (resFC1.statusCode === 200 && dataFC1.sprayAdvisory.isSafe === false && dataFC1.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC1.sprayAdvisory.reason.includes('precipitation')) {
      pass('FC-1', 'Missing precipitation fails closed (isSafe: false, ADVISORY_UNAVAILABLE; never interpreted as 0)');
    } else {
      fail('FC-1', `Failed fail-closed on missing precipitation: ${JSON.stringify(dataFC1.sprayAdvisory)}`);
    }

    // FC-2: Missing wind gusts -> fail closed (isSafe: false, ADVISORY_UNAVAILABLE)
    // Never interpret missing wind gusts as safe!
    mockWeatherTelemetry({ wind_gusts_10m: undefined });
    const resFC2 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC2 = resFC2.json();
    if (resFC2.statusCode === 200 && dataFC2.sprayAdvisory.isSafe === false && dataFC2.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC2.sprayAdvisory.reason.includes('windGusts')) {
      pass('FC-2', 'Missing wind gusts fails closed (isSafe: false, ADVISORY_UNAVAILABLE; never assumed safe)');
    } else {
      fail('FC-2', `Failed fail-closed on missing wind gusts: ${JSON.stringify(dataFC2.sprayAdvisory)}`);
    }

    // FC-3: Missing temperature -> fail closed
    mockWeatherTelemetry({ temperature_2m: undefined });
    const resFC3 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC3 = resFC3.json();
    if (dataFC3.sprayAdvisory.isSafe === false && dataFC3.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC3.sprayAdvisory.reason.includes('temperature')) {
      pass('FC-3', 'Missing ambient temperature fails closed (isSafe: false, ADVISORY_UNAVAILABLE)');
    } else {
      fail('FC-3', `Failed on missing temperature: ${JSON.stringify(dataFC3.sprayAdvisory)}`);
    }

    // FC-4: Missing relative humidity -> fail closed
    mockWeatherTelemetry({ relative_humidity_2m: undefined });
    const resFC4 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC4 = resFC4.json();
    if (dataFC4.sprayAdvisory.isSafe === false && dataFC4.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC4.sprayAdvisory.reason.includes('humidity')) {
      pass('FC-4', 'Missing relative humidity fails closed (isSafe: false, ADVISORY_UNAVAILABLE)');
    } else {
      fail('FC-4', `Failed on missing humidity: ${JSON.stringify(dataFC4.sprayAdvisory)}`);
    }

    // FC-5: Missing sustained wind speed -> fail closed
    mockWeatherTelemetry({ wind_speed_10m: undefined });
    const resFC5 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC5 = resFC5.json();
    if (dataFC5.sprayAdvisory.isSafe === false && dataFC5.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC5.sprayAdvisory.reason.includes('windSpeed')) {
      pass('FC-5', 'Missing sustained wind speed fails closed (isSafe: false, ADVISORY_UNAVAILABLE)');
    } else {
      fail('FC-5', `Failed on missing windSpeed: ${JSON.stringify(dataFC5.sprayAdvisory)}`);
    }

    // FC-6: Missing WMO weather code -> fail closed
    mockWeatherTelemetry({ weather_code: undefined });
    const resFC6 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC6 = resFC6.json();
    if (dataFC6.sprayAdvisory.isSafe === false && dataFC6.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC6.sprayAdvisory.reason.includes('weatherCode')) {
      pass('FC-6', 'Missing WMO weather code fails closed (isSafe: false, ADVISORY_UNAVAILABLE)');
    } else {
      fail('FC-6', `Failed on missing weatherCode: ${JSON.stringify(dataFC6.sprayAdvisory)}`);
    }

    // FC-7: Missing provider timestamp -> fail closed (never substitute retrieval time!)
    mockWeatherTelemetry({ time: undefined });
    const resFC7 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC7 = resFC7.json();
    if (dataFC7.sprayAdvisory.isSafe === false && dataFC7.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC7.modelTime === null) {
      pass('FC-7', 'Missing provider timestamp fails closed (isSafe: false, ADVISORY_UNAVAILABLE; server retrieval time NOT substituted)');
    } else {
      fail('FC-7', `Failed on missing provider timestamp: ${JSON.stringify(dataFC7)}`);
    }

    // FC-8: Out-of-range temperature (75°C) -> fail closed
    mockWeatherTelemetry({ temperature_2m: 75.0 });
    const resFC8 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC8 = resFC8.json();
    if (dataFC8.sprayAdvisory.isSafe === false && dataFC8.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC8.sprayAdvisory.reason.includes('temperature out of plausible range')) {
      pass('FC-8', 'Implausible temperature (75°C) rejected with ADVISORY_UNAVAILABLE');
    } else {
      fail('FC-8', `Failed on out-of-range temperature: ${JSON.stringify(dataFC8.sprayAdvisory)}`);
    }

    // FC-9: Out-of-range humidity (-10%) -> fail closed
    mockWeatherTelemetry({ relative_humidity_2m: -10 });
    const resFC9 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC9 = resFC9.json();
    if (dataFC9.sprayAdvisory.isSafe === false && dataFC9.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC9.sprayAdvisory.reason.includes('humidity out of range')) {
      pass('FC-9', 'Negative humidity (-10%) rejected with ADVISORY_UNAVAILABLE');
    } else {
      fail('FC-9', `Failed on negative humidity: ${JSON.stringify(dataFC9.sprayAdvisory)}`);
    }

    // FC-10: Negative wind speed (-5 km/h) -> fail closed
    mockWeatherTelemetry({ wind_speed_10m: -5.0 });
    const resFC10 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC10 = resFC10.json();
    if (dataFC10.sprayAdvisory.isSafe === false && dataFC10.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC10.sprayAdvisory.reason.includes('windSpeed out of plausible range')) {
      pass('FC-10', 'Negative wind speed rejected with ADVISORY_UNAVAILABLE');
    } else {
      fail('FC-10', `Failed on negative wind speed: ${JSON.stringify(dataFC10.sprayAdvisory)}`);
    }

    // FC-11: Malformed provider values: Gusts lower than sustained wind (gusts = 5 km/h, sustained = 15 km/h) -> fail closed
    mockWeatherTelemetry({ wind_speed_10m: 15.0, wind_gusts_10m: 5.0 });
    const resFC11 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC11 = resFC11.json();
    if (dataFC11.sprayAdvisory.isSafe === false && dataFC11.sprayAdvisory.status === 'ADVISORY_UNAVAILABLE' && dataFC11.sprayAdvisory.reason.includes('lower than sustained windSpeed')) {
      pass('FC-11', 'Malformed provider values (gusts < sustained wind) rejected with ADVISORY_UNAVAILABLE');
    } else {
      fail('FC-11', `Failed on gusts < sustained wind: ${JSON.stringify(dataFC11.sprayAdvisory)}`);
    }

    // FC-12: Active precipitation (2.5 mm, code = 61) -> UNSAFE (rain wash-off risk)
    mockWeatherTelemetry({ precipitation: 2.5, weather_code: 61 });
    const resFC12 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC12 = resFC12.json();
    if (dataFC12.sprayAdvisory.isSafe === false && dataFC12.sprayAdvisory.status === 'UNSAFE' && dataFC12.sprayAdvisory.reason.includes('precipitation')) {
      pass('FC-12', 'Active precipitation marked UNSAFE (rain wash-off risk)');
    } else {
      fail('FC-12', `Failed on active precipitation: ${JSON.stringify(dataFC12.sprayAdvisory)}`);
    }

    // FC-13: High sustained wind (18 km/h > 15 km/h) -> UNSAFE (droplet drift)
    mockWeatherTelemetry({ wind_speed_10m: 18.0, wind_gusts_10m: 20.0 });
    const resFC13 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC13 = resFC13.json();
    if (dataFC13.sprayAdvisory.isSafe === false && dataFC13.sprayAdvisory.status === 'UNSAFE' && dataFC13.sprayAdvisory.reason.includes('droplet drift')) {
      pass('FC-13', 'High sustained wind (18 km/h > 15 km/h) marked UNSAFE');
    } else {
      fail('FC-13', `Failed on high wind: ${JSON.stringify(dataFC13.sprayAdvisory)}`);
    }

    // FC-14: High wind gusts (24 km/h > 20 km/h) -> UNSAFE (gust drift hazard)
    mockWeatherTelemetry({ wind_speed_10m: 10.0, wind_gusts_10m: 24.0 });
    const resFC14 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC14 = resFC14.json();
    if (dataFC14.sprayAdvisory.isSafe === false && dataFC14.sprayAdvisory.status === 'UNSAFE' && dataFC14.sprayAdvisory.reason.includes('gust')) {
      pass('FC-14', 'High wind gusts (24 km/h > 20 km/h) marked UNSAFE');
    } else {
      fail('FC-14', `Failed on high gusts: ${JSON.stringify(dataFC14.sprayAdvisory)}`);
    }

    // FC-15: Near-calm wind (1.5 km/h < 3 km/h) -> UNSAFE (inversion risk)
    mockWeatherTelemetry({ wind_speed_10m: 1.5, wind_gusts_10m: 2.0 });
    const resFC15 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC15 = resFC15.json();
    if (dataFC15.sprayAdvisory.isSafe === false && dataFC15.sprayAdvisory.status === 'UNSAFE' && dataFC15.sprayAdvisory.reason.includes('inversion')) {
      pass('FC-15', 'Near-calm wind (1.5 km/h < 3 km/h) marked UNSAFE (inversion risk)');
    } else {
      fail('FC-15', `Failed on calm wind: ${JSON.stringify(dataFC15.sprayAdvisory)}`);
    }

    // FC-16: High ambient temperature (35°C > 32°C) -> UNSAFE (evaporation / phytotoxicity)
    mockWeatherTelemetry({ temperature_2m: 35.0 });
    const resFC16 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC16 = resFC16.json();
    if (dataFC16.sprayAdvisory.isSafe === false && dataFC16.sprayAdvisory.status === 'UNSAFE' && dataFC16.sprayAdvisory.reason.includes('evaporation')) {
      pass('FC-16', 'High ambient temperature (35°C > 32°C) marked UNSAFE');
    } else {
      fail('FC-16', `Failed on high temperature: ${JSON.stringify(dataFC16.sprayAdvisory)}`);
    }

    // FC-17: Low ambient temperature (11°C < 15°C) -> UNSAFE (impedes foliar uptake)
    mockWeatherTelemetry({ temperature_2m: 11.0 });
    const resFC17 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC17 = resFC17.json();
    if (dataFC17.sprayAdvisory.isSafe === false && dataFC17.sprayAdvisory.status === 'UNSAFE' && dataFC17.sprayAdvisory.reason.includes('Low ambient temperature')) {
      pass('FC-17', 'Low ambient temperature (11°C < 15°C) marked UNSAFE');
    } else {
      fail('FC-17', `Failed on low temperature: ${JSON.stringify(dataFC17.sprayAdvisory)}`);
    }

    // FC-18: High relative humidity (85% > 80%) -> UNSAFE (fungal risk)
    mockWeatherTelemetry({ relative_humidity_2m: 85 });
    const resFC18 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC18 = resFC18.json();
    if (dataFC18.sprayAdvisory.isSafe === false && dataFC18.sprayAdvisory.status === 'UNSAFE' && dataFC18.sprayAdvisory.reason.includes('High relative humidity')) {
      pass('FC-18', 'High relative humidity (85% > 80%) marked UNSAFE');
    } else {
      fail('FC-18', `Failed on high humidity: ${JSON.stringify(dataFC18.sprayAdvisory)}`);
    }

    // FC-19: Low relative humidity (35% < 40%) -> UNSAFE (rapid droplet vaporization)
    mockWeatherTelemetry({ relative_humidity_2m: 35 });
    const resFC19 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC19 = resFC19.json();
    if (dataFC19.sprayAdvisory.isSafe === false && dataFC19.sprayAdvisory.status === 'UNSAFE' && dataFC19.sprayAdvisory.reason.includes('Low relative humidity')) {
      pass('FC-19', 'Low relative humidity (35% < 40%) marked UNSAFE');
    } else {
      fail('FC-19', `Failed on low humidity: ${JSON.stringify(dataFC19.sprayAdvisory)}`);
    }

    // FC-20: All parameters within safe envelope -> isSafe: true, status: 'AVAILABLE', OPTIMAL
    mockWeatherTelemetry(validTelemetry);
    const resFC20 = await app.inject({ method: 'GET', url: '/weather/current?district=Warangal' });
    const dataFC20 = resFC20.json();
    if (dataFC20.sprayAdvisory.isSafe === true && dataFC20.sprayAdvisory.status === 'AVAILABLE' && dataFC20.sprayAdvisory.reason.includes('OPTIMAL')) {
      pass('FC-20', 'All parameters within envelope returns isSafe: true, status: AVAILABLE, OPTIMAL');
    } else {
      fail('FC-20', `Failed on optimal parameters: ${JSON.stringify(dataFC20.sprayAdvisory)}`);
    }

    // PROV-1: Arbitrary coordinates without district or state must return state: null (never 'Telangana')
    const resProv1 = await app.inject({ method: 'GET', url: '/weather/current?lat=28.6139&lon=77.2090' });
    const dataProv1 = resProv1.json();
    if (dataProv1.location.state === null) {
      pass('PROV-1', 'Arbitrary coordinates return state: null (never defaults to Telangana)');
    } else {
      fail('PROV-1', `Arbitrary coordinates returned state: ${dataProv1.location.state}`);
    }

    // PROV-2: Model-derived forecast data distinguished from station observation
    if (dataFC20.source.includes('NWP Numerical Forecast Model') && dataFC20.observationTime === null && dataFC20.modelTime !== null) {
      pass('PROV-2', 'NWP forecast model telemetry properly attributed; observationTime null and modelTime preserved');
    } else {
      fail('PROV-2', `Provenance misattributed: source=${dataFC20.source}, obsTime=${dataFC20.observationTime}, modelTime=${dataFC20.modelTime}`);
    }

  } finally {
    axios.get = originalAxiosGet;
  }

  // ---------------------------------------------------------------------------
  // P0.4 & P0.5: Persistent Price Alerts & Idempotency Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P0.4: Persistent Price Alerts, Scoped Idempotency & Validation');

  // PA-1: Validation - negative target price
  const resPA1 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer1Token}`, 'x-idempotency-key': 'idem-neg-1' },
    payload: { crop: 'Cotton', mandi: 'Warangal', targetPrice: -500 }
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
    headers: { authorization: `Bearer ${farmer1Token}`, 'x-idempotency-key': 'idem-nocrop-1' },
    payload: { mandi: 'Warangal', targetPrice: 7500 }
  });
  if (resPA2.statusCode === 400 && resPA2.json().error === 'VALIDATION_ERROR') {
    pass('PA-2', 'Missing crop rejected with 400 VALIDATION_ERROR');
  } else {
    fail('PA-2', `Expected 400 VALIDATION_ERROR, got ${resPA2.statusCode}`);
  }

  // PA-3: Validation - missing idempotency key
  const resPA3NoIdem = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer1Token}` },
    payload: { crop: 'Cotton', mandi: 'Warangal', targetPrice: 7200 }
  });
  if (resPA3NoIdem.statusCode === 400 && resPA3NoIdem.json().error === 'MISSING_IDEMPOTENCY_KEY') {
    pass('PA-3', 'Missing x-idempotency-key rejected with 400 MISSING_IDEMPOTENCY_KEY');
  } else {
    fail('PA-3', `Expected 400 MISSING_IDEMPOTENCY_KEY, got ${resPA3NoIdem.statusCode}`);
  }

  // PA-4: Validation - missing mandi
  const resPA4NoMandi = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer1Token}`, 'x-idempotency-key': 'idem-nomandi-1' },
    payload: { crop: 'Cotton', targetPrice: 7200 }
  });
  if (resPA4NoMandi.statusCode === 400 && resPA4NoMandi.json().error === 'MISSING_MANDI') {
    pass('PA-4', 'Missing mandi rejected with 400 MISSING_MANDI');
  } else {
    fail('PA-4', `Expected 400 MISSING_MANDI, got ${resPA4NoMandi.statusCode}`);
  }

  // PA-5: Valid price alert creation
  const resPA5 = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer1Token}`, 'x-idempotency-key': 'idem-alert-101' },
    payload: { crop: 'Cotton', commodity: 'Cotton', mandi: 'Warangal', targetPrice: 7200, condition: 'ABOVE' }
  });
  let createdAlertId = null;
  if (resPA5.statusCode === 201) {
    const body = resPA5.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'ACTIVE');
    assert.strictEqual(body.crop, 'Cotton');
    assert.strictEqual(body.targetPrice, 7200);
    createdAlertId = body.alertId;
    pass('PA-5', `Created persistent price alert (${createdAlertId}) with status ACTIVE`);
  } else {
    fail('PA-5', `Expected 201 Created, got ${resPA5.statusCode}: ${resPA5.body}`);
  }

  // PA-6: Idempotency Key deduplication (same user, same key -> 409)
  const resPA6Dup = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer1Token}`, 'x-idempotency-key': 'idem-alert-101' },
    payload: { crop: 'Cotton', commodity: 'Cotton', mandi: 'Warangal', targetPrice: 7200, condition: 'ABOVE' }
  });
  if (resPA6Dup.statusCode === 409 && resPA6Dup.json().error === 'DUPLICATE_ALERT') {
    pass('PA-6', 'Duplicate price alert with same idempotency key for same user rejected with 409 DUPLICATE_ALERT');
  } else {
    fail('PA-6', `Expected 409 DUPLICATE_ALERT, got ${resPA6Dup.statusCode}: ${resPA6Dup.body}`);
  }

  // PA-7: Scoped Idempotency Key (Farmer 2 using SAME idempotency key succeeds!)
  const resPA7OtherUser = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer2Token}`, 'x-idempotency-key': 'idem-alert-101' },
    payload: { crop: 'Chilli', commodity: 'Chilli', mandi: 'Khammam', targetPrice: 18000, condition: 'ABOVE' }
  });
  let farmer2AlertId = null;
  if (resPA7OtherUser.statusCode === 201) {
    farmer2AlertId = resPA7OtherUser.json().alertId;
    pass('PA-7', 'Independent user can reuse idempotency key without collision (scoped per user_id)');
  } else {
    fail('PA-7', `Expected 201 Created for different user, got ${resPA7OtherUser.statusCode}: ${resPA7OtherUser.body}`);
  }

  // PA-8: Cross-User Authorization: Farmer 2 cannot delete Farmer 1's price alert
  const resPA8CrossDel = await app.inject({
    method: 'DELETE',
    url: `/weather/price-alerts/${createdAlertId}`,
    headers: { authorization: `Bearer ${farmer2Token}` }
  });
  if (resPA8CrossDel.statusCode === 404) {
    pass('PA-8', 'Farmer 2 rejected with 404 when attempting to delete Farmer 1 price alert');
  } else {
    fail('PA-8', `Expected 404, got ${resPA8CrossDel.statusCode}: ${resPA8CrossDel.body}`);
  }

  // PA-9: Owner can delete own price alert
  const resPA9OwnerDel = await app.inject({
    method: 'DELETE',
    url: `/weather/price-alerts/${createdAlertId}`,
    headers: { authorization: `Bearer ${farmer1Token}` }
  });
  if (resPA9OwnerDel.statusCode === 200 && resPA9OwnerDel.json().alert?.status === 'CANCELLED') {
    pass('PA-9', `Owner successfully cancelled price alert (${createdAlertId})`);
  } else {
    fail('PA-9', `Failed to cancel alert: ${resPA9OwnerDel.body}`);
  }

  // PA-10: Concurrency in Price Alert Evaluation
  // Evaluate price alert for Chilli in Khammam concurrently with price = 18500
  const evalResults = await Promise.all([
    evaluatePriceAlerts('Chilli', 'Khammam', 18500),
    evaluatePriceAlerts('Chilli', 'Khammam', 18500)
  ]);
  const totalTriggered = evalResults.reduce((sum, r) => sum + r.triggeredCount, 0);
  if (totalTriggered === 1) {
    pass('PA-10', 'Concurrent evaluatePriceAlerts atomic UPDATE prevented duplicate trigger execution (triggered once)');
  } else {
    fail('PA-10', `Expected exactly 1 trigger across concurrent evaluations, got ${totalTriggered}`);
  }

  // PA-11: Atomic Transaction Rollback on Notification Failure
  // Seed active alert for Farmer 1
  const seedAlertRes = await app.inject({
    method: 'POST',
    url: '/weather/price-alerts',
    headers: { authorization: `Bearer ${farmer1Token}`, 'x-idempotency-key': 'idem-tx-rollback-001' },
    payload: { crop: 'Soybean', commodity: 'Soybean', mandi: 'Nizamabad', targetPrice: 4500, condition: 'ABOVE' }
  });
  assert.strictEqual(seedAlertRes.statusCode, 201);
  const rollbackAlertId = seedAlertRes.json().alertId;

  // Intercept pool.connect to return a client whose INSERT INTO notifications throws
  const originalPoolConnect = pool.connect;
  try {
    pool.connect = async () => {
      const realClient = await originalPoolConnect();
      const realClientQuery = realClient.query;
      realClient.query = async (text, params) => {
        if (typeof text === 'string' && text.toLowerCase().includes('insert into public.notifications')) {
          throw new Error('SIMULATED_NOTIFICATION_PERSISTENCE_CRASH');
        }
        return realClientQuery.call(realClient, text, params);
      };
      return realClient;
    };

    // Trigger evaluation with price = 4600 (meets condition)
    const evalRollback = await evaluatePriceAlerts('Soybean', 'Nizamabad', 4600);
    assert.strictEqual(evalRollback.triggeredCount, 0, 'Triggered count should be 0 because transaction failed');

    // Verify alert in database REMAINS ACTIVE (was not left in TRIGGERED state)
    const alertAfterRollback = memoryStore.priceAlerts.find(a => a.id === rollbackAlertId);
    if (alertAfterRollback && alertAfterRollback.status === 'ACTIVE') {
      pass('PA-11', 'Transaction atomicity verified: Notification failure triggered ROLLBACK; alert status remained ACTIVE');
    } else {
      fail('PA-11', `Alert was not rolled back to ACTIVE: status=${alertAfterRollback?.status}`);
    }

    // Verify no orphaned notification was inserted
    const orphanNotif = memoryStore.notifications.find(n => n.event_id === rollbackAlertId);
    if (!orphanNotif) {
      pass('PA-12', 'Transaction atomicity verified: No orphaned notification inserted upon rollback');
    } else {
      fail('PA-12', 'Orphan notification was inserted despite transaction failure');
    }
  } finally {
    pool.connect = originalPoolConnect;
  }

  // PA-13: Stale and Future Market Observation Validation
  const evalStale = await evaluatePriceAlerts('Soybean', 'Nizamabad', 4600, {
    source: 'Agmarknet',
    timestamp: new Date(Date.now() - (72 * 3600 * 1000)).toISOString() // 72 hours ago
  });
  if (evalStale.triggeredCount === 0) {
    pass('PA-13', 'Stale market observation (>48h) rejected without triggering alerts');
  } else {
    fail('PA-13', `Stale observation triggered alerts: ${evalStale.triggeredCount}`);
  }

  const evalFuture = await evaluatePriceAlerts('Soybean', 'Nizamabad', 4600, {
    source: 'Agmarknet',
    timestamp: new Date(Date.now() + (3600 * 1000)).toISOString() // 1 hour in future
  });
  if (evalFuture.triggeredCount === 0) {
    pass('PA-14', 'Future market observation rejected without triggering alerts');
  } else {
    fail('PA-14', `Future observation triggered alerts: ${evalFuture.triggeredCount}`);
  }

  // ---------------------------------------------------------------------------
  // P0.5 & P0.6: Notifications Controller Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P0.5: Notifications API, Ownership & Resilience');

  // N-1: Unread count for Farmer 2
  const resN1 = await app.inject({
    method: 'GET',
    url: '/weather/notifications/unread-count',
    headers: { authorization: `Bearer ${farmer2Token}` }
  });
  if (resN1.statusCode === 200 && resN1.json().unreadCount >= 1) {
    pass('N-1', `Authentic unread count returned: ${resN1.json().unreadCount}`);
  } else {
    fail('N-1', `Failed to retrieve unread count: ${resN1.body}`);
  }

  // Retrieve Farmer 2's triggered notification
  const resF2Notifs = await app.inject({
    method: 'GET',
    url: '/weather/notifications',
    headers: { authorization: `Bearer ${farmer2Token}` }
  });
  const notifsList = resF2Notifs.json().notifications || [];
  const triggeredNotif = notifsList.find(n => n.event_id === farmer2AlertId);
  assert.ok(triggeredNotif, 'Expected triggered notification to exist for Farmer 2');

  // N-2: Farmer 1 cannot mark Farmer 2's notification as read (Cross-user isolation)
  const resN2Cross = await app.inject({
    method: 'PATCH',
    url: `/weather/notifications/${triggeredNotif.id}/read`,
    headers: { authorization: `Bearer ${farmer1Token}` }
  });
  if (resN2Cross.statusCode === 404) {
    pass('N-2', 'Farmer 1 rejected with 404 when attempting to mutate Farmer 2 notification read state');
  } else {
    fail('N-2', `Expected 404, got ${resN2Cross.statusCode}`);
  }

  // N-3: Farmer 2 marks own notification as read
  const resN3Owner = await app.inject({
    method: 'PATCH',
    url: `/weather/notifications/${triggeredNotif.id}/read`,
    headers: { authorization: `Bearer ${farmer2Token}` }
  });
  if (resN3Owner.statusCode === 200 && resN3Owner.json().notification?.is_read === true) {
    pass('N-3', `Farmer 2 successfully marked own notification (${triggeredNotif.id}) as read`);
  } else {
    fail('N-3', `Failed to mark notification read: ${resN3Owner.body}`);
  }

  // N-4: DB Outage Resilience: getUnreadNotificationsCount returns 503 SERVICE_UNAVAILABLE on failure (never 200 with fake 0)
  const originalPoolQuery = pool.query;
  try {
    pool.query = async () => {
      throw new Error('SIMULATED_DATABASE_DISCONNECTION');
    };
    const resOutage = await app.inject({
      method: 'GET',
      url: '/weather/notifications/unread-count',
      headers: { authorization: `Bearer ${farmer2Token}` }
    });
    if (resOutage.statusCode === 503 && (resOutage.json().error === 'SERVICE_UNAVAILABLE' || resOutage.json().code === 'SERVICE_UNAVAILABLE')) {
      pass('N-4', 'Database failure returns 503 SERVICE_UNAVAILABLE honestly (never returns fake unread count of 0)');
    } else {
      fail('N-4', `Expected 503 SERVICE_UNAVAILABLE, got ${resOutage.statusCode}: ${resOutage.body}`);
    }
  } finally {
    pool.query = originalPoolQuery;
  }

  // ---------------------------------------------------------------------------
  // P1.1: AI Scanner Contract Tests
  // ---------------------------------------------------------------------------
  console.log('\n▶ P1.1: Strict AI Scanner Contract');

  // AI-1: Missing base64 payload rejected
  const resAI1 = await app.inject({
    method: 'POST',
    url: '/ai/diagnose',
    headers: { authorization: `Bearer ${farmer1Token}` },
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
    headers: { authorization: `Bearer ${farmer1Token}` },
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
