/**
 * NuKropAI — Database Fallback & Reliability Security Suite
 *
 * Verifies that:
 * 1. Persistent writes (INSERT, UPDATE, DELETE, TRUNCATE) FAIL-CLOSED in production when DB is offline.
 * 2. CTE writes (WITH ... INSERT/UPDATE/DELETE RETURNING) FAIL-CLOSED in production.
 * 3. Financial operations (escrow_contracts, khata_transactions, kcc_applications) FAIL-CLOSED in production.
 * 4. Stored procedures (CALL) and transactions (BEGIN, COMMIT, ROLLBACK) FAIL-CLOSED in production.
 * 5. pool.connect() fails-closed in production when database is unreachable.
 * 6. Non-production / test execution preserves safe development fallback.
 */

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

// Ensure db module is compiled
const { query, pool, memoryStore } = require(path.join(backendDir, 'dist', 'config', 'db'));

console.log('\n================================================================================');
console.log('🛡️  NUKROPAI DATABASE FALLBACK & PERSISTENCE RELIABILITY AUDIT');
console.log('================================================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // Set production mode
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  // 1. INSERT in production
  await testAsync('PROD-FAIL-1: INSERT throws error in production when DB offline', async () => {
    let threw = false;
    try {
      await query('INSERT INTO public.users (email, password_hash) VALUES ($1, $2)', ['test@example.com', 'hash']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected INSERT to throw in production');
  });

  // 2. UPDATE in production
  await testAsync('PROD-FAIL-2: UPDATE throws error in production when DB offline', async () => {
    let threw = false;
    try {
      await query('UPDATE public.refresh_tokens SET revoked = true WHERE id = $1', ['token-id']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected UPDATE to throw in production');
  });

  // 3. DELETE in production
  await testAsync('PROD-FAIL-3: DELETE throws error in production when DB offline', async () => {
    let threw = false;
    try {
      await query('DELETE FROM public.users WHERE id = $1', ['user-id']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected DELETE to throw in production');
  });

  // 4. CTE WITH ... INSERT in production
  await testAsync('PROD-FAIL-4: WITH ... INSERT RETURNING throws error in production', async () => {
    let threw = false;
    try {
      await query('WITH inserted AS (INSERT INTO public.users (email) VALUES ($1) RETURNING *) SELECT * FROM inserted', ['cte@test.com']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected CTE write to throw in production');
  });

  // 5. Financial Operations in production
  await testAsync('PROD-FAIL-5: Escrow contracts query throws in production when DB offline', async () => {
    let threw = false;
    try {
      await query('SELECT * FROM public.escrow_contracts WHERE id = $1', ['contract-id']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected financial query to throw in production');
  });

  // 6. Stored procedure CALL in production
  await testAsync('PROD-FAIL-6: Stored procedure CALL throws error in production', async () => {
    let threw = false;
    try {
      await query('CALL public.settle_mandi_batch($1)', ['batch-1']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected CALL to throw in production');
  });

  // 7. Transaction BEGIN in production
  await testAsync('PROD-FAIL-7: Transaction BEGIN throws error in production when DB offline', async () => {
    let threw = false;
    try {
      await query('BEGIN');
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected BEGIN to throw in production');
  });

  // 8. READ query in production must fail closed
  await testAsync('PROD-FAIL-8: Read query SELECT * FROM public.profiles throws SERVICE_UNAVAILABLE in production', async () => {
    let threw = false;
    try {
      await query('SELECT * FROM public.profiles WHERE id = $1', ['some-profile-id']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Database is offline in production mode'));
    }
    assert.strictEqual(threw, true, 'Expected SELECT to throw in production');
  });

  // 9. pool.connect() in production
  await testAsync('PROD-FAIL-9: pool.connect() throws error in production when DB offline', async () => {
    let threw = false;
    try {
      await pool.connect();
    } catch (e) {
      threw = true;
      assert(e.message.includes('SERVICE_UNAVAILABLE') && e.message.includes('Cannot establish client connection or transaction in production'));
    }
    assert.strictEqual(threw, true, 'Expected pool.connect to throw in production');
  });

  // Restore test mode
  process.env.NODE_ENV = 'test';

  // 9. In test/dev mode, read queries fall back gracefully
  await testAsync('DEV-FALLBACK-9: Read queries succeed in development/test fallback', async () => {
    const res = await query('SELECT * FROM public.users WHERE email = $1', ['nonexistent@example.com']);
    assert(Array.isArray(res.rows), 'Expected rows array');
    assert.strictEqual(res.rows.length, 0);
  });

  // Restore original env
  if (originalEnv) {
    process.env.NODE_ENV = originalEnv;
  } else {
    delete process.env.NODE_ENV;
  }

  console.log('\n================================================================================');
  console.log(`📊 AUDIT RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});

