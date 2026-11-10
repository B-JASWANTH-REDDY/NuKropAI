/**
 * NuKropAI — Automated Auth Trigger & Public ID Function Synchronization Test
 * 
 * Verifies 100% semantic and structural parity of auth trigger and public ID functions
 * across all three canonical SQL files:
 * 1. supabase/migrations/20261109000001_canonical_identity_reconciliation.sql
 * 2. supabase/CANONICAL_PRODUCTION_SETUP.sql
 * 3. supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql
 */

const fs = require('fs');
const path = require('path');

let passCount = 0;
let failCount = 0;

function pass(name, msg) {
  passCount++;
  console.log(`  ✔ [PASS] ${name}: ${msg}`);
}

function fail(name, msg) {
  failCount++;
  console.error(`  ❌ [FAIL] ${name}: ${msg}`);
}

function normalizeSql(sql) {
  if (!sql) return '';
  return sql
    .replace(/--.*$/gm, '')           // Strip single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Strip block comments
    .replace(/\s+/g, ' ')             // Collapse all whitespace runs to single space
    .trim()
    .toLowerCase();
}

function extractFunction(content, fnName) {
  const regex = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${fnName}\\s*\\([\\s\\S]*?\\$\\$\\s*(?:LANGUAGE\\s+\\w+\\s+)?(?:SECURITY\\s+DEFINER\\s*)?(?:SET\\s+search_path\\s*=\\s*public,\\s*pg_temp\\s*)?;`, 'i');
  const match = content.match(regex);
  if (!match) {
    // Alternative ordering: LANGUAGE / SECURITY DEFINER before AS $$
    const altRegex = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${fnName}\\s*\\([\\s\\S]*?\\$\\$;`, 'i');
    const altMatch = content.match(altRegex);
    return altMatch ? altMatch[0] : null;
  }
  return match[0];
}

function extractTrigger(content, trgName) {
  const regex = new RegExp(`CREATE\\s+TRIGGER\\s+${trgName}\\s+[\\s\\S]*?;`, 'i');
  const match = content.match(regex);
  return match ? match[0] : null;
}

function extractGrants(content, fnName) {
  const regex = new RegExp(`(?:REVOKE|GRANT)[\\s\\S]*?ON\\s+FUNCTION\\s+public\\.${fnName}\\([\\s\\S]*?;`, 'gi');
  const matches = content.match(regex);
  return matches ? matches.join(' ') : '';
}

