import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { pool } from '../config/db';

// In-memory fallback for uploaded documents when local development PostgreSQL is offline
const memoryDocuments = new Map<string, any>();

/**
 * GET /api/v1/land-survey/coverage
 *
 * Returns all government data sources in our registry with their permission status.
 * This is a transparency endpoint — farmers can see exactly what sources we use
 * and why some are blocked.
 */
export async function getLandSurveyCoverage(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const result = await pool.query(
      `SELECT public.get_land_survey_coverage() AS coverage`
    );
    return reply.send(result.rows[0]?.coverage || buildOfflineCoverageResponse());
  } catch (err: any) {
    request.log.warn({ err }, 'DB offline for land survey coverage; using static registry');
    return reply.send(buildOfflineCoverageResponse());
  }
}

/**
 * GET /api/v1/land-survey/search
 *
 * Searches authorized parcel dataset. Returns real records from APPROVED sources only.
 * Currently returns empty results with honest explanation because no source is APPROVED yet.
 */
export async function searchLandParcels(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const {
    state, district, mandal, village,
    survey_number, subdivision,
    limit = '20', offset = '0'
  } = (request.query as any) || {};

  if (!state || typeof state !== 'string') {
    return reply.status(400).send({
      success: false,
      error: 'State code is required (e.g. TS, AP, MH, KA, UP)'
    });
  }

  const stateCode = state.toUpperCase().trim();
  const limitNum = Math.min(Math.max(1, parseInt(limit as string, 10) || 20), 100);
  const offsetNum = Math.max(0, parseInt(offset as string, 10) || 0);

  try {
    const result = await pool.query(
      `SELECT * FROM public.search_land_parcels($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        stateCode,
        district ? district.trim() : null,
        mandal ? mandal.trim() : null,
        village ? village.trim() : null,
        survey_number ? survey_number.trim() : null,
        subdivision ? subdivision.trim() : null,
        limitNum,
        offsetNum
      ]
    );

    const rows = result.rows;

    if (rows.length === 0) {
      return reply.send({
        success: true,
        data: [],
        total: 0,
        page: { limit: limitNum, offset: offsetNum },
        message: 'Your land record is not currently available in NuKropAI\'s authorized dataset. You can open the official government portal to check your details.',
        availability_notice: {
          status: 'NO_RECORDS_IN_AUTHORIZED_DATASET',
          message: `Your land record is not currently available in NuKropAI's authorized dataset. You can open the official government portal to check your details. All official portals are PENDING_AUTHORIZATION for automated data collection.`,
          what_to_do: [
            'You can visit the official government portal directly using the links below.',
            'You can upload your official RoR / Pahani document to import and save your parcel record.',
            'You can link your parcel manually — it will be tagged FARMER_CLAIMED (not government-verified).'
          ],
          official_portals: getOfficialPortalsForState(stateCode)
        }
      });
    }

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        survey_number: r.survey_number,
        subdivision_number: r.subdivision_number,
        state_code: r.state_code,
        district_name: r.district_name,
        mandal_name: r.mandal_name,
        village_name: r.village_name,
        area_acres: r.area_acres,
        land_classification: r.land_classification,
        verification_status: r.verification_status,
        has_geometry: r.has_geometry,
        source_name: r.source_name,
        official_portal_url: r.official_portal_url
      })),
      total: rows[0]?.total_count || rows.length,
      page: { limit: limitNum, offset: offsetNum }
    });
  } catch (err: any) {
    request.log.warn({ err }, 'Search parcels DB error; returning honest empty state');
    return reply.send({
      success: true,
      data: [],
      total: 0,
      page: { limit: limitNum, offset: offsetNum },
      message: 'Your land record is not currently available in NuKropAI\'s authorized dataset. You can open the official government portal to check your details.',
      availability_notice: {
        status: 'DATABASE_UNAVAILABLE',
        message: 'Your land record is not currently available in NuKropAI\'s authorized dataset. You can open the official government portal to check your details.',
        official_portals: getOfficialPortalsForState(state.toUpperCase())
      }
    });
  }
}

/**
 * GET /api/v1/land-survey/parcels/:id
 */
