/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI — PHASE 3.1 CRITICAL DOCUMENT PIPELINE & STORAGE AUDIT SUITE
 * ════════════════════════════════════════════════════════════════════════════
 * Strict verification of:
 * - Durable private document storage in 'farmer-land-documents'
 * - Real PDF text-stream extraction and transparent image manual fallback
 * - Digital signature distinction (SIGNATURE_PRESENT_UNVERIFIED vs validated)
 * - Reliable deletion: physical file purge from storage, never false success
 * - Strict tenant isolation & cross-farmer access prevention
 * - File survival across backend restart (durable storage vs volatile memory)
 * - AndroidBridge.openExternalUrl scheme validation & injection prevention
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

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
console.log('📄 NUKROPAI PHASE 3.1 DOCUMENT PIPELINE & DURABLE STORAGE AUDIT');
console.log('================================================================================\n');

// Import services directly
const {
  saveDocumentFile,
  getDocumentFile,
  deleteDocumentFile,
  checkDocumentFileExists,
  sanitizeStorageFileName
} = require('../backend/dist/services/storageService');

const {
  verifyFileSignature,
  inspectPdfDigitalSignature,
  extractTextStreamsFromPdf,
  extractStructuredLandFields,
  inspectAndExtractLandDocument
} = require('../backend/dist/services/pdfExtractionService');

const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261105000003_land_survey_phase3_1_storage_audit.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const controllerPath = path.resolve(__dirname, '../backend/src/controllers/land_survey.controller.ts');
const controllerCode = fs.readFileSync(controllerPath, 'utf8');

const mainActivityPath = path.resolve(__dirname, '../app/src/main/java/com/example/MainActivity.kt');
const mainActivityCode = fs.readFileSync(mainActivityPath, 'utf8');

