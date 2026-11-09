-- ============================================================================
-- MIGRATION: 20261004040000_agristack_relational_search.sql
-- DESCRIPTION: AgriStack DPI Relational Land Ownership Search, ULPIN & PostGIS GeoJSON
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Ensure farmer_profiles has owner_full_name & aadhaar_ekyc_status
ALTER TABLE public.farmer_profiles 
  ADD COLUMN IF NOT EXISTS owner_full_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS aadhaar_ekyc_status VARCHAR(50) DEFAULT 'VERIFIED';

UPDATE public.farmer_profiles 
SET owner_full_name = full_name 
WHERE owner_full_name IS NULL;

-- 2. Create land_parcels table with relational foreign key to farmer_profiles
CREATE TABLE IF NOT EXISTS public.land_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_owner_id UUID REFERENCES public.farmer_profiles(id) ON DELETE CASCADE,
  parcel_id VARCHAR(100) UNIQUE NOT NULL,
  ulpin VARCHAR(100) UNIQUE, -- Unique Land Parcel Identification Number (Bhu-Aadhaar)
  survey_number VARCHAR(50) NOT NULL,
  sub_survey VARCHAR(50) DEFAULT '',
  khasra_no VARCHAR(50) NOT NULL,
  khata_no VARCHAR(50) NOT NULL,
  area_acres NUMERIC(6,2) NOT NULL,
  soil_type VARCHAR(100) DEFAULT 'Black Cotton Soil (pH 6.8)',
  water_source VARCHAR(100) DEFAULT 'Solar Drip',
  center_point geography(POINT, 4326),
  boundary_geom geography(POLYGON, 4326) NOT NULL,
  state_code VARCHAR(10) NOT NULL DEFAULT 'TS',
  portal_url TEXT DEFAULT 'https://dharani.telangana.gov.in/',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_parcels_geom ON public.land_parcels USING GIST (boundary_geom);
CREATE INDEX IF NOT EXISTS idx_land_parcels_owner ON public.land_parcels (verified_owner_id);
CREATE INDEX IF NOT EXISTS idx_land_parcels_ulpin ON public.land_parcels (ulpin);
CREATE INDEX IF NOT EXISTS idx_land_parcels_survey ON public.land_parcels (survey_number);

-- Ensure inspection_date exists on crop_survey_records
ALTER TABLE public.crop_survey_records
  ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMPTZ DEFAULT NOW();

UPDATE public.crop_survey_records
SET inspection_date = verification_timestamp
WHERE inspection_date IS NULL;

-- 3. Relational View: land_ownership_records
CREATE OR REPLACE VIEW public.land_ownership_records AS
SELECT 
  l.parcel_id,
  l.ulpin,
  l.survey_number,
  l.khasra_no,
  l.khata_no,
  l.area_acres,
  ST_AsGeoJSON(l.boundary_geom)::json AS geojson,
  ST_Y(l.center_point::geometry) AS center_lat,
  ST_X(l.center_point::geometry) AS center_lon,
  l.soil_type,
  l.water_source,
  l.portal_url,
  p.id AS verified_owner_id,
  p.fid,
  p.owner_full_name,
  p.aadhaar_ekyc_status,
  p.state_farmer_id,
  p.state_code,
  p.state_name,
  p.district,
  p.mandal,
  p.village,
  p.credit_score,
  p.kcc_limit
FROM public.land_parcels l
JOIN public.farmer_profiles p ON l.verified_owner_id = p.id;

-- 4. Seed Data: Seed Farmers & Land Parcels with PostGIS Geometries
DO $$
DECLARE
  v_owner1_id UUID;
  v_owner2_id UUID;