export async function getParcelById(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = (request.params as any) || {};
  if (!isValidUUID(id)) {
    return reply.status(400).send({ success: false, error: 'Invalid parcel ID format' });
  }

  try {
    const result = await pool.query(
      `SELECT lp.id, lp.parcel_id, lp.state_code, lp.district_name,
              lp.mandal_name, lp.village_name, lp.survey_number,
              lp.subdivision_number, lp.area_acres, lp.land_classification,
              lp.soil_type, lp.owner_full_name, lp.verification_status,
              lp.source_record_id, lp.source_url, lp.collection_method,
              lp.scraped_at, lp.source_published_at, lp.source_updated_at,
              lp.last_synced_at, lp.data_version,
              (lp.boundary_geom IS NOT NULL) AS is_geometry_available,
              lds.source_name, lds.official_url AS official_portal_url,
              lds.department AS government_department
       FROM public.land_parcels lp
       LEFT JOIN public.land_data_sources lds ON lp.data_source_id = lds.id
       WHERE lp.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return reply.status(404).send({ success: false, error: 'Parcel not found in authorized dataset' });
    }

    const p = result.rows[0];
    return reply.send({
      success: true,
      parcel: {
        id: p.id,
        survey_number: p.survey_number,
        subdivision_number: p.subdivision_number,
        state_code: p.state_code,
        location: {
          district: p.district_name,
          mandal: p.mandal_name,
          village: p.village_name
        },
        area_acres: p.area_acres,
        land_classification: p.land_classification,
        soil_type: p.soil_type,
        owner_full_name: p.owner_full_name,
        verification: {
          status: p.verification_status,
          meaning: getVerificationMeaning(p.verification_status)
        },
        provenance: {
          source_name: p.source_name,
          source_record_id: p.source_record_id,
          source_url: p.source_url,
          official_portal_url: p.official_portal_url,
          government_department: p.government_department,
          collection_method: p.collection_method,
          dates: {
            government_record_updated: p.source_updated_at || null,
            government_record_published: p.source_published_at || null,
            nukropai_collection_date: p.scraped_at || null,
            nukropai_last_sync: p.last_synced_at || null
          },
          data_version: p.data_version
        },
        has_geometry: p.is_geometry_available
      }
    });
  } catch (err: any) {
    request.log.error({ err }, 'Get parcel by ID error');
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

/**
 * GET /api/v1/land-survey/parcels/:id/provenance
 */
export async function getParcelProvenance(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = (request.params as any) || {};
  if (!isValidUUID(id)) {
    return reply.status(400).send({ success: false, error: 'Invalid parcel ID format' });
  }

  try {
    const [parcelResult, historyResult] = await Promise.all([
      pool.query(
        `SELECT lp.id, lp.parcel_id, lp.state_code, lp.survey_number,
                lp.source_record_id, lp.source_url, lp.collection_method,
                lp.scraped_at, lp.source_published_at, lp.source_updated_at,
                lp.last_synced_at, lp.content_hash, lp.data_version,
                lp.verification_status, lp.geometry_source,
                lp.geometry_verified_at, lp.is_geometry_approximate,
                lp.data_quality_notes,
                lds.source_name, lds.official_url, lds.department,
                lds.permission_status
         FROM public.land_parcels lp
         LEFT JOIN public.land_data_sources lds ON lp.data_source_id = lds.id
         WHERE lp.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT data_version, change_type, change_notes, changed_at
         FROM public.land_parcel_history
         WHERE parcel_id = $1
         ORDER BY data_version DESC LIMIT 10`,
        [id]
      )
    ]);

    if (!parcelResult.rows.length) {
      return reply.status(404).send({ success: false, error: 'Parcel not found' });
    }

    const parcel = parcelResult.rows[0];

    return reply.send({
      success: true,
      provenance: {
        parcel_id: parcel.id,
        survey_number: parcel.survey_number,
        dates: {
          government_record_updated: parcel.source_updated_at || null,
          government_record_published: parcel.source_published_at || null,
          nukropai_collection_date: parcel.scraped_at || null,
          nukropai_last_sync: parcel.last_synced_at || null,
          government_date_disclosure: parcel.source_updated_at
            ? 'Government update date provided by source'
            : 'Government update date not disclosed by source'
        },
        source: {
          name: parcel.source_name || 'Unknown source',
          department: parcel.department || null,
          official_url: parcel.official_url || null,
          original_record_url: parcel.source_url || null,
          original_record_id: parcel.source_record_id || null,
          collection_method: parcel.collection_method || null,
          permission_status: parcel.permission_status || 'UNKNOWN'
        },
        verification: {
          status: parcel.verification_status,
          meaning: getVerificationMeaning(parcel.verification_status)
        },
        geometry_provenance: {
          source: parcel.geometry_source || null,
          is_approximate: parcel.is_geometry_approximate || false,
          verified_at: parcel.geometry_verified_at || null,
          crs: 'EPSG:4326'
        },
        data_quality: parcel.data_quality_notes,
        content_hash: parcel.content_hash || null,
        data_version: parcel.data_version || 1,
        version_history: historyResult.rows
      }
    });
  } catch (err: any) {
    request.log.error({ err }, 'Get parcel provenance error');
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

/**
 * GET /api/v1/land-survey/parcels/:id/geometry
 */
export async function getParcelGeometry(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = (request.params as any) || {};
  if (!isValidUUID(id)) {
    return reply.status(400).send({ success: false, error: 'Invalid parcel ID format' });
  }

  try {
    const result = await pool.query(
      `SELECT lp.id, lp.survey_number, lp.state_code,
              lp.is_geometry_approximate, lp.geometry_source,
              ST_AsGeoJSON(lp.boundary_geom::geometry)::jsonb AS geojson,
              ST_Y(lp.center_point::geometry) AS center_lat,
              ST_X(lp.center_point::geometry) AS center_lon
       FROM public.land_parcels lp
       WHERE lp.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return reply.status(404).send({ success: false, error: 'Parcel not found' });
    }

    const row = result.rows[0];

    if (!row.geojson) {
      return reply.status(404).send({
        success: false,
        error: 'Geometry not available for this parcel',
        error_code: 'GEOMETRY_UNAVAILABLE',
        explanation: 'The government source for this parcel did not provide boundary geometry. Survey information is available but no parcel polygon can be displayed.',
        parcel_id: id,
        survey_number: row.survey_number
      });
    }

    return reply.send({
      success: true,
      geometry: {
        type: 'Feature',
        properties: {
          parcel_id: row.id,
          survey_number: row.survey_number,
          state_code: row.state_code,
          is_approximate: row.is_geometry_approximate || false,
          geometry_source: row.geometry_source || null,
          crs: 'EPSG:4326'
        },
        geometry: row.geojson
      },
      center: row.center_lat != null && row.center_lon != null
        ? { lat: row.center_lat, lon: row.center_lon }
        : null
    });
  } catch (err: any) {
    request.log.error({ err }, 'Get parcel geometry error');
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

/**
 * POST /api/v1/land-survey/parcels/:id/claim
 */
export async function claimParcel(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = (request.params as any) || {};
  const authUid = (request as any).user?.id || (request as any).user?.sub;

  if (!isValidUUID(id)) {
    return reply.status(400).send({ success: false, error: 'Invalid parcel ID format' });
  }

  if (!authUid) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  const parcelCheck = await pool.query(
    'SELECT id, survey_number, state_code FROM public.land_parcels WHERE id = $1',
    [id]
  ).catch(() => ({ rows: [] }));

  if (!parcelCheck.rows.length) {
    return reply.status(404).send({ success: false, error: 'Parcel not found in authorized dataset' });
  }

  try {
    await pool.query(
      `INSERT INTO public.farmer_land_links
         (farmer_auth_uid, parcel_id, claim_status, consent_reference, linked_at)
       VALUES ($1, $2, 'FARMER_CLAIMED', $3, NOW())
       ON CONFLICT (farmer_auth_uid, parcel_id) DO UPDATE SET
         claim_status = 'FARMER_CLAIMED',
         consent_reference = EXCLUDED.consent_reference`,
      [authUid, id, (request.body as any)?.consent_reference || 'in-app-consent-v1.0']
    );

    const parcel = parcelCheck.rows[0];
    return reply.send({
      success: true,
      message: 'Parcel linked to your account',
      claim_status: 'FARMER_CLAIMED',
      claim_status_meaning: 'You have linked this parcel to your account. This is NOT government verification of ownership. The parcel information is sourced from an authorized dataset.',
      parcel_id: parcel.id,
      survey_number: parcel.survey_number,
      state_code: parcel.state_code
    });
  } catch (err: any) {
    request.log.error({ err }, 'Claim parcel error');
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

/**
 * GET /api/v1/land-survey/my-parcels
 */
export async function getFarmerLinkedParcels(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authUid = (request as any).user?.id || (request as any).user?.sub;
  if (!authUid) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  try {
    const result = await pool.query(
      `SELECT
        fll.id AS link_id,
        fll.claim_status,
        fll.linked_at,
        fll.verified_at,
        fll.raw_state_code, fll.raw_district, fll.raw_mandal,
        fll.raw_village, fll.raw_survey_number, fll.raw_subdivision,
        lp.id AS parcel_id,
        lp.state_code, lp.district_name, lp.mandal_name, lp.village_name,
        lp.survey_number, lp.subdivision_number, lp.area_acres,
        lp.land_classification, lp.verification_status,
        (lp.boundary_geom IS NOT NULL) AS is_geometry_available,
        lds.source_name, lds.official_url AS official_portal_url
       FROM public.farmer_land_links fll
       LEFT JOIN public.land_parcels lp ON fll.parcel_id = lp.id
       LEFT JOIN public.land_data_sources lds ON lp.data_source_id = lds.id
       WHERE fll.farmer_auth_uid = $1 AND fll.removed_at IS NULL
       ORDER BY fll.linked_at DESC`,
      [authUid]
    );

    return reply.send({
      success: true,
      parcels: result.rows,
      total: result.rows.length,
      claim_status_note: 'FARMER_CLAIMED status means you have linked this parcel. It does not constitute government verification of ownership.'
    });
  } catch (err: any) {
    request.log.error({ err }, 'Get farmer parcels error');
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: FARMER-ASSISTED OFFICIAL DOCUMENT IMPORT & VERIFICATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/land-survey/documents/upload
 * Farmer uploads an official RoR / Pahani / 7/12 document with explicit consent.
 */
export async function uploadFarmerLandDocument(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authUid = (request as any).user?.id || (request as any).user?.sub;
  if (!authUid) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  const {
    file_name,
    mime_type,
    file_base64,
    document_type = 'PAHANI',
    issuing_state = 'TS',
    user_consent_granted = false,
    declared_survey_number,
    declared_subdivision,
    declared_extent_acres,
    declared_village,
    declared_mandal,
    declared_district
  } = (request.body as any) || {};

  // Privacy minimization & explicit consent requirement
  if (!user_consent_granted) {
    return reply.status(400).send({
      success: false,
      error: 'EXPLICIT_CONSENT_REQUIRED',
      message: 'Explicit farmer consent is required to process and extract survey identifiers from official documents.'
    });
  }

  if (!file_name || !file_base64 || !mime_type) {
    return reply.status(400).send({
      success: false,
      error: 'INVALID_PAYLOAD',
      message: 'file_name, mime_type, and file_base64 are required.'
    });
  }

  const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedMimes.includes(mime_type.toLowerCase())) {
    return reply.status(415).send({
      success: false,
      error: 'UNSUPPORTED_MEDIA_TYPE',
      message: `Only official PDF and image files (PNG, JPEG) are accepted. Received: ${mime_type}`
    });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(file_base64, 'base64');
  } catch (e) {
    return reply.status(400).send({ success: false, error: 'Invalid base64 encoding' });
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_FILE_SIZE) {
    return reply.status(413).send({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: `File exceeds maximum allowed size of 10MB. Current size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`
    });
  }

  // Compute deterministic SHA-256
  const contentSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Rule-based metadata extraction without bulk PII harvesting
  const textSample = buffer.toString('utf8', 0, Math.min(buffer.length, 32768));
  const extracted = extractFieldsFromDocument(textSample, {
    declared_survey_number,
    declared_subdivision,
    declared_extent_acres,
    declared_village,
    declared_mandal,
    declared_district,
    issuing_state
  });

  // Digital signature marker detection
  const hasDigitalSignature = textSample.includes('/ByteRange') || textSample.includes('adbe.pkcs7') || textSample.includes('Digital Signature');

  // Strict verification status distinction:
  // Farmer-supplied uploads are tagged USER_PROVIDED_DOCUMENT.
  // Never automatically tagged OFFICIALLY_VERIFIED without state registry integration.
  const verificationStatus = 'USER_PROVIDED_DOCUMENT';
  const geometryStatus = 'GEOMETRY_UNAVAILABLE'; // Raster & PDF documents do not contain georeferenced spatial vectors

  const docId = crypto.randomUUID();
  const documentRecord = {
    id: docId,
    farmer_auth_uid: authUid,
    file_name: sanitizeFileName(file_name),
    file_size_bytes: buffer.length,
    mime_type: mime_type.toLowerCase(),
    content_sha256: contentSha256,
    document_type: String(document_type).toUpperCase(),
    issuing_state: String(issuing_state).toUpperCase(),
    user_consent_granted: true,
    extracted_fields: extracted,
    extraction_method: 'RULE_PARSER',
    verification_status: verificationStatus,
    digital_signature_present: hasDigitalSignature,
    digital_signature_details: hasDigitalSignature ? { status: 'SIGNATURE_MARKER_DETECTED', verified_against_trust_chain: false } : null,
    geometry_detected: false,
    geometry_status: geometryStatus,
    uploaded_at: new Date().toISOString(),
    deleted_at: null
  };

  // Persist to PostgreSQL if available, or fall back to memory
  try {
    await pool.query(
      `INSERT INTO public.farmer_land_documents (
         id, farmer_auth_uid, file_name, file_size_bytes, mime_type,
         content_sha256, document_type, issuing_state, user_consent_granted,
         extracted_fields, extraction_method, verification_status,
         digital_signature_present, digital_signature_details,
         geometry_detected, geometry_status, uploaded_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12,
         $13, $14,
         $15, $16, NOW()
       )`,
      [
        docId,
        authUid,
        documentRecord.file_name,
        documentRecord.file_size_bytes,
        documentRecord.mime_type,
        contentSha256,
        documentRecord.document_type,
        documentRecord.issuing_state,
        true,
        JSON.stringify(extracted),
        'RULE_PARSER',
        verificationStatus,
        hasDigitalSignature,
        documentRecord.digital_signature_details ? JSON.stringify(documentRecord.digital_signature_details) : null,
        false,
        geometryStatus
      ]
    );
  } catch (err: any) {
    request.log.warn({ err }, 'DB unavailable for document persistence; saving to in-memory store');
    memoryDocuments.set(docId, documentRecord);
  }

  return reply.send({
    success: true,
    message: 'Official land document uploaded and parsed. Tagged as USER_PROVIDED_DOCUMENT.',
    document: {
      id: docId,
      file_name: documentRecord.file_name,
      content_sha256: contentSha256,
      document_type: documentRecord.document_type,
      issuing_state: documentRecord.issuing_state,
      verification_status: verificationStatus,
      verification_status_meaning: 'Document supplied by farmer. Does not establish official legal proof of title without registry confirmation.',
      extracted_fields: extracted,
      digital_signature_present: hasDigitalSignature,
      geometry_status: geometryStatus,
      geometry_status_meaning: 'No georeferenced spatial boundary vectors detected in document. Basemap will display without synthetic polygons.'
    }
  });
}

/**
 * GET /api/v1/land-survey/documents
 */
export async function getFarmerLandDocuments(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authUid = (request as any).user?.id || (request as any).user?.sub;
  if (!authUid) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, file_name, file_size_bytes, mime_type, content_sha256,
              document_type, issuing_state, extracted_fields,
              verification_status, digital_signature_present,
              geometry_status, uploaded_at
       FROM public.farmer_land_documents
       WHERE farmer_auth_uid = $1 AND deleted_at IS NULL
       ORDER BY uploaded_at DESC`,
      [authUid]
    );

    return reply.send({
      success: true,
      documents: result.rows,
      total: result.rows.length
    });
  } catch (err: any) {
    request.log.warn({ err }, 'DB unavailable for get documents; checking memory');
    const userDocs = Array.from(memoryDocuments.values()).filter(d => d.farmer_auth_uid === authUid && !d.deleted_at);
    return reply.send({
      success: true,
      documents: userDocs,
      total: userDocs.length
    });
  }
}

/**
 * DELETE /api/v1/land-survey/documents/:id
 * Privacy mechanism: Farmers have complete right to delete their uploaded documents.
 */
export async function deleteFarmerLandDocument(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = (request.params as any) || {};
  const authUid = (request as any).user?.id || (request as any).user?.sub;

  if (!authUid) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  if (!isValidUUID(id)) {
    return reply.status(400).send({ success: false, error: 'Invalid document ID format' });
  }

  try {
    const res = await pool.query(
      `UPDATE public.farmer_land_documents
       SET deleted_at = NOW(),
           extracted_fields = '{}'::jsonb
       WHERE id = $1 AND farmer_auth_uid = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, authUid]
    );

    if (memoryDocuments.has(id)) {
      const doc = memoryDocuments.get(id);
      if (doc.farmer_auth_uid === authUid) {
        doc.deleted_at = new Date().toISOString();
      }
    }

    if (!res.rows.length && !memoryDocuments.has(id)) {
      return reply.status(404).send({ success: false, error: 'Document not found or already deleted' });
    }

    return reply.send({
      success: true,
      message: 'Land document permanently removed from your active profile.'
    });
  } catch (err: any) {
    if (memoryDocuments.has(id)) {
      const doc = memoryDocuments.get(id);
      if (doc.farmer_auth_uid === authUid) {
        doc.deleted_at = new Date().toISOString();
        return reply.send({ success: true, message: 'Land document deleted from profile.' });
      }
    }
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

/**
 * POST /api/v1/land-survey/documents/:id/claim
 * Converts an uploaded document's extracted fields into a FARMER_CLAIMED parcel record.
 */
export async function claimFromDocument(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = (request.params as any) || {};
  const authUid = (request as any).user?.id || (request as any).user?.sub;

  if (!authUid) {
    return reply.status(401).send({ success: false, error: 'Authentication required' });
  }

  if (!isValidUUID(id)) {
    return reply.status(400).send({ success: false, error: 'Invalid document ID format' });
  }

  try {
    let doc: any = null;
    const res = await pool.query(
      `SELECT * FROM public.farmer_land_documents WHERE id = $1 AND farmer_auth_uid = $2 AND deleted_at IS NULL`,
      [id, authUid]
    );

    if (res.rows.length) {
      doc = res.rows[0];
    } else if (memoryDocuments.has(id)) {
      const mem = memoryDocuments.get(id);
      if (mem.farmer_auth_uid === authUid && !mem.deleted_at) doc = mem;
    }

    if (!doc) {
      return reply.status(404).send({ success: false, error: 'Document not found' });
    }

    const fields = doc.extracted_fields || {};
    const surveyNumber = fields.survey_number || 'UNKNOWN';
    const subdivision = fields.subdivision || null;
    const stateCode = doc.issuing_state || 'TS';

    // Link into farmer_land_links with claim_status = FARMER_CLAIMED
    const claimRes = await pool.query(
      `INSERT INTO public.farmer_land_links (
         farmer_auth_uid, claim_status, consent_reference,
         raw_state_code, raw_district, raw_mandal, raw_village,
         raw_survey_number, raw_subdivision, linked_at
       ) VALUES ($1, 'FARMER_CLAIMED', $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        authUid,
        `doc-import-${id}`,
        stateCode,
        fields.district || null,
        fields.mandal || null,
        fields.village || null,
        surveyNumber,
        subdivision
      ]
    ).catch(() => ({ rows: [{ id: crypto.randomUUID() }] }));

    return reply.send({
      success: true,
      message: `Survey #${surveyNumber} imported as self-declared parcel`,
      claim_status: 'FARMER_CLAIMED',
      claim_status_meaning: 'Farmer declared asset based on user-provided document. This does not constitute legal government proof of title.',
      survey_number: surveyNumber,
      subdivision_number: subdivision,
      area_acres: fields.area_acres || null,
      geometry_status: 'GEOMETRY_UNAVAILABLE'
    });
  } catch (err: any) {
    request.log.error({ err }, 'Claim from document error');
    return reply.status(503).send({ success: false, error: 'Service temporarily unavailable' });
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

function extractFieldsFromDocument(text: string, declared: any): Record<string, any> {
  const fields: Record<string, any> = {};

  // Survey number detection: matches patterns like "Survey No: 124/A", "Sy. No. 45", "Khasra: 23"
  const surveyMatch = text.match(/(?:Survey|Sy\.?|Khasra|Khatauni)\s*(?:No\.?|Number|\#)?[:.\s]*([0-9]+(?:\/[0-9A-Za-z]+)?)/i);
  if (surveyMatch) {
    const rawVal = surveyMatch[1].trim();
    if (rawVal.includes('/')) {
      const parts = rawVal.split('/');
      fields.survey_number = parts[0];
      fields.subdivision = parts[1];
    } else {
      fields.survey_number = rawVal;
    }
  } else if (declared.declared_survey_number) {
    fields.survey_number = String(declared.declared_survey_number).trim();
    if (declared.declared_subdivision) {
      fields.subdivision = String(declared.declared_subdivision).trim();
    }
  }

  // Area / Extent detection: matches "Extent: 3.50 Acres", "Area: 1.25 Ac"
  const extentMatch = text.match(/(?:Extent|Area|Total Area)[:.\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:Acres?|Ac|Guntas?|Hectares?)/i);
  if (extentMatch) {
    fields.area_acres = parseFloat(extentMatch[1]);
  } else if (declared.declared_extent_acres) {
    fields.area_acres = parseFloat(declared.declared_extent_acres) || null;
  }

  // Location hierarchy: uses declared values or detected tokens
  if (declared.declared_village) fields.village = String(declared.declared_village).trim();
  if (declared.declared_mandal) fields.mandal = String(declared.declared_mandal).trim();
  if (declared.declared_district) fields.district = String(declared.declared_district).trim();
  fields.state = declared.issuing_state || 'TS';

  // Record date detection (if government update timestamp is printed in document)
  const dateMatch = text.match(/(?:Date of Generation|Generated on|Report Date|Date)[:.\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i);
  if (dateMatch) {
    fields.source_reported_date = dateMatch[1];
  }

  return fields;
}

function getVerificationMeaning(status: string): string {
  const meanings: Record<string, string> = {
    USER_PROVIDED_DOCUMENT: 'The document was supplied by the farmer. It does not establish official legal proof of title without independent registry confirmation.',
    SOURCE_DOCUMENT_UNVERIFIED: 'The document claims to originate from an official portal, but independent verification has not been completed.',
    DIGITAL_SIGNATURE_VALIDATED: 'The cryptographic digital signature on this document has been validated against a trusted CA chain.',
    OFFICIALLY_VERIFIED: 'An authorized verification process with the state revenue registry has confirmed this record.',
    SOURCE_RETRIEVED: 'The record was successfully collected from its identified government source.',
    SOURCE_MATCHED: 'The survey identity matches the official source administrative location and identifier.',
    GEOMETRY_VALIDATED: 'The parcel geometry passed structural and spatial validation.',
    FARMER_CLAIMED: 'The farmer has declared this parcel. Legal ownership has not been independently verified.'
  };
  return meanings[status] || 'Unknown verification status.';
}

export function getOfficialPortalsForState(stateCode: string): Array<{ name: string; url: string; statusUrl?: string; gisUrl?: string }> {
  const portals: Record<string, { name: string; url: string; statusUrl?: string; gisUrl?: string }> = {
    TS: {
      name: 'Bhu Bharati — Telangana (Official Portal Replacing Dharani)',
      url: 'https://bhubharati.telangana.gov.in/homePage?lang=en',
      statusUrl: 'https://bhubharati.telangana.gov.in/knowLandStatus',
      gisUrl: 'https://bhubharati.telangana.gov.in/gis/'
    },
    AP: {
      name: 'MeeBhoomi — Andhra Pradesh',
      url: 'https://meebhoomi.ap.gov.in',
      statusUrl: 'https://meebhoomi.ap.gov.in'
    },
    MH: {
      name: 'MahaBhumi — Maharashtra',
      url: 'https://bhulekh.mahabhumi.gov.in',
      statusUrl: 'https://bhulekh.mahabhumi.gov.in'
    },
    KA: {
      name: 'Bhoomi — Karnataka',
      url: 'https://landrecords.karnataka.gov.in',
      statusUrl: 'https://landrecords.karnataka.gov.in'
    },
    UP: {
      name: 'UP Bhulekh — Uttar Pradesh',
      url: 'https://upbhulekh.gov.in',
      statusUrl: 'https://upbhulekh.gov.in'
    },
    PB: {
      name: 'PLRS — Punjab',
      url: 'https://jamabandi.punjab.gov.in',
      statusUrl: 'https://jamabandi.punjab.gov.in'
    },
    HR: {
      name: 'Jamabandi — Haryana',
      url: 'https://jamabandi.nic.in',
      statusUrl: 'https://jamabandi.nic.in'
    },
    MP: {
      name: 'MP Bhulekh — Madhya Pradesh',
      url: 'https://mpbhulekh.gov.in',
      statusUrl: 'https://mpbhulekh.gov.in'
    },
    GJ: {
      name: 'AnyRoR — Gujarat',
      url: 'https://anyror.gujarat.gov.in',
      statusUrl: 'https://anyror.gujarat.gov.in'
    },
    RJ: {
      name: 'Apna Khata — Rajasthan',
      url: 'https://apnakhata.rajasthan.gov.in',
      statusUrl: 'https://apnakhata.rajasthan.gov.in'
    },
    TN: {
      name: 'Tamil Nilam — Tamil Nadu',
      url: 'https://eservices.tn.gov.in/eservicesnew/index.html',
      statusUrl: 'https://eservices.tn.gov.in/eservicesnew/index.html'
    },
    IN: {
      name: 'Digital India Land Records (DILRMP Central)',
      url: 'https://dilrmp.gov.in',
      statusUrl: 'https://dilrmp.gov.in'
    }
  };
  const portal = portals[stateCode];
  return portal ? [portal] : [{ name: 'Digital India Land Records', url: 'https://dilrmp.gov.in' }];
}

export function buildOfflineCoverageResponse() {
  return {
    coverage: [
      {
        source_code: 'TS_BHUBHARATI',
        source_name: 'Bhu Bharati — Telangana Integrated Land Records Management System',
        state_code: 'TS',
        official_url: 'https://bhubharati.telangana.gov.in/homePage?lang=en',
        terms_url: 'https://bhubharati.telangana.gov.in',
        department: 'Revenue Department (CCLA), Government of Telangana',
        permission_status: 'PENDING_AUTHORIZATION',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'PENDING_AGREEMENT',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: true,
        geometry_available: true,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'TS_DHARANI',
        source_name: 'Dharani — Telangana (Superseded by Bhu Bharati)',
        state_code: 'TS',
        official_url: 'https://dharani.telangana.gov.in',
        terms_url: 'https://dharani.telangana.gov.in',
        department: 'Registration & Stamps Dept, Govt of Telangana',
        permission_status: 'PROHIBITED',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'PROHIBITED',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: true,
        geometry_available: false,
        legacy_status: 'SUPERSEDED_BY_BHUBHARATI',
        parcel_count: 0
      },
      {
        source_code: 'AP_MEEBHOOMI',
        source_name: 'MeeBhoomi — Andhra Pradesh',
        state_code: 'AP',
        official_url: 'https://meebhoomi.ap.gov.in',
        department: 'Revenue Dept, Govt of Andhra Pradesh',
        permission_status: 'PENDING_AUTHORIZATION',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'UNAUTHORIZED',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: true,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'MH_MAHABHUMI',
        source_name: 'MahaBhumi — Maharashtra',
        state_code: 'MH',
        official_url: 'https://bhulekh.mahabhumi.gov.in',
        department: 'Revenue & Forest Dept, Govt of Maharashtra',
        permission_status: 'PENDING_AUTHORIZATION',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'UNAUTHORIZED',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: true,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'KA_BHOOMI',
        source_name: 'Bhoomi — Karnataka',
        state_code: 'KA',
        official_url: 'https://landrecords.karnataka.gov.in',
        department: 'Revenue Dept, Govt of Karnataka',
        permission_status: 'PENDING_AUTHORIZATION',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'UNAUTHORIZED',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: true,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'UP_BHULEKH',
        source_name: 'UP Bhulekh — Uttar Pradesh',
        state_code: 'UP',
        official_url: 'https://upbhulekh.gov.in',
        department: 'Revenue Board, Govt of UP',
        permission_status: 'PENDING_AUTHORIZATION',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'UNAUTHORIZED',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: true,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'CENTRAL_DATA_GOV_IN',
        source_name: 'data.gov.in — National Open Data Portal',
        state_code: 'IN',
        official_url: 'https://data.gov.in',
        department: 'MeitY, Government of India',
        permission_status: 'NO_DATASET',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'PERMITTED_UNDER_GODL',
        bulk_download_status: 'NO_PARCEL_DATASET',
        captcha_enforced: false,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'CENTRAL_DILRMP',
        source_name: 'DILRMP — Digital India Land Records',
        state_code: 'IN',
        official_url: 'https://dilrmp.gov.in',
        department: 'DoLR, Ministry of Rural Development',
        permission_status: 'NO_DATASET',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'UNAUTHORIZED',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: false,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      },
      {
        source_code: 'ISRO_BHUVAN',
        source_name: 'Bhuvan — ISRO NRSC',
        state_code: 'IN',
        official_url: 'https://bhuvan.nrsc.gov.in',
        department: 'NRSC, ISRO',
        permission_status: 'PENDING_AUTHORIZATION',
        scraping_enabled: false,
        manual_citizen_access: true,
        commercial_reuse_status: 'REQUIRES_NRSC_MOU',
        bulk_download_status: 'UNAVAILABLE',
        captcha_enforced: false,
        geometry_available: false,
        legacy_status: 'ACTIVE',
        parcel_count: 0
      }
    ],
    generated_at: new Date().toISOString(),
    legal_notice: 'NuKropAI operates strictly within Indian legal standards. Automated scraping is disabled. Bhuvan WMS is disabled pending NRSC agreement. Direct official portal links and farmer-provided document import are supported.'
  };
}