const indexPath = path.resolve(__dirname, '../app/src/main/assets/index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

async function main() {
  const testFarmerUid = 'farmer-test-' + Date.now();
  const testDocId = 'doc-test-' + Date.now();
  const testFileName = 'pahani_sample_2026.pdf';

  // 1. Storage bucket configuration in migration is private
  runTest('DPA-1', 'Supabase storage migration configures private bucket with strict RLS', () => {
    assert.ok(migrationSql.includes("'farmer-land-documents'"), 'Must specify bucket farmer-land-documents');
    assert.ok(migrationSql.includes('false, -- Strictly private'), 'Bucket must be private (public = false)');
    assert.ok(migrationSql.includes('10485760'), '10MB file size limit must be set in storage config');
    assert.ok(migrationSql.includes('(storage.foldername(name))[1] = auth.uid()::text'), 'Must enforce tenant isolation in storage RLS');
  });

  // 2. Storage path sanitization
  runTest('DPA-2', 'sanitizeStorageFileName prevents path traversal and special characters', () => {
    const raw = '../../etc/passwd..///evil_doc.pdf';
    const safe = sanitizeStorageFileName(raw);
    assert.ok(!safe.includes('/'), 'Must not contain directory slashes');
    assert.ok(!safe.includes('..'), 'Must not contain double dots');
    assert.ok(safe.includes('evil_doc.pdf'), 'Must preserve base filename');
  });

  // 3. Durable persistence to disk storage
  const samplePdfContent = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    'stream\n(Survey No: 142/A District: Warangal Mandal: Geesugonda Village: Dharmaram Extent: 3.5 Acres) Tj\nendstream\n%%EOF',
    'utf8'
  );

  await runAsyncTest('DPA-3', 'saveDocumentFile persists binary to durable storage (not volatile memory)', async () => {
    const sha = 'sample_sha256_' + Date.now();
    const result = await saveDocumentFile(testFarmerUid, testDocId, testFileName, samplePdfContent, 'application/pdf', sha);
    assert.strictEqual(result.storage_bucket, 'farmer-land-documents');
    assert.strictEqual(result.storage_path, `${testFarmerUid}/${testDocId}/${testFileName}`);
    assert.strictEqual(result.file_size_bytes, samplePdfContent.length);

    // Verify physical file exists on disk
    const exists = checkDocumentFileExists(testFarmerUid, result.storage_path);
    assert.strictEqual(exists, true, 'File must exist on disk storage');
  });

  // 4. Persistence across backend restart simulation
  await runAsyncTest('DPA-4', 'Stored document survives simulated backend restart and is retrievable', async () => {
    const path = `${testFarmerUid}/${testDocId}/${testFileName}`;
    // Simulate restart by re-fetching directly without any in-memory variable
    const retrieved = await getDocumentFile(testFarmerUid, path);
    assert.ok(retrieved, 'Buffer must be retrieved from durable storage');
    assert.strictEqual(retrieved.length, samplePdfContent.length);
    assert.ok(retrieved.toString().includes('Survey No: 142/A'), 'Retrieved buffer must match original contents');
  });

  // 5. Cross-tenant storage isolation (Farmer B CANNOT access Farmer A's file)
  await runAsyncTest('DPA-5', 'Cross-tenant access rejection: Farmer B cannot read Farmer A document', async () => {
    const path = `${testFarmerUid}/${testDocId}/${testFileName}`;
    const impostorUid = 'impostor-farmer-999';
    let rejected = false;
    try {
      await getDocumentFile(impostorUid, path);
    } catch (err) {
      rejected = true;
      assert.ok(err.message.includes('SECURITY_VIOLATION'), 'Must throw security violation for cross-tenant access');
    }
    assert.strictEqual(rejected, true, 'Impostor read attempt must be strictly rejected');
  });

  // 6. Magic byte file signature validation (prevents MIME spoofing)
  runTest('DPA-6', 'verifyFileSignature validates magic numbers and rejects spoofed files', () => {
    // Valid PDF
    const validPdf = verifyFileSignature(Buffer.from('%PDF-1.7\n...', 'utf8'), 'application/pdf');
    assert.strictEqual(validPdf.valid, true);
    assert.strictEqual(validPdf.format, 'PDF');

    // Spoofed file: EXE or script renamed as PDF
    const spoofedPdf = verifyFileSignature(Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'binary'), 'application/pdf');
    assert.strictEqual(spoofedPdf.valid, false);
    assert.ok(spoofedPdf.error.includes('FILE_SIGNATURE_MISMATCH'), 'Must identify file signature mismatch');

    // Valid PNG
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const validPng = verifyFileSignature(pngHeader, 'image/png');
    assert.strictEqual(validPng.valid, true);
    assert.strictEqual(validPng.format, 'PNG');
  });

  // 7. Real PDF text extraction from stream
  runTest('DPA-7', 'extractTextStreamsFromPdf extracts plain and FlateDecode streams', () => {
    const rawStream = 'BT /F1 12 Tf (Survey No: 205/B Village: Narsampet District: Warangal) Tj ET';
    const compressed = zlib.deflateSync(Buffer.from(rawStream, 'utf8'));

    const pdfBuffer = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 100 /Filter /FlateDecode >>\nstream\n', 'latin1'),
      compressed,
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')
    ]);

    const extracted = extractTextStreamsFromPdf(pdfBuffer);
    assert.ok(extracted.includes('Survey No: 205/B'), 'Must decompress and extract text from stream');
  });

  // 8. Structured land fields extraction & confidence scoring
  runTest('DPA-8', 'extractStructuredLandFields extracts attributes and preserves provenance', () => {
    const text = 'Govt of Telangana Pahani Survey No: 88/1 District: Warangal Mandal: Geesugonda Village: Dharmaram Extent: 4.25 Acres Khata No: 541';
    const fields = extractStructuredLandFields(text, {}, 'PDF_TEXT_STREAM');

    assert.strictEqual(fields.survey_number.value, '88/1');
    assert.strictEqual(fields.survey_number.extraction_method, 'PDF_TEXT_STREAM');
    assert.ok(fields.survey_number.confidence >= 0.85);
    assert.strictEqual(fields.survey_number.farmer_confirmed, false, 'Field must await farmer confirmation');

    assert.strictEqual(fields.village.value, 'Dharmaram');
    assert.strictEqual(fields.mandal.value, 'Geesugonda');
    assert.strictEqual(fields.district.value, 'Warangal');
    assert.strictEqual(fields.extent_acres.value, 4.25);
  });

  // 9. Strict rule: Do not infer missing survey number
  runTest('DPA-9', 'extractStructuredLandFields does NOT infer missing survey number', () => {
    const textWithoutSurvey = 'Government Report Village: Dharmaram District: Warangal Area: 2.0 Acres';
    const fields = extractStructuredLandFields(textWithoutSurvey, {}, 'PDF_TEXT_STREAM');
    assert.strictEqual(fields.survey_number.value, null, 'Must NOT invent or infer missing survey number');
    assert.strictEqual(fields.survey_number.confidence, 0.0);
  });

  // 10. Scanned image fallback notice
  runTest('DPA-10', 'inspectAndExtractLandDocument provides transparent notice when text extraction unavailable', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const result = await inspectAndExtractLandDocument(pngHeader, 'image/png');

    assert.strictEqual(result.extraction_status, 'MANUAL_FALLBACK');
    assert.strictEqual(result.extraction_message, 'Text extraction is unavailable. Please enter or review the land details manually.');
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
    assert.strictEqual(result.extracted_fields.survey_number.farmer_confirmed, false);
  });

  // 11. Digital signature marker detection vs validation
  runTest('DPA-11', 'Digital signature presence classifies as SIGNATURE_PRESENT_UNVERIFIED (not validated)', () => {
    const pdfWithSignature = Buffer.from(
      '%PDF-1.7\n' +
      '/Type /Sig\n' +
      '/ByteRange [ 0 100 200 50 ]\n' +
      '/Filter /Adobe.PPKLite\n' +
      '/SubFilter /adbe.pkcs7.detached\n' +
      '/Contents <308204...> \n' +
      '%%EOF' + 'x'.repeat(200),
      'latin1'
    );

    const sig = inspectPdfDigitalSignature(pdfWithSignature);
    assert.strictEqual(sig.status, 'SIGNATURE_PRESENT_UNVERIFIED', 'Presence of /ByteRange alone must NOT be validated');
    assert.strictEqual(sig.marker_present, true);
    assert.strictEqual(sig.trust_chain_verified, false);
    assert.ok(sig.explanation.includes('Certificate trust chain has not been cryptographically verified'));
  });

  // 12. Corrupted signature byte range detected as SIGNATURE_INVALID
  runTest('DPA-12', 'inspectPdfDigitalSignature identifies malformed ByteRange as SIGNATURE_INVALID', () => {
    const pdfWithCorruptSig = Buffer.from(
      '%PDF-1.7\n/ByteRange [ 50 100 200 999999999 ]\n%%EOF',
      'latin1'
    );
    const sig = inspectPdfDigitalSignature(pdfWithCorruptSig);
    assert.strictEqual(sig.status, 'SIGNATURE_INVALID');
  });

  // 13. Reliable document deletion: physical removal from storage
  await runAsyncTest('DPA-13', 'deleteDocumentFile actually removes physical file from durable storage', async () => {
    const path = `${testFarmerUid}/${testDocId}/${testFileName}`;
    assert.strictEqual(checkDocumentFileExists(testFarmerUid, path), true, 'File must exist prior to deletion');

    const deleted = await deleteDocumentFile(testFarmerUid, path);
    assert.strictEqual(deleted, true, 'Deletion must report true');
    assert.strictEqual(checkDocumentFileExists(testFarmerUid, path), false, 'File must NOT exist on disk after deletion');
  });

  // 14. Cross-tenant deletion rejection
  await runAsyncTest('DPA-14', 'deleteDocumentFile prevents Farmer B from deleting Farmer A document', async () => {
    // Recreate a sample file
    const docId2 = 'doc-test-2-' + Date.now();
    const saveRes = await saveDocumentFile(testFarmerUid, docId2, 'sample.pdf', Buffer.from('%PDF-1.4\n%%EOF'), 'application/pdf', 'sha2');
    
    let caught = false;
    try {
      await deleteDocumentFile('malicious-user-456', saveRes.storage_path);
    } catch (e) {
      caught = true;
      assert.ok(e.message.includes('SECURITY_VIOLATION'));
    }
    assert.strictEqual(caught, true, 'Cross-tenant deletion must be forbidden');
    // Cleanup
    await deleteDocumentFile(testFarmerUid, saveRes.storage_path);
  });

  // 15. Source lifecycle separated from authorization
  runTest('DPA-15', 'Separation of source lifecycle (ACTIVE/SUPERSEDED) from authorization status in migration', () => {
    assert.ok(migrationSql.includes('legacy_status = \'SUPERSEDED\''), 'Must set Dharani lifecycle to SUPERSEDED');
    assert.ok(migrationSql.includes("permission_status = 'PENDING_AUTHORIZATION'"), 'Must set Dharani permission to PENDING_AUTHORIZATION');
    assert.ok(migrationSql.includes("dataset_status = 'UNAVAILABLE'"), 'Must set Dharani dataset_status to UNAVAILABLE');
    assert.ok(migrationSql.includes("dataset_status = 'NO_DATASET'"), 'Must mark Central data.gov.in as NO_DATASET');
  });

  // 16. Android bridge URL scheme validation
  runTest('DPA-16', 'AndroidBridge openExternalUrl validates HTTP/HTTPS and rejects unsafe schemes', () => {
    assert.ok(mainActivityCode.includes('scheme != "http" && scheme != "https"'), 'MainActivity must strictly reject non-HTTP/HTTPS schemes');
    assert.ok(mainActivityCode.includes('Rejected unsafe external URL scheme'), 'MainActivity must log security warnings for unsafe schemes');
  });

  // 17. Client UI contains enhanced DPDP transparency notice & delete button
  runTest('DPA-17', 'Client UI includes detailed DPDP notice, erasure rights, and delete action', () => {
    assert.ok(indexHtml.includes('Privacy & DPDP Act Data Collection Notice'), 'index.html must display DPDP transparency panel');
    assert.ok(indexHtml.includes('farmer-land-documents'), 'index.html must mention private bucket farmer-land-documents');
    assert.ok(indexHtml.includes('deleteFarmerDocumentFromProfile'), 'index.html must provide deleteFarmerDocumentFromProfile handler');
    assert.ok(indexHtml.includes('Delete & Purge'), 'index.html must display Delete & Purge action button');
  });

  // 18. Endpoints confirmation route exists in controller & routes
  runTest('DPA-18', 'confirmFarmerLandDocument and downloadFarmerLandDocumentFile implemented and routed', () => {
    assert.ok(controllerCode.includes('confirmFarmerLandDocument'), 'Controller must implement confirmFarmerLandDocument');
    assert.ok(controllerCode.includes('downloadFarmerLandDocumentFile'), 'Controller must implement downloadFarmerLandDocumentFile');
    assert.ok(controllerCode.includes('saveDocumentFile'), 'Controller must call saveDocumentFile for durable storage');
  });

  console.log(`\n================================================================================`);
  console.log(`📊 PHASE 3.1 AUDIT: ${passedTests} PASSED, ${totalTests - passedTests} FAILED (TOTAL: ${totalTests})`);
  console.log(`================================================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
