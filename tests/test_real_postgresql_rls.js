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
  phone VARCHAR(50),
  encrypted_password VARCHAR(255),
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

      -- Create legacy public.users table to verify P0.3 migration safety & admin escalation blocking
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        role VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO public.users (id, email, password_hash, role) VALUES
        ('88888888-8888-8888-8888-888888888888', 'legacy_admin@nukrop.ai', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQmG6FeVnZ4pZ5x8kGyGG', 'admin'),
        ('77777777-7777-7777-7777-777777777777', 'legacy_incompatible@nukrop.ai', 'incompatible_md5_hash_sample', 'farmer');
    `);
    pass('MIG-1.2', 'Pre-existing profile and legacy accounts inserted into baseline schema');

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

    // 4b. Verify P0.3: Legacy admin role escalation prevented during migration
    const resLegacyAdminAuth = await pglite.query(
      `SELECT id, email, raw_app_meta_data FROM auth.users WHERE id = '88888888-8888-8888-8888-888888888888'`
    );
    const resLegacyAdminProfile = await pglite.query(
      `SELECT id, role FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'`
    );
    const resLegacyAdminAudit = await pglite.query(
      `SELECT status, details FROM public._migration_legacy_user_sync_audit WHERE user_id = '88888888-8888-8888-8888-888888888888'`
    );
    const appMeta = resLegacyAdminAuth.rows[0]?.raw_app_meta_data;
    if (
      appMeta?.role === 'farmer' &&
      appMeta?.admin_verification_required === true &&
      resLegacyAdminProfile.rows[0]?.role === 'farmer' &&
      resLegacyAdminAudit.rows[0]?.status === 'ADMIN_VERIFICATION_REQUIRED'
    ) {
      pass('P0.3-MIG', 'Legacy admin downgraded to farmer, marked for admin verification, recorded in audit table');
    } else {
      fail('P0.3-MIG', `Legacy admin was not safely downgraded: ${JSON.stringify(appMeta)}`);
    }

    // 4c. Verify P0.3: Incompatible password hash marked for recovery
    const resIncompatibleAudit = await pglite.query(
      `SELECT status FROM public._migration_legacy_user_sync_audit WHERE user_id = '77777777-7777-7777-7777-777777777777'`
    );
    if (resIncompatibleAudit.rows[0]?.status === 'PASSWORD_RECOVERY_REQUIRED') {
      pass('P0.3-REC', 'Incompatible password hash flagged as PASSWORD_RECOVERY_REQUIRED');
    } else {
      fail('P0.3-REC', `Incompatible password not flagged properly: ${resIncompatibleAudit.rows[0]?.status}`);
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

    // =========================================================================
    // P0.1 TESTS: PROFILES PRIVATE DATA ISOLATION & PUBLIC VIEW VERIFICATION
    // =========================================================================
    // AS FARMER 1: Update own profile with sensitive financial and identity data
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
      UPDATE public.profiles SET
        phone = '+919111111111',
        land_acres = 12.5,
        kcc_credit_limit = 250000.00,
        agristack_id = 'AGR-TEL-WAR-9821'
      WHERE id = '${farmer1Id}';
    `);
    pass('P0.1-1', 'Farmer 1 updated own profile with sensitive PII / financial data');

    // AS FARMER 1: Can select own full profile
    const f1OwnProfile = await pglite.query(`SELECT phone, land_acres, kcc_credit_limit, agristack_id FROM public.profiles WHERE id = $1`, [farmer1Id]);
    if (f1OwnProfile.rows.length === 1 && f1OwnProfile.rows[0].phone === '+919111111111') {
      pass('P0.1-2', 'Farmer 1 can read own sensitive private profile fields');
    } else {
      fail('P0.1-2', 'Farmer 1 failed to read own profile');
    }

    // AS FARMER 2: Attempt to query Farmer 1's private profile table directly
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2ReadF1 = await pglite.query(`SELECT * FROM public.profiles WHERE id = $1`, [farmer1Id]);
    if (f2ReadF1.rows.length === 0) {
      pass('P0.1-3', 'Farmer 2 CANNOT read Farmer 1 private profile table (RLS returned 0 rows)');
    } else {
      fail('P0.1-3', `Farmer 2 breached Farmer 1 private profile: ${JSON.stringify(f2ReadF1.rows)}`);
    }

    // AS FARMER 2: Query public.public_profiles discovery view for Farmer 1
    const f2ReadView = await pglite.query(`SELECT * FROM public.public_profiles WHERE id = $1`, [farmer1Id]);
    if (f2ReadView.rows.length === 1) {
      const row = f2ReadView.rows[0];
      const returnedKeys = Object.keys(row);
      const approvedKeys = ['id', 'full_name', 'role', 'avatar_url', 'district', 'state', 'agristack_verified', 'created_at'];
      const unapprovedKeys = returnedKeys.filter(k => !approvedKeys.includes(k));
      
      // Verify public fields are present
      const hasPublicFields = row.full_name !== undefined && row.role !== undefined && row.district !== undefined;
      // Verify sensitive private fields are NOT present in the view schema
      const exposesPrivate = row.phone !== undefined || row.email !== undefined || row.land_acres !== undefined || 
                             row.kcc_credit_limit !== undefined || row.agristack_id !== undefined || 
                             row.user_id !== undefined || row.village !== undefined;
      
      if (hasPublicFields && !exposesPrivate && unapprovedKeys.length === 0) {
        pass('P0.1-4', 'Farmer 2 can discover Farmer 1 via public_profiles view without exposing phone/email/kcc/land/user_id/village');
      } else {
        fail('P0.1-4', `public_profiles view exposes private or unapproved columns: ${unapprovedKeys.join(', ')}`);
      }
    } else {
      fail('P0.1-4', `public_profiles view failed to return row for Farmer 1 (rows: ${f2ReadView.rows.length})`);
    }

    // AS ANON: Attempt to query public_profiles (should be rejected because REVOKE ALL FROM anon)
    await pglite.exec(`
      SET ROLE anon;
      SET request.jwt.claims = '{"role": "anon"}';
    `);
    let anonBlocked = false;
    try {
      await pglite.query(`SELECT * FROM public.public_profiles WHERE id = $1`, [farmer1Id]);
    } catch (e) {
      anonBlocked = true;
    }
    if (anonBlocked) {
      pass('P0.1-4b', 'Anonymous user blocked from querying public_profiles view (permission denied)');
    } else {
      fail('P0.1-4b', 'Anonymous user was permitted to query public_profiles');
    }

    // AS DRIVER: Test driver profile access
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${driverId}", "role": "authenticated"}';
    `);
    const driverOwn = await pglite.query(`SELECT id, role FROM public.profiles WHERE id = $1`, [driverId]);
    const driverOther = await pglite.query(`SELECT id FROM public.profiles WHERE id = $1`, [farmer1Id]);
    if (driverOwn.rows.length === 1 && driverOther.rows.length === 0) {
      pass('P0.1-5', 'Driver can select own profile (1 row) but cannot read Farmer 1 private profile (0 rows)');
    } else {
      fail('P0.1-5', `Driver RLS profile isolation violated: own=${driverOwn.rows.length}, other=${driverOther.rows.length}`);
    }

    // AS ADMIN: Admin role can read all profiles via app_metadata
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "app_metadata": {"role": "admin"}}';
    `);
    const adminRead = await pglite.query(`SELECT COUNT(*)::int as count FROM public.profiles`);
    if (adminRead.rows[0].count >= 3) {
      pass('P0.1-6', `Admin can query all profiles (${adminRead.rows[0].count} profiles visible)`);
    } else {
      fail('P0.1-6', `Admin failed to read profiles: count=${adminRead.rows[0]?.count}`);
    }

    // AS SERVICE_ROLE: Service role can read all profiles
    await pglite.exec(`
      SET ROLE service_role;
      SET request.jwt.claims = '{"role": "service_role"}';
    `);
    const svcRead = await pglite.query(`SELECT COUNT(*)::int as count FROM public.profiles`);
    if (svcRead.rows[0].count >= 3) {
      pass('P0.1-7', `Service role can query all profiles (${svcRead.rows[0].count} profiles visible)`);
    } else {
      fail('P0.1-7', `Service role failed to read profiles: count=${svcRead.rows[0]?.count}`);
    }

    // =========================================================================
    // P0.4 TESTS: GENUINE PERSISTENT PRICE ALERTS RLS & IDEMPOTENCY
    // =========================================================================
    // AS FARMER 1: Create a genuine price alert
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    const alertRes = await pglite.query(`
      INSERT INTO public.price_alerts (user_id, crop, commodity, mandi, target_price, condition, idempotency_key)
      VALUES ($1, 'Cotton', 'Cotton', 'Warangal', 7500.00, 'ABOVE', 'alert-idem-farmer1-001')
      RETURNING id, crop, target_price, status;
    `, [farmer1Id]);
    const alertId = alertRes.rows[0].id;
    if (alertRes.rows[0].status === 'ACTIVE' && Number(alertRes.rows[0].target_price) === 7500) {
      pass('P0.4-1', `Farmer 1 created persistent price alert (${alertId}) with status ACTIVE`);
    } else {
      fail('P0.4-1', 'Failed to create active price alert');
    }

    // AS FARMER 2: Cannot select Farmer 1's price alert
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2Alerts = await pglite.query(`SELECT * FROM public.price_alerts WHERE id = $1`, [alertId]);
    if (f2Alerts.rows.length === 0) {
      pass('P0.4-2', 'Farmer 2 cannot read Farmer 1 price alerts (RLS returned 0 rows)');
    } else {
      fail('P0.4-2', 'Farmer 2 accessed Farmer 1 price alert');
    }

    // AS FARMER 2: Cannot delete Farmer 1's price alert
    const f2DelAlert = await pglite.query(`DELETE FROM public.price_alerts WHERE id = $1`, [alertId]);
    if (f2DelAlert.affectedRows === 0) {
      pass('P0.4-3', 'Farmer 2 cannot delete Farmer 1 price alert (0 rows deleted)');
    } else {
      fail('P0.4-3', 'Farmer 2 deleted Farmer 1 price alert');
    }

    // AS FARMER 1: Idempotency Key uniqueness prevents duplicate alerts
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    let dupBlocked = false;
    try {
      await pglite.query(`
        INSERT INTO public.price_alerts (user_id, crop, commodity, mandi, target_price, condition, idempotency_key)
        VALUES ($1, 'Cotton', 'Cotton', 'Warangal', 7500.00, 'ABOVE', 'alert-idem-farmer1-001');
      `, [farmer1Id]);
    } catch (e) {
      dupBlocked = true;
    }
    if (dupBlocked) {
      pass('P0.4-4', 'Duplicate price alert with same idempotency key blocked by unique constraint');
    } else {
      fail('P0.4-4', 'Duplicate price alert was allowed');
    }

    // AS FARMER 2: Create alert with SAME idempotency key as Farmer 1 (allowed because scoped per (user_id, idempotency_key))
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2AlertRes = await pglite.query(`
      INSERT INTO public.price_alerts (user_id, crop, commodity, mandi, target_price, condition, idempotency_key)
      VALUES ($1, 'Cotton', 'Cotton', 'Warangal', 7600.00, 'ABOVE', 'alert-idem-farmer1-001')
      RETURNING id;
    `, [farmer2Id]);
    if (f2AlertRes.rows.length === 1) {
      pass('P0.4-5', 'Farmer 2 can reuse same idempotency key without collision (scoped per user_id)');
    } else {
      fail('P0.4-5', 'Cross-user idempotency key caused unexpected conflict');
    }

    // =========================================================================
    // P0.5 TESTS: GENUINE NOTIFICATIONS TABLE RLS & STATE INTEGRITY
    // =========================================================================
    // AS SERVICE_ROLE: Background price alert engine inserts notification for Farmer 1
    await pglite.exec(`
      SET ROLE service_role;
      SET request.jwt.claims = '{"role": "service_role"}';
    `);
    const notifRes = await pglite.query(`
      INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
      VALUES ($1, 'PRICE_ALERT_ENGINE', 'alert-idem-farmer1-001', 'PRICE_ALERT', 'Cotton Price Target Met', 'Warangal mandi reached ₹7,550/Q')
      RETURNING id, is_read;
    `, [farmer1Id]);
    const notifId = notifRes.rows[0].id;
    pass('P0.5-1', `Created notification for Farmer 1 (${notifId})`);

    // AS FARMER 2: Attempt to read Farmer 1's notifications
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2Notifs = await pglite.query(`SELECT * FROM public.notifications WHERE user_id = $1`, [farmer1Id]);
    if (f2Notifs.rows.length === 0) {
      pass('P0.5-2', 'Farmer 2 cannot read Farmer 1 notifications (RLS returned 0 rows)');
    } else {
      fail('P0.5-2', 'Farmer 2 read Farmer 1 notifications');
    }

    // AS FARMER 2: Attempt to update Farmer 1's notification read state
    const f2UpdNotif = await pglite.query(`UPDATE public.notifications SET is_read = true WHERE id = $1`, [notifId]);
    if (f2UpdNotif.affectedRows === 0) {
      pass('P0.5-3', 'Farmer 2 cannot mark Farmer 1 notification as read (0 rows updated)');
    } else {
      fail('P0.5-3', 'Farmer 2 mutated Farmer 1 notification read state');
    }

    // AS FARMER 1: Can read and mark own notification as read
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    const f1UpdNotif = await pglite.query(`UPDATE public.notifications SET is_read = true WHERE id = $1 RETURNING id, is_read`, [notifId]);
    if (f1UpdNotif.affectedRows === 1 && f1UpdNotif.rows[0].is_read === true) {
      pass('P0.5-4', 'Farmer 1 successfully marked own notification as read');
    } else {
      fail('P0.5-4', 'Farmer 1 failed to update own notification');
    }

    // AS SERVICE_ROLE: Attempt duplicate notification insert with same (user_id, event_source, event_id)
    await pglite.exec(`
      SET ROLE service_role;
      SET request.jwt.claims = '{"role": "service_role"}';
    `);
    let dupNotifBlocked = false;
    try {
      await pglite.query(`
        INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
        VALUES ($1, 'PRICE_ALERT_ENGINE', 'alert-idem-farmer1-001', 'PRICE_ALERT', 'Cotton Target Duplicate', 'Should be blocked')
      `, [farmer1Id]);
    } catch (e) {
      dupNotifBlocked = true;
    }
    if (dupNotifBlocked) {
      pass('P0.5-5', 'Duplicate notification with same (user_id, event_source, event_id) blocked by unique constraint');
    } else {
      fail('P0.5-5', 'Duplicate notification was allowed');
    }

    // =========================================================================
    // P0.2 TESTS: OBSERVABLE MIGRATION AUDIT TABLE VERIFICATION
    // =========================================================================
    await pglite.exec(`RESET ROLE;`);
    const auditRes = await pglite.query(`SELECT COUNT(*)::int as count FROM public._migration_legacy_user_sync_audit`);
    if (auditRes.rows[0].count >= 0) {
      pass('P0.2-1', `_migration_legacy_user_sync_audit table exists and is queryable (entries: ${auditRes.rows[0].count})`);
    } else {
      fail('P0.2-1', '_migration_legacy_user_sync_audit not found');
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
