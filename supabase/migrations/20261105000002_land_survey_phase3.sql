-- ============================================================================
-- NUKROPAI AGRARIAN OS — LAND SURVEY INTELLIGENCE PHASE 3
-- REAL SOURCE CORRECTION, AUTHORIZATION MODEL & FARMER DOCUMENT IMPORT
-- ============================================================================
-- 1. Updates source registry to recognize Bhu Bharati as current Telangana portal
-- 2. Preserves historical Dharani source marked as superseded/legacy
-- 3. Corrects authorization statuses: APPROVED, PENDING_AUTHORIZATION, PROHIBITED, NO_DATASET
-- 4. Creates farmer_land_documents table with privacy safeguards and RLS
-- ============================================================================

-- 1. EXTEND LAND DATA SOURCES SCHEMA
ALTER TABLE public.land_data_sources
  ADD COLUMN IF NOT EXISTS terms_url TEXT,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_citizen_access BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS commercial_reuse_status VARCHAR(50) DEFAULT 'UNAUTHORIZED',
  ADD COLUMN IF NOT EXISTS bulk_download_status VARCHAR(50) DEFAULT 'UNAVAILABLE',
  ADD COLUMN IF NOT EXISTS captcha_enforced BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS geometry_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS search_capabilities JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS required_authorization TEXT,
  ADD COLUMN IF NOT EXISTS legacy_status VARCHAR(50) DEFAULT 'ACTIVE';

-- 2. UPDATE HISTORICAL DHARANI AS SUPERSEDED / LEGACY
UPDATE public.land_data_sources
SET
  source_name = 'Dharani — Telangana Legacy Land Portal (Superseded by Bhu Bharati)',
  legacy_status = 'SUPERSEDED_BY_BHUBHARATI',
  permission_status = 'PROHIBITED',
  permission_notes = 'Historical land portal for Telangana. Superseded by Bhu Bharati under the Telangana Bhu Bharati (Record of Rights in Land) Act. Automated extraction prohibited. Preserved for provenance and historical record traceability.',
  scraping_enabled = FALSE,
  last_reviewed_at = '2026-11-05T00:00:00Z',
  manual_citizen_access = true,
  commercial_reuse_status = 'PROHIBITED',
  bulk_download_status = 'UNAVAILABLE',
  captcha_enforced = true,
  geometry_available = false
WHERE source_code = 'TS_DHARANI';

-- 3. INSERT CURRENT OFFICIAL TELANGANA PORTAL: BHU BHARATI
INSERT INTO public.land_data_sources (
  source_code, source_name, state_code, official_url, terms_url, department,
  source_type, permission_status, permission_notes, scraping_enabled,
  last_reviewed_at, manual_citizen_access, commercial_reuse_status,
  bulk_download_status, captcha_enforced, geometry_available,
  search_capabilities, required_authorization, legacy_status
) VALUES (
  'TS_BHUBHARATI',
  'Bhu Bharati — Telangana Integrated Land Records Management System',
  'TS',
  'https://bhubharati.telangana.gov.in/homePage?lang=en',
  'https://bhubharati.telangana.gov.in',
  'Revenue Department (Chief Commissioner of Land Administration), Government of Telangana',
  'STATE_REVENUE_PORTAL',
  'PENDING_AUTHORIZATION',
  'Official land administration portal under Telangana Bhu Bharati Act. Citizen lookup available at /knowLandStatus. Cadastral map viewer at /gis/. Automated scraping not permitted without written authorization from CCLA. Protected by dynamic CAPTCHA. Vector bulk download unavailable.',
  FALSE,
  '2026-11-05T00:00:00Z',
  TRUE,
  'PENDING_AGREEMENT',
  'UNAVAILABLE',
  TRUE,
  TRUE,
  '{"hierarchy": ["state", "district", "division", "mandal", "village", "survey_number", "subdivision"], "knowLandStatus": true, "gisViewer": true, "khataSearch": true, "notes": "Text records and cadastral map viewer operate as distinct services"}'::jsonb,
  'Written Data Sharing Agreement / API Access Agreement from CCLA, Government of Telangana',
  'ACTIVE'
)
ON CONFLICT (source_code) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  official_url = EXCLUDED.official_url,
  department = EXCLUDED.department,
  permission_status = EXCLUDED.permission_status,
  permission_notes = EXCLUDED.permission_notes,
  terms_url = EXCLUDED.terms_url,
  search_capabilities = EXCLUDED.search_capabilities,
  last_reviewed_at = EXCLUDED.last_reviewed_at;