function runSyncAudit() {
  console.log('================================================================================');
  console.log('🛡️  NUKROPAI CANONICAL AUTH TRIGGER & PUBLIC ID SYNCHRONIZATION SUITE');
  console.log('================================================================================\n');

  const files = {
    migration: {
      path: path.join(__dirname, '../supabase/migrations/20261109000001_canonical_identity_reconciliation.sql'),
      name: 'canonical_identity_reconciliation.sql'
    },
    canonicalSetup: {
      path: path.join(__dirname, '../supabase/CANONICAL_PRODUCTION_SETUP.sql'),
      name: 'CANONICAL_PRODUCTION_SETUP.sql'
    },
    allInOne: {
      path: path.join(__dirname, '../supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql'),
      name: 'COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql'
    }
  };

  const contents = {};
  for (const [key, f] of Object.entries(files)) {
    if (!fs.existsSync(f.path)) {
      fail('FILE-EXISTENCE', `Required file missing: ${f.name}`);
      process.exit(1);
    }
    contents[key] = fs.readFileSync(f.path, 'utf-8');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. handle_new_auth_user() Parity Check
  // ───────────────────────────────────────────────────────────────────────────
  console.log('▶ Auditing public.handle_new_auth_user() Parity Across Files');
  const migFn = extractFunction(contents.migration, 'handle_new_auth_user');
  const canonFn = extractFunction(contents.canonicalSetup, 'handle_new_auth_user');
  const allInOneFn = extractFunction(contents.allInOne, 'handle_new_auth_user');

  if (!migFn) fail('EXTRACT-MIG', 'Could not extract handle_new_auth_user from migration');
  if (!canonFn) fail('EXTRACT-CANON', 'Could not extract handle_new_auth_user from CANONICAL_PRODUCTION_SETUP.sql');
  if (!allInOneFn) fail('EXTRACT-ALLINONE', 'Could not extract handle_new_auth_user from COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql');

  const normMig = normalizeSql(migFn);
  const normCanon = normalizeSql(canonFn);
  const normAllInOne = normalizeSql(allInOneFn);

  if (normMig === normCanon) {
    pass('SYNC-HANDLE-AUTH-CANON', 'handle_new_auth_user matches 100% between migration and CANONICAL_PRODUCTION_SETUP.sql');
  } else {
    fail('SYNC-HANDLE-AUTH-CANON', `Mismatch in handle_new_auth_user between migration and CANONICAL_PRODUCTION_SETUP.sql`);
  }

  if (normMig === normAllInOne) {
    pass('SYNC-HANDLE-AUTH-ALLINONE', 'handle_new_auth_user matches 100% between migration and COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql');
  } else {
    fail('SYNC-HANDLE-AUTH-ALLINONE', `Mismatch in handle_new_auth_user between migration and COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`);
  }

  // Check required sub-clauses in all three definitions
  for (const [key, fn] of Object.entries({ migration: migFn, canonicalSetup: canonFn, allInOne: allInOneFn })) {
    const fnText = fn || '';
    const hasDpdp = fnText.includes('dpdp_consent_given') && fnText.includes('dpdp_consent_timestamp');
    const hasDiscovery = fnText.includes('public_profile_enabled');
    const hasPhoneExtraction = fnText.includes('phoneNumber') && fnText.includes("to_jsonb(NEW)->>'phone'");
    const hasRoleSecurity = fnText.includes('v_requested_role') && fnText.includes("'driver'") && fnText.includes("'farmer'");
    const hasCsprng = fnText.includes('nk_pub_') && fnText.includes('gen_random_uuid');
    const hasSecDef = /SECURITY\s+DEFINER/i.test(fnText);
    const hasSafePath = /SET\s+search_path\s*=\s*public,\s*pg_temp/i.test(fnText);

    if (hasDpdp && hasDiscovery && hasPhoneExtraction && hasRoleSecurity && hasCsprng && hasSecDef && hasSafePath) {
      pass(`FEATURES-${key}`, `${files[key].name} contains complete DPDP consent, discovery opt-in, phone extraction, role security, CSPRNG, and security definer search_path`);
    } else {
      fail(`FEATURES-${key}`, `${files[key].name} missing required features: dpdp=${hasDpdp}, disc=${hasDiscovery}, phone=${hasPhoneExtraction}, role=${hasRoleSecurity}, csprng=${hasCsprng}, secDef=${hasSecDef}, path=${hasSafePath}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ensure_profile_public_id() Parity Check
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Auditing public.ensure_profile_public_id() Parity Across Files');
  const migEnsure = extractFunction(contents.migration, 'ensure_profile_public_id');
  const canonEnsure = extractFunction(contents.canonicalSetup, 'ensure_profile_public_id');
  const allInOneEnsure = extractFunction(contents.allInOne, 'ensure_profile_public_id');

  const normMigEnsure = normalizeSql(migEnsure);
  const normCanonEnsure = normalizeSql(canonEnsure);
  const normAllInOneEnsure = normalizeSql(allInOneEnsure);

  if (normMigEnsure === normCanonEnsure) {
    pass('SYNC-ENSURE-PUBID-CANON', 'ensure_profile_public_id matches 100% between migration and CANONICAL_PRODUCTION_SETUP.sql');
  } else {
    fail('SYNC-ENSURE-PUBID-CANON', `Mismatch in ensure_profile_public_id between migration and CANONICAL_PRODUCTION_SETUP.sql`);
  }

  if (normMigEnsure === normAllInOneEnsure) {
    pass('SYNC-ENSURE-PUBID-ALLINONE', 'ensure_profile_public_id matches 100% between migration and COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql');
  } else {
    fail('SYNC-ENSURE-PUBID-ALLINONE', `Mismatch in ensure_profile_public_id between migration and COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`);
  }

  // Verify untrusted role rejection and 122-bit CSPRNG in all definitions
  for (const [key, fn] of Object.entries({ migration: migEnsure, canonicalSetup: canonEnsure, allInOne: allInOneEnsure })) {
    const fnText = fn || '';
    const rejectsUntrusted = fnText.includes("'authenticated'") && fnText.includes("'anon'") && fnText.includes('PERMISSION_DENIED');
    const hasAutoGen = fnText.includes('NEW.public_id IS NULL') && fnText.includes('nk_pub_') && fnText.includes('gen_random_uuid');
    const rejectsMalformed = fnText.includes('^nk_pub_[0-9a-f]{32}$');
    const noGuc = !fnText.includes('current_setting') && !fnText.includes('set_config');

    if (rejectsUntrusted && hasAutoGen && rejectsMalformed && noGuc) {
      pass(`SECURITY-${key}`, `${files[key].name} ensure_profile_public_id strictly enforces non-GUC server-only generation & rejects untrusted roles`);
    } else {
      fail(`SECURITY-${key}`, `${files[key].name} ensure_profile_public_id failed security check: rejectsUntrusted=${rejectsUntrusted}, autoGen=${hasAutoGen}, rejectsMalformed=${rejectsMalformed}, noGuc=${noGuc}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. generate_profile_public_id() Parity Check
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Auditing public.generate_profile_public_id() Parity Across Files');
  const migGen = extractFunction(contents.migration, 'generate_profile_public_id');
  const canonGen = extractFunction(contents.canonicalSetup, 'generate_profile_public_id');
  const allInOneGen = extractFunction(contents.allInOne, 'generate_profile_public_id');

  const normMigGen = normalizeSql(migGen);
  const normCanonGen = normalizeSql(canonGen);
  const normAllInOneGen = normalizeSql(allInOneGen);

  if (normMigGen === normCanonGen) {
    pass('SYNC-GEN-PUBID-CANON', 'generate_profile_public_id matches 100% between migration and CANONICAL_PRODUCTION_SETUP.sql');
  } else {
    fail('SYNC-GEN-PUBID-CANON', `Mismatch in generate_profile_public_id between migration and CANONICAL_PRODUCTION_SETUP.sql`);
  }

  if (normMigGen === normAllInOneGen) {
    pass('SYNC-GEN-PUBID-ALLINONE', 'generate_profile_public_id matches 100% between migration and COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql');
  } else {
    fail('SYNC-GEN-PUBID-ALLINONE', `Mismatch in generate_profile_public_id between migration and COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Trigger Declarations & Catalog Privileges Parity Check
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Auditing Trigger Declarations & Grants Across Files');
  const migTrg = extractTrigger(contents.migration, 'on_auth_user_created');
  const canonTrg = extractTrigger(contents.canonicalSetup, 'on_auth_user_created');
  const allInOneTrg = extractTrigger(contents.allInOne, 'on_auth_user_created');

  const normMigTrg = normalizeSql(migTrg);
  const normCanonTrg = normalizeSql(canonTrg);
  const normAllInOneTrg = normalizeSql(allInOneTrg);

  if (normMigTrg === normCanonTrg && normMigTrg === normAllInOneTrg) {
    pass('SYNC-TRIGGER-AUTH', 'on_auth_user_created trigger declaration matches 100% across all 3 files');
  } else {
    fail('SYNC-TRIGGER-AUTH', `Trigger declaration mismatch: mig="${normMigTrg}", canon="${normCanonTrg}", allInOne="${normAllInOneTrg}"`);
  }

  // Check grants on handle_new_auth_user
  for (const [key, content] of Object.entries(contents)) {
    const hasRevokePublic = /REVOKE ALL ON FUNCTION public\.handle_new_auth_user\(\) FROM PUBLIC, anon, authenticated/i.test(content);
    const hasGrantService = /GRANT EXECUTE ON FUNCTION public\.handle_new_auth_user\(\) TO service_role/i.test(content);
    const hasGrantAuthAdmin = /GRANT EXECUTE ON FUNCTION public\.handle_new_auth_user\(\) TO supabase_auth_admin/i.test(content);

    if (hasRevokePublic && hasGrantService && hasGrantAuthAdmin) {
      pass(`GRANTS-${key}`, `${files[key].name} revokes handle_new_auth_user from PUBLIC/anon/auth and grants to service_role & supabase_auth_admin`);
    } else {
      fail(`GRANTS-${key}`, `${files[key].name} missing required privilege statements: revoke=${hasRevokePublic}, service=${hasGrantService}, authAdmin=${hasGrantAuthAdmin}`);
    }
  }

  // Check explicit revoke on ensure_profile_public_id across all three files
  for (const [key, content] of Object.entries(contents)) {
    const hasRevokeEnsurePubId = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.ensure_profile_public_id\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role,\s*supabase_auth_admin/i.test(content);
    if (hasRevokeEnsurePubId) {
      pass(`REVOKE-ENSURE-PUBID-${key}`, `${files[key].name} explicitly revokes direct EXECUTE on ensure_profile_public_id() from PUBLIC, anon, authenticated, service_role, and supabase_auth_admin`);
    } else {
      fail(`REVOKE-ENSURE-PUBID-${key}`, `${files[key].name} missing explicit REVOKE ALL ON FUNCTION public.ensure_profile_public_id() FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin`);
    }
  }

  // Check column DEFAULT on public_id is dropped in all three files
  for (const [key, content] of Object.entries(contents)) {
    const hasDropDefault = /ALTER TABLE public\.profiles ALTER COLUMN public_id DROP DEFAULT/i.test(content);
    if (hasDropDefault) {
      pass(`DROP-DEFAULT-${key}`, `${files[key].name} explicitly executes ALTER COLUMN public_id DROP DEFAULT`);
    } else {
      fail(`DROP-DEFAULT-${key}`, `${files[key].name} missing ALTER COLUMN public_id DROP DEFAULT`);
    }
  }

  console.log('\n================================================================================');
  console.log(`📊 SYNCHRONIZATION AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSyncAudit();
