/**
 * NuKropAI Agrarian OS — Phase 3.3 Acceptance Suite: PDF Extraction & Scanned Document Acceptance
 * Validates the 7 required extraction acceptance scenarios:
 * 1. Multi-page text PDF (page_1, page_2 extraction and page reference attribution)
 * 2. Compressed PDF streams (/FlateDecode decompression)
 * 3. PDF with no survey number (never infer missing survey numbers, survey_number.value === null)
 * 4. Password-protected / encrypted PDF (fails gracefully with actionable farmer guidance)
 * 5. Corrupted PDF structure (fails safely without unhandled process exception)
 * 6. Scanned PDF without digital text layer (honest MANUAL_FALLBACK: "Text extraction is unavailable. Please enter or review the land details manually.")
 * 7. Scanned Image document PNG/JPEG (honest MANUAL_FALLBACK, no fake OCR claim, farmer confirmation required)
 */

const assert = require('assert');
const zlib = require('zlib');
const path = require('path');

// Target the compiled or source service
let service;
try {
  service = require('../backend/src/services/pdfExtractionService');
} catch (e) {
  // If running directly against ts-node or compiled backend
  try {
    service = require('../backend/dist/services/pdfExtractionService');
  } catch (err) {
    console.error('Failed to load pdfExtractionService:', err.message);
    process.exit(1);
  }
}

const {
  verifyFileSignature,
  inspectPdfDigitalSignature,
  inspectAndExtractLandDocument,
  extractStructuredLandFieldsFromPages
} = service;

async function runAcceptanceTests() {
  console.log('='.repeat(80));
  console.log('📄 PHASE 3.3 ACCEPTANCE SUITE: PDF EXTRACTION & SCANNED DOCUMENT RESILIENCE');
  console.log('='.repeat(80));

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}:`, err.message);
      process.exitCode = 1;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}:`, err.message);
      process.exitCode = 1;
    }
  }

  // --- Helpers to build test PDF structures ---
  function createMinimalPdfWithStream(streamContent, isCompressed = false) {
    let streamBytes = Buffer.from(streamContent, 'utf8');
    let filter = '';
    if (isCompressed) {
      streamBytes = zlib.deflateSync(streamBytes);
      filter = '/Filter /FlateDecode\n';
    }

    const pdfTemplate = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBytes.length}
