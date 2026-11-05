/**
 * NuKropAI Agrarian OS — Document Extraction & Digital Signature Inspection Engine
 * Strictly adheres to:
 * 1. Privacy minimization: Extracts ONLY agricultural parcel attributes (no Aadhaar/bank PII).
 * 2. Magic byte file signature validation (prevents MIME spoofing).
 * 3. Real text stream extraction from digital PDFs via zlib inflate stream parsing.
 * 4. Transparent OCR / manual fallback notice when OCR is unavailable:
 *    "Text extraction is unavailable. Please enter or review the land details manually."
 * 5. Distinct digital signature statuses (differentiating detected markers from verified trust chains).
 * 6. "Do not infer a missing survey number" rule.
 */

import * as zlib from 'zlib';

export type DigitalSignatureStatus =
  | 'NO_SIGNATURE_DETECTED'
  | 'SIGNATURE_PRESENT_UNVERIFIED'
  | 'DIGITAL_SIGNATURE_VALIDATED'
  | 'SIGNATURE_INVALID';

export interface ExtractedFieldItem<T = string | number | null> {
  value: T;
  extraction_method: 'PDF_TEXT_STREAM' | 'LOCAL_OCR' | 'MANUAL_FALLBACK' | 'USER_CONFIRMED';
  confidence: number;
  source_page_or_region: string;
  farmer_confirmed: boolean;
}

export interface StructuredLandExtraction {
  survey_number: ExtractedFieldItem<string | null>;
  subdivision: ExtractedFieldItem<string | null>;
  district: ExtractedFieldItem<string | null>;
  mandal: ExtractedFieldItem<string | null>;
  village: ExtractedFieldItem<string | null>;
  extent_acres: ExtractedFieldItem<number | null>;
  document_reference: ExtractedFieldItem<string | null>;
  raw_text_excerpt: string;
}

export interface DocumentInspectionResult {
  file_format: 'PDF' | 'PNG' | 'JPEG';
  magic_bytes_valid: boolean;
  extraction_status: 'SUCCESS' | 'PARTIAL' | 'MANUAL_FALLBACK' | 'FAILED';
  extraction_message: string;
  extracted_fields: StructuredLandExtraction;
  signature_status: DigitalSignatureStatus;
  signature_details: {
    status: DigitalSignatureStatus;
    marker_present: boolean;
    trust_chain_verified: boolean;
    byte_range?: number[];
    explanation: string;
  };
}

/**
 * Validates actual magic bytes against reported MIME type.
 * Prevents MIME spoofing and disguised executables.
 */
export function verifyFileSignature(buffer: Buffer, reportedMime: string): { valid: boolean; format: 'PDF' | 'PNG' | 'JPEG'; error?: string } {
  if (!buffer || buffer.length < 8) {
    return { valid: false, format: 'PDF', error: 'File is too small to determine file signature.' };
  }

  const mime = reportedMime.toLowerCase().trim();

  // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D) {
    if (mime !== 'application/pdf') {
      return { valid: false, format: 'PDF', error: `MIME type mismatch: Content is PDF but declared as ${reportedMime}` };
    }
    return { valid: true, format: 'PDF' };
  }

  // PNG magic bytes: \x89PNG\r\n\x1a\n (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 && buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    if (mime !== 'image/png') {
      return { valid: false, format: 'PNG', error: `MIME type mismatch: Content is PNG but declared as ${reportedMime}` };
    }
    return { valid: true, format: 'PNG' };
  }

  // JPEG magic bytes: \xFF\xD8\xFF (0xFF 0xD8 0xFF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    if (mime !== 'image/jpeg' && mime !== 'image/jpg') {
      return { valid: false, format: 'JPEG', error: `MIME type mismatch: Content is JPEG but declared as ${reportedMime}` };
    }
    return { valid: true, format: 'JPEG' };
  }

  return {
    valid: false,
    format: 'PDF',
    error: `FILE_SIGNATURE_MISMATCH: Buffer header does not match accepted PDF, PNG, or JPEG magic numbers.`
  };
}

/**
 * Inspects PDF digital signature structure and ByteRange.
 * Distinctly classifies:
 * - NO_SIGNATURE_DETECTED
 * - SIGNATURE_PRESENT_UNVERIFIED
 * - DIGITAL_SIGNATURE_VALIDATED
 * - SIGNATURE_INVALID
 */