-- 4. UPDATE REMAINING SOURCES WITH PRECISE AUTHORIZATION AND DATASET CLASSIFICATIONS
-- CENTRAL_DATA_GOV_IN: NO_DATASET (No parcel-level cadastral vector datasets exist)
UPDATE public.land_data_sources
SET
  permission_status = 'NO_DATASET',
  permission_notes = 'Licensed under Government Open Data License (GODL) v1.0. Allows open reuse with attribution. However, zero parcel-level cadastral or survey-number datasets are hosted on the platform as of review.',
  last_reviewed_at = '2026-11-05T00:00:00Z',
  commercial_reuse_status = 'PERMITTED_UNDER_GODL',
  bulk_download_status = 'NO_PARCEL_DATASET',
  captcha_enforced = false,
  geometry_available = false
WHERE source_code = 'CENTRAL_DATA_GOV_IN';

-- CENTRAL_DILRMP: NO_DATASET (Administrative program dashboard only)
UPDATE public.land_data_sources
SET
  permission_status = 'NO_DATASET',
  permission_notes = 'Department of Land Resources (DoLR) central monitoring portal. Hosts aggregate digitization metrics. Does not host individual village cadastral records or parcel boundaries.',
  last_reviewed_at = '2026-11-05T00:00:00Z',
  commercial_reuse_status = 'UNAUTHORIZED',
  bulk_download_status = 'UNAVAILABLE',
  captcha_enforced = false,
  geometry_available = false
WHERE source_code = 'CENTRAL_DILRMP';

-- ISRO_BHUVAN: PENDING_AUTHORIZATION (WMS layer disabled pending written authorization)
UPDATE public.land_data_sources
SET
  permission_status = 'PENDING_AUTHORIZATION',
  permission_notes = 'Bhuvan WMS integration disabled in client until explicit written data licensing agreement from NRSC is confirmed. Raw parcel geometry downloads require formal MoU. Tile scraping strictly disallowed.',
  last_reviewed_at = '2026-11-05T00:00:00Z',
  commercial_reuse_status = 'REQUIRES_NRSC_MOU',
  bulk_download_status = 'UNAVAILABLE',
  captcha_enforced = false,
  geometry_available = false
WHERE source_code = 'ISRO_BHUVAN';

