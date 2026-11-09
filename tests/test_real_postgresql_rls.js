/**
 * ==============================================================================
 * NuKropAI — Genuine PostgreSQL Row Level Security (RLS) & Migration Test Suite
 * Engine: Real PostgreSQL 18 (via @electric-sql/pglite WASM engine)
 * Standard:docs/FEATURE_DEFINITION_OF_DONE.md & docs/ENGINEERING_QUALITY_STANDARD.md
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { PGlite } = require('../backend/node_modules/@electric-sql/pglite');

let passCount = 0;
let failCount = 0;

function pass(name, details) {
  passCount++;
  console.log(`  ✔ [PASS] ${name}${details ? ` (${details})` : ''}`);
}

function fail(name, reason) {
  failCount++;
  console.error(`  ❌ [FAIL] ${name}: ${reason}`);
}

async function runRealPostgreSqlRlsSuite() {
  console.log('================================================================================');
  console.log('🐘 NUKROPAI GENUINE POSTGRESQL RLS & MIGRATION COMPATIBILITY SUITE');
  console.log('================================================================================\n');

  const pglite = new PGlite();

  // Load SQL Migrations
  let initialSql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20260901000001_initial_schema_and_rls.sql'),
    'utf-8'
  );
  // Replace direct CREATE EXTENSION with exception-handled block for universal Postgres 14-18 support
  initialSql = initialSql.replace(
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    () => `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS $$ SELECT gen_random_uuid(); $$ LANGUAGE sql;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    'anon'
  )::text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'anon';
END;
$$ LANGUAGE plpgsql STABLE;`
  );

  const reconSql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20261109000001_canonical_identity_reconciliation.sql'),
    'utf-8'
  );

  console.log('▶ Test 1: Migration Baseline Compatibility & Additive Schema Execution');
  try {
    // 1. Run baseline initial migration
    await pglite.exec(initialSql);
    pass('MIG-1.1', '20260901000001_initial_schema_and_rls executed on clean DB');

    // 2. Insert pre-existing profile in baseline schema
    const baselineUserId = 'a0000000-0000-0000-0000-000000000001';
    await pglite.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${baselineUserId}', 'existing_farmer@nukrop.ai');
      INSERT INTO public.profiles (id, phone, full_name, state, district)
      VALUES ('${baselineUserId}', '+919876543210', 'Legacy Preexisting Farmer', 'Telangana', 'Warangal');
    `);
    pass('MIG-1.2', 'Pre-existing profile inserted into baseline schema');

    // 3. Run reconciliation migration on top of baseline
    await pglite.exec(reconSql);
    pass('MIG-1.3', '20261109000001_canonical_identity_reconciliation applied additively');

    // 4. Verify columns exist and pre-existing data was preserved
    const resExisting = await pglite.query(
      `SELECT id, user_id, email, role, full_name, phone FROM public.profiles WHERE id = $1`,
      [baselineUserId]
    );
    if (
      resExisting.rows.length === 1 &&
      resExisting.rows[0].full_name === 'Legacy Preexisting Farmer' &&
      resExisting.rows[0].user_id === baselineUserId
    ) {
      pass('MIG-1.4', 'Pre-existing profile preserved with additive user_id backfilled');
    } else {
      fail('MIG-1.4', 'Pre-existing data corrupted or user_id not backfilled');
    }

    // 5. Idempotency test: Re-run reconciliation migration a second time
    await pglite.exec(reconSql);
    pass('MIG-1.5', 'Reconciliation migration re-applied idempotently without errors');
  } catch (err) {
    fail('MIG-1', `Migration execution error: ${err.message}`);
  }

  console.log('\n▶ Test 2: Real PostgreSQL RLS — Private Data Isolation (Disease Scans & Khata)');
  const farmer1Id = '11111111-1111-1111-1111-111111111111';
  const farmer2Id = '22222222-2222-2222-2222-222222222222';
  const driverId =  '33333333-3333-3333-3333-333333333333';

  try {
    // Seed test users in auth.users
    await pglite.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) 
      VALUES 
        ('${farmer1Id}', 'farmer1@nukrop.ai', '{"full_name": "Farmer One", "role": "farmer"}'),
        ('${farmer2Id}', 'farmer2@nukrop.ai', '{"full_name": "Farmer Two", "role": "farmer"}'),
        ('${driverId}',  'driver1@nukrop.ai', '{"full_name": "Driver Suresh", "role": "driver"}')
      ON CONFLICT (id) DO NOTHING;
    `);

    // AS FARMER 1: Insert confidential disease scan and khata transaction
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
      INSERT INTO public.disease_scans (user_id, crop_type, diagnosis_name, confidence, recommended_treatment)
      VALUES ('${farmer1Id}', 'Cotton', 'Cotton Leaf Curl Virus', 0.96, 'Apply Diafenthiuron 50% WP');
      
      INSERT INTO public.khata_transactions (user_id, type, category, description, amount)
      VALUES ('${farmer1Id}', 'expense', 'Pesticides', 'Diafenthiuron 500g', 850.00);
    `);
    pass('RLS-2.1', 'Farmer 1 created personal confidential records');

    // AS FARMER 2: Attempt to SELECT Farmer 1's disease scans
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2Scans = await pglite.query(`SELECT * FROM public.disease_scans WHERE user_id = $1`, [farmer1Id]);
    if (f2Scans.rows.length === 0) {
      pass('RLS-2.2', 'Farmer 2 cannot read Farmer 1 disease scans (RLS returned 0 rows)');
    } else {
      fail('RLS-2.2', `Farmer 2 breached Farmer 1 scan privacy: ${JSON.stringify(f2Scans.rows)}`);
    }

    // AS FARMER 2: Attempt to SELECT Farmer 1's Khata financial ledger
    const f2Khata = await pglite.query(`SELECT * FROM public.khata_transactions WHERE user_id = $1`, [farmer1Id]);
    if (f2Khata.rows.length === 0) {
      pass('RLS-2.3', 'Farmer 2 cannot read Farmer 1 financial ledger (RLS returned 0 rows)');
    } else {
      fail('RLS-2.3', `Farmer 2 breached Farmer 1 Khata records: ${JSON.stringify(f2Khata.rows)}`);
    }

    // AS FARMER 2: Attempt to UPDATE Farmer 1's Khata ledger
    const updateRes = await pglite.query(`UPDATE public.khata_transactions SET amount = 1.00 WHERE user_id = $1`, [farmer1Id]);
    if (updateRes.affectedRows === 0) {
      pass('RLS-2.4', 'Farmer 2 cannot mutate Farmer 1 Khata record (0 rows updated)');
    } else {
      fail('RLS-2.4', 'Farmer 2 maliciously updated Farmer 1 Khata transaction');
    }

    // AS DRIVER: Attempt to DELETE Farmer 1's Khata records
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${driverId}", "role": "authenticated"}';
    `);
    const delRes = await pglite.query(`DELETE FROM public.khata_transactions WHERE user_id = $1`, [farmer1Id]);
    if (delRes.affectedRows === 0) {
      pass('RLS-2.5', 'Driver cannot delete Farmer 1 Khata records (0 rows deleted)');
    } else {
      fail('RLS-2.5', 'Driver deleted Farmer 1 Khata records');
    }
  } catch (err) {
    fail('RLS-2', `RLS data isolation test failed: ${err.message}`);
  }

  console.log('\n▶ Test 3: Real PostgreSQL RLS — Community Post Ownership & Like Integrity');
  try {
    // AS FARMER 1: Create a community post
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    const postInsert = await pglite.query(`
      INSERT INTO public.community_posts (author_id, crop_tag, title, description)
      VALUES ($1, 'Cotton', 'Whitefly alert in Warangal', 'Noticed heavy infestation on lower leaves')
      RETURNING id;
    `, [farmer1Id]);
    const postId = postInsert.rows[0].id;
    pass('RLS-3.1', `Farmer 1 published community post (${postId})`);

    // AS FARMER 2: Read community feed (Public read permitted)
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const feed = await pglite.query(`SELECT id, title, author_id FROM public.community_posts WHERE id = $1`, [postId]);
    if (feed.rows.length === 1) {
      pass('RLS-3.2', 'Farmer 2 can read community post');
    } else {
      fail('RLS-3.2', 'Farmer 2 could not view public post');
    }

    // AS FARMER 2: Attempt to DELETE Farmer 1's post (Should affect 0 rows)
    const delPost = await pglite.query(`DELETE FROM public.community_posts WHERE id = $1`, [postId]);
    if (delPost.affectedRows === 0) {
      pass('RLS-3.3', 'Farmer 2 cannot delete Farmer 1 community post (0 rows deleted)');
    } else {
      fail('RLS-3.3', 'Farmer 2 deleted Farmer 1 community post');
    }

    // AS FARMER 2: Like Farmer 1's post as Farmer 2
    await pglite.query(`
      INSERT INTO public.post_likes (post_id, user_id) VALUES ($1, $2)
    `, [postId, farmer2Id]);
    pass('RLS-3.4', 'Farmer 2 legitimately liked post as Farmer 2');

    // AS FARMER 2: Attempt to impersonate Farmer 1 by inserting a like on behalf of Farmer 1
    let impersonationBlocked = false;
    try {
      await pglite.query(`
        INSERT INTO public.post_likes (post_id, user_id) VALUES ($1, $2)
      `, [postId, farmer1Id]);
    } catch (rlsErr) {
      impersonationBlocked = true;
    }
    if (impersonationBlocked) {
      pass('RLS-3.5', 'Farmer 2 blocked by RLS from forging like on behalf of Farmer 1');
    } else {
      fail('RLS-3.5', 'RLS permitted cross-user like forgery');
    }
  } catch (err) {
    fail('RLS-3', `Community RLS test error: ${err.message}`);
  }

  console.log('\n▶ Test 4: Privilege Escalation Prevention');
  try {
    // Reset role to superuser to simulate auth provider inserting into auth.users
    await pglite.exec(`RESET ROLE;`);

    // Attempt to register with self-assigned 'admin' role in user metadata
    const attackerId = '99999999-9999-9999-9999-999999999999';
    await pglite.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${attackerId}', 'hacker@nukrop.ai', '{"full_name": "Fake Admin", "role": "admin"}');
    `);

    const profileRes = await pglite.query(`SELECT role FROM public.profiles WHERE id = $1`, [attackerId]);
    if (profileRes.rows.length === 1 && profileRes.rows[0].role === 'farmer') {
      pass('SEC-4.1', 'Trigger stripped self-assigned admin role and defaulted to farmer');
    } else {
      fail('SEC-4.1', `Privilege escalation succeeded! Role is: ${profileRes.rows[0]?.role}`);
    }
  } catch (err) {
    fail('SEC-4', `Privilege escalation test failed: ${err.message}`);
  }

  console.log('\n================================================================================');
  console.log(`📊 REAL POSTGRESQL RLS TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runRealPostgreSqlRlsSuite().catch(err => {
  console.error('FATAL RLS TEST SUITE FAILURE:', err);
  process.exit(1);
});