${filter}>>
stream
`;
    const header = Buffer.from(pdfTemplate, 'utf8');
    const footer = Buffer.from('\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF\n', 'utf8');
    return Buffer.concat([header, streamBytes, footer]);
  }

  // Case 1: Multi-page text PDF & Page Reference Attribution
  test('Case 1: Multi-page document extracts fields with exact page attribution (page_1, page_2)', () => {
    const mockPages = [
      { pageNumber: 1, text: 'Government of Telangana Revenue Dept. District: Warangal Mandal: Hanamkonda' },
      { pageNumber: 2, text: 'Record of Rights Survey No: 142/A Sub-division: 2 Extent: 4.5 Acres Village: Kazipet' }
    ];

    const extracted = extractStructuredLandFieldsFromPages(mockPages, '');
    assert.strictEqual(extracted.district.value, 'Warangal');
    assert.strictEqual(extracted.district.source_page_or_region, 'page_1');
    assert.strictEqual(extracted.mandal.value, 'Hanamkonda');
    assert.strictEqual(extracted.mandal.source_page_or_region, 'page_1');

    assert.strictEqual(extracted.survey_number.value, '142/A');
    assert.strictEqual(extracted.survey_number.source_page_or_region, 'page_2');
    assert.strictEqual(extracted.subdivision.value, '2');
    assert.strictEqual(extracted.subdivision.source_page_or_region, 'page_2');
    assert.strictEqual(extracted.extent_acres.value, 4.5);
    assert.strictEqual(extracted.extent_acres.source_page_or_region, 'page_2');
    assert.strictEqual(extracted.village.value, 'Kazipet');
    assert.strictEqual(extracted.village.source_page_or_region, 'page_2');

    // Never pre-confirm without farmer explicit action
    assert.strictEqual(extracted.survey_number.farmer_confirmed, false);
  });

  // Case 2: Compressed PDF streams (/FlateDecode)
  await testAsync('Case 2: Compressed /FlateDecode PDF decompresses and extracts text correctly', async () => {
    const streamContent = 'BT /F1 12 Tf (Survey No: 305/B District: Nalgonda Mandal: Miryalaguda Village: Alwal Extent: 2.75 Acres) Tj ET';
    const compressedPdfBuffer = createMinimalPdfWithStream(streamContent, true);

    const result = await inspectAndExtractLandDocument(compressedPdfBuffer, 'application/pdf');
    assert.strictEqual(result.magic_bytes_valid, true);
    assert.strictEqual(result.file_format, 'PDF');
    assert.strictEqual(result.extracted_fields.survey_number.value, '305/B');
    assert.strictEqual(result.extracted_fields.district.value, 'Nalgonda');
    assert.strictEqual(result.extracted_fields.mandal.value, 'Miryalaguda');
    assert.strictEqual(result.extracted_fields.village.value, 'Alwal');
    assert.strictEqual(result.extracted_fields.extent_acres.value, 2.75);
    assert.strictEqual(result.extracted_fields.survey_number.farmer_confirmed, false);
  });

  // Case 3: PDF with no survey number (Must NEVER invent or infer a survey number)
  await testAsync('Case 3: PDF without survey number sets survey_number.value to null and requires manual entry', async () => {
    const streamContent = 'BT /F1 12 Tf (Agricultural Subsidy Notice: District: Karimnagar Mandal: Manakondur Village: Chenjarla) Tj ET';
    const pdfBuffer = createMinimalPdfWithStream(streamContent, false);

    const result = await inspectAndExtractLandDocument(pdfBuffer, 'application/pdf');
    assert.strictEqual(result.magic_bytes_valid, true);
    assert.strictEqual(result.extracted_fields.survey_number.value, null, 'Survey number must NEVER be inferred or guessed');
    assert.strictEqual(result.extracted_fields.survey_number.extraction_method, 'MANUAL_FALLBACK');
    assert.strictEqual(result.extracted_fields.survey_number.confidence, 0.0);
    assert.strictEqual(result.extracted_fields.survey_number.farmer_confirmed, false);
    // Partial status because survey number is missing
    assert.strictEqual(result.extraction_status, 'PARTIAL');
  });

  // Case 4: Password-protected or encrypted PDF
  await testAsync('Case 4: Password-protected PDF fails gracefully with actionable farmer guidance', async () => {
    // Encrypted PDF structure
    const encryptedPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\ntrailer\n<< /Encrypt << /Filter /Standard /V 2 /R 3 /U (userpass) >> /Root 1 0 R >>\nstartxref\n150\n%%EOF`;
    const encryptedBuffer = Buffer.from(encryptedPdfContent, 'utf8');

    const result = await inspectAndExtractLandDocument(encryptedBuffer, 'application/pdf');
    assert.strictEqual(result.magic_bytes_valid, true);
    assert.strictEqual(result.extraction_status, 'FAILED');
    assert.ok(result.extraction_message.includes('password-protected') || result.extraction_message.includes('enter land details manually'));
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
    assert.strictEqual(result.extracted_fields.survey_number.farmer_confirmed, false);
  });

  // Case 5: Corrupted PDF structure
  await testAsync('Case 5: Corrupted PDF structure is caught gracefully without server crash', async () => {
    const corruptedBuffer = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog', 'utf8'),
      Buffer.from([0x00, 0xFF, 0xDE, 0xAD, 0xBE, 0xEF]),
      Buffer.from('CORRUPTED_GARBAGE_BYTES_NO_XREF_NO_TRAILER', 'utf8')
    ]);

    const result = await inspectAndExtractLandDocument(corruptedBuffer, 'application/pdf');
    assert.strictEqual(result.magic_bytes_valid, true);
    assert.strictEqual(result.file_format, 'PDF');
    // Corrupted file falls back gracefully to manual entry without throwing unhandled exception
    assert.strictEqual(result.extraction_status, 'MANUAL_FALLBACK');
    assert.ok(result.extraction_message.includes('manually'));
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
  });

  // Case 6: Scanned PDF without digital text layer (honest fallback notice)
  await testAsync('Case 6: Scanned PDF without text stream triggers honest MANUAL_FALLBACK', async () => {
    const emptyScanStream = 'q /Im1 Do Q'; // Pure image drawing operator, zero Tj/TJ text
    const scannedPdfBuffer = createMinimalPdfWithStream(emptyScanStream, false);

    const result = await inspectAndExtractLandDocument(scannedPdfBuffer, 'application/pdf');
    assert.strictEqual(result.magic_bytes_valid, true);
    assert.strictEqual(result.extraction_status, 'MANUAL_FALLBACK');
    assert.strictEqual(
      result.extraction_message,
      'Text extraction is unavailable. Please enter or review the land details manually.'
    );
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
    assert.strictEqual(result.extracted_fields.survey_number.confidence, 0.0);
    assert.strictEqual(result.extracted_fields.survey_number.extraction_method, 'MANUAL_FALLBACK');
  });

  // Case 7: Image Document (PNG / JPEG)
  await testAsync('Case 7: Image documents (PNG/JPEG) trigger honest MANUAL_FALLBACK with zero fake OCR claims', async () => {
    // Valid PNG magic bytes + dummy chunks
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // Magic PNG
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR header
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    const result = await inspectAndExtractLandDocument(pngBuffer, 'image/png');
    assert.strictEqual(result.magic_bytes_valid, true);
    assert.strictEqual(result.file_format, 'PNG');
    assert.strictEqual(result.extraction_status, 'MANUAL_FALLBACK');
    assert.strictEqual(
      result.extraction_message,
      'Text extraction is unavailable. Please enter or review the land details manually.'
    );
    assert.strictEqual(result.extracted_fields.survey_number.value, null);
    assert.strictEqual(result.extracted_fields.survey_number.confidence, 0.0);
    assert.strictEqual(result.extracted_fields.survey_number.farmer_confirmed, false);
    assert.strictEqual(result.signature_status, 'NO_SIGNATURE_DETECTED');
  });

  console.log('='.repeat(80));
  console.log(`📊 ACCEPTANCE SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED (TOTAL: ${total})`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runAcceptanceTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