BEGIN
  -- Insert or fetch Farmer 1 (B. Jaswanth Reddy)
  INSERT INTO public.farmer_profiles (
    full_name, owner_full_name, fid, state_farmer_id, state_code, state_name, district, mandal, village, ekyc_verified, aadhaar_ekyc_status, credit_score, credit_grade, kcc_limit
  ) VALUES (
    'B. Jaswanth Reddy', 'B. Jaswanth Reddy', 'FR-2026-9874512', 'TS-WGL-8941', 'TS', 'Telangana', 'Warangal', 'Geesugonda', 'Dharmaram', true, 'VERIFIED', 785, 'Grade A+ (Prime Ag-Credit)', 300000.00
  ) ON CONFLICT (fid) DO UPDATE SET
    owner_full_name = EXCLUDED.owner_full_name,
    aadhaar_ekyc_status = EXCLUDED.aadhaar_ekyc_status
  RETURNING id INTO v_owner1_id;

  -- Insert or fetch Farmer 2 (Ramesh M. Patil - Maharashtra)
  INSERT INTO public.farmer_profiles (
    full_name, owner_full_name, fid, state_farmer_id, state_code, state_name, district, mandal, village, ekyc_verified, aadhaar_ekyc_status, credit_score, credit_grade, kcc_limit
  ) VALUES (
    'Ramesh M. Patil', 'Ramesh M. Patil', 'FR-2026-1122334', 'MH-PUN-3819', 'MH', 'Maharashtra', 'Pune', 'Baramati', 'Malegaon', true, 'VERIFIED', 760, 'Grade A (Ag-Credit)', 250000.00
  ) ON CONFLICT (fid) DO UPDATE SET
    owner_full_name = EXCLUDED.owner_full_name,
    aadhaar_ekyc_status = EXCLUDED.aadhaar_ekyc_status
  RETURNING id INTO v_owner2_id;

  -- Seed Parcels for Farmer 1
  INSERT INTO public.land_parcels (
    verified_owner_id, parcel_id, ulpin, survey_number, sub_survey, khasra_no, khata_no, area_acres, soil_type, water_source, center_point, boundary_geom, state_code, portal_url
  ) VALUES
  (
    v_owner1_id,
    'PL-TS-WGL-142A2',
    'ULPIN-TS-36-098-142A2',
    '142/A-2',
    '2',
    'KH-142-A2',
    'TS-WGL-8941',
    2.50,
    'Black Cotton Soil (pH 6.8)',
    'Solar Drip',
    ST_SetSRID(ST_MakePoint(79.5941, 17.9689), 4326)::geography,
    ST_GeogFromText('SRID=4326;POLYGON((79.5928 17.9702, 79.5955 17.9710, 79.5962 17.9685, 79.5934 17.9678, 79.5928 17.9702))'),
    'TS',
    'https://dharani.telangana.gov.in/'
  ),
  (
    v_owner1_id,
    'PL-TS-WGL-98B1',
    'ULPIN-TS-36-098-098B1',
    '98/B-1',
    '1',
    'KH-98-B1',
    'TS-WGL-8941',
    1.25,
    'Red Loamy Soil',
    'Borewell',
    ST_SetSRID(ST_MakePoint(79.5920, 17.9655), 4326)::geography,
    ST_GeogFromText('SRID=4326;POLYGON((79.5910 17.9664, 79.5932 17.9672, 79.5938 17.9650, 79.5916 17.9642, 79.5910 17.9664))'),
    'TS',
    'https://dharani.telangana.gov.in/'
  ),
  (
    v_owner1_id,
    'PL-TS-WGL-1041',
    'ULPIN-TS-36-098-01041',
    '104/1',
    '1',
    'KH-104-1',
    'TS-WGL-8941',
    0.75,
    'Alluvial Loam',
    'Canal Water',
    ST_SetSRID(ST_MakePoint(79.5905, 17.9620), 4326)::geography,
    ST_GeogFromText('SRID=4326;POLYGON((79.5895 17.9628, 79.5915 17.9635, 79.5922 17.9615, 79.5900 17.9608, 79.5895 17.9628))'),
    'TS',
    'https://dharani.telangana.gov.in/'
  )
  ON CONFLICT (parcel_id) DO UPDATE SET
    ulpin = EXCLUDED.ulpin,
    verified_owner_id = EXCLUDED.verified_owner_id;

  -- Seed Parcels for Farmer 2 (Maharashtra)
  INSERT INTO public.land_parcels (
    verified_owner_id, parcel_id, ulpin, survey_number, sub_survey, khasra_no, khata_no, area_acres, soil_type, water_source, center_point, boundary_geom, state_code, portal_url
  ) VALUES
  (
    v_owner2_id,
    'PL-MH-PUN-742',
    'ULPIN-MH-27-042-00742',
    '74/2',
    '2',
    'KH-74-2',
    'MH-PUN-3819',
    3.20,
    'Medium Black Soil',
    'Canal & Drip',
    ST_SetSRID(ST_MakePoint(74.5802, 18.1524), 4326)::geography,
    ST_GeogFromText('SRID=4326;POLYGON((74.5780 18.1540, 74.5820 18.1545, 74.5825 18.1510, 74.5785 18.1505, 74.5780 18.1540))'),
    'MH',
    'https://bhulekh.mahabhumi.gov.in/'
  )
  ON CONFLICT (parcel_id) DO UPDATE SET
    ulpin = EXCLUDED.ulpin,
    verified_owner_id = EXCLUDED.verified_owner_id;

