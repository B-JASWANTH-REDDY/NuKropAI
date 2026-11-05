-- ============================================================================
-- MIGRATION: 20261105000001_land_survey_intelligence.sql
-- DESCRIPTION: Land Survey Intelligence — Data Provenance, Source Registry,
--              Scraping Audit, and Farmer Land Links
-- APPROACH: Additive only. No destructive changes to existing tables.
-- ============================================================================

-- 1. LAND DATA SOURCES REGISTRY
-- Tracks every government data source, its permission status, and scraping config.
-- NO source is APPROVED until explicit authorization is confirmed and documented.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.land_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(50) UNIQUE NOT NULL,       -- e.g. 'TS_DHARANI', 'AP_MEEBHOOMI'
  source_name TEXT NOT NULL,                      -- Human-readable name
  state_code VARCHAR(10) NOT NULL,                -- ISO state code (TS, AP, MH...)
  official_url TEXT NOT NULL,                     -- Official government portal URL
  department TEXT NOT NULL,                       -- e.g. 'Registration & Stamps Dept, Telangana'
  source_type VARCHAR(50) NOT NULL DEFAULT 'STATE_REVENUE_PORTAL',
  -- APPROVED | PENDING_AUTHORIZATION | PROHIBITED
  permission_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_AUTHORIZATION',
  permission_notes TEXT,                          -- Why blocked or what auth is needed
  permission_reviewed_at TIMESTAMPTZ,
  permission_reviewer TEXT,
  source_license TEXT,                            -- e.g. 'NLDR', 'Open Government Data'
  -- Scraping is disabled by default. Only APPROVED sources may be enabled.
  scraping_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scraping_method VARCHAR(100),                   -- 'PLAYWRIGHT_BROWSER' | 'HTTP_API' | 'CSV_DOWNLOAD' | 'SHAPEFILE'
  scraping_rate_limit_notes TEXT,                 -- Any known rate limits
  -- How frequently official data is updated (not our scrape frequency)
  official_update_frequency VARCHAR(100),
  -- When we last verified this source is still accessible
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_sources_state ON public.land_data_sources (state_code);
CREATE INDEX IF NOT EXISTS idx_land_sources_permission ON public.land_data_sources (permission_status);

-- Seed: Known government sources — ALL PENDING_AUTHORIZATION
INSERT INTO public.land_data_sources (
  source_code, source_name, state_code, official_url, department,
  source_type, permission_status, permission_notes, scraping_enabled
) VALUES
(
  'TS_DHARANI',
  'Dharani — Telangana Integrated Land Records Management',
  'TS',
  'https://dharani.telangana.gov.in',
  'Registration & Stamps Department, Government of Telangana',
  'STATE_REVENUE_PORTAL',
  'PENDING_AUTHORIZATION',
  'Portal uses CAPTCHA on all search endpoints. Scraping not permitted without explicit written authorization from DoR&S, Telangana. Direct access requires human interaction flow.',
  FALSE
),
(
  'AP_MEEBHOOMI',
  'MeeBhoomi — Andhra Pradesh Land Records (1B / Adangal)',
  'AP',
  'https://meebhoomi.ap.gov.in',
  'Revenue Department, Government of Andhra Pradesh',
  'STATE_REVENUE_PORTAL',
  'PENDING_AUTHORIZATION',
  'Portal uses CAPTCHA. No public API. Requires written permission from AP Revenue Dept for bulk access.',
  FALSE
),
(
  'MH_MAHABHUMI',
  'MahaBhumi — Maharashtra 7/12 and 8A Records',
  'MH',
  'https://bhulekh.mahabhumi.gov.in',
  'Revenue & Forest Department, Government of Maharashtra',
  'STATE_REVENUE_PORTAL',
  'PENDING_AUTHORIZATION',
  'CAPTCHA protected. Official download permitted only via the state open data portal with attribution.',
  FALSE
),
(
  'KA_BHOOMI',
  'Bhoomi — Karnataka RTC (Record of Rights, Tenancy and Crops)',
  'KA',
  'https://landrecords.karnataka.gov.in',
  'Revenue Department, Government of Karnataka',
  'STATE_REVENUE_PORTAL',
  'PENDING_AUTHORIZATION',
  'CAPTCHA and OTP gated. Requires authorization from Karnataka Rajaswa Department.',
  FALSE
),
(
  'UP_BHULEKH',
  'UP Bhulekh — Uttar Pradesh Khatauni Records',
  'UP',
  'https://upbhulekh.gov.in',
  'Revenue Board, Government of Uttar Pradesh',
  'STATE_REVENUE_PORTAL',
  'PENDING_AUTHORIZATION',
  'Portal requires CAPTCHA solving. No open API documented.',
  FALSE
),
(
  'CENTRAL_DATA_GOV_IN',
  'data.gov.in — National Open Government Data Portal',
  'IN',
  'https://data.gov.in',
  'Ministry of Electronics & Information Technology (MeitY)',
  'NATIONAL_OPEN_DATA',
  'PENDING_AUTHORIZATION',
  'Open Government Data License v1.0 applies. Specific cadastral datasets need individual review for reuse terms. API key required. No land-parcel geometry datasets confirmed available as of 2026-11-05.',
  FALSE
),
(
  'CENTRAL_DILRMP',
  'DILRMP — Digital India Land Records Modernisation Programme',
  'IN',
  'https://dolr.gov.in/dilrmp',
  'Department of Land Resources (DoLR), Ministry of Rural Development',
  'NATIONAL_PORTAL',
  'PENDING_AUTHORIZATION',
  'Central programme coordinating state land records. No public bulk-download API. State-level cooperation required.',
  FALSE
),
(
  'ISRO_BHUVAN',
  'Bhuvan — ISRO National Remote Sensing WMS',
  'IN',
  'https://bhuvan.nrsc.gov.in',
  'National Remote Sensing Centre (NRSC), ISRO',
  'SATELLITE_WMS',
  'PENDING_AUTHORIZATION',
  'Bhuvan WMS is accessible for visualization but cadastral vector data download requires NRSC MOU. Tile usage for display (not bulk download) may be permitted under fair-use terms. Attribution mandatory.',
  FALSE
)
ON CONFLICT (source_code) DO UPDATE SET
  permission_status = EXCLUDED.permission_status,
  permission_notes = EXCLUDED.permission_notes,
  updated_at = NOW();


