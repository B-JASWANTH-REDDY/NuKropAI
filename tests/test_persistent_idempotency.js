/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI BACKEND PERSISTENT IDEMPOTENCY & CONCURRENCY VERIFICATION
 * ════════════════════════════════════════════════════════════════════════════
 */

const assert = require('assert');
const path = require('path');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

console.log('================================================================================');
console.log('🔒 NUKROPAI PERSISTENT IDEMPOTENCY & RESTART RELIABILITY AUDIT');
console.log('================================================================================\n');

(async () => {
  const { IdempotencyService } = require('../backend/dist/services/IdempotencyService');
  const { query, memoryStore } = require('../backend/dist/config/db');

  // Test 1: Record and Retrieve from L1 cache
  await runAsyncTest('IDEM-1: Record response and immediate retrieval from L1 cache', async () => {
    const key = 'test_key_001_' + Date.now();
    const payload = { success: true, bookingId: 'HB-1001', fare: 3500 };
    await IdempotencyService.record(key, '00000000-0000-0000-0000-000000000001', 'CREATE_BOOKING', 201, payload);

    const hit = await IdempotencyService.check(key);
    assert.ok(hit, 'Must retrieve recorded key');
    assert.strictEqual(hit.statusCode, 201);
    assert.strictEqual(hit.responseBody.bookingId, 'HB-1001');
  });

  // Test 2: Persistence across server restart (L1 Cache Cleared)
  await runAsyncTest('IDEM-2: Persistence across simulated server restart (L1 cache cleared)', async () => {
    const key = 'test_restart_key_' + Date.now();
    const payload = { success: true, bookingId: 'HB-2002', status: 'ACCEPTED' };
    await IdempotencyService.record(key, '00000000-0000-0000-0000-000000000002', 'ACCEPT_BOOKING', 200, payload);

    // Simulate complete process crash and reboot by clearing L1 memory cache
    IdempotencyService.clearL1();

    // Query must resolve from persistent database
    const persistentHit = await IdempotencyService.check(key);
    assert.ok(persistentHit, 'Must resolve from persistent database store after restart');
    assert.strictEqual(persistentHit.statusCode, 200);
    assert.strictEqual(persistentHit.responseBody.bookingId, 'HB-2002');
  });

  // Test 3: Multiple instances concurrent resolution
  await runAsyncTest('IDEM-3: Multi-instance concurrent reads return consistent payload', async () => {
    const key = 'test_multi_instance_' + Date.now();
    const payload = { success: true, bookingId: 'HB-3003', vehicle: 'Tata Ace' };
    await IdempotencyService.record(key, '00000000-0000-0000-0000-000000000003', 'CREATE_BOOKING', 201, payload);

    // Simulate 5 instances reading concurrently
    IdempotencyService.clearL1();
    const promises = [1, 2, 3, 4, 5].map(() => IdempotencyService.check(key));
    const results = await Promise.all(promises);

    for (const r of results) {
      assert.ok(r, 'Every instance must read the persisted key');
      assert.strictEqual(r.responseBody.bookingId, 'HB-3003');
    }
  });

  // Test 4: Unrecorded or distinct keys return null
  await runAsyncTest('IDEM-4: Unrecorded keys return null allowing fresh execution', async () => {
    const nonExistentKey = 'non_existent_' + Math.random();
    const res = await IdempotencyService.check(nonExistentKey);
    assert.strictEqual(res, null, 'Non-existent key must return null');
  });

  // Test 5: Empty / invalid keys handled safely
  await runAsyncTest('IDEM-5: Empty and whitespace keys rejected safely without errors', async () => {
    assert.strictEqual(await IdempotencyService.check(''), null);
    assert.strictEqual(await IdempotencyService.check('   '), null);
    assert.strictEqual(await IdempotencyService.check(null), null);
    assert.strictEqual(await IdempotencyService.check(undefined), null);
  });

  console.log('\n================================================================================');
  console.log(`📊 PERSISTENT IDEMPOTENCY AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================================\n');

  if (failCount > 0) process.exit(1);
})();

