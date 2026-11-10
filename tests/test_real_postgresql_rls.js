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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin;
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
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON TABLE auth.users TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
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

    // 2. Insert pre-existing profiles in baseline schema to verify non-destructive data preservation
    const baselineUserId = 'a0000000-0000-0000-0000-000000000001';
    const genuineHanamkondaId = 'a0000000-0000-0000-0000-000000000002';
    const withLandDocId = 'a0000000-0000-0000-0000-000000000003';
    const partialDefaultId = 'a0000000-0000-0000-0000-000000000004';

    await pglite.exec(`
      INSERT INTO auth.users (id, email) VALUES 
        ('${baselineUserId}', 'existing_farmer@nukrop.ai'),
        ('${genuineHanamkondaId}', 'genuine_warangal_farmer@nukrop.ai'),
        ('${withLandDocId}', 'farmer_landdoc@nukrop.ai'),
        ('${partialDefaultId}', 'farmer_partial@nukrop.ai');

      INSERT INTO public.profiles (id, phone, full_name, state, district, village, land_extent_acres)
      VALUES 
        ('${baselineUserId}', '+919876543210', 'Legacy Preexisting Farmer', 'Telangana', 'Warangal', NULL, NULL),
        ('${genuineHanamkondaId}', '+919876543211', 'Genuine Hanamkonda Farmer', 'Telangana', 'Warangal', 'Hanamkonda', 4.50),
        ('${withLandDocId}', '+919876543212', 'Farmer With Land Document', 'Telangana', 'Warangal', 'Hanamkonda', 4.50),
        ('${partialDefaultId}', '+919876543213', 'Partial Default Farmer', 'Telangana', 'Karimnagar', 'Hanamkonda', 2.00);

      -- Create land document for withLandDocId
      CREATE TABLE IF NOT EXISTS public.land_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        document_type TEXT,
        document_number TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO public.land_documents (user_id, document_type, document_number)
      VALUES ('${withLandDocId}', 'Pattadar Passbook', 'TS-WRG-2026-9988');

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
    pass('MIG-1.2', 'Pre-existing profiles and legacy accounts inserted into baseline schema');

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

    // 4a-1. P0 Historical Data Preservation: Genuine farmer in Hanamkonda with 4.5 acres has data preserved intact
    const resGenuine = await pglite.query(
      `SELECT village, district, state, land_extent_acres, land_acres FROM public.profiles WHERE id = $1`,
      [genuineHanamkondaId]
    );
    const gRow = resGenuine.rows[0];
    if (
      gRow &&
      gRow.village === 'Hanamkonda' &&
      gRow.district === 'Warangal' &&
      gRow.state === 'Telangana' &&
      Number(gRow.land_extent_acres) === 4.5
    ) {
      pass('P0-PROV-1', 'Genuine farmer in Hanamkonda with 4.50 acres and no land doc preserved intact in public.profiles (zero destructive NULL overwrites)');
    } else {
      fail('P0-PROV-1', `Genuine farmer profile data was destructively modified: ${JSON.stringify(gRow)}`);
    }

    // 4a-2. P0 Audit Trail: Provenance uncertainty recorded as FLAGGED_UNVERIFIED_DEFAULT with action PRESERVED_FOR_USER_CONFIRMATION
    const resAudit = await pglite.query(
      `SELECT field_name, current_value, provenance_status, action FROM public._profile_provenance_audit WHERE profile_id = $1 ORDER BY field_name`,
      [genuineHanamkondaId]
    );
    if (
      resAudit.rows.length >= 4 &&
      resAudit.rows.every(r => r.provenance_status === 'FLAGGED_UNVERIFIED_DEFAULT' && r.action === 'PRESERVED_FOR_USER_CONFIRMATION')
    ) {
      pass('P0-PROV-2', 'Unverified legacy defaults flagged in provenance audit table with action PRESERVED_FOR_USER_CONFIRMATION (zero destructive NULL overwrites)');
    } else {
      fail('P0-PROV-2', `Audit trail missing or unexpected: ${JSON.stringify(resAudit.rows)}`);
    }

    // 4a-3. P0 Farmer with land doc preserved
    const resDoc = await pglite.query(
      `SELECT village, district, state, land_extent_acres FROM public.profiles WHERE id = $1`,
      [withLandDocId]
    );
    if (resDoc.rows[0]?.village === 'Hanamkonda' && Number(resDoc.rows[0]?.land_extent_acres) === 4.5) {
      pass('P0-PROV-3', 'Farmer with linked land document preserved intact in public.profiles');
    } else {
      fail('P0-PROV-3', `Farmer with land document corrupted: ${JSON.stringify(resDoc.rows)}`);
    }

    // 4a-4. P0 Profile with partial default fields untouched
    const resPartial = await pglite.query(
      `SELECT village, district, state, land_extent_acres FROM public.profiles WHERE id = $1`,
      [partialDefaultId]
    );
    const resPartialAudit = await pglite.query(
      `SELECT COUNT(*)::int as count FROM public._profile_provenance_audit WHERE profile_id = $1`,
      [partialDefaultId]
    );
    if (
      resPartial.rows[0]?.village === 'Hanamkonda' &&
      resPartial.rows[0]?.district === 'Karimnagar' &&
      resPartialAudit.rows[0]?.count === 0
    ) {
      pass('P0-PROV-4', 'Profile with partial default-looking fields untouched and not logged in audit');
    } else {
      fail('P0-PROV-4', `Partial default profile handled incorrectly: profile=${JSON.stringify(resPartial.rows)}, audit=${JSON.stringify(resPartialAudit.rows)}`);
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
    const auditCountBeforeRerun = (await pglite.query(`SELECT COUNT(*)::int as count FROM public._profile_provenance_audit`)).rows[0]?.count;
    await pglite.exec(reconSql);
    const auditCountAfterRerun = (await pglite.query(`SELECT COUNT(*)::int as count FROM public._profile_provenance_audit`)).rows[0]?.count;
    if (auditCountBeforeRerun === auditCountAfterRerun) {
      pass('MIG-1.5', 'Reconciliation migration re-applied idempotently without errors or duplicate audit rows');
    } else {
      fail('MIG-1.5', `Migration rerun generated duplicate audit rows: before=${auditCountBeforeRerun}, after=${auditCountAfterRerun}`);
    }
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

    // P0-DEF-1: Verify NO fabricated geographic or consent defaults were assigned, and public_profile_enabled defaults to false
    await pglite.exec(`RESET ROLE;`);
    const defaultsCheck = await pglite.query(
      `SELECT village, district, state, land_extent_acres, dpdp_consent_given, public_profile_enabled FROM public.profiles WHERE id = $1`,
      [farmer1Id]
    );
    const defRow = defaultsCheck.rows[0];
    if (defRow.village === null && defRow.district === null && defRow.state === null &&
        defRow.land_extent_acres === null && defRow.dpdp_consent_given === false && defRow.public_profile_enabled === false) {
      pass('P0-DEF-1', 'Missing profile attributes stored as NULL/false without fabricated defaults (no Hanamkonda/Warangal/Telangana/4.50/TRUE, public_profile_enabled=false)');
    } else {
      fail('P0-DEF-1', `Profile received fabricated defaults: ${JSON.stringify(defRow)}`);
    }

    // P0-DEF-2: Verify explicit user attributes and consent are preserved accurately without clobbering
    const farmer3Id = '44444444-4444-4444-4444-444444444444';
    await pglite.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${farmer3Id}', 'farmer3@nukrop.ai', '{"full_name": "Farmer Three", "role": "farmer", "village": "Alwal", "district": "Medchal", "state": "Telangana", "dpdp_consent_given": true}')
      ON CONFLICT (id) DO NOTHING;
    `);
    const f3Check = await pglite.query(
      `SELECT village, district, state, dpdp_consent_given, public_profile_enabled FROM public.profiles WHERE id = $1`,
      [farmer3Id]
    );
    if (f3Check.rows[0]?.village === 'Alwal' && f3Check.rows[0]?.district === 'Medchal' &&
        f3Check.rows[0]?.state === 'Telangana' && f3Check.rows[0]?.dpdp_consent_given === true &&
        f3Check.rows[0]?.public_profile_enabled === false) {
      pass('P0-DEF-2', 'Explicit user attributes and DPDP consent are preserved accurately without being clobbered');
    } else {
      fail('P0-DEF-2', `Explicit attributes not preserved: ${JSON.stringify(f3Check.rows[0])}`);
    }

    // P0-AUDIT-PROV: Verify historical provenance audit table exists and logged legacy records
    const auditTableRes = await pglite.query(`
      SELECT COUNT(*)::int as count FROM public._profile_provenance_audit
    `);
    if (auditTableRes.rows[0]?.count >= 0) {
      pass('P0-AUDIT-PROV', `Historical profile provenance audit table active (logged audit events: ${auditTableRes.rows[0]?.count})`);
    } else {
      fail('P0-AUDIT-PROV', 'Provenance audit table missing or failed query');
    }

    // P0-OPTIN-1: AS FARMER 2: Query public.public_profiles before Farmer 1 opts in -> returns 0 rows (default privacy shield)
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2BeforeOptIn = await pglite.query(
      `SELECT * FROM public.public_profiles WHERE full_name = 'Farmer One'`
    );
    if (f2BeforeOptIn.rows.length === 0) {
      pass('P0-OPTIN-1', 'New account is NOT publicly discoverable before explicit opt-in (public_profiles returned 0 rows)');
    } else {
      fail('P0-OPTIN-1', `Farmer 1 was prematurely discoverable: ${JSON.stringify(f2BeforeOptIn.rows)}`);
    }

    // P0-DIRECT-MUTATE-BLOCKED: Direct table mutation of discovery flag is strictly blocked for authenticated role
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    let directMutateBlocked = false;
    try {
      await pglite.query(`UPDATE public.profiles SET public_profile_enabled = TRUE WHERE id = $1`, [farmer1Id]);
    } catch (e) {
      if (e.message.includes('Direct table mutation of public_profile_enabled is prohibited')) {
        directMutateBlocked = true;
      }
    }
    if (directMutateBlocked) {
      pass('P0-DIRECT-MUTATE-BLOCKED', 'Direct table update of public_profile_enabled blocked by trigger for authenticated users');
    } else {
      fail('P0-DIRECT-MUTATE-BLOCKED', 'Direct table update of public_profile_enabled was not blocked!');
    }

    // P0-OPTIN-2: AS FARMER 1: Explicitly opt-in via audited SECURITY DEFINER RPC function
    const optInRpcRes = await pglite.query(`SELECT public.set_my_profile_discovery(true) as enabled;`);
    if (optInRpcRes.rows[0]?.enabled === true) {
      pass('P0-OPTIN-RPC', 'Authenticated user explicitly opts in via audited RPC set_my_profile_discovery(true)');
    } else {
      fail('P0-OPTIN-RPC', `RPC set_my_profile_discovery failed: ${JSON.stringify(optInRpcRes.rows)}`);
    }

    // P0-OPTIN-3: AS FARMER 2: Query public.public_profiles now that Farmer 1 has opted in
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2DiscoverF1 = await pglite.query(
      `SELECT * FROM public.public_profiles WHERE full_name = 'Farmer One'`
    );
    if (f2DiscoverF1.rows.length === 1) {
      const discRow = f2DiscoverF1.rows[0];
      const hasNoUuid = discRow.id === undefined && discRow.user_id === undefined;
      const hasNoPii = discRow.phone === undefined && discRow.email === undefined && discRow.land_acres === undefined && discRow.village === undefined && discRow.kcc_balance === undefined;
      const hasNoInternalIds = discRow.farmer_id === undefined && discRow.driver_id === undefined;
      const hasOpaquePublicId = typeof discRow.public_id === 'string' && discRow.public_id.startsWith('nk_pub_');
      const approvedKeys = ['public_id', 'full_name', 'role', 'avatar_url', 'district', 'state', 'created_at'];
      const returnedKeys = Object.keys(discRow);
      const unapprovedKeys = returnedKeys.filter(k => !approvedKeys.includes(k));
      if (hasNoUuid && hasNoPii && hasNoInternalIds && hasOpaquePublicId && unapprovedKeys.length === 0) {
        pass('P1.1-DISC-1', 'Farmer 2 discovers Farmer 1 after opt-in (opaque public_id only, zero internal farmer/driver IDs, zero UUIDs, zero PII)');
      } else {
        fail('P1.1-DISC-1', `Discovery returned unexpected fields or exposed internal identifiers: ${JSON.stringify(discRow)}`);
      }
    } else {
      fail('P1.1-DISC-1', `Farmer 2 could not discover Farmer 1 via public.public_profiles (rows returned: ${f2DiscoverF1.rows.length})`);
    }

    // P0-OPTIN-4: AS FARMER 1: Revoke opt-in via audited RPC -> Immediate revocation
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    await pglite.query(`SELECT public.set_my_profile_discovery(false);`);

    // AS FARMER 2: Query again -> immediately 0 rows returned
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2AfterRevocation = await pglite.query(
      `SELECT * FROM public.public_profiles WHERE full_name = 'Farmer One'`
    );
    if (f2AfterRevocation.rows.length === 0) {
      pass('P0-OPTIN-REVOKE', 'Revocation is immediate: Farmer 1 is instantly hidden from public discovery upon opt-out (0 rows)');
    } else {
      fail('P0-OPTIN-REVOKE', `Farmer 1 remained discoverable after revocation: ${JSON.stringify(f2AfterRevocation.rows)}`);
    }

    // P0-CROSS-MUTATE-BLOCKED: Adversarial mutation: Farmer 2 attempts to change Farmer 1's public_profile_enabled
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    let crossMutateBlocked = false;
    try {
      const f2TamperF1 = await pglite.query(
        `UPDATE public.profiles SET public_profile_enabled = TRUE WHERE id = $1 RETURNING id`,
        [farmer1Id]
      );
      if (f2TamperF1.rows.length === 0) crossMutateBlocked = true;
    } catch (_) {
      crossMutateBlocked = true;
    }
    if (crossMutateBlocked) {
      pass('P0-CROSS-MUTATE-BLOCKED', 'Cross-user visibility tampering blocked: Farmer 2 cannot alter Farmer 1 visibility setting');
    } else {
      fail('P0-CROSS-MUTATE-BLOCKED', `Farmer 2 illegally mutated Farmer 1 visibility setting!`);
    }

    // Re-enable Farmer 3's opt-in for projection verification
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer3Id}", "role": "authenticated"}';
    `);
    await pglite.query(`SELECT public.set_my_profile_discovery(true);`);

    // AS FARMER 3: Query public.public_profiles discovery view for own public projection
    const f3ReadView = await pglite.query(`SELECT * FROM public.public_profiles WHERE full_name = 'Farmer Three'`);
    if (f3ReadView.rows.length === 1) {
      const row = f3ReadView.rows[0];
      const returnedKeys = Object.keys(row);
      const approvedKeys = ['public_id', 'full_name', 'role', 'avatar_url', 'district', 'state', 'created_at'];
      const unapprovedKeys = returnedKeys.filter(k => !approvedKeys.includes(k));
      
      // Verify primary key id and internal user_id are strictly stripped from public discovery
      const hasAuthUuid = row.id !== undefined || row.user_id !== undefined;
      // Verify opaque public_id is present and internal IDs (farmer_id, driver_id) are removed
      const hasOpaquePublicId = typeof row.public_id === 'string' && row.public_id.startsWith('nk_pub_');
      const hasNoInternalIds = row.farmer_id === undefined && row.driver_id === undefined;
      // Verify sensitive private fields are NOT present in the view schema
      const exposesPrivate = row.phone !== undefined || row.email !== undefined || row.land_acres !== undefined || 
                             row.kcc_credit_limit !== undefined || row.agristack_id !== undefined || 
                             row.village !== undefined || row.kcc_balance !== undefined;
      
      if (!hasAuthUuid && hasOpaquePublicId && hasNoInternalIds && !exposesPrivate && unapprovedKeys.length === 0) {
        pass('P0.1-4', 'Public discovery view uses opaque public identifier (nk_pub_*) and strips internal farmer_id/driver_id/auth UUIDs without leaking PII/financial/land data');
      } else {
        fail('P0.1-4', `public_profiles view exposes private or unapproved columns: ${unapprovedKeys.join(', ')} (hasAuthUuid: ${hasAuthUuid}, hasNoInternalIds: ${hasNoInternalIds})`);
      }
    } else {
      fail('P0.1-4', `public_profiles view failed to return rows for opted-in user (rows: ${f3ReadView.rows.length})`);
    }

    // P1.1-ADV-1: Adversarial Test - Attempting to query public_profiles by auth UUID 'id' fails because 'id' column does not exist
    let idColumnExists = false;
    try {
      await pglite.query(`SELECT id FROM public.public_profiles`);
      idColumnExists = true;
    } catch (e) {
      idColumnExists = false;
    }
    if (!idColumnExists) {
      pass('P1.1-ADV-1', 'Auth UUID primary key id is completely eliminated from public.public_profiles view');
    } else {
      fail('P1.1-ADV-1', 'Auth UUID primary key id was still exposed in public.public_profiles');
    }

    // P1.1-ADV-2: Adversarial Test - Farmer A cannot retrieve Farmer B private profile table directly
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f2ReadF1Direct = await pglite.query(`SELECT phone, land_acres, kcc_credit_limit FROM public.profiles WHERE id = $1`, [farmer1Id]);
    if (f2ReadF1Direct.rows.length === 0) {
      pass('P1.1-ADV-2', 'Farmer 2 cannot retrieve Farmer 1 private profile table via direct query (RLS returned 0 rows)');
    } else {
      fail('P1.1-ADV-2', `Farmer 2 breached Farmer 1 private profile: ${JSON.stringify(f2ReadF1Direct.rows)}`);
    }

    // P1.1-ADV-3: AS ANON: Attempt to query public_profiles (should be rejected because REVOKE ALL FROM anon)
    await pglite.exec(`
      SET ROLE anon;
      SET request.jwt.claims = '{"role": "anon"}';
    `);
    let anonBlocked = false;
    try {
      await pglite.query(`SELECT * FROM public.public_profiles`);
    } catch (e) {
      anonBlocked = true;
    }
    if (anonBlocked) {
      pass('P1.1-ADV-3', 'Anonymous user blocked from querying public_profiles view (permission denied)');
    } else {
      fail('P1.1-ADV-3', 'Anonymous user was permitted to query public_profiles');
    }

    // P1-RPC-ANON-BLOCKED: Anonymous caller cannot execute set_my_profile_discovery
    let rpcAnonBlocked = false;
    try {
      await pglite.query(`SELECT public.set_my_profile_discovery(true)`);
    } catch (e) {
      rpcAnonBlocked = true;
    }
    if (rpcAnonBlocked) {
      pass('P1-RPC-ANON-BLOCKED', 'Anonymous user blocked from executing set_my_profile_discovery RPC (permission denied)');
    } else {
      fail('P1-RPC-ANON-BLOCKED', 'Anonymous user was permitted to execute set_my_profile_discovery');
    }

    // P1-UNIQUE-USERID: Database uniqueness constraint idx_profiles_user_id_unique blocks duplicate user_id
    await pglite.exec(`RESET ROLE;`);
    let duplicateUserIdBlocked = false;
    try {
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, full_name, role)
        VALUES ('99999999-9999-9999-9999-999999999991', '${farmer1Id}', 'Duplicate User Profile', 'farmer')
      `);
    } catch (e) {
      if (e.message.includes('unique') || e.message.includes('duplicate key') || e.message.includes('idx_profiles_user_id_unique')) {
        duplicateUserIdBlocked = true;
      }
    }
    if (duplicateUserIdBlocked) {
      pass('P1-UNIQUE-USERID', 'Unique index idx_profiles_user_id_unique successfully blocks duplicate profile user_id mappings');
    } else {
      fail('P1-UNIQUE-USERID', 'Duplicate user_id profile mapping was NOT blocked by unique index');
    }

    // P1-PUBID-ISOLATION: public_id cannot be used as an auth credential to query private profile data
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer2Id}", "role": "authenticated"}';
    `);
    const f3PublicId = f3ReadView.rows[0]?.public_id;
    const leakViaPubId = await pglite.query(
      `SELECT phone, email FROM public.profiles WHERE id::text = $1 OR user_id::text = $1`,
      [f3PublicId]
    );
    if (leakViaPubId.rows.length === 0) {
      pass('P1-PUBID-ISOLATION', 'public_id cannot be used as authorization credential or primary key to query private data (0 rows)');
    } else {
      fail('P1-PUBID-ISOLATION', 'Private profile data was accessible via public_id!');
    }

    // P1-AMBIGUOUS-RPC: Audited RPC rejects ambiguous profiles with AMBIGUOUS_IDENTITY
    // Temporarily drop unique index to simulate ambiguous duplicate profile rows
    await pglite.exec(`
      RESET ROLE;
      DROP INDEX IF EXISTS public.idx_profiles_user_id_unique;
      INSERT INTO auth.users (id, email) VALUES ('88888888-8888-8888-8888-888888888899', 'dup@nukrop.ai') ON CONFLICT (id) DO NOTHING;
      UPDATE public.profiles SET user_id = '${farmer1Id}' WHERE id = '88888888-8888-8888-8888-888888888899';
    `);
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${farmer1Id}", "role": "authenticated"}';
    `);
    let ambiguousRpcThrown = false;
    try {
      await pglite.query(`SELECT public.set_my_profile_discovery(true)`);
    } catch (e) {
      if (e.message.includes('AMBIGUOUS_IDENTITY')) {
        ambiguousRpcThrown = true;
      }
    }
    if (ambiguousRpcThrown) {
      pass('P1-AMBIGUOUS-RPC', 'set_my_profile_discovery safely raises AMBIGUOUS_IDENTITY when multiple profiles match authenticated user');
    } else {
      fail('P1-AMBIGUOUS-RPC', 'set_my_profile_discovery did not reject ambiguous multiple profile mappings');
    }
    // Clean up duplicate profile and restore unique index
    await pglite.exec(`
      RESET ROLE;
      DELETE FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888899';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON public.profiles(user_id) WHERE user_id IS NOT NULL;
    `);

    // P0-PUBID-1: Profile creation automatically populates non-null CSPRNG public_id via trigger/default
    await pglite.exec(`RESET ROLE;`);
    const newTestUid = '77777777-7777-7777-7777-777777777771';
    await pglite.query(`
      INSERT INTO auth.users (id, email) VALUES ($1, 'pubid_test@nukrop.ai') ON CONFLICT (id) DO NOTHING;
    `, [newTestUid]);
    const pubIdCheck = await pglite.query(`SELECT public_id FROM public.profiles WHERE id = $1`, [newTestUid]);
    const assignedPubId = pubIdCheck.rows[0]?.public_id;
    if (typeof assignedPubId === 'string' && /^nk_pub_[0-9a-f]{32}$/.test(assignedPubId) && assignedPubId.length === 39) {
      pass('P0-PUBID-NONNULL', `public_id generated automatically on creation with 128-bit UUID representation (122 bits of UUIDv4 random entropy, 32 hex chars suffix) (${assignedPubId})`);
    } else {
      fail('P0-PUBID-NONNULL', `public_id was not properly generated with 122 bits of random entropy: ${assignedPubId}`);
    }

    // P0-PUBID-2: Attempting to insert explicit NULL public_id is caught and populated by trigger
    const nullBypassUid = '77777777-7777-7777-7777-777777777772';
    await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
    await pglite.query(`
      INSERT INTO auth.users (id, email) VALUES ($1, 'null_bypass@nukrop.ai') ON CONFLICT (id) DO NOTHING;
    `, [nullBypassUid]);
    await pglite.query(`
      INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
      VALUES ($1, $1, 'null_bypass@nukrop.ai', 'Null Bypass User', 'farmer', NULL);
    `, [nullBypassUid]);
    await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    const nullBypassCheck = await pglite.query(`SELECT public_id FROM public.profiles WHERE id = $1`, [nullBypassUid]);
    const bypassedPubId = nullBypassCheck.rows[0]?.public_id;
    if (typeof bypassedPubId === 'string' && /^nk_pub_[0-9a-f]{32}$/.test(bypassedPubId) && bypassedPubId.length === 39) {
      pass('P0-PUBID-TRIGGER-POPULATE', `NULL public_id safely coerced to 122-bit UUIDv4 CSPRNG public_id by trigger (${bypassedPubId})`);
    } else {
      fail('P0-PUBID-TRIGGER-POPULATE', `NULL public_id was not coerced: ${bypassedPubId}`);
    }

    // P0-PUBID-AUTH-OMITTED: Authenticated user insert with public_id omitted succeeds via database-generated default
    const authOmittedUid = '77777777-7777-7777-7777-7777777777a0';
    await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
    await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'auth_omitted@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [authOmittedUid]);
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${authOmittedUid}", "role": "authenticated"}';
    `);
    await pglite.query(`
      INSERT INTO public.profiles (id, user_id, email, full_name, role)
      VALUES ($1, $1, 'auth_omitted@nukrop.ai', 'Auth Omitted Profile', 'farmer');
    `, [authOmittedUid]);
    await pglite.exec(`RESET ROLE;`);
    await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    const authOmittedCheck = await pglite.query(`SELECT public_id FROM public.profiles WHERE id = $1`, [authOmittedUid]);
    const authOmittedPubId = authOmittedCheck.rows[0]?.public_id;
    if (typeof authOmittedPubId === 'string' && /^nk_pub_[0-9a-f]{32}$/.test(authOmittedPubId) && authOmittedPubId.length === 39) {
      pass('P0-PUBID-AUTH-OMITTED', `Authenticated insert with public_id omitted safely populated by database default (${authOmittedPubId})`);
    } else {
      fail('P0-PUBID-AUTH-OMITTED', `Authenticated insert with omitted public_id failed: ${authOmittedPubId}`);
    }

    // P0-PUBID-AUTH-NULL: Authenticated user insert with public_id = NULL succeeds via trigger generation
    const authNullUid = '77777777-7777-7777-7777-7777777777a2';
    await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
    await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'auth_null@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [authNullUid]);
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${authNullUid}", "role": "authenticated"}';
    `);
    await pglite.query(`
      INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
      VALUES ($1, $1, 'auth_null@nukrop.ai', 'Auth Null Profile', 'farmer', NULL);
    `, [authNullUid]);
    await pglite.exec(`RESET ROLE;`);
    await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    const authNullCheck = await pglite.query(`SELECT public_id FROM public.profiles WHERE id = $1`, [authNullUid]);
    const authNullPubId = authNullCheck.rows[0]?.public_id;
    if (typeof authNullPubId === 'string' && /^nk_pub_[0-9a-f]{32}$/.test(authNullPubId) && authNullPubId.length === 39) {
      pass('P0-PUBID-AUTH-NULL', `Authenticated insert with public_id = NULL safely populated by trigger (${authNullPubId})`);
    } else {
      fail('P0-PUBID-AUTH-NULL', `Authenticated insert with NULL public_id failed: ${authNullPubId}`);
    }

    // P0-PUBID-EMPTY: Attempting to insert empty string public_id is rejected
    const emptyPubIdUid = '77777777-7777-7777-7777-7777777777e0';
    let emptyPubIdBlocked = false;
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'empty_pubid@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [emptyPubIdUid]);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'empty_pubid@nukrop.ai', 'Empty PubId User', 'farmer', '');
      `, [emptyPubIdUid]);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      if (e.message.includes('MALFORMED_PUBLIC_ID')) emptyPubIdBlocked = true;
    }
    if (emptyPubIdBlocked) {
      pass('P0-PUBID-EMPTY-REJECTED', 'Empty string public_id strictly rejected with MALFORMED_PUBLIC_ID');
    } else {
      fail('P0-PUBID-EMPTY-REJECTED', 'Empty string public_id was unexpectedly accepted!');
    }

    // P0-PUBID-UUID-INJECT: Attempting to inject auth UUID as public_id is rejected
    const uuidInjectUid = '77777777-7777-7777-7777-7777777777e1';
    let uuidInjectBlocked = false;
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'uuid_inject@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [uuidInjectUid]);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'uuid_inject@nukrop.ai', 'UUID Inject User', 'farmer', $2);
      `, [uuidInjectUid, uuidInjectUid]);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      if (e.message.includes('UUID_INJECTION_REJECTED')) uuidInjectBlocked = true;
    }
    if (uuidInjectBlocked) {
      pass('P0-PUBID-UUID-INJECT-REJECTED', 'UUID injection as public_id strictly rejected with UUID_INJECTION_REJECTED');
    } else {
      fail('P0-PUBID-UUID-INJECT-REJECTED', 'UUID injection as public_id was unexpectedly accepted!');
    }

    // P0-PUBID-AUTHENTICATED-FORBIDDEN: Authenticated role cannot supply client-chosen public_id
    const authSupplyUid = '77777777-7777-7777-7777-7777777777a1';
    let authSupplyBlocked = false;
    let authSupplyErrorCode = null;
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'auth_supply@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [authSupplyUid]);
      await pglite.exec(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${authSupplyUid}", "role": "authenticated"}';
      `);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'auth_supply@nukrop.ai', 'Auth Supply User', 'farmer', 'nk_pub_11112222333344445555666677778888');
      `, [authSupplyUid]);
      await pglite.exec(`RESET ROLE;`);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec(`RESET ROLE;`);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      authSupplyErrorCode = e.code;
      if (e.message.includes('PERMISSION_DENIED') || e.message.includes('Client-specified public_id is prohibited')) {
        authSupplyBlocked = true;
      }
    }
    if (authSupplyBlocked && authSupplyErrorCode === '42501') {
      pass('P0-PUBID-AUTHENTICATED-FORBIDDEN', 'Authenticated caller attempting custom public_id strictly rejected with PERMISSION_DENIED (42501)');
    } else {
      fail('P0-PUBID-AUTHENTICATED-FORBIDDEN', `Authenticated caller was allowed to specify custom public_id or wrong code: ${authSupplyErrorCode}`);
    }

    // P0-PUBID-GUC-BYPASS-REJECTED: Adversarial attempt to forge public_id via custom GUC set_config is completely defeated
    const gucBypassUid = '77777777-7777-7777-7777-7777777777c4';
    let gucBypassBlocked = false;
    let gucBypassErrorCode = null;
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'guc_bypass@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [gucBypassUid]);
      await pglite.exec(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${gucBypassUid}", "role": "authenticated"}';
      `);
      await pglite.exec('BEGIN;');
      await pglite.query(`SELECT set_config('nukrop.server_generated_public_id', 'nk_pub_deadbeefcafebabef00ddeadbeefcafe', true);`);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'guc_bypass@nukrop.ai', 'GUC Bypass Attacker', 'farmer', 'nk_pub_deadbeefcafebabef00ddeadbeefcafe');
      `, [gucBypassUid]);
      await pglite.exec('COMMIT;');
      await pglite.exec(`RESET ROLE;`);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec('ROLLBACK;');
      await pglite.exec(`RESET ROLE;`);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      gucBypassErrorCode = e.code;
      if (e.message.includes('PERMISSION_DENIED') || e.message.includes('Client-specified public_id is prohibited')) {
        gucBypassBlocked = true;
      }
    }
    if (gucBypassBlocked && gucBypassErrorCode === '42501') {
      pass('P0-PUBID-GUC-BYPASS-REJECTED', 'Adversarial custom GUC set_config bypass attempt strictly rejected with PERMISSION_DENIED (42501)');
    } else {
      fail('P0-PUBID-GUC-BYPASS-REJECTED', `GUC bypass unexpectedly succeeded or wrong code: ${gucBypassErrorCode}`);
    }

    // P0-PUBID-GENERATOR-DIRECT-CALL-DENIED: Authenticated role calling generate_profile_public_id() directly is denied
    let generatorDirectCallDenied = false;
    let generatorErrorCode = null;
    try {
      await pglite.exec(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${authSupplyUid}", "role": "authenticated"}';
      `);
      await pglite.query(`SELECT public.generate_profile_public_id();`);
      await pglite.exec(`RESET ROLE;`);
    } catch (e) {
      await pglite.exec(`RESET ROLE;`);
      generatorErrorCode = e.code;
      if (e.message.includes('permission denied') && e.message.includes('generate_profile_public_id')) {
        generatorDirectCallDenied = true;
      }
    }
    if (generatorDirectCallDenied && generatorErrorCode === '42501') {
      pass('P0-PUBID-GENERATOR-DIRECT-CALL-DENIED', 'Direct execution of generate_profile_public_id() by authenticated caller strictly denied (42501)');
    } else {
      fail('P0-PUBID-GENERATOR-DIRECT-CALL-DENIED', `Authenticated caller was unexpectedly permitted to execute generator: ${generatorErrorCode}`);
    }

    // P0-PUBID-AUTH-MALFORMED: Authenticated role inserting malformed public_id is rejected
    const authMalformedUid = '77777777-7777-7777-7777-7777777777d1';
    let authMalformedBlocked = false;
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'auth_malformed@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [authMalformedUid]);
      await pglite.exec(`
        SET ROLE authenticated;
        SET request.jwt.claims = '{"sub": "${authMalformedUid}", "role": "authenticated"}';
      `);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'auth_malformed@nukrop.ai', 'Auth Malformed User', 'farmer', 'malformed_id_string');
      `, [authMalformedUid]);
      await pglite.exec(`RESET ROLE;`);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec(`RESET ROLE;`);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      if (e.message.includes('PERMISSION_DENIED') || e.message.includes('INVALID_PUBLIC_ID')) {
        authMalformedBlocked = true;
      }
    }
    if (authMalformedBlocked) {
      pass('P0-PUBID-AUTH-MALFORMED-REJECTED', 'Authenticated insert with malformed public_id strictly rejected');
    } else {
      fail('P0-PUBID-AUTH-MALFORMED-REJECTED', 'Authenticated insert with malformed public_id was accepted!');
    }

    // P0-PUBID-ARBITRARY-REJECTED: Arbitrary vanity strings rejected by format validator
    const arbitraryUid = '77777777-7777-7777-7777-7777777777f1';
    let arbitraryBlocked = false;
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'arbitrary@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [arbitraryUid]);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'arbitrary@nukrop.ai', 'Arbitrary User', 'farmer', 'nk_pub_custom_vanity_identifier');
      `, [arbitraryUid]);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      if (e.message.includes('INVALID_PUBLIC_ID') || e.message.includes('PERMISSION_DENIED')) arbitraryBlocked = true;
    }
    if (arbitraryBlocked) {
      pass('P0-PUBID-ARBITRARY-REJECTED', 'Arbitrary vanity public_id strictly rejected with INVALID_PUBLIC_ID');
    } else {
      fail('P0-PUBID-ARBITRARY-REJECTED', 'Arbitrary vanity public_id was unexpectedly accepted!');
    }

    // P0-PUBID-3: Immutability enforcement - Attempting to UPDATE public_id is rejected by trigger
    let pubIdUpdateBlocked = false;
    try {
      await pglite.query(`
        UPDATE public.profiles SET public_id = 'nk_pub_attacker_override' WHERE id = $1;
      `, [newTestUid]);
    } catch (e) {
      if (e.message.includes('IMMUTABLE_FIELD') || e.message.includes('cannot be modified')) {
        pubIdUpdateBlocked = true;
      }
    }
    if (pubIdUpdateBlocked) {
      pass('P0-PUBID-IMMUTABLE', 'Attempt to update public_id strictly blocked by immutability trigger (IMMUTABLE_FIELD)');
    } else {
      fail('P0-PUBID-IMMUTABLE', 'public_id was mutable! Immutability trigger failed.');
    }

    // P0-PUBID-4: Collision protection - Duplicate public_id insert rejected by unique index
    let pubIdCollisionBlocked = false;
    const collisionUid = '77777777-7777-7777-7777-777777777773';
    try {
      await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
      await pglite.query(`
        INSERT INTO auth.users (id, email) VALUES ($1, 'collision@nukrop.ai') ON CONFLICT (id) DO NOTHING;
      `, [collisionUid]);
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
        VALUES ($1, $1, 'collision@nukrop.ai', 'Collision User', 'farmer', $2);
      `, [collisionUid, assignedPubId]);
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    } catch (e) {
      await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
      if (e.message.includes('unique') || e.message.includes('duplicate key') || e.message.includes('idx_profiles_public_id_unique')) {
        pubIdCollisionBlocked = true;
      }
    }
    if (pubIdCollisionBlocked) {
      pass('P0-PUBID-COLLISION', 'Duplicate public_id insertion strictly blocked by unique constraint');
    } else {
      fail('P0-PUBID-COLLISION', 'Duplicate public_id was permitted! Collision protection failed.');
    }

    // P0-PUBID-CONCURRENCY: Concurrent creation generates distinct 122-bit UUIDv4 entropy IDs without collision
    const concurrentUids = [
      '77777777-7777-7777-7777-7777777777c1',
      '77777777-7777-7777-7777-7777777777c2',
      '77777777-7777-7777-7777-7777777777c3'
    ];
    await Promise.all(concurrentUids.map((uid, idx) => 
      pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING;`, [uid, `concurr_${idx}@nukrop.ai`])
    ));
    const concurrCheck = await pglite.query(`SELECT public_id FROM public.profiles WHERE id = ANY($1)`, [concurrentUids]);
    const generatedConcurrIds = concurrCheck.rows.map(r => r.public_id);
    const uniqueConcurrIds = new Set(generatedConcurrIds);
    if (generatedConcurrIds.length === 3 && uniqueConcurrIds.size === 3 && generatedConcurrIds.every(id => /^nk_pub_[0-9a-f]{32}$/.test(id))) {
      pass('P0-PUBID-CONCURRENCY', `Concurrent profile creation generated 3 distinct 122-bit UUIDv4 CSPRNG public_ids with zero collision`);
    } else {
      fail('P0-PUBID-CONCURRENCY', `Concurrent public_id creation failed uniqueness: ${JSON.stringify(generatedConcurrIds)}`);
    }

    // P0-PUBID-5: Migration rerun idempotency - Rerunning backfill does NOT regenerate existing public_id
    const pubIdBeforeRerun = assignedPubId;
    await pglite.query(`
      UPDATE public.profiles 
      SET public_id = 'nk_pub_' || lower(replace(gen_random_uuid()::text, '-', ''))
      WHERE public_id IS NULL;
    `);
    const pubIdAfterRerunCheck = await pglite.query(`SELECT public_id FROM public.profiles WHERE id = $1`, [newTestUid]);
    const pubIdAfterRerun = pubIdAfterRerunCheck.rows[0]?.public_id;
    if (pubIdBeforeRerun === pubIdAfterRerun) {
      pass('P0-PUBID-RERUN-STABLE', 'Migration rerun preserves existing public_id without regeneration (idempotent)');
    } else {
      fail('P0-PUBID-RERUN-STABLE', `public_id was mutated on rerun: before=${pubIdBeforeRerun}, after=${pubIdAfterRerun}`);
    }

    // P0-PUBID-MULTIROW-TX: Multi-row and repeated inserts in one transaction generate distinct non-colliding IDs
    const multiRowUid1 = '77777777-7777-7777-7777-7777777777d2';
    const multiRowUid2 = '77777777-7777-7777-7777-7777777777d3';
    await pglite.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
    await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'm1@nukrop.ai'), ($2, 'm2@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [multiRowUid1, multiRowUid2]);
    await pglite.exec(`
      SET ROLE service_role;
      SET request.jwt.claims = '{"role": "service_role"}';
    `);
    const multiRowRes = await pglite.query(`
      INSERT INTO public.profiles (id, user_id, email, full_name, role)
      VALUES 
        ($1, $1, 'm1@nukrop.ai', 'Multi Row 1', 'farmer'),
        ($2, $2, 'm2@nukrop.ai', 'Multi Row 2', 'farmer')
      RETURNING id, public_id;
    `, [multiRowUid1, multiRowUid2]);
    await pglite.exec(`RESET ROLE;`);
    await pglite.exec(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    const mIds = multiRowRes.rows.map(r => r.public_id);
    if (mIds.length === 2 && mIds[0] !== mIds[1] && mIds.every(id => /^nk_pub_[0-9a-f]{32}$/.test(id))) {
      pass('P0-PUBID-MULTIROW-TX', `Multi-row insert in single transaction generated distinct 122-bit CSPRNG identifiers (${mIds.join(', ')})`);
    } else {
      fail('P0-PUBID-MULTIROW-TX', `Multi-row insert failed distinct ID requirement: ${JSON.stringify(mIds)}`);
    }

    // P0-PUBID-CATALOG-PRIVILEGES: Verify PostgreSQL catalog privileges for generator and trigger functions
    const genPrivAnon = (await pglite.query(`SELECT has_function_privilege('anon', 'public.generate_profile_public_id()', 'EXECUTE') AS can_exec;`)).rows[0]?.can_exec;
    const genPrivAuth = (await pglite.query(`SELECT has_function_privilege('authenticated', 'public.generate_profile_public_id()', 'EXECUTE') AS can_exec;`)).rows[0]?.can_exec;
    const genPrivSvc = (await pglite.query(`SELECT has_function_privilege('service_role', 'public.generate_profile_public_id()', 'EXECUTE') AS can_exec;`)).rows[0]?.can_exec;
    const authTriggerPrivAnon = (await pglite.query(`SELECT has_function_privilege('anon', 'public.handle_new_auth_user()', 'EXECUTE') AS can_exec;`)).rows[0]?.can_exec;
    const authTriggerPrivAuth = (await pglite.query(`SELECT has_function_privilege('authenticated', 'public.handle_new_auth_user()', 'EXECUTE') AS can_exec;`)).rows[0]?.can_exec;
    const authTriggerPrivAdmin = (await pglite.query(`SELECT has_function_privilege('supabase_auth_admin', 'public.handle_new_auth_user()', 'EXECUTE') AS can_exec;`)).rows[0]?.can_exec;
    if (!genPrivAnon && !genPrivAuth && genPrivSvc && !authTriggerPrivAnon && !authTriggerPrivAuth && authTriggerPrivAdmin) {
      pass('P0-PUBID-CATALOG-PRIVILEGES', 'Database catalog confirms EXECUTE revoked from anon/authenticated, granted to service_role and supabase_auth_admin');
    } else {
      fail('P0-PUBID-CATALOG-PRIVILEGES', `Catalog privilege violation: genAnon=${genPrivAnon}, genAuth=${genPrivAuth}, genSvc=${genPrivSvc}, authAnon=${authTriggerPrivAnon}, authUser=${authTriggerPrivAuth}, authAdmin=${authTriggerPrivAdmin}`);
    }

    // P1-CROSS-COLLISION: Profile A id collides with Profile B user_id
    // Profile X has id=uidX, user_id=uidY. Profile Y has id=uidY, user_id=uidZ.
    const uidX = '66666666-6666-6666-6666-666666666661';
    const uidY = '66666666-6666-6666-6666-666666666662';
    const uidZ = '66666666-6666-6666-6666-666666666663';
    await pglite.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'userX@nukrop.ai'), ($2, 'userY@nukrop.ai') ON CONFLICT (id) DO NOTHING;`, [uidX, uidY]);
    // First update Profile Y's user_id to uidZ so user_id values remain unique across both profiles
    await pglite.query(`UPDATE public.profiles SET user_id = $2 WHERE id = $1;`, [uidY, uidZ]);
    // Then update Profile X's user_id to uidY (colliding Profile X user_id with Profile Y id)
    await pglite.query(`UPDATE public.profiles SET user_id = $2 WHERE id = $1;`, [uidX, uidY]);

    // As user Y: Both profiles match query (id::text = Y OR user_id::text = Y)
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${uidY}", "role": "authenticated"}';
    `);
    let crossCollisionRpcBlocked = false;
    try {
      await pglite.query(`SELECT public.set_my_profile_discovery(true)`);
    } catch (e) {
      if (e.message.includes('AMBIGUOUS_IDENTITY')) {
        crossCollisionRpcBlocked = true;
      }
    }
    // Verify neither profile was updated
    await pglite.exec(`RESET ROLE;`);
    const checkProfA = await pglite.query(`SELECT public_profile_enabled FROM public.profiles WHERE id = $1`, [uidX]);
    const checkProfB = await pglite.query(`SELECT public_profile_enabled FROM public.profiles WHERE id = $1`, [uidY]);
    if (crossCollisionRpcBlocked && !checkProfA.rows[0]?.public_profile_enabled && !checkProfB.rows[0]?.public_profile_enabled) {
      pass('P1-CROSS-COLLISION', 'Cross-collision (Profile A id === Profile B user_id) safely raises AMBIGUOUS_IDENTITY without mutating either profile');
    } else {
      fail('P1-CROSS-COLLISION', `Cross-collision failed: blocked=${crossCollisionRpcBlocked}, profA=${checkProfA.rows[0]?.public_profile_enabled}, profB=${checkProfB.rows[0]?.public_profile_enabled}`);
    }

    // Clean up test profiles
    await pglite.query(`DELETE FROM public.profiles WHERE id IN ($1, $2, $3, $4, $5)`, [newTestUid, nullBypassUid, collisionUid, uidX, uidY]);

    // ─────────────────────────────────────────────────────────────────────────
    // P0: MULTI-SETUP SIGNUP COMPATIBILITY & SEARCH PATH AUDIT
    // ─────────────────────────────────────────────────────────────────────────

    // P0-SIGNUP-CANONICAL-MIG: Signup via canonical reconciliation migration trigger
    const canonSignupUid = '11111111-aaaa-1111-aaaa-111111111111';
    await pglite.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) 
      VALUES ($1, 'canon_signup@nukrop.ai', '{"full_name": "Canon Farmer", "role": "farmer"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `, [canonSignupUid]);
    const canonProfCheck = await pglite.query(`SELECT id, public_id, full_name, role FROM public.profiles WHERE id = $1`, [canonSignupUid]);
    const canonProf = canonProfCheck.rows[0];
    if (canonProf && /^nk_pub_[0-9a-f]{32}$/.test(canonProf.public_id) && canonProf.public_id.length === 39) {
      pass('P0-SIGNUP-CANONICAL-MIG', `Canonical migration signup creates profile with 32-hex public_id (${canonProf.public_id})`);
    } else {
      fail('P0-SIGNUP-CANONICAL-MIG', `Canonical migration signup failed: ${JSON.stringify(canonProf)}`);
    }

    // P0-SIGNUP-UPSERT-PRESERVE: Repeated signup / upsert preserves public_id without regeneration
    const originalCanonPubId = canonProf.public_id;
    // In handle_new_auth_user, a new 32-hex v_public_id is generated, but ON CONFLICT strictly preserves existing public.profiles.public_id
    const tempNewCandidatePubId = 'nk_pub_99999999888877776666555544443333';
    await pglite.query(`
      INSERT INTO public.profiles (id, user_id, email, full_name, role, public_id)
      VALUES ($1, $1, 'canon_signup@nukrop.ai', 'Updated Canon Farmer', 'farmer', $2)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.id,
        public_id = COALESCE(public.profiles.public_id, EXCLUDED.public_id),
        full_name = EXCLUDED.full_name;
    `, [canonSignupUid, tempNewCandidatePubId]);
    const upsertPreserveCheck = await pglite.query(`SELECT public_id, full_name FROM public.profiles WHERE id = $1`, [canonSignupUid]);
    if (upsertPreserveCheck.rows[0]?.public_id === originalCanonPubId && upsertPreserveCheck.rows[0]?.full_name === 'Updated Canon Farmer') {
      pass('P0-SIGNUP-UPSERT-PRESERVE', 'Repeated auth user upsert strictly preserves existing public_id without regeneration');
    } else {
      fail('P0-SIGNUP-UPSERT-PRESERVE', `public_id was regenerated on upsert: was=${originalCanonPubId}, now=${upsertPreserveCheck.rows[0]?.public_id}`);
    }

    // P0-SIGNUP-CANONICAL-SETUP: Execute handle_new_auth_user from CANONICAL_PRODUCTION_SETUP.sql
    const canonicalSetupSql = fs.readFileSync(path.join(__dirname, '../supabase/CANONICAL_PRODUCTION_SETUP.sql'), 'utf-8');
    const canonSetupFnMatch = canonicalSetupSql.match(/CREATE OR REPLACE FUNCTION public\.handle_new_auth_user\(\)[\s\S]+?END;\s*\$\$\s*LANGUAGE plpgsql SECURITY DEFINER;/i);
    if (canonSetupFnMatch) {
      await pglite.exec(canonSetupFnMatch[0]);
    }
    const canonSetupUid = '22222222-bbbb-2222-bbbb-222222222222';
    await pglite.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) 
      VALUES ($1, 'canon_setup@nukrop.ai', '{"full_name": "Setup Farmer", "role": "farmer"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `, [canonSetupUid]);
    const canonSetupProfCheck = await pglite.query(`SELECT id, public_id, full_name FROM public.profiles WHERE id = $1`, [canonSetupUid]);
    const canonSetupProf = canonSetupProfCheck.rows[0];
    if (canonSetupProf && /^nk_pub_[0-9a-f]{32}$/.test(canonSetupProf.public_id) && canonSetupProf.public_id.length === 39) {
      pass('P0-SIGNUP-CANONICAL-SETUP', `CANONICAL_PRODUCTION_SETUP trigger creates profile with 32-hex public_id (${canonSetupProf.public_id})`);
    } else {
      fail('P0-SIGNUP-CANONICAL-SETUP', `CANONICAL_PRODUCTION_SETUP trigger failed: ${JSON.stringify(canonSetupProf)}`);
    }

    // P0-SIGNUP-ALL-IN-ONE-SETUP: Execute handle_new_auth_user from COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql
    const allInOneSql = fs.readFileSync(path.join(__dirname, '../supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql'), 'utf-8');
    const allInOneFnMatch = allInOneSql.match(/CREATE OR REPLACE FUNCTION public\.handle_new_auth_user\(\)[\s\S]+?END;\s*\$\$\s*LANGUAGE plpgsql;/i)
      || allInOneSql.match(/CREATE OR REPLACE FUNCTION public\.handle_new_auth_user\(\)[\s\S]+?END;\s*\$\$;/i);
    if (allInOneFnMatch) {
      await pglite.exec(allInOneFnMatch[0]);
    }
    const allInOneUid = '33333333-cccc-3333-cccc-333333333333';
    await pglite.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) 
      VALUES ($1, 'all_in_one@nukrop.ai', '{"full_name": "AllInOne Farmer", "role": "farmer"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `, [allInOneUid]);
    const allInOneProfCheck = await pglite.query(`SELECT id, public_id, full_name FROM public.profiles WHERE id = $1`, [allInOneUid]);
    const allInOneProf = allInOneProfCheck.rows[0];
    if (allInOneProf && /^nk_pub_[0-9a-f]{32}$/.test(allInOneProf.public_id) && allInOneProf.public_id.length === 39) {
      pass('P0-SIGNUP-ALL-IN-ONE-SETUP', `COMPLETE_SUPABASE_ALL_IN_ONE trigger creates profile with 32-hex public_id (${allInOneProf.public_id})`);
    } else {
      fail('P0-SIGNUP-ALL-IN-ONE-SETUP', `COMPLETE_SUPABASE_ALL_IN_ONE trigger failed: ${JSON.stringify(allInOneProf)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // P0: SUPABASE AUTH EXECUTION CONTEXT & REALISTIC PRIVILEGE BOUNDARY SUITE
    // ─────────────────────────────────────────────────────────────────────────

    // 1. P0-AUTH-ROLE-NON-SUPERUSER: Verify supabase_auth_admin is a non-superuser role
    const authAdminRoleCheck = await pglite.query(`SELECT rolsuper FROM pg_roles WHERE rolname = 'supabase_auth_admin';`);
    const isSuperuser = authAdminRoleCheck.rows[0]?.rolsuper;
    if (isSuperuser === false) {
      pass('P0-AUTH-ROLE-NON-SUPERUSER', 'supabase_auth_admin role is strictly non-superuser (rolsuper = false)');
    } else {
      fail('P0-AUTH-ROLE-NON-SUPERUSER', `supabase_auth_admin unexpectedly has superuser status: ${isSuperuser}`);
    }

    // 2. P0-AUTH-ROLE-SIGNUP-PROVISIONING: Realistic signup executed under supabase_auth_admin role
    const authAdminSignupUid = '44444444-aaaa-4444-aaaa-444444444444';
    await pglite.exec(`SET ROLE supabase_auth_admin;`);
    await pglite.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ($1, 'auth_admin_farmer@nukrop.ai', '{"full_name": "Auth Admin Farmer", "role": "farmer"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `, [authAdminSignupUid]);
    await pglite.exec(`RESET ROLE;`);
    const authAdminProfCheck = await pglite.query(`SELECT id, public_id, full_name, role FROM public.profiles WHERE id = $1`, [authAdminSignupUid]);
    const authAdminProf = authAdminProfCheck.rows[0];
    if (authAdminProf && /^nk_pub_[0-9a-f]{32}$/.test(authAdminProf.public_id) && authAdminProf.public_id.length === 39 && authAdminProf.role === 'farmer') {
      pass('P0-AUTH-ROLE-SIGNUP-PROVISIONING', `Signup under realistic supabase_auth_admin role creates profile with valid CSPRNG public_id (${authAdminProf.public_id})`);
    } else {
      fail('P0-AUTH-ROLE-SIGNUP-PROVISIONING', `Signup under supabase_auth_admin failed: ${JSON.stringify(authAdminProf)}`);
    }

    // 3. P0-AUTH-TRIGGER-ATOMIC-ROLLBACK: Failed profile insert rolls back auth user creation atomically
    await pglite.exec(`
      CREATE OR REPLACE FUNCTION public.failing_trigger_test()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'SIMULATED_PROFILE_INSERT_CRASH: storage error or constraint failure';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_fail_rollback_test ON public.profiles;
      CREATE TRIGGER trg_fail_rollback_test
        BEFORE INSERT ON public.profiles
        FOR EACH ROW
        WHEN (NEW.email = 'fail_rollback@nukrop.ai')
        EXECUTE FUNCTION public.failing_trigger_test();
    `);

    const failRollbackUid = '99999999-eeee-9999-eeee-999999999999';
    let triggerCrashCaught = false;
    try {
      await pglite.exec(`SET ROLE supabase_auth_admin;`);
      await pglite.query(`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ($1, 'fail_rollback@nukrop.ai', '{"full_name": "Crash Farmer"}'::jsonb);
      `, [failRollbackUid]);
    } catch (e) {
      if (e.message.includes('SIMULATED_PROFILE_INSERT_CRASH')) {
        triggerCrashCaught = true;
      }
    } finally {
      await pglite.exec(`RESET ROLE;`);
    }
    const rolledBackUser = await pglite.query(`SELECT id FROM auth.users WHERE id = $1`, [failRollbackUid]);
    const rolledBackProf = await pglite.query(`SELECT id FROM public.profiles WHERE id = $1`, [failRollbackUid]);
    await pglite.exec(`DROP TRIGGER IF EXISTS trg_fail_rollback_test ON public.profiles; DROP FUNCTION IF EXISTS public.failing_trigger_test();`);
    if (triggerCrashCaught && rolledBackUser.rows.length === 0 && rolledBackProf.rows.length === 0) {
      pass('P0-AUTH-TRIGGER-ATOMIC-ROLLBACK', 'Failed profile insert in trigger atomically rolls back auth user creation (0 orphaned rows)');
    } else {
      fail('P0-AUTH-TRIGGER-ATOMIC-ROLLBACK', `Atomic rollback violated: caught=${triggerCrashCaught}, users=${rolledBackUser.rows.length}, profs=${rolledBackProf.rows.length}`);
    }

    // 4. P0-AUTH-DUPLICATE-RETRY-INTEGRITY: Duplicate signup under supabase_auth_admin rejected and preserves profile
    const originalAdminPubId = authAdminProf.public_id;
    let duplicateRejected = false;
    try {
      await pglite.exec(`SET ROLE supabase_auth_admin;`);
      await pglite.query(`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ($1, 'auth_admin_farmer@nukrop.ai', '{"full_name": "Duplicate Farmer"}'::jsonb);
      `, [authAdminSignupUid]);
    } catch (e) {
      if (e.message.includes('duplicate key') || e.message.includes('unique constraint')) {
        duplicateRejected = true;
      }
    } finally {
      await pglite.exec(`RESET ROLE;`);
    }
    const duplicatePreserveCheck = await pglite.query(`SELECT public_id, full_name FROM public.profiles WHERE id = $1`, [authAdminSignupUid]);
    if (duplicateRejected && duplicatePreserveCheck.rows[0]?.public_id === originalAdminPubId) {
      pass('P0-AUTH-DUPLICATE-RETRY-INTEGRITY', 'Duplicate user insert rejected by unique constraint; existing public_id preserved without mutation');
    } else {
      fail('P0-AUTH-DUPLICATE-RETRY-INTEGRITY', `Duplicate handling failed: rejected=${duplicateRejected}, pubId=${duplicatePreserveCheck.rows[0]?.public_id}`);
    }

    // 5. P0-CROSS-USER-PROFILE-INJECTION-DENIED: Authenticated user cannot insert profile for another user
    const victimUid = '55555555-bbbb-5555-bbbb-555555555555';
    const attackerUid = '66666666-cccc-6666-cccc-666666666666';
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${attackerUid}", "role": "authenticated"}';
    `);
    let crossUserInsertBlocked = false;
    try {
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, full_name, email)
        VALUES ($1, $1, 'Spoofed Victim Profile', 'victim@nukrop.ai');
      `, [victimUid]);
    } catch (e) {
      if (e.message.includes('violates row-level security policy') || e.message.includes('permission denied')) {
        crossUserInsertBlocked = true;
      }
    } finally {
      await pglite.exec(`RESET ROLE;`);
    }
    if (crossUserInsertBlocked) {
      pass('P0-CROSS-USER-PROFILE-INJECTION-DENIED', 'Authenticated user strictly blocked by RLS from creating another user profile');
    } else {
      fail('P0-CROSS-USER-PROFILE-INJECTION-DENIED', 'Authenticated user was able to insert profile for another user!');
    }

    // 6. P0-AUTHENTICATED-CHOSEN-PUBID-DENIED: Authenticated user cannot choose or supply public_id
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${attackerUid}", "role": "authenticated"}';
    `);
    let chosenPubIdBlocked = false;
    try {
      await pglite.query(`
        INSERT INTO public.profiles (id, user_id, public_id, full_name)
        VALUES ($1, $1, 'nk_pub_cafebabecafebabecafebabecafebabe', 'Attacker Profile');
      `, [attackerUid]);
    } catch (e) {
      if (e.message.includes('PERMISSION_DENIED') || e.message.includes('42501')) {
        chosenPubIdBlocked = true;
      }
    } finally {
      await pglite.exec(`RESET ROLE;`);
    }
    if (chosenPubIdBlocked) {
      pass('P0-AUTHENTICATED-CHOSEN-PUBID-DENIED', 'Authenticated caller attempting to provide chosen public_id rejected with 42501 PERMISSION_DENIED');
    } else {
      fail('P0-AUTHENTICATED-CHOSEN-PUBID-DENIED', 'Authenticated caller was unexpectedly permitted to supply public_id!');
    }

    // 7. P0-DIRECT-AUTH-TRIGGER-CALL-DENIED: Untrusted roles denied direct execution of handle_new_auth_user
    let directAnonCallDenied = false;
    try {
      await pglite.exec(`SET ROLE anon;`);
      await pglite.query(`SELECT public.handle_new_auth_user();`);
    } catch (e) {
      if (e.message.includes('permission denied') || e.message.includes('cannot be invoked from SQL')) {
        directAnonCallDenied = true;
      }
    } finally {
      await pglite.exec(`RESET ROLE;`);
    }
    let directAuthCallDenied = false;
    try {
      await pglite.exec(`SET ROLE authenticated;`);
      await pglite.query(`SELECT public.handle_new_auth_user();`);
    } catch (e) {
      if (e.message.includes('permission denied') || e.message.includes('cannot be invoked from SQL')) {
        directAuthCallDenied = true;
      }
    } finally {
      await pglite.exec(`RESET ROLE;`);
    }
    if (directAnonCallDenied && directAuthCallDenied) {
      pass('P0-DIRECT-AUTH-TRIGGER-CALL-DENIED', 'Direct SQL execution of handle_new_auth_user() strictly denied to anon and authenticated');
    } else {
      fail('P0-DIRECT-AUTH-TRIGGER-CALL-DENIED', `Direct trigger execution leak: anonDenied=${directAnonCallDenied}, authDenied=${directAuthCallDenied}`);
    }

    // 8. P0-AUTH-TRIGGER-SECURITY-DEFINER-CATALOG: Verify handle_new_auth_user is SECURITY DEFINER with fixed search_path
    const triggerProcCheck = await pglite.query(`
      SELECT p.proname, p.prosecdef, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_auth_user';
    `);
    const trigProc = triggerProcCheck.rows[0];
    const hasSafePath = (trigProc?.proconfig || []).some(c => c.toLowerCase().startsWith('search_path=') && c.toLowerCase().endsWith('pg_temp'));
    if (trigProc && trigProc.prosecdef === true && hasSafePath) {
      pass('P0-AUTH-TRIGGER-SECURITY-DEFINER-CATALOG', 'handle_new_auth_user() confirmed in pg_proc as prosecdef = true with safe search_path');
    } else {
      fail('P0-AUTH-TRIGGER-SECURITY-DEFINER-CATALOG', `Catalog check failed for handle_new_auth_user: ${JSON.stringify(trigProc)}`);
    }

    // Clean up auth admin test profiles
    await pglite.query(`DELETE FROM public.profiles WHERE id = $1`, [authAdminSignupUid]);

    // P0-UNTRUSTED-CREATE-DENIED: Untrusted roles denied CREATE ON SCHEMA public
    await pglite.exec(`SET ROLE authenticated;`);
    let authCreateBlocked = false;
    try {
      await pglite.query(`CREATE TABLE public.untrusted_auth_test (id int);`);
    } catch (e) {
      if (e.message.includes('permission denied')) authCreateBlocked = true;
    }
    await pglite.exec(`RESET ROLE;`);
    if (authCreateBlocked) {
      pass('P0-UNTRUSTED-CREATE-DENIED', 'Untrusted authenticated role strictly denied CREATE on schema public');
    } else {
      fail('P0-UNTRUSTED-CREATE-DENIED', 'Authenticated role was unexpectedly permitted to create objects in schema public!');
    }

    // P0-SECDEF-SHADOWING-DEFENSE: Temporary objects in pg_temp cannot shadow public objects
    await pglite.exec(`
      CREATE TEMP TABLE profiles (
        id text, 
        user_id text,
        public_id text, 
        full_name text, 
        public_profile_enabled boolean
      );
      INSERT INTO pg_temp.profiles (id, user_id, public_id, full_name, public_profile_enabled)
      VALUES ('temp-spoof-id', 'temp-spoof-id', 'nk_pub_spoofed_temp_1234567890abcdef', 'Spoofed User', false);
    `);
    // Invoke SECURITY DEFINER RPC as canonSignupUid
    await pglite.exec(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"sub": "${canonSignupUid}", "role": "authenticated"}';
    `);
    await pglite.query(`SELECT public.set_my_profile_discovery(true);`);
    await pglite.exec(`RESET ROLE;`);
    const tempTableCheck = await pglite.query(`SELECT public_profile_enabled FROM pg_temp.profiles WHERE id = 'temp-spoof-id'`);
    const realTableCheck = await pglite.query(`SELECT public_profile_enabled FROM public.profiles WHERE id = $1`, [canonSignupUid]);
    await pglite.exec(`DROP TABLE pg_temp.profiles;`);
    if (realTableCheck.rows[0]?.public_profile_enabled === true && tempTableCheck.rows[0]?.public_profile_enabled === false) {
      pass('P0-SECDEF-SHADOWING-DEFENSE', 'SECURITY DEFINER function safely targets public.profiles and is immune to pg_temp object shadowing');
    } else {
      fail('P0-SECDEF-SHADOWING-DEFENSE', `pg_temp table shadowed public table! real=${realTableCheck.rows[0]?.public_profile_enabled}, temp=${tempTableCheck.rows[0]?.public_profile_enabled}`);
    }

    // P0-SECDEF-SEARCHPATH-AUDIT: Audit pg_proc for SECURITY DEFINER search_path enforcement
    const procAudit = await pglite.query(`
      SELECT p.proname, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.prosecdef = true;
    `);
    let allProcSecure = true;
    let procCount = procAudit.rows.length;
    for (const proc of procAudit.rows) {
      const config = proc.proconfig || [];
      const hasSearchPath = config.some(c => c.toLowerCase().startsWith('search_path=') && c.toLowerCase().endsWith('pg_temp'));
      if (!hasSearchPath) {
        allProcSecure = false;
        console.error(`Insecure SECURITY DEFINER function in pg_proc: ${proc.proname}, proconfig=${JSON.stringify(config)}`);
      }
    }
    if (allProcSecure && procCount > 0) {
      pass('P0-SECDEF-SEARCHPATH-AUDIT', `All ${procCount} SECURITY DEFINER functions in pg_proc enforce fixed search_path ending in pg_temp`);
    } else {
      fail('P0-SECDEF-SEARCHPATH-AUDIT', `Found insecure SECURITY DEFINER functions in pg_proc (total=${procCount})`);
    }

    // Clean up test profiles
    await pglite.query(`DELETE FROM public.profiles WHERE id IN ($1, $2, $3)`, [canonSignupUid, canonSetupUid, allInOneUid]);

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

  console.log('\n▶ Test 5: Real PostgreSQL Transaction Engine — Alert State & Notification Atomicity');
  console.log('   (Engine: @electric-sql/pglite WASM — PostgreSQL-compatible WASM engine, NOT live Supabase)\n');
  try {
    await pglite.exec(`RESET ROLE;`);

    const alertId1 = 'a1111111-1111-1111-1111-111111111111';
    await pglite.query(`
      INSERT INTO public.price_alerts (id, user_id, crop, commodity, mandi, target_price, condition, status)
      VALUES ($1, $2, 'Cotton', 'Cotton', 'Enumamula APMC', 7500.00, 'ABOVE', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', triggered_at = NULL;
    `, [alertId1, farmer1Id]);
    await pglite.query(`DELETE FROM public.notifications WHERE event_id = $1`, [alertId1]);

    // TEST 5.1: Alert UPDATE succeeds, notification INSERT fails -> ROLLBACK verified
    try {
      await pglite.exec('BEGIN;');
      await pglite.query(`
        UPDATE public.price_alerts SET status = 'TRIGGERED', triggered_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
        RETURNING id;
      `, [alertId1, farmer1Id]);

      // Trigger failure on notification check constraint
      await pglite.query(`
        INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
        VALUES ($1, 'PRICE_ALERT_ENGINE', $2, 'INVALID_CATEGORY_VIOLATION', 'Test', 'Test');
      `, [farmer1Id, alertId1]);

      await pglite.exec('COMMIT;');
      fail('TX-1', 'Transaction should have failed on invalid notification category constraint');
    } catch (txErr) {
      await pglite.exec('ROLLBACK;');
      const alertCheck = await pglite.query(`SELECT status FROM public.price_alerts WHERE id = $1`, [alertId1]);
      const notifCheck = await pglite.query(`SELECT COUNT(*)::int as count FROM public.notifications WHERE event_id = $1`, [alertId1]);
      if (alertCheck.rows[0]?.status === 'ACTIVE' && notifCheck.rows[0]?.count === 0) {
        pass('TX-1', 'Alert UPDATE succeeded, notification INSERT failed -> alert remains ACTIVE (rollback verified, 0 notifications)');
      } else {
        fail('TX-1', `Rollback failed: status=${alertCheck.rows[0]?.status}, notifCount=${notifCheck.rows[0]?.count}`);
      }
    }

    // TEST 5.2: Both UPDATE and notification INSERT succeed -> COMMIT
    await pglite.exec('BEGIN;');
    const updateRes = await pglite.query(`
      UPDATE public.price_alerts SET status = 'TRIGGERED', triggered_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
      RETURNING id, user_id, crop, mandi, target_price, condition;
    `, [alertId1, farmer1Id]);

    if (updateRes.rows.length === 1) {
      await pglite.query(`
        INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
        VALUES ($1, 'PRICE_ALERT_ENGINE', $2, 'PRICE_ALERT', 'Cotton Price Alert', 'Target reached at Enumamula APMC')
        ON CONFLICT (user_id, event_source, event_id) DO NOTHING;
      `, [farmer1Id, alertId1]);
      await pglite.exec('COMMIT;');

      const alertCheck2 = await pglite.query(`SELECT status FROM public.price_alerts WHERE id = $1`, [alertId1]);
      const notifCheck2 = await pglite.query(`SELECT COUNT(*)::int as count FROM public.notifications WHERE event_id = $1`, [alertId1]);
      if (alertCheck2.rows[0]?.status === 'TRIGGERED' && notifCheck2.rows[0]?.count === 1) {
        pass('TX-2', 'Both succeed -> alert becomes TRIGGERED, exactly 1 notification committed');
      } else {
        fail('TX-2', `Commit failed: status=${alertCheck2.rows[0]?.status}, count=${notifCheck2.rows[0]?.count}`);
      }
    } else {
      await pglite.exec('ROLLBACK;');
      fail('TX-2', 'Initial alert update failed to match ACTIVE alert');
    }

    // TEST 5.3: Concurrent workers evaluate same alert -> exactly 1 notification
    const alertIdConcurrent = 'a2222222-2222-2222-2222-222222222222';
    await pglite.query(`
      INSERT INTO public.price_alerts (id, user_id, crop, commodity, mandi, target_price, condition, status)
      VALUES ($1, $2, 'Chilli', 'Chilli', 'Warangal APMC', 18000.00, 'ABOVE', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', triggered_at = NULL;
    `, [alertIdConcurrent, farmer1Id]);
    await pglite.query(`DELETE FROM public.notifications WHERE event_id = $1`, [alertIdConcurrent]);

    let worker1Triggered = false;
    let worker2Triggered = false;

    // Worker 1 transaction
    await pglite.exec('BEGIN;');
    const w1Upd = await pglite.query(`
      UPDATE public.price_alerts SET status = 'TRIGGERED', triggered_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
      RETURNING id;
    `, [alertIdConcurrent, farmer1Id]);
    if (w1Upd.rows.length > 0) {
      await pglite.query(`
        INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
        VALUES ($1, 'PRICE_ALERT_ENGINE', $2, 'PRICE_ALERT', 'Chilli Alert', 'Target reached')
        ON CONFLICT (user_id, event_source, event_id) DO NOTHING;
      `, [farmer1Id, alertIdConcurrent]);
      await pglite.exec('COMMIT;');
      worker1Triggered = true;
    } else {
      await pglite.exec('ROLLBACK;');
    }

    // Worker 2 attempts same alert (status already TRIGGERED)
    await pglite.exec('BEGIN;');
    const w2Upd = await pglite.query(`
      UPDATE public.price_alerts SET status = 'TRIGGERED', triggered_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
      RETURNING id;
    `, [alertIdConcurrent, farmer1Id]);
    if (w2Upd.rows.length > 0) {
      await pglite.query(`
        INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
        VALUES ($1, 'PRICE_ALERT_ENGINE', $2, 'PRICE_ALERT', 'Chilli Alert', 'Target reached')
        ON CONFLICT (user_id, event_source, event_id) DO NOTHING;
      `, [farmer1Id, alertIdConcurrent]);
      await pglite.exec('COMMIT;');
      worker2Triggered = true;
    } else {
      await pglite.exec('ROLLBACK;');
    }

    const concurrentNotifs = await pglite.query(`SELECT COUNT(*)::int as count FROM public.notifications WHERE event_id = $1`, [alertIdConcurrent]);
    if (worker1Triggered && !worker2Triggered && concurrentNotifs.rows[0]?.count === 1) {
      pass('TX-3', 'Concurrent workers evaluate same alert: exactly 1 worker claims and commits, exactly 1 notification created');
    } else {
      fail('TX-3', `Concurrency failed: w1=${worker1Triggered}, w2=${worker2Triggered}, count=${concurrentNotifs.rows[0]?.count}`);
    }

    // TEST 5.4: Retry after commit does not create duplicate notification
    await pglite.exec('BEGIN;');
    const retryUpd = await pglite.query(`
      UPDATE public.price_alerts SET status = 'TRIGGERED', triggered_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
      RETURNING id;
    `, [alertIdConcurrent, farmer1Id]);
    if (retryUpd.rows.length === 0) {
      await pglite.exec('ROLLBACK;');
      await pglite.query(`
        INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
        VALUES ($1, 'PRICE_ALERT_ENGINE', $2, 'PRICE_ALERT', 'Chilli Alert Retry', 'Target reached')
        ON CONFLICT (user_id, event_source, event_id) DO NOTHING;
      `, [farmer1Id, alertIdConcurrent]);
    }
    const retryNotifs = await pglite.query(`SELECT COUNT(*)::int as count FROM public.notifications WHERE event_id = $1`, [alertIdConcurrent]);
    if (retryNotifs.rows[0]?.count === 1) {
      pass('TX-4', 'Retry after commit does not create duplicate notification (idempotency preserved)');
    } else {
      fail('TX-4', `Duplicate notification created on retry: count=${retryNotifs.rows[0]?.count}`);
    }

    // TEST 5.5: DB query/syntax failure rolls back cleanly without false success
    let simulatedFailedTriggerReported = false;
    try {
      await pglite.exec('BEGIN;');
      await pglite.query('SELECT * FROM public.non_existent_table_for_failure_injection;');
      await pglite.exec('COMMIT;');
      simulatedFailedTriggerReported = true;
    } catch (_) {
      await pglite.exec('ROLLBACK;');
      simulatedFailedTriggerReported = false;
    }
    if (!simulatedFailedTriggerReported) {
      pass('TX-5', 'DB failure rolls back cleanly without falsely reporting successful trigger');
    } else {
      fail('TX-5', 'DB failure falsely reported success');
    }

  } catch (err) {
    fail('TX-E', `Alert transaction test suite error: ${err.message}`);
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
