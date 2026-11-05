/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI AGRARIAN OS — LAND SURVEY INTELLIGENCE ZERO-REGRESSION SUITE
 * ════════════════════════════════════════════════════════════════════════════
 * Verifies the honest Land Survey Intelligence implementation across
 * the Android WebView frontend, Fastify backend, ingestion workers, and Supabase migrations:
 * - Zero fabricated coordinates or random khasra numbers
 * - Zero fake government verification badges ("VERIFIED_BY_OFFICER")
 * - Zero mock credit scores or prime ag-credit grades
 * - All government data sources classified as PENDING_AUTHORIZATION
 * - Ingestion pipeline: geometry validation, deterministic SHA-256 hashing, permission guard
 * - PostGIS provenance and three-date separation preserved
 * - 100% SHA-256 asset parity between index.html and nukrop_emulator.html
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(id, name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${id}: ${name}`);
  } catch (err) {
    console.error(`  ✖ [FAIL] ${id}: ${name} — ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(id, name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${id}: ${name}`);
  } catch (err) {
    console.error(`  ✖ [FAIL] ${id}: ${name} — ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================================');
console.log('🏛️  NUKROPAI LAND SURVEY INTELLIGENCE ZERO-REGRESSION SUITE');
console.log('================================================================================\n');

const indexPath = path.resolve(__dirname, '../app/src/main/assets/index.html');
const emulatorPath = path.resolve(__dirname, '../nukrop_emulator.html');
const dpiServicePath = path.resolve(__dirname, '../app/src/main/assets/js/agristack_dpi_service.js');
const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261105000001_land_survey_intelligence.sql');
const migrationPhase3Path = path.resolve(__dirname, '../supabase/migrations/20261105000002_land_survey_phase3.sql');
const routesPath = path.resolve(__dirname, '../backend/src/routes/land_survey.routes.ts');
const controllerPath = path.resolve(__dirname, '../backend/src/controllers/land_survey.controller.ts');
const backendIndexPath = path.resolve(__dirname, '../backend/src/routes/index.ts');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const dpiServiceCode = fs.readFileSync(dpiServicePath, 'utf8');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const migrationPhase3Sql = fs.readFileSync(migrationPhase3Path, 'utf8');
const controllerCode = fs.readFileSync(controllerPath, 'utf8');
const backendIndexCode = fs.readFileSync(backendIndexPath, 'utf8');

const {
  validateParcelGeometry,
  computeLandRecordHash,
  checkSourcePermission
} = require('../backend/dist/workers/jobs/landSurveyIngestion');

async function main() {
  // LSI-1: Source registry returns ALL PENDING_AUTHORIZATION in database migration
  runTest('LSI-1', 'Source registry defines ALL sources as PENDING_AUTHORIZATION in seed data', () => {
    assert.ok(migrationSql.includes('PENDING_AUTHORIZATION'), 'Migration must specify PENDING_AUTHORIZATION');
    const insertSection = migrationSql.split('INSERT INTO public.land_data_sources')[1] || '';
    const insertValues = insertSection.split('ON CONFLICT')[0] || '';
    const pendingCount = (insertValues.match(/'PENDING_AUTHORIZATION'/g) || []).length;
    assert.strictEqual(pendingCount, 8, 'All 8 initial government sources must be PENDING_AUTHORIZATION');
    assert.ok(!insertValues.includes("'APPROVED'"), 'No initial source may have APPROVED status');
  });

  // LSI-2: Search returns honest availability notice when no APPROVED sources exist
  runTest('LSI-2', 'Backend controller provides honest availability_notice for searches', () => {
    assert.ok(controllerCode.includes('availability_notice'), 'Controller must include availability_notice in search response');
    assert.ok(controllerCode.includes('PENDING_AUTHORIZATION for automated data collection'), 'Controller must honestly state sources are PENDING_AUTHORIZATION');
  });

  // LSI-3: Zero occurrences of 'VERIFIED_BY_OFFICER' across HTML and JS assets
  runTest('LSI-3', 'Zero occurrences of VERIFIED_BY_OFFICER in client assets', () => {
    assert.ok(!indexHtml.includes('VERIFIED_BY_OFFICER'), 'index.html must not contain VERIFIED_BY_OFFICER');
    assert.ok(!dpiServiceCode.includes('VERIFIED_BY_OFFICER'), 'agristack_dpi_service.js must not contain VERIFIED_BY_OFFICER');
  });

  // LSI-4: Zero fake coordinate generation in fetchAndVerifyRealLandRecord
  runTest('LSI-4', 'Zero fake coordinate or polygon generation in fetchAndVerifyRealLandRecord', () => {
    const funcMatch = indexHtml.match(/function fetchAndVerifyRealLandRecord\(\)[\s\S]*?\n\}/);
    assert.ok(funcMatch, 'fetchAndVerifyRealLandRecord function must exist in index.html');
    const funcBody = funcMatch[0];
    assert.ok(!funcBody.includes('polygonCoordinates'), 'fetchAndVerifyRealLandRecord must not generate synthetic polygons');
    assert.ok(!funcBody.includes('STATE_BASE_COORDS'), 'fetchAndVerifyRealLandRecord must not contain fake state base coords');
    assert.ok(!funcBody.includes('Math.random()'), 'fetchAndVerifyRealLandRecord must not generate random IDs or coords');
    assert.ok(funcBody.includes('FARMER_CLAIMED'), 'fetchAndVerifyRealLandRecord must store claims as FARMER_CLAIMED');
  });

  // LSI-5: Farmer claim sets claim_status = 'FARMER_CLAIMED' (not government-verified)
  runTest('LSI-5', 'Farmer claim explicitly sets FARMER_CLAIMED status', () => {
    assert.ok(controllerCode.includes("claim_status = 'FARMER_CLAIMED'"), 'Controller must set claim_status = FARMER_CLAIMED');
    assert.ok(controllerCode.includes('This is NOT government verification of ownership'), 'Controller must disclose non-verification');
  });

  // LSI-6: Provenance models three distinct dates
  runTest('LSI-6', 'Provenance panel separates government update, collection, and sync dates', () => {
    assert.ok(controllerCode.includes('government_record_updated'), 'Provenance must expose government_record_updated');
    assert.ok(controllerCode.includes('nukropai_collection_date'), 'Provenance must expose nukropai_collection_date');
    assert.ok(controllerCode.includes('nukropai_last_sync'), 'Provenance must expose nukropai_last_sync');
  });

  // LSI-7: Missing geometry returns 404 with GEOMETRY_UNAVAILABLE explanation
  runTest('LSI-7', 'Missing geometry returns 404 with GEOMETRY_UNAVAILABLE', () => {
    assert.ok(controllerCode.includes('GEOMETRY_UNAVAILABLE'), 'Controller must return GEOMETRY_UNAVAILABLE error code');
    assert.ok(controllerCode.includes('404'), 'Controller must return 404 when geometry is null');
  });

  // LSI-8: Official state portal links present
  runTest('LSI-8', 'Official state land portals included for TS, AP, UP, MH, KA', () => {
    assert.ok(indexHtml.includes('dharani.telangana.gov.in'), 'Must link to Dharani for Telangana');
    assert.ok(indexHtml.includes('meebhoomi.ap.gov.in'), 'Must link to MeeBhoomi for Andhra Pradesh');
    assert.ok(indexHtml.includes('upbhulekh.gov.in'), 'Must link to UP Bhulekh');
    assert.ok(indexHtml.includes('bhulekh.mahabhumi.gov.in'), 'Must link to MahaBhumi');
    assert.ok(indexHtml.includes('landrecords.karnataka.gov.in'), 'Must link to Bhoomi');
  });

  // LSI-9: OSM map container correctly initialized with leaflet ID
  runTest('LSI-9', 'OSM map container present in agristack view', () => {
    assert.ok(indexHtml.includes('id="agristack-osm-map"'), 'agristack-osm-map container must exist');
    assert.ok(indexHtml.includes('id="agristack-map-wrapper"'), 'agristack-map-wrapper container must exist');
  });

  // LSI-10: Farmer linked parcels query filters strictly by farmer_auth_uid
  runTest('LSI-10', 'Farmer linked parcels query enforces strict tenant isolation', () => {
    assert.ok(controllerCode.includes('fll.farmer_auth_uid = $1'), 'Must filter by farmer_auth_uid');
    assert.ok(controllerCode.includes('fll.removed_at IS NULL'), 'Must filter out removed claims');
  });

  // LSI-11: Screen navigation: 'agristack' APP_VIEW renderer exists and returns HTML
  runTest('LSI-11', 'agristack APP_VIEW exists in index.html', () => {
    assert.ok(indexHtml.includes('agristack: () => {'), 'agristack APP_VIEW must exist');
    assert.ok(indexHtml.includes('openScreen(\'agristack\''), 'openScreen(\'agristack\') must be callable');
  });

  // LSI-12: Zero mock credit scores in agristack screen or I18N titles
  runTest('LSI-12', 'Zero mock credit scores (742 / 850 or 785 / 850) in index.html', () => {
    assert.ok(!indexHtml.includes('742 / 850'), 'index.html must not contain 742 / 850');
    assert.ok(!indexHtml.includes('785 / 850'), 'index.html must not contain 785 / 850');
  });

  // LSI-13: agristack_dpi_service.js initializes in 100% empty state
  runTest('LSI-13', 'agristack_dpi_service.js initializes in 100% empty state with no pre-rendered data', () => {
    assert.ok(dpiServiceCode.includes('data: null'), 'Store must initialize with data: null');
    assert.ok(dpiServiceCode.includes('clearActiveAgristackView'), 'Clear active view function must exist');
  });

  // LSI-14: Land survey routes registered in backend router
  runTest('LSI-14', 'Land survey routes registered in backend/src/routes/index.ts', () => {
    assert.ok(backendIndexCode.includes('import landSurveyRoutes'), 'backend routes index must import landSurveyRoutes');
    assert.ok(backendIndexCode.includes("fastify.register(landSurveyRoutes, { prefix: '/land-survey' })"), 'landSurveyRoutes must be registered under /land-survey');
  });

  // LSI-15: Database migration 20261105000001_land_survey_intelligence.sql exists and is valid
  runTest('LSI-15', 'Database migration creates land_data_sources, land_parcel_history, farmer_land_links', () => {
    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.land_data_sources'), 'Must create land_data_sources');
    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.land_parcel_history'), 'Must create land_parcel_history');
    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.farmer_land_links'), 'Must create farmer_land_links');
    assert.ok(migrationSql.includes('search_land_parcels'), 'Must create search_land_parcels function');
  });

  // LSI-16: All 8 land data sources in migration default scraping_enabled to false
  runTest('LSI-16', 'All 8 government land data sources have scraping disabled (FALSE)', () => {
    const insertSection = migrationSql.split('INSERT INTO public.land_data_sources')[1] || '';
    const insertValues = insertSection.split('ON CONFLICT')[0] || '';
    const falseMatches = (insertValues.match(/FALSE\s*\)/g) || []).length;
    assert.strictEqual(falseMatches, 8, 'All 8 initial government sources must have scraping_enabled set to FALSE');
  });

  // LSI-17: Modal contains subdivision input field ('ror-subdivision-input')
  runTest('LSI-17', 'Search modal contains ror-subdivision-input field', () => {
    assert.ok(indexHtml.includes('id="ror-subdivision-input"'), 'Modal must contain ror-subdivision-input');
  });

  // LSI-18: Offline state provides direct links to official state land portals
  runTest('LSI-18', 'Offline and error fallback provides state portal URLs', () => {
    assert.ok(controllerCode.includes('buildOfflineCoverageResponse'), 'Controller must build offline coverage response');
    assert.ok(indexHtml.includes('OFFICIAL_GOVT_LAND_PORTALS'), 'index.html must have official portals map');
  });

  // LSI-19: UI shows clear 'DATA PENDING' badge instead of fake 'Govt RoR'
  runTest('LSI-19', 'Agristack header shows DATA PENDING badge instead of Govt RoR', () => {
    assert.ok(indexHtml.includes('<span>DATA PENDING</span>'), 'Header must display DATA PENDING badge');
    assert.ok(!indexHtml.includes('<span>Govt RoR</span>'), 'Header must NOT display fake Govt RoR badge');
  });

  // LSI-20: 100% Asset Parity: index.html SHA-256 strictly equals nukrop_emulator.html SHA-256
  runTest('LSI-20', '100% Asset Parity: index.html SHA-256 equals nukrop_emulator.html SHA-256', () => {
    const indexHash = crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
    const emulatorHash = crypto.createHash('sha256').update(fs.readFileSync(emulatorPath)).digest('hex');
    assert.strictEqual(indexHash, emulatorHash, `SHA-256 mismatch!\nindex.html:     ${indexHash}\nemulator:       ${emulatorHash}`);
  });

  // LSI-21: validateParcelGeometry accepts valid closed Polygon ring
  runTest('LSI-21', 'validateParcelGeometry accepts valid closed Polygon in EPSG:4326', () => {
    const validPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [78.4521, 17.3850],
          [78.4550, 17.3850],
          [78.4550, 17.3880],
          [78.4521, 17.3880],
          [78.4521, 17.3850]
        ]
      ]
    };
    const res = validateParcelGeometry(validPolygon);
    assert.strictEqual(res.valid, true);
  });

  // LSI-22: validateParcelGeometry rejects unclosed Polygon ring
  runTest('LSI-22', 'validateParcelGeometry rejects unclosed Polygon (first != last point)', () => {
    const unclosedPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [78.4521, 17.3850],
          [78.4550, 17.3850],
          [78.4550, 17.3880],
          [78.4521, 17.3880] // Missing closing point [78.4521, 17.3850]
        ]
      ]
    };
    const res = validateParcelGeometry(unclosedPolygon);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('not closed'));
  });

  // LSI-23: validateParcelGeometry rejects Polygon with fewer than 4 coordinates
  runTest('LSI-23', 'validateParcelGeometry rejects ring with fewer than 4 vertices', () => {
    const invalidRing = {
      type: 'Polygon',
      coordinates: [
        [
          [78.4521, 17.3850],
          [78.4550, 17.3850],
          [78.4521, 17.3850]
        ]
      ]
    };
    const res = validateParcelGeometry(invalidRing);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('at least 4 coordinates'));
  });

  // LSI-24: validateParcelGeometry rejects coordinates outside WGS84 bounds
  runTest('LSI-24', 'validateParcelGeometry rejects out-of-range coordinates (>90 lat or >180 lon)', () => {
    const outOfBounds = {
      type: 'Polygon',
      coordinates: [
        [
          [200.0, 17.3850],
          [78.4550, 17.3850],
          [78.4550, 17.3880],
          [78.4521, 17.3880],
          [200.0, 17.3850]
        ]
      ]
    };
    const res = validateParcelGeometry(outOfBounds);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('out of WGS84 range'));
  });

  // LSI-25: computeLandRecordHash produces deterministic SHA-256 for identical inputs
  runTest('LSI-25', 'computeLandRecordHash generates deterministic SHA-256 for identical records', () => {
    const rec1 = {
      source_record_id: 'REC-TS-001',
      state_code: 'TS',
      district_name: 'Warangal',
      mandal_name: 'Geesugonda',
      village_name: 'Dharmaram',
      survey_number: '124',
      subdivision_number: 'A',
      area_acres: 3.5
    };
    const rec2 = { ...rec1 };
    const hash1 = computeLandRecordHash(rec1);
    const hash2 = computeLandRecordHash(rec2);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });

  // LSI-26: computeLandRecordHash produces distinct hashes for differing inputs
  runTest('LSI-26', 'computeLandRecordHash generates distinct hashes when fields change', () => {
    const rec1 = {
      source_record_id: 'REC-TS-001',
      state_code: 'TS',
      district_name: 'Warangal',
      mandal_name: 'Geesugonda',
      village_name: 'Dharmaram',
      survey_number: '124',
      subdivision_number: 'A'
    };
    const rec2 = {
      ...rec1,
      subdivision_number: 'B' // Changed subdivision
    };
    const hash1 = computeLandRecordHash(rec1);
    const hash2 = computeLandRecordHash(rec2);
    assert.notStrictEqual(hash1, hash2);
  });

  // LSI-27: checkSourcePermission blocks scraping when permission_status is PENDING_AUTHORIZATION
  await runAsyncTest('LSI-27', 'checkSourcePermission blocks ingestion for PENDING_AUTHORIZATION sources', async () => {
    const perm = await checkSourcePermission('TS_DHARANI');
    // If DB offline, falls back closed to allowed=false; if DB online, returns allowed=false because status is PENDING_AUTHORIZATION
    assert.strictEqual(perm.allowed, false, 'TS_DHARANI must NOT be allowed to scrape');
  });

  // LSI-28: Client UI renders GEOMETRY_UNAVAILABLE badge when parcel geometry is null
  runTest('LSI-28', 'Client UI displays GEOMETRY_UNAVAILABLE badge when geometry is absent', () => {
    assert.ok(indexHtml.includes('GEOMETRY_UNAVAILABLE'), 'index.html must include GEOMETRY_UNAVAILABLE handling');
    assert.ok(indexHtml.includes('POLYGON AVAILABLE'), 'index.html must conditionally show POLYGON AVAILABLE vs GEOMETRY_UNAVAILABLE');
  });

  // LSI-29: Phase 3 migration updates Telangana source to Bhu Bharati (TS_BHUBHARATI) with official URLs
  runTest('LSI-29', 'Phase 3 migration registers Bhu Bharati (TS_BHUBHARATI) with official URLs', () => {
    assert.ok(migrationPhase3Sql.includes('TS_BHUBHARATI'), 'Migration must register TS_BHUBHARATI');
    assert.ok(migrationPhase3Sql.includes('bhubharati.telangana.gov.in'), 'Migration must use official bhubharati.telangana.gov.in domain');
    assert.ok(migrationPhase3Sql.includes('/knowLandStatus'), 'Migration must document /knowLandStatus citizen search capability');
    assert.ok(migrationPhase3Sql.includes('/gis/'), 'Migration must document /gis/ cadastral map capability');
  });

  // LSI-30: Phase 3 migration sets TS_DHARANI to SUPERSEDED_BY_BHUBHARATI and PROHIBITED
  runTest('LSI-30', 'Phase 3 migration updates TS_DHARANI to SUPERSEDED_BY_BHUBHARATI and PROHIBITED', () => {
    assert.ok(migrationPhase3Sql.includes('SUPERSEDED_BY_BHUBHARATI'), 'Migration must mark TS_DHARANI as SUPERSEDED_BY_BHUBHARATI');
    assert.ok(migrationPhase3Sql.includes("permission_status = 'PROHIBITED'"), 'Migration must mark TS_DHARANI permission_status as PROHIBITED');
  });

  // LSI-31: Phase 3 migration creates farmer_land_documents table with 5 verification status constraints
  runTest('LSI-31', 'Phase 3 migration creates farmer_land_documents with 5 verification statuses', () => {
    assert.ok(migrationPhase3Sql.includes('CREATE TABLE IF NOT EXISTS public.farmer_land_documents'), 'Must create farmer_land_documents table');
    assert.ok(migrationPhase3Sql.includes('USER_PROVIDED_DOCUMENT'), 'Must support USER_PROVIDED_DOCUMENT');
    assert.ok(migrationPhase3Sql.includes('SOURCE_DOCUMENT_UNVERIFIED'), 'Must support SOURCE_DOCUMENT_UNVERIFIED');
    assert.ok(migrationPhase3Sql.includes('DIGITAL_SIGNATURE_VALIDATED'), 'Must support DIGITAL_SIGNATURE_VALIDATED');
    assert.ok(migrationPhase3Sql.includes('OFFICIALLY_VERIFIED'), 'Must support OFFICIALLY_VERIFIED');
    assert.ok(migrationPhase3Sql.includes('FARMER_CLAIMED'), 'Must support FARMER_CLAIMED');
    assert.ok(migrationPhase3Sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enforce RLS on farmer_land_documents');
  });

  // LSI-32: Document upload requires explicit user consent under DPDP Act
  runTest('LSI-32', 'Document upload endpoint rejects requests without user_consent_granted', () => {
    assert.ok(controllerCode.includes('EXPLICIT_CONSENT_REQUIRED'), 'Controller must fail without user_consent_granted');
  });

  // LSI-33: Document upload enforces 10MB maximum file size limit
  runTest('LSI-33', 'Document upload endpoint enforces 10MB file limit', () => {
    assert.ok(controllerCode.includes('PAYLOAD_TOO_LARGE'), 'Controller must return PAYLOAD_TOO_LARGE for files > 10MB');
    assert.ok(controllerCode.includes('10 * 1024 * 1024'), 'Controller must check against 10MB threshold');
  });

  // LSI-34: Document upload tags records with USER_PROVIDED_DOCUMENT and GEOMETRY_UNAVAILABLE
  runTest('LSI-34', 'Document upload tags uploaded records with USER_PROVIDED_DOCUMENT and GEOMETRY_UNAVAILABLE', () => {
    assert.ok(controllerCode.includes("verificationStatus = 'USER_PROVIDED_DOCUMENT'"), 'Uploads must be tagged USER_PROVIDED_DOCUMENT');
    assert.ok(controllerCode.includes("geometryStatus = 'GEOMETRY_UNAVAILABLE'"), 'Uploads must default to GEOMETRY_UNAVAILABLE');
  });

  // LSI-35: Leaflet map removes unauthorized Bhuvan WMS layer
  runTest('LSI-35', 'Leaflet map initialization disables unauthorized Bhuvan WMS layer', () => {
    assert.ok(!indexHtml.includes('nationalCadastralWMS.addTo'), 'index.html must NOT add nationalCadastralWMS to map');
    assert.ok(dpiServiceCode.includes('NRSC / ISRO Bhuvan WMS is pending bilateral data licensing agreement'), 'agristack_dpi_service.js must disable WMS layer');
  });

  // LSI-36: Client UI includes exact prompt-mandated handoff message
  runTest('LSI-36', 'Client UI includes prompt-mandated official portal handoff message', () => {
    const expectedMsg = "Your land record is not currently available in NuKropAI's authorized dataset. You can open the official government portal to check your details.";
    assert.ok(indexHtml.includes(expectedMsg), 'index.html must display exact handoff notice');
    assert.ok(controllerCode.includes(expectedMsg), 'Backend search response must return exact handoff message');
  });

  // LSI-37: Client UI contains openLandDocumentUploadModal with DPDP consent checkbox
  runTest('LSI-37', 'Client UI provides document upload modal with DPDP consent checkbox', () => {
    assert.ok(indexHtml.includes('openLandDocumentUploadModal'), 'index.html must define openLandDocumentUploadModal');
    assert.ok(indexHtml.includes('doc-user-consent'), 'Document upload modal must include consent checkbox');
    assert.ok(indexHtml.includes('submitLandDocumentUpload'), 'Document upload modal must include submission handler');
  });

  console.log(`\n================================================================================`);
  console.log(`📊 LAND SURVEY INTELLIGENCE AUDIT: ${passedTests} PASSED, ${totalTests - passedTests} FAILED (TOTAL: ${totalTests})`);
  console.log(`================================================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