-- 2. LAND PARCEL PROVENANCE METADATA
-- Extends existing land_parcels with full data provenance columns.
-- Never stores ownership as authoritative unless explicitly sourced.
-- ============================================================================
ALTER TABLE public.land_parcels
  ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.land_data_sources(id),
  ADD COLUMN IF NOT EXISTS source_record_id TEXT,           -- Original record ID from government source
  ADD COLUMN IF NOT EXISTS source_url TEXT,                 -- Direct URL to original record if available
  ADD COLUMN IF NOT EXISTS collection_method VARCHAR(100),  -- How it was collected
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ,          -- When our system retrieved it
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ, -- When govt says it was published (nullable)
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,   -- When govt says it was last updated (nullable)
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,      -- Last successful NuKropAI sync
  ADD COLUMN IF NOT EXISTS content_hash TEXT,               -- SHA-256 of raw record content
  ADD COLUMN IF NOT EXISTS data_version INT NOT NULL DEFAULT 1,
  -- SOURCE_RETRIEVED | SOURCE_MATCHED | GEOMETRY_VALIDATED | OFFICIAL_STATUS_VERIFIED | FARMER_CLAIMED
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) NOT NULL DEFAULT 'SOURCE_RETRIEVED',
  ADD COLUMN IF NOT EXISTS geometry_source TEXT,            -- Where the geometry came from
  ADD COLUMN IF NOT EXISTS geometry_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geometry_crs VARCHAR(20) DEFAULT 'EPSG:4326',
  ADD COLUMN IF NOT EXISTS is_geometry_approximate BOOLEAN DEFAULT FALSE,
  -- Human-readable notes about data quality or availability gaps
  ADD COLUMN IF NOT EXISTS data_quality_notes TEXT,
  -- State/District/Mandal/Village classification (normalized)
  ADD COLUMN IF NOT EXISTS mandal_name TEXT,
  ADD COLUMN IF NOT EXISTS village_code TEXT,
  ADD COLUMN IF NOT EXISTS land_classification TEXT;       -- Patta / Assigned / Govt / Forest etc.

CREATE INDEX IF NOT EXISTS idx_land_parcels_source_id ON public.land_parcels (data_source_id);
CREATE INDEX IF NOT EXISTS idx_land_parcels_verification ON public.land_parcels (verification_status);
CREATE INDEX IF NOT EXISTS idx_land_parcels_state_survey ON public.land_parcels (state_code, survey_number);


