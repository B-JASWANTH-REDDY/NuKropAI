import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../config/db';

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
    // Try to fetch from live DB; fall back to hardcoded registry if DB offline.
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

  // Input validation
  if (!state) {
    return reply.status(400).send({
      success: false,
      error: 'state parameter is required',
      error_code: 'MISSING_STATE'
    });
  }

  const stateCode = state.toUpperCase().trim();
  const pageLimit = Math.min(parseInt(limit || '20', 10), 100);
  const pageOffset = Math.max(parseInt(offset || '0', 10), 0);

  // Sanitize inputs — no special characters in survey number
  const surveyNum = survey_number ? survey_number.trim().replace(/[^\w\/\-\.]/g, '') : undefined;

  try {
    const result = await pool.query(
      `SELECT public.search_land_parcels($1, $2, $3, $4, $5, $6, $7, $8) AS result`,
      [
        stateCode,
        district?.trim() || null,
        mandal?.trim() || null,
        village?.trim() || null,
        surveyNum || null,
        subdivision?.trim() || null,
        pageLimit,
        pageOffset
      ]
    );

    const searchResult = result.rows[0]?.result;

    // Add honest coverage note if no records found
    if (!searchResult?.records?.length) {
      return reply.send({
        success: true,
        records: [],
        total: 0,
        limit: pageLimit,
        offset: pageOffset,
        availability_notice: {
          status: 'NO_RECORDS_IN_AUTHORIZED_DATASET',
          message: `NuKropAI does not currently have authorized land records for ${stateCode} in its verified dataset. All government sources for this state are PENDING_AUTHORIZATION for automated data collection.`,
          what_to_do: [
            'You can still visit the official government portal directly using the links below.',
            'We are working to establish data-sharing agreements with state revenue departments.',
            'You can link your parcel manually — it will be tagged FARMER_CLAIMED (not government-verified).'
          ],
          official_portals: getOfficialPortalsForState(stateCode)
        }
      });
    }

    return reply.send(searchResult);
  } catch (err: any) {
    request.log.error({ err }, 'Land survey search error');
    return reply.status(503).send({
      success: false,
      error: 'Land survey search temporarily unavailable',
      error_code: 'SEARCH_UNAVAILABLE',
      availability_notice: {
        status: 'DATABASE_UNAVAILABLE',
        message: 'The land survey search is temporarily unavailable. Please try again later.',
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
      `SELECT
        lp.id, lp.parcel_id, lp.state_code, lp.district_code, lp.district_name,
        lp.mandal_name, lp.village_code, lp.village_name,
        lp.survey_number, lp.subdivision_number,
        lp.area_acres AS official_area, 'acres' AS area_unit,
        lp.land_classification, lp.verification_status,
        lp.is_geometry_approximate,
        lp.data_quality_notes,
        (lp.boundary_geom IS NOT NULL) AS is_geometry_available,
        lds.source_name, lds.official_url AS official_portal_url,
        lds.department AS government_department,
        lds.permission_status AS source_permission_status,
        lp.source_url, lp.source_record_id, lp.collection_method,
        lp.scraped_at, lp.source_published_at, lp.source_updated_at, lp.last_synced_at,
        lp.geometry_source, lp.geometry_crs, lp.geometry_verified_at,
        lp.created_at
       FROM public.land_parcels lp
       LEFT JOIN public.land_data_sources lds ON lp.data_source_id = lds.id
       WHERE lp.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return reply.status(404).send({
        success: false,
        error: 'Parcel not found in NuKropAI authorized dataset',
        error_code: 'PARCEL_NOT_FOUND'
      });
    }

    return reply.send({ success: true, parcel: result.rows[0] });
  } catch (err: any) {
    request.log.error({ err }, 'Get parcel error');
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
                lds.source_license, lds.permission_status
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
        // Three distinct dates — always kept separate
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
          license: parcel.source_license || null,
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
 * Farmer links a known parcel to their account.
 * Sets claim_status = FARMER_CLAIMED — this is not government verification.
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

  // Check parcel exists
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
 * Returns all parcels linked by the authenticated farmer.
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

// ─── Utility Functions ───────────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getVerificationMeaning(status: string): string {
  const meanings: Record<string, string> = {
    SOURCE_RETRIEVED: 'The record was successfully collected from its identified government source.',
    SOURCE_MATCHED: 'The survey identity matches the official source administrative location and identifier.',
    GEOMETRY_VALIDATED: 'The parcel geometry passed structural and spatial validation.',
    OFFICIAL_STATUS_VERIFIED: 'The applicable official record provides verification evidence.',
    FARMER_CLAIMED: 'The farmer has linked this parcel but legal ownership has not been independently verified.'
  };
  return meanings[status] || 'Unknown verification status.';
}

function getOfficialPortalsForState(stateCode: string): Array<{ name: string; url: string }> {
  const portals: Record<string, { name: string; url: string }> = {
    TS: { name: 'Dharani — Telangana', url: 'https://dharani.telangana.gov.in' },
    AP: { name: 'MeeBhoomi — Andhra Pradesh', url: 'https://meebhoomi.ap.gov.in' },
    MH: { name: 'MahaBhumi — Maharashtra', url: 'https://bhulekh.mahabhumi.gov.in' },
    KA: { name: 'Bhoomi — Karnataka', url: 'https://landrecords.karnataka.gov.in' },
    UP: { name: 'UP Bhulekh', url: 'https://upbhulekh.gov.in' },
    PB: { name: 'PLRS — Punjab', url: 'https://jamabandi.punjab.gov.in' },
    HR: { name: 'Jamabandi — Haryana', url: 'https://jamabandi.nic.in' },
    MP: { name: 'MP Bhulekh', url: 'https://mpbhulekh.gov.in' },
    GJ: { name: 'AnyRoR — Gujarat', url: 'https://anyror.gujarat.gov.in' },
    RJ: { name: 'Apna Khata — Rajasthan', url: 'https://apnakhata.rajasthan.gov.in' },
    TN: { name: 'Tamil Nilam — Tamil Nadu', url: 'https://eservices.tn.gov.in/eservicesnew/index.html' },
    IN: { name: 'data.gov.in', url: 'https://data.gov.in' }
  };
  const portal = portals[stateCode];
  return portal ? [portal] : [{ name: 'data.gov.in', url: 'https://data.gov.in' }];
}

function buildOfflineCoverageResponse() {
  return {
    coverage: [
      { source_code: 'TS_DHARANI', source_name: 'Dharani — Telangana', state_code: 'TS', official_url: 'https://dharani.telangana.gov.in', department: 'Registration & Stamps Dept, Govt of Telangana', permission_status: 'PENDING_AUTHORIZATION', scraping_enabled: false, parcel_count: 0 },
      { source_code: 'AP_MEEBHOOMI', source_name: 'MeeBhoomi — Andhra Pradesh', state_code: 'AP', official_url: 'https://meebhoomi.ap.gov.in', department: 'Revenue Dept, Govt of Andhra Pradesh', permission_status: 'PENDING_AUTHORIZATION', scraping_enabled: false, parcel_count: 0 },
      { source_code: 'MH_MAHABHUMI', source_name: 'MahaBhumi — Maharashtra', state_code: 'MH', official_url: 'https://bhulekh.mahabhumi.gov.in', department: 'Revenue Dept, Govt of Maharashtra', permission_status: 'PENDING_AUTHORIZATION', scraping_enabled: false, parcel_count: 0 },
      { source_code: 'KA_BHOOMI', source_name: 'Bhoomi — Karnataka', state_code: 'KA', official_url: 'https://landrecords.karnataka.gov.in', department: 'Revenue Dept, Govt of Karnataka', permission_status: 'PENDING_AUTHORIZATION', scraping_enabled: false, parcel_count: 0 },
      { source_code: 'UP_BHULEKH', source_name: 'UP Bhulekh', state_code: 'UP', official_url: 'https://upbhulekh.gov.in', department: 'Revenue Board, Govt of UP', permission_status: 'PENDING_AUTHORIZATION', scraping_enabled: false, parcel_count: 0 }
    ],
    generated_at: new Date().toISOString(),
    note: 'All sources currently PENDING_AUTHORIZATION. No real parcel records ingested yet. Database temporarily unavailable.'
  };
}