export function inspectPdfDigitalSignature(buffer: Buffer): {
  status: DigitalSignatureStatus;
  marker_present: boolean;
  trust_chain_verified: boolean;
  byte_range?: number[];
  explanation: string;
} {
  const text = buffer.toString('latin1');
  const byteRangeMatch = text.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);

  if (!byteRangeMatch) {
    return {
      status: 'NO_SIGNATURE_DETECTED',
      marker_present: false,
      trust_chain_verified: false,
      explanation: 'No digital signature dictionary or ByteRange found in document structure.'
    };
  }

  const offset1 = parseInt(byteRangeMatch[1], 10);
  const len1 = parseInt(byteRangeMatch[2], 10);
  const offset2 = parseInt(byteRangeMatch[3], 10);
  const len2 = parseInt(byteRangeMatch[4], 10);

  // Validate ByteRange consistency against file length
  if (offset1 !== 0 || offset2 < len1 || (offset2 + len2) > buffer.length) {
    return {
      status: 'SIGNATURE_INVALID',
      marker_present: true,
      trust_chain_verified: false,
      byte_range: [offset1, len1, offset2, len2],
      explanation: 'Signature ByteRange array is malformed or exceeds document byte bounds.'
    };
  }

  // Signature marker exists. In client/offline context without bilateral government Root CA trust store,
  // we strictly classify as SIGNATURE_PRESENT_UNVERIFIED.
  // The presence of /ByteRange or adbe.pkcs7 is NOT cryptographic signature validation.
  return {
    status: 'SIGNATURE_PRESENT_UNVERIFIED',
    marker_present: true,
    trust_chain_verified: false,
    byte_range: [offset1, len1, offset2, len2],
    explanation: 'Digital signature marker detected (/ByteRange, /Contents). Certificate trust chain has not been cryptographically verified against official government trust store. Presence of signature does not infer legal ownership.'
  };
}

/**
 * Extracts raw textual streams from a PDF buffer.
 * Decompresses /FlateDecode streams using zlib.inflateSync.
 */
export function extractTextStreamsFromPdf(buffer: Buffer): string {
  const contentLatin1 = buffer.toString('latin1');
  let extractedText = '';

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(contentLatin1)) !== null) {
    const streamStart = match.index + match[0].indexOf('\n') + 1;
    const streamEnd = match.index + match[0].lastIndexOf('\nendstream');
    const rawStreamBuffer = buffer.subarray(streamStart, streamEnd > streamStart ? streamEnd : streamStart + match[1].length);

    // Look backward from streamStart to check if stream is /FlateDecode compressed
    const headerSlice = contentLatin1.slice(Math.max(0, match.index - 300), match.index);
    let decompressed: Buffer | null = null;

    if (headerSlice.includes('/FlateDecode') || headerSlice.includes('/Fl')) {
      try {
        decompressed = zlib.inflateSync(rawStreamBuffer);
      } catch (e) {
        try {
          decompressed = zlib.inflateRawSync(rawStreamBuffer);
        } catch (e2) {
          decompressed = null;
        }
      }
    } else {
      decompressed = rawStreamBuffer;
    }

    if (decompressed) {
      const streamStr = decompressed.toString('utf8');
      // Extract strings inside parentheses for text operators (str) Tj or [(str1)(str2)] TJ
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(streamStr)) !== null) {
        extractedText += ' ' + tjMatch[1];
      }

      const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = tjArrayRegex.exec(streamStr)) !== null) {
        const innerStrings = arrMatch[1].match(/\(([^)]+)\)/g);
        if (innerStrings) {
          extractedText += ' ' + innerStrings.map(s => s.slice(1, -1)).join('');
        }
      }

      // If stream contains plain text keywords like Survey or District directly
      if (streamStr.includes('Survey') || streamStr.includes('District') || streamStr.includes('Pahani')) {
        extractedText += ' ' + streamStr;
      }
    }
  }

  // Also search directly in latin1 representation for uncompressed metadata
  const textTokens = contentLatin1.match(/\b(?:Survey|Khasra|District|Mandal|Village|Acres?|Khata|Pattadar|Telangana|Andhra|Bhulekh)\b[^\r\n]*/gi);
  if (textTokens) {
    extractedText += ' ' + textTokens.join(' ');
  }

  return extractedText.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts structured land fields from raw document text.
 * Rule: "Do not infer a missing survey number."
 */
