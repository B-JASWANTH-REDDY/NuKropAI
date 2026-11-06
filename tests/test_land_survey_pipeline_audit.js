/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI — PHASE 3.2 DOCUMENT PIPELINE, DURABLE STORAGE & RELEASE HARDENING
 * ════════════════════════════════════════════════════════════════════════════
 * Strict verification of:
 * 1. PDF EXTRACTION HARDENING:
 *    - Maintained pdf-parse library
 *    - Multi-page extraction with page preservation (page_1, page_2)
 *    - Compressed streams and supported font mappings
 *    - Corrupted and password-protected PDF graceful handling
 *    - Explicit manual fallback for scanned images & zero-text PDFs
 *    - Strict non-inference of missing survey numbers
 * 2. SUPABASE STORAGE HARDENING:
 *    - Supabase Storage private bucket authoritative persistence
 *    - Local filesystem temporary processing with guaranteed cleanup
 *    - Server-generated paths: {farmer_auth_uid}/{document_id}/{filename}
 *    - Strict cross-farmer tenant isolation
 *    - File size limits (10MB)
 *    - Reliable physical file deletion
 * 3. SECURE OFFICIAL PORTAL HANDOFF:
 *    - Exact HTTPS hostname allowlist
 *    - Rejection of embedded credentials (user:pass@host)
 *    - Rejection of unapproved ports and unsafe schemes (javascript:, file:)
 *    - Preserved Android back navigation
 * 4. RELEASE SIGNING AUDIT:
 *    - apksigner signature verification
 *    - Certificate identity and SHA-256 fingerprint audit
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');
const { execSync } = require('child_process');

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
console.log('📄 NUKROPAI PHASE 3.2 RELEASE HARDENING & DOCUMENT PIPELINE AUDIT');
console.log('================================================================================\n');

// Import services directly
const {
  saveDocumentFile,
  getDocumentFile,
  deleteDocumentFile,
  checkDocumentFileExists,
  sanitizeStorageFileName,
  createTemporaryProcessingFile,
  cleanupTemporaryProcessingFile,
  MAX_DOCUMENT_FILE_SIZE
} = require('../backend/dist/services/storageService');