-- 3. LAND PARCEL HISTORY (VERSIONED CHANGES)
-- Every time a parcel record changes in the source, preserve the old version.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.land_parcel_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.land_parcels(id) ON DELETE CASCADE,
  data_version INT NOT NULL,
  snapshot_jsonb JSONB NOT NULL,       -- Full JSON snapshot of the parcel at this version
  change_type VARCHAR(50) NOT NULL,    -- 'INITIAL_LOAD' | 'SOURCE_UPDATE' | 'GEOMETRY_UPDATE' | 'ADMIN_CORRECTION'
  change_notes TEXT,
  changed_by TEXT,                     -- system user or scraper identifier
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_history_parcel ON public.land_parcel_history (parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcel_history_version ON public.land_parcel_history (parcel_id, data_version);


-- 4. LAND SCRAPING RUNS (AUDIT LOG)
-- Every scraper execution is recorded regardless of outcome.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.land_scraping_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.land_data_sources(id),
  run_type VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',  -- SCHEDULED | MANUAL | TEST_DRY_RUN
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_time TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',      -- RUNNING | COMPLETED | FAILED | PARTIAL | ABORTED
  records_found INT DEFAULT 0,
  records_inserted INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_rejected INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  error_details TEXT,
  scraper_version TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_scraping_runs_source ON public.land_scraping_runs (source_id);
CREATE INDEX IF NOT EXISTS idx_scraping_runs_status ON public.land_scraping_runs (status);
CREATE INDEX IF NOT EXISTS idx_scraping_runs_time ON public.land_scraping_runs (start_time DESC);


-- 5. FARMER LAND LINKS (CLAIM MANAGEMENT)
-- Tracks which parcels a farmer has linked to their account.
-- FARMER_CLAIMED status is the highest verifiable status without external auth.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.farmer_land_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_auth_uid UUID NOT NULL,       -- Supabase auth.users.id (not farmer_profiles.id)
  parcel_id UUID REFERENCES public.land_parcels(id) ON DELETE SET NULL,
  -- For parcels not yet in our DB, store the input fields:
  raw_state_code VARCHAR(10),
  raw_district TEXT,
  raw_mandal TEXT,
  raw_village TEXT,
  raw_survey_number TEXT,
  raw_subdivision TEXT,
  -- FARMER_CLAIMED | PENDING_VERIFICATION | REMOVED
  claim_status VARCHAR(50) NOT NULL DEFAULT 'FARMER_CLAIMED',
  claim_notes TEXT,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_reference TEXT,              -- e.g. 'in-app-consent-v1.0'
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,            -- NULL until external verification is available
  removed_at TIMESTAMPTZ,
  UNIQUE(farmer_auth_uid, parcel_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_land_links_uid ON public.farmer_land_links (farmer_auth_uid);
CREATE INDEX IF NOT EXISTS idx_farmer_land_links_parcel ON public.farmer_land_links (parcel_id);
CREATE INDEX IF NOT EXISTS idx_farmer_land_links_status ON public.farmer_land_links (claim_status);


-- 6. ENABLE RLS ON NEW TABLES
-- ============================================================================
ALTER TABLE public.land_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_parcel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_scraping_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_land_links ENABLE ROW LEVEL SECURITY;

-- Public can read source registry (transparency)
CREATE POLICY "Public read land_data_sources"
  ON public.land_data_sources FOR SELECT USING (true);

-- Parcel history: authenticated users can read
CREATE POLICY "Authenticated read parcel history"
  ON public.land_parcel_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- Scraping runs: service role only (backend inserts, users can read)
CREATE POLICY "Authenticated read scraping runs"
  ON public.land_scraping_runs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Farmer land links: users can only manage their own links
CREATE POLICY "Users manage own land links"
  ON public.farmer_land_links FOR ALL
  USING (farmer_auth_uid = auth.uid());

CREATE POLICY "Users read own land links"
  ON public.farmer_land_links FOR SELECT
  USING (farmer_auth_uid = auth.uid());


-- 7. PostGIS SPATIAL SEARCH RPC
-- Search parcels by state/district/mandal/village/survey_number
-- Returns only records from APPROVED sources (or farmer's own linked parcels)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_land_parcels(
  p_state_code VARCHAR,
  p_district TEXT DEFAULT NULL,
  p_mandal TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_survey_number TEXT DEFAULT NULL,
  p_subdivision TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_results JSONB;
  v_total INT;
BEGIN
  -- Sanitize inputs
  p_state_code := UPPER(TRIM(COALESCE(p_state_code, '')));
  p_district := NULLIF(TRIM(LOWER(COALESCE(p_district, ''))), '');
  p_mandal := NULLIF(TRIM(LOWER(COALESCE(p_mandal, ''))), '');
  p_village := NULLIF(TRIM(LOWER(COALESCE(p_village, ''))), '');
  p_survey_number := NULLIF(TRIM(UPPER(COALESCE(p_survey_number, ''))), '');
  p_subdivision := NULLIF(TRIM(UPPER(COALESCE(p_subdivision, ''))), '');

  IF p_state_code = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'state_code is required',
      'records', '[]'::jsonb,
      'total', 0
    );
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.land_parcels lp
  JOIN public.land_data_sources lds ON lp.data_source_id = lds.id
  WHERE lp.state_code = p_state_code
    AND lds.permission_status = 'APPROVED'
    AND (p_district IS NULL OR LOWER(COALESCE(lp.district_name,'')) ILIKE '%' || p_district || '%')
    AND (p_mandal IS NULL OR LOWER(COALESCE(lp.mandal_name,'')) ILIKE '%' || p_mandal || '%')
    AND (p_village IS NULL OR LOWER(COALESCE(lp.village_name,'')) ILIKE '%' || p_village || '%')
    AND (p_survey_number IS NULL OR UPPER(lp.survey_number) = p_survey_number OR UPPER(lp.survey_number) ILIKE '%' || p_survey_number || '%')
    AND (p_subdivision IS NULL OR UPPER(COALESCE(lp.subdivision_number,'')) = p_subdivision);

  SELECT jsonb_agg(jsonb_build_object(
    'id', lp.id,
    'parcel_id', lp.parcel_id,
    'state_code', lp.state_code,
    'district_name', lp.district_name,
    'mandal_name', lp.mandal_name,
    'village_name', lp.village_name,
    'survey_number', lp.survey_number,
    'subdivision_number', lp.subdivision_number,
    'official_area', lp.area_acres,
    'area_unit', 'acres',
    'land_classification', lp.land_classification,
    'verification_status', lp.verification_status,
    'is_geometry_available', (lp.boundary_geom IS NOT NULL),
    'is_geometry_approximate', lp.is_geometry_approximate,
    'source_name', lds.source_name,
    'source_url', lp.source_url,
    'government_department', lds.department,
    'official_portal_url', lds.official_url,
    'scraped_at', lp.scraped_at,
    'source_published_at', lp.source_published_at,
    'source_updated_at', lp.source_updated_at,
    'last_synced_at', lp.last_synced_at,
    'data_quality_notes', lp.data_quality_notes
  ))
  INTO v_results
  FROM public.land_parcels lp
  JOIN public.land_data_sources lds ON lp.data_source_id = lds.id
  WHERE lp.state_code = p_state_code
    AND lds.permission_status = 'APPROVED'
    AND (p_district IS NULL OR LOWER(COALESCE(lp.district_name,'')) ILIKE '%' || p_district || '%')
    AND (p_mandal IS NULL OR LOWER(COALESCE(lp.mandal_name,'')) ILIKE '%' || p_mandal || '%')
    AND (p_village IS NULL OR LOWER(COALESCE(lp.village_name,'')) ILIKE '%' || p_village || '%')
    AND (p_survey_number IS NULL OR UPPER(lp.survey_number) = p_survey_number OR UPPER(lp.survey_number) ILIKE '%' || p_survey_number || '%')
    AND (p_subdivision IS NULL OR UPPER(COALESCE(lp.subdivision_number,'')) = p_subdivision)
  ORDER BY lp.last_synced_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;

  RETURN jsonb_build_object(
    'success', true,
    'records', COALESCE(v_results, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;


-- 8. COVERAGE SUMMARY RPC
-- Returns what coverage we have per state (for the UI coverage map)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_land_survey_coverage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sources JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'source_code', lds.source_code,
    'source_name', lds.source_name,
    'state_code', lds.state_code,
    'official_url', lds.official_url,
    'department', lds.department,
    'permission_status', lds.permission_status,
    'permission_notes', lds.permission_notes,
    'scraping_enabled', lds.scraping_enabled,
    'last_checked_at', lds.last_checked_at,
    'parcel_count', (
      SELECT COUNT(*) FROM public.land_parcels lp
      WHERE lp.data_source_id = lds.id
    )
  ) ORDER BY lds.state_code)
  INTO v_sources
  FROM public.land_data_sources lds;

  RETURN jsonb_build_object(
    'coverage', COALESCE(v_sources, '[]'::jsonb),
    'generated_at', NOW(),
    'note', 'All sources currently PENDING_AUTHORIZATION. No real parcel records ingested yet.'
  );
END;
$$;