export function extractStructuredLandFields(
  rawText: string,
  declared: {
    declared_survey_number?: string;
    declared_subdivision?: string;
    declared_extent_acres?: number;
    declared_village?: string;
    declared_mandal?: string;
    declared_district?: string;
  } = {},
  method: 'PDF_TEXT_STREAM' | 'MANUAL_FALLBACK' = 'PDF_TEXT_STREAM'
): StructuredLandExtraction {
  // 1. Survey Number
  let surveyVal: string | null = null;
  let surveyConf = 0.0;
  const surveyMatch = rawText.match(/\b(?:Survey|Sy|S\.No|Khasra|ఖస్రా|సర్వే|खसरा)\s*(?:No\.?|Number)?\s*[:.\-]?\s*([0-9]+(?:\/[0-9A-Za-z]+)?)\b/i);

  if (surveyMatch && surveyMatch[1]) {
    surveyVal = surveyMatch[1].trim();
    surveyConf = 0.90;
  } else if (declared.declared_survey_number) {
    surveyVal = declared.declared_survey_number.trim();
    surveyConf = 0.50;
  }

  // 2. Subdivision
  let subdivVal: string | null = null;
  let subdivConf = 0.0;
  const subdivMatch = rawText.match(/\b(?:Sub-?\s*division|Sub-?\s*div|హిస్సా|उपविभाग)\s*[:.\-]?\s*([0-9A-Za-z]+)\b/i);
  if (subdivMatch && subdivMatch[1]) {
    subdivVal = subdivMatch[1].trim();
    subdivConf = 0.85;
  } else if (declared.declared_subdivision) {
    subdivVal = declared.declared_subdivision.trim();
    subdivConf = 0.50;
  }

  // 3. District
  let distVal: string | null = null;
  let distConf = 0.0;
  const distMatch = rawText.match(/\b(?:District|Dist|జిల్లా|जिला)\s*[:.\-]?\s*([A-Za-z]{3,25})\b/i);
  if (distMatch && distMatch[1]) {
    distVal = distMatch[1].trim();
    distConf = 0.80;
  } else if (declared.declared_district) {
    distVal = declared.declared_district.trim();
    distConf = 0.50;
  }

  // 4. Mandal
  let mandalVal: string | null = null;
  let mandalConf = 0.0;
  const mandalMatch = rawText.match(/\b(?:Mandal|Taluk|Tahsil|మండలం|तहसील)\s*[:.\-]?\s*([A-Za-z]{3,25})\b/i);
  if (mandalMatch && mandalMatch[1]) {
    mandalVal = mandalMatch[1].trim();
    mandalConf = 0.80;
  } else if (declared.declared_mandal) {
    mandalVal = declared.declared_mandal.trim();
    mandalConf = 0.50;
  }

  // 5. Village
  let villageVal: string | null = null;
  let villageConf = 0.0;
  const villageMatch = rawText.match(/\b(?:Village|Rev\.?\s*Village|గ్రామం|गांव)\s*[:.\-]?\s*([A-Za-z]{3,25})\b/i);
  if (villageMatch && villageMatch[1]) {
    villageVal = villageMatch[1].trim();
    villageConf = 0.80;
  } else if (declared.declared_village) {
    villageVal = declared.declared_village.trim();
    villageConf = 0.50;
  }

  // 6. Extent Acres
  let extentVal: number | null = null;
  let extentConf = 0.0;
  const extentMatch = rawText.match(/\b(?:Extent|Area|విస్తీర్ణం|Total\s*Area)\s*[:.\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Ac|Acres|Guntas|ఎకరాలు)?\b/i);
  if (extentMatch && extentMatch[1]) {
    extentVal = parseFloat(extentMatch[1]);
    extentConf = 0.85;
  } else if (declared.declared_extent_acres) {
    extentVal = declared.declared_extent_acres;
    extentConf = 0.50;
  }

  // 7. Document Reference
  let docRefVal: string | null = null;
  let docRefConf = 0.0;
  const refMatch = rawText.match(/\b(?:Passbook|Khata|ఖాతా|खाता|Doc|RoR)\s*(?:No\.?|ID)?\s*[:.\-]?\s*([0-9A-Za-z\/-]{3,20})\b/i);
  if (refMatch && refMatch[1]) {
    docRefVal = refMatch[1].trim();
    docRefConf = 0.75;
  }

  return {
    survey_number: {
      value: surveyVal,
      extraction_method: surveyConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: surveyConf,
      source_page_or_region: surveyConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    subdivision: {
      value: subdivVal,
      extraction_method: subdivConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: subdivConf,
      source_page_or_region: subdivConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    district: {
      value: distVal,
      extraction_method: distConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: distConf,
      source_page_or_region: distConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    mandal: {
      value: mandalVal,
      extraction_method: mandalConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: mandalConf,
      source_page_or_region: mandalConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    village: {
      value: villageVal,
      extraction_method: villageConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: villageConf,
      source_page_or_region: villageConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    extent_acres: {
      value: extentVal,
      extraction_method: extentConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: extentConf,
      source_page_or_region: extentConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    document_reference: {
      value: docRefVal,
      extraction_method: docRefConf > 0.6 ? method : 'MANUAL_FALLBACK',
      confidence: docRefConf,
      source_page_or_region: docRefConf > 0.6 ? 'stream_text' : 'declared_input',
      farmer_confirmed: false
    },
    raw_text_excerpt: rawText.slice(0, 300)
  };
}

/**
 * Master Document Inspection & Extraction pipeline:
 * Verifies magic bytes, checks signatures, extracts text streams from PDF,
 * or safely falls back for scanned documents/images with transparent disclosures.
 */
export async function inspectAndExtractLandDocument(
  buffer: Buffer,
  reportedMime: string,
  declaredFields: {
    declared_survey_number?: string;
    declared_subdivision?: string;
    declared_extent_acres?: number;
    declared_village?: string;
    declared_mandal?: string;
    declared_district?: string;
  } = {}
): Promise<DocumentInspectionResult> {
  // Step 1: Magic byte validation
  const sig = verifyFileSignature(buffer, reportedMime);
  if (!sig.valid) {
    throw new Error(sig.error || 'FILE_SIGNATURE_MISMATCH');
  }

  // Step 2: Digital signature inspection
  let signatureInfo = {
    status: 'NO_SIGNATURE_DETECTED' as DigitalSignatureStatus,
    marker_present: false,
    trust_chain_verified: false,
    explanation: 'Image files do not contain PDF digital signature dictionaries.'
  };

  let extractedFields: StructuredLandExtraction;
  let extractionStatus: 'SUCCESS' | 'PARTIAL' | 'MANUAL_FALLBACK' | 'FAILED' = 'MANUAL_FALLBACK';
  let extractionMessage = '';

  if (sig.format === 'PDF') {
    signatureInfo = inspectPdfDigitalSignature(buffer);

    // Extract text from PDF streams
    const streamText = extractTextStreamsFromPdf(buffer);

    if (streamText && streamText.length > 20) {
      extractedFields = extractStructuredLandFields(streamText, declaredFields, 'PDF_TEXT_STREAM');
      if (extractedFields.survey_number.value && extractedFields.village.value) {
        extractionStatus = 'SUCCESS';
        extractionMessage = 'Text successfully extracted from digital PDF streams. Please review and confirm your details.';
      } else {
        extractionStatus = 'PARTIAL';
        extractionMessage = 'Partial text stream extracted from PDF. Please review and complete missing survey details.';
      }
    } else {
      // Scanned PDF (no digital text streams)
      extractionStatus = 'MANUAL_FALLBACK';
      extractionMessage = 'Text extraction is unavailable. Please enter or review the land details manually.';
      extractedFields = extractStructuredLandFields('', declaredFields, 'MANUAL_FALLBACK');
    }
  } else {
    // Images (PNG, JPEG) — Scanned photo of passbook/RoR
    extractionStatus = 'MANUAL_FALLBACK';
    extractionMessage = 'Text extraction is unavailable. Please enter or review the land details manually.';
    extractedFields = extractStructuredLandFields('', declaredFields, 'MANUAL_FALLBACK');
  }

  return {
    file_format: sig.format,
    magic_bytes_valid: true,
    extraction_status: extractionStatus,
    extraction_message: extractionMessage,
    extracted_fields: extractedFields,
    signature_status: signatureInfo.status,
    signature_details: signatureInfo
  };
}