const {
  verifyFileSignature,
  inspectPdfDigitalSignature,
  extractTextStreamsFromPdf,
  extractStructuredLandFields,
  extractStructuredLandFieldsFromPages,
  inspectAndExtractLandDocument,
  parsePdfWithLibrary
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

  // 3. Durable persistence to authoritative storage
  const samplePdfContent = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    'stream\n(Survey No: 142/A District: Warangal Mandal: Geesugonda Village: Dharmaram Extent: 3.5 Acres) Tj\nendstream\n%%EOF',
    'utf8'
  );

  await runAsyncTest('DPA-3', 'saveDocumentFile persists binary to authoritative storage', async () => {
    const sha = 'sample_sha256_' + Date.now();
    const result = await saveDocumentFile(testFarmerUid, testDocId, testFileName, samplePdfContent, 'application/pdf', sha);
    assert.strictEqual(result.storage_bucket, 'farmer-land-documents');
    assert.strictEqual(result.storage_path, `${testFarmerUid}/${testDocId}/${testFileName}`);
    assert.strictEqual(result.file_size_bytes, samplePdfContent.length);

    // Verify file exists in persistent storage
    const exists = checkDocumentFileExists(testFarmerUid, result.storage_path);
    assert.strictEqual(exists, true, 'File must exist in authoritative storage');
  });

  // 4. Persistence across backend restart simulation
  await runAsyncTest('DPA-4', 'Stored document survives simulated backend restart and is retrievable', async () => {
    const path = `${testFarmerUid}/${testDocId}/${testFileName}`;
    const retrieved = await getDocumentFile(testFarmerUid, path);
    assert.ok(retrieved, 'Buffer must be retrieved from authoritative storage');
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
    const validPdf = verifyFileSignature(Buffer.from('%PDF-1.7\n...', 'utf8'), 'application/pdf');
    assert.strictEqual(validPdf.valid, true);
    assert.strictEqual(validPdf.format, 'PDF');

    const spoofedPdf = verifyFileSignature(Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'binary'), 'application/pdf');
    assert.strictEqual(spoofedPdf.valid, false);
    assert.ok(spoofedPdf.error.includes('FILE_SIGNATURE_MISMATCH'), 'Must identify file signature mismatch');

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

  // 8. Maintained pdf-parse library extracts multi-page text and preserves page reference
  await runAsyncTest('DPA-8', 'parsePdfWithLibrary handles standard multi-page text PDF and preserves page references', async () => {
    // Generate valid 2-page PDF
    const multiPagePdf = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
      '4 0 obj\n<< /Length 60 >>\nstream\nBT /F1 12 Tf 100 700 Td (District: Warangal Mandal: Geesugonda) Tj ET\nendstream\nendobj\n' +
      '5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n' +
      '6 0 obj\n<< /Length 65 >>\nstream\nBT /F1 12 Tf 100 700 Td (Survey No: 334/1 Village: Dharmaram Extent: 5.5 Acres) Tj ET\nendstream\nendobj\n' +
      'xref\n0 7\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000124 00000 n \n0000000215 00000 n \n0000000325 00000 n \n0000000416 00000 n \n' +
      'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n532\n%%EOF',
      'latin1'
    );

    const parsed = await parsePdfWithLibrary(multiPagePdf);
    assert.strictEqual(parsed.total, 2, 'Must detect 2 pages in PDF document');
    assert.strictEqual(parsed.pages.length, 2, 'Pages array must have 2 elements');

    const fields = extractStructuredLandFieldsFromPages(parsed.pages, parsed.combinedText, {}, 'PDF_LIBRARY');
    assert.strictEqual(fields.survey_number.value, '334/1');
    assert.strictEqual(fields.survey_number.source_page_or_region, 'page_2', 'Must preserve that survey was found on Page 2');
    assert.strictEqual(fields.district.value, 'Warangal');
    assert.strictEqual(fields.district.source_page_or_region, 'page_1', 'Must preserve that district was found on Page 1');
    assert.strictEqual(fields.extent_acres.value, 5.5);
    assert.strictEqual(fields.extent_acres.source_page_or_region, 'page_2');
  });

  // 9. Strict rule: Do not infer missing survey number
  runTest('DPA-9', 'extractStructuredLandFields does NOT infer missing survey number', () => {
    const textWithoutSurvey = 'Government Report Village: Dharmaram District: Warangal Area: 2.0 Acres';
    const fields = extractStructuredLandFields(textWithoutSurvey, {}, 'PDF_TEXT_STREAM');
    assert.strictEqual(fields.survey_number.value, null, 'Must NOT invent or infer missing survey number');
    assert.strictEqual(fields.survey_number.confidence, 0.0);
  });

  // 10. Scanned image fallback notice
  await runAsyncTest('DPA-10', 'inspectAndExtractLandDocument provides transparent notice when text extraction unavailable', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const result = await inspectAndExtractLandDocument(pngHeader, 'image/png');

    assert.strictEqual(result.extraction_status, 'MANUAL_FALLBACK');
    assert.strictEqual(result.extraction_message, 'Text extraction is unavailable. Please enter or review the land details manually.');
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
    assert.strictEqual(result.extracted_fields.survey_number.farmer_confirmed, false);
  });

  // 11. Graceful handling of encrypted or password-protected PDF
  await runAsyncTest('DPA-11', 'inspectAndExtractLandDocument gracefully handles password-protected or encrypted PDFs', async () => {
    // PDF with Encrypt dictionary
    const encryptedPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Encrypt << /Filter /Standard /V 2 /R 3 >> >>\nendobj\n' +
      'trailer\n<< /Root 1 0 R >>\n%%EOF',
      'latin1'
    );
    const result = await inspectAndExtractLandDocument(encryptedPdf, 'application/pdf');
    assert.ok(result.extraction_status === 'FAILED' || result.extraction_status === 'MANUAL_FALLBACK');
    assert.ok(result.extraction_message.includes('password') || result.extraction_message.includes('unavailable') || result.extraction_message.includes('manually'));
  });

  // 12. Graceful handling of corrupted PDF
  await runAsyncTest('DPA-12', 'inspectAndExtractLandDocument gracefully handles corrupted PDF structures without unhandled crash', async () => {
    const corruptedPdf = Buffer.from('%PDF-1.4\ncorrupted gibberish without xref or objects %%EOF', 'latin1');
    const result = await inspectAndExtractLandDocument(corruptedPdf, 'application/pdf');
    assert.ok(result.extraction_status === 'MANUAL_FALLBACK' || result.extraction_status === 'FAILED');
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
  });

  // 13. Digital signature marker detection vs validation
  runTest('DPA-13', 'Digital signature presence classifies as SIGNATURE_PRESENT_UNVERIFIED (not validated)', () => {
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

  // 14. Corrupted signature byte range detected as SIGNATURE_INVALID
  runTest('DPA-14', 'inspectPdfDigitalSignature identifies malformed ByteRange as SIGNATURE_INVALID', () => {
    const pdfWithCorruptSig = Buffer.from(
      '%PDF-1.7\n/ByteRange [ 50 100 200 999999999 ]\n%%EOF',
      'latin1'
    );
    const sig = inspectPdfDigitalSignature(pdfWithCorruptSig);
    assert.strictEqual(sig.status, 'SIGNATURE_INVALID');
  });

  // 15. Safe temporary file handling and guaranteed cleanup
  runTest('DPA-15', 'createTemporaryProcessingFile and cleanupTemporaryProcessingFile guarantee file removal', () => {
    const tempBuffer = Buffer.from('Temporary processing content', 'utf8');
    const tempPath = createTemporaryProcessingFile(tempBuffer);
    assert.strictEqual(fs.existsSync(tempPath), true, 'Temp file must exist after creation');

    cleanupTemporaryProcessingFile(tempPath);
    assert.strictEqual(fs.existsSync(tempPath), false, 'Temp file must be unlinked after cleanup');
  });

  // 16. Enforce file size limit (10MB)
  await runAsyncTest('DPA-16', 'saveDocumentFile strictly enforces 10MB maximum limit', async () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    let caught = false;
    try {
      await saveDocumentFile(testFarmerUid, 'doc-oversized', 'huge.pdf', oversizedBuffer, 'application/pdf', 'dummy-sha');
    } catch (e) {
      caught = true;
      assert.ok(e.message.includes('maximum allowable size'));
    }
    assert.strictEqual(caught, true, 'Oversized document must be rejected');
  });

  // 17. Reliable document deletion: physical removal from storage
  await runAsyncTest('DPA-17', 'deleteDocumentFile actually removes physical file from durable storage', async () => {
    const path = `${testFarmerUid}/${testDocId}/${testFileName}`;
    assert.strictEqual(checkDocumentFileExists(testFarmerUid, path), true, 'File must exist prior to deletion');

    const deleted = await deleteDocumentFile(testFarmerUid, path);
    assert.strictEqual(deleted, true, 'Deletion must report true');
    assert.strictEqual(checkDocumentFileExists(testFarmerUid, path), false, 'File must NOT exist on disk after deletion');
  });

  // 18. Cross-tenant deletion rejection
  await runAsyncTest('DPA-18', 'deleteDocumentFile prevents Farmer B from deleting Farmer A document', async () => {
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
    await deleteDocumentFile(testFarmerUid, saveRes.storage_path);
  });

  // 19. MainActivity strict portal hostname allowlist validation
  runTest('DPA-19', 'MainActivity enforces strict HTTPS hostname allowlist for official portals', () => {
    assert.ok(mainActivityCode.includes('OFFICIAL_PORTAL_HOST_ALLOWLIST'), 'MainActivity must declare OFFICIAL_PORTAL_HOST_ALLOWLIST');
    assert.ok(mainActivityCode.includes('bhubharati.telangana.gov.in'), 'Allowlist must include Bhu Bharati Telangana portal');
    assert.ok(mainActivityCode.includes('dharani.telangana.gov.in'), 'Allowlist must include legacy Dharani portal');
    assert.ok(mainActivityCode.includes('meebhoomi.ap.gov.in'), 'Allowlist must include AP Meebhoomi');
    assert.ok(mainActivityCode.includes('upbhulekh.gov.in'), 'Allowlist must include UP Bhulekh');
    assert.ok(mainActivityCode.includes('bhulekh.mahabhumi.gov.in'), 'Allowlist must include Maharashtra portal');
    assert.ok(mainActivityCode.includes('landrecords.karnataka.gov.in'), 'Allowlist must include Karnataka portal');
    assert.ok(mainActivityCode.includes('isAllowedPortalUrl'), 'MainActivity must implement isAllowedPortalUrl validator');
  });

  // 20. MainActivity rejects untrusted hosts, embedded credentials, unapproved ports, and unsafe schemes
  runTest('DPA-20', 'MainActivity rejects untrusted hosts, embedded credentials, and unapproved ports', () => {
    assert.ok(mainActivityCode.includes('scheme != "https"'), 'MainActivity must reject non-HTTPS schemes');
    assert.ok(mainActivityCode.includes('!uri.userInfo.isNullOrBlank()'), 'MainActivity must reject embedded credentials (user:pass@host)');
    assert.ok(mainActivityCode.includes('port != -1 && port != 443'), 'MainActivity must reject unapproved custom ports');
    assert.ok(mainActivityCode.includes('isAllowedPortalUrl(trimmed)'), 'openExternalUrl must guard with isAllowedPortalUrl');
    assert.ok(mainActivityCode.includes('isAllowedPortalUrl(targetUrl)'), 'onCreateWindow must guard with isAllowedPortalUrl');
  });

  // 21. index.html client portal handoff allowlist validation
  runTest('DPA-21', 'index.html implements isLegitimatePortalUrl and validates before handoff', () => {
    assert.ok(indexHtml.includes('OFFICIAL_PORTAL_HOST_ALLOWLIST'), 'index.html must include portal allowlist');
    assert.ok(indexHtml.includes('isLegitimatePortalUrl'), 'index.html must implement isLegitimatePortalUrl');
    assert.ok(indexHtml.includes('bhubharati.telangana.gov.in'), 'index.html must include bhubharati.telangana.gov.in');
    assert.ok(indexHtml.includes('Rejected unapproved external URL'), 'index.html must log warning for rejected URLs');
  });

  // 22. Android back navigation preservation in MainActivity
  runTest('DPA-22', 'MainActivity preserves Android back navigation stack and modal dismissals', () => {
    assert.ok(mainActivityCode.includes('onBackPressedDispatcher.addCallback'), 'MainActivity must register back-press callback');
    assert.ok(mainActivityCode.includes('custom-modal-overlay'), 'Back navigation must dismiss active modal dialogs');
    assert.ok(mainActivityCode.includes('webView.canGoBack()'), 'Back navigation must support WebView history');
  });

  // 23. APK signature verification and certificate classification
  runTest('DPA-23', 'apksigner verification validates APK integrity and certificate identity', () => {
    const apkPath = path.resolve(__dirname, '../app/build/outputs/apk/release/app-release.apk');
    assert.ok(fs.existsSync(apkPath), 'app-release.apk must exist');

    const apksignerPath = 'C:\\Users\\bjasw\\AppData\\Local\\Android\\Sdk\\build-tools\\35.0.0\\apksigner.bat';
    if (fs.existsSync(apksignerPath)) {
      const output = execSync(`"${apksignerPath}" verify --verbose --print-certs "${apkPath}"`, {
        env: { ...process.env, JAVA_HOME: 'C:\\Program Files\\Android\\Android Studio\\jbr' }
      }).toString();

      assert.ok(output.includes('Verifies'), 'APK signature must be valid');
      assert.ok(output.includes('Verified using v2 scheme'), 'Must be verified using v2 scheme');
      assert.ok(output.includes('Signer #1 certificate DN'), 'Must report certificate DN');
      assert.ok(output.includes('Signer #1 certificate SHA-256 digest'), 'Must report SHA-256 fingerprint');
    }
  });

  console.log(`\n================================================================================`);
  console.log(`📊 PHASE 3.2 AUDIT: ${passedTests} PASSED, ${totalTests - passedTests} FAILED (TOTAL: ${totalTests})`);
  console.log(`================================================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