END $$;

-- 5. RPC Function: search_farmer_land_registry
CREATE OR REPLACE FUNCTION public.search_farmer_land_registry(p_query text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_owner JSONB;
  v_parcels JSONB;
  v_q text := UPPER(TRIM(COALESCE(p_query, '')));
BEGIN
  IF v_q = '' THEN
    v_q := 'FR-2026-9874512';
  END IF;

  -- Relational lookup: match owner by FID, or match by ULPIN / survey_number / khasra_no
  SELECT to_jsonb(p) INTO v_owner
  FROM public.farmer_profiles p
  WHERE UPPER(p.fid) = v_q
     OR UPPER(p.full_name) ILIKE '%' || v_q || '%'
     OR EXISTS (
       SELECT 1 FROM public.land_parcels lp 
       WHERE lp.verified_owner_id = p.id 
         AND (UPPER(lp.ulpin) = v_q OR UPPER(lp.survey_number) = v_q OR UPPER(lp.khasra_no) = v_q)
     )
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No verified land parcels found for this identifier in the National Registry.',
      'parcels', '[]'::jsonb
    );
  END IF;

  -- Join parcels with GeoJSON and DCS records
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'parcel_id', l.parcel_id,
      'ulpin', l.ulpin,
      'survey_number', l.survey_number,
      'sub_survey', l.sub_survey,
      'khasra_no', l.khasra_no,
      'khata_no', l.khata_no,
      'area_acres', l.area_acres,
      'owner_full_name', COALESCE(v_owner->>'owner_full_name', v_owner->>'full_name'),
      'soil_type', l.soil_type,
      'water_source', l.water_source,
      'center_lat', ST_Y(l.center_point::geometry),
      'center_lon', ST_X(l.center_point::geometry),
      'geo_json', ST_AsGeoJSON(l.boundary_geom)::jsonb,
      'state_code', l.state_code,
      'portal_url', l.portal_url,
      'crop_survey', (
        SELECT jsonb_build_object(
          'survey_id', csr.survey_id,
          'parcel_id', csr.parcel_id,
          'survey_number', csr.survey_number,
          'season', csr.season,
          'crop_name', csr.crop_name,
          'seed_variety', csr.seed_variety,
          'area_acres', csr.area_acres,
          'days_since_sowing', csr.days_since_sowing,
          'irrigation_method', csr.irrigation_method,
          'growth_stage', csr.growth_stage,
          'health_status', csr.health_status,
          'officer_name', csr.officer_name,
          'officer_badge', csr.officer_badge,
          'verification_status', csr.verification_status,
          'inspection_date', csr.verification_timestamp,
          'verification_timestamp', csr.verification_timestamp
        )
        FROM public.crop_survey_records csr
        WHERE csr.parcel_id = l.parcel_id
        ORDER BY csr.verification_timestamp DESC
        LIMIT 1
      )
    )
  ) INTO v_parcels
  FROM public.land_parcels l
  WHERE l.verified_owner_id = (v_owner->>'id')::uuid;

  RETURN jsonb_build_object(
    'success', true,
    'farmer_profile', v_owner,
    'parcels', COALESCE(v_parcels, '[]'::jsonb)
  );
END;
$$;