-- 5. CREATE FARMER LAND DOCUMENTS TABLE (OFFICIAL DOCUMENT IMPORT)
CREATE TABLE IF NOT EXISTS public.farmer_land_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_auth_uid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  content_sha256 CHAR(64) NOT NULL,
  document_type VARCHAR(50) NOT NULL,            -- 'ROR_1B', 'PAHANI', '7_12_EXTRACT', 'KHATAUNI', 'PATTA_PASSBOOK', 'CADASTRAL_MAP', 'OTHER'
  issuing_state VARCHAR(10) NOT NULL,
  user_consent_granted BOOLEAN NOT NULL DEFAULT true,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_method VARCHAR(50) NOT NULL DEFAULT 'RULE_PARSER',
  verification_status VARCHAR(50) NOT NULL DEFAULT 'USER_PROVIDED_DOCUMENT',
  -- USER_PROVIDED_DOCUMENT: Farmer supplied file
  -- SOURCE_DOCUMENT_UNVERIFIED: Claims to originate from govt portal, unverified
  -- DIGITAL_SIGNATURE_VALIDATED: Cryptographically validated certificate trust chain
  -- OFFICIALLY_VERIFIED: Confirmed via authorized government verification
  -- FARMER_CLAIMED: Declared by farmer
  digital_signature_present BOOLEAN NOT NULL DEFAULT false,
  digital_signature_details JSONB,
  geometry_detected BOOLEAN NOT NULL DEFAULT false,
  geometry_status VARCHAR(50) NOT NULL DEFAULT 'GEOMETRY_UNAVAILABLE',
  geometry_wgs84 GEOGRAPHY(POLYGON, 4326),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT valid_doc_verification_status CHECK (
    verification_status IN (
      'USER_PROVIDED_DOCUMENT',
      'SOURCE_DOCUMENT_UNVERIFIED',
      'DIGITAL_SIGNATURE_VALIDATED',
      'OFFICIALLY_VERIFIED',
      'FARMER_CLAIMED'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_fld_farmer ON public.farmer_land_documents (farmer_auth_uid);
CREATE INDEX IF NOT EXISTS idx_fld_sha256 ON public.farmer_land_documents (content_sha256);
CREATE INDEX IF NOT EXISTS idx_fld_active ON public.farmer_land_documents (farmer_auth_uid) WHERE deleted_at IS NULL;

-- Enable Row Level Security (RLS) on farmer_land_documents
ALTER TABLE public.farmer_land_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fld_farmer_select ON public.farmer_land_documents;
CREATE POLICY fld_farmer_select ON public.farmer_land_documents
  FOR SELECT USING (farmer_auth_uid = auth.uid()::text AND deleted_at IS NULL);

DROP POLICY IF EXISTS fld_farmer_insert ON public.farmer_land_documents;
CREATE POLICY fld_farmer_insert ON public.farmer_land_documents
  FOR INSERT WITH CHECK (farmer_auth_uid = auth.uid()::text);

DROP POLICY IF EXISTS fld_farmer_update ON public.farmer_land_documents;
CREATE POLICY fld_farmer_update ON public.farmer_land_documents
  FOR UPDATE USING (farmer_auth_uid = auth.uid()::text);

DROP POLICY IF EXISTS fld_farmer_delete ON public.farmer_land_documents;
CREATE POLICY fld_farmer_delete ON public.farmer_land_documents
  FOR DELETE USING (farmer_auth_uid = auth.uid()::text);

-- 6. REFINED GET_LAND_SURVEY_COVERAGE RPC
CREATE OR REPLACE FUNCTION public.get_land_survey_coverage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sources JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'source_code', lds.source_code,
    'source_name', lds.source_name,
    'state_code', lds.state_code,
    'official_url', lds.official_url,
    'terms_url', lds.terms_url,
    'department', lds.department,
    'permission_status', lds.permission_status,
    'permission_notes', lds.permission_notes,
    'scraping_enabled', lds.scraping_enabled,
    'manual_citizen_access', lds.manual_citizen_access,
    'commercial_reuse_status', lds.commercial_reuse_status,
    'bulk_download_status', lds.bulk_download_status,
    'captcha_enforced', lds.captcha_enforced,
    'geometry_available', lds.geometry_available,
    'search_capabilities', lds.search_capabilities,
    'legacy_status', lds.legacy_status,
    'last_reviewed_at', lds.last_reviewed_at,
    'parcel_count', (
      SELECT COUNT(*) FROM public.land_parcels lp
      WHERE lp.data_source_id = lds.id
    )
  ) ORDER BY lds.legacy_status ASC, lds.state_code ASC)
  INTO v_sources
  FROM public.land_data_sources lds;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'sources_count', jsonb_array_length(COALESCE(v_sources, '[]'::jsonb)),
    'approved_sources_count', (
      SELECT COUNT(*) FROM public.land_data_sources WHERE permission_status = 'APPROVED'
    ),
    'sources', COALESCE(v_sources, '[]'::jsonb),
    'legal_notice', 'NuKropAI does not perform unauthorized automated scraping. Direct links to official state portals are provided for citizen-assisted verification.'
  );
END;
$$;
