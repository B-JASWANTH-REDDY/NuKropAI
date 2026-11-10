-- ============================================================================
-- MIGRATION: 20261004030000_agristack_cadastral_dcs.sql
-- DESCRIPTION: India DPI AgriStack Unified Farmer Identity, Cadastral RoR (PostGIS) & DCS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. All-India Unified Farmer Profile Table
CREATE TABLE IF NOT EXISTS public.farmer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  fid VARCHAR(100) UNIQUE NOT NULL, -- AgriStack Sovereign FID: e.g. FR-2026-9874512
  state_farmer_id VARCHAR(50) NOT NULL, -- e.g. TS-WGL-8941, MH-PUN-3819, UP-LKO-4421
  state_code VARCHAR(10) NOT NULL DEFAULT 'TS',
  state_name VARCHAR(100) NOT NULL DEFAULT 'Telangana',
  district VARCHAR(100) NOT NULL DEFAULT 'Warangal',
  mandal VARCHAR(100) NOT NULL DEFAULT 'Geesugonda',
  village VARCHAR(100) NOT NULL DEFAULT 'Dharmaram',
  ekyc_verified BOOLEAN DEFAULT true,
  credit_score INT DEFAULT 785,
  credit_grade VARCHAR(50) DEFAULT 'Grade A+ (Prime Ag-Credit)',
  kcc_limit NUMERIC(12,2) DEFAULT 300000.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Land Parcels Table with PostGIS Polygon Geometry
CREATE TABLE IF NOT EXISTS public.farmer_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid VARCHAR(100) NOT NULL,
  parcel_id VARCHAR(100) UNIQUE NOT NULL,
  survey_number VARCHAR(50) NOT NULL,
  sub_survey VARCHAR(50) DEFAULT '',
  khasra_no VARCHAR(50) NOT NULL,
  khata_no VARCHAR(50) NOT NULL,
  area_acres NUMERIC(6,2) NOT NULL,
  pattadar_name VARCHAR(150) NOT NULL,
  ownership_type VARCHAR(100) DEFAULT 'INDIVIDUAL_100',
  soil_type VARCHAR(100) DEFAULT 'Black Cotton Soil (pH 6.8)',
  water_source VARCHAR(100) DEFAULT 'Solar Drip',
  center_point geography(POINT, 4326),
  boundary_polygon geography(POLYGON, 4326) NOT NULL,
  state_code VARCHAR(10) NOT NULL DEFAULT 'TS',
  portal_url TEXT DEFAULT 'https://dharani.telangana.gov.in/',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_boundary_polygon 
ON public.farmer_parcels USING GIST (boundary_polygon);

CREATE INDEX IF NOT EXISTS idx_parcels_fid 
ON public.farmer_parcels (fid);

-- 3. Digital Crop Survey (DCS) Sown Registry Table
CREATE TABLE IF NOT EXISTS public.crop_survey_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) UNIQUE NOT NULL,
  parcel_id VARCHAR(100) NOT NULL,
  survey_number VARCHAR(50) NOT NULL,
  season VARCHAR(50) NOT NULL DEFAULT 'Kharif 2026',
  crop_name VARCHAR(100) NOT NULL,
  seed_variety VARCHAR(100) NOT NULL,
  area_acres NUMERIC(6,2) NOT NULL,
  days_since_sowing INT NOT NULL DEFAULT 45,
  irrigation_method VARCHAR(100) NOT NULL,
  growth_stage VARCHAR(100) NOT NULL,
  health_status VARCHAR(50) DEFAULT 'Optimal',
  officer_name VARCHAR(150) NOT NULL,
  officer_badge VARCHAR(50) NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'VERIFIED_BY_OFFICER',
  verification_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_survey_parcel 
ON public.crop_survey_records (parcel_id);

-- 4. RPC to fetch unified farmer AgriStack DPI payload with GeoJSON polygons
CREATE OR REPLACE FUNCTION public.get_farmer_agristack(p_fid VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_profile JSONB;
  v_parcels JSONB;
BEGIN
  -- Fetch Profile
  SELECT to_jsonb(p) INTO v_profile
  FROM public.farmer_profiles p
  WHERE p.fid = p_fid
  LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch Parcels with GeoJSON and matching Crop Survey Records
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', fp.id,
      'parcel_id', fp.parcel_id,
      'survey_number', fp.survey_number,
      'sub_survey', fp.sub_survey,
      'khasra_no', fp.khasra_no,
      'khata_no', fp.khata_no,
      'area_acres', fp.area_acres,
      'pattadar_name', fp.pattadar_name,
      'ownership_type', fp.ownership_type,
      'soil_type', fp.soil_type,
      'water_source', fp.water_source,
      'center_lat', ST_Y(fp.center_point::geometry),
      'center_lon', ST_X(fp.center_point::geometry),
      'geo_json', ST_AsGeoJSON(fp.boundary_polygon)::jsonb,
      'state_code', fp.state_code,
      'portal_url', fp.portal_url,
      'crop_survey', (
        SELECT to_jsonb(csr)
        FROM public.crop_survey_records csr
        WHERE csr.parcel_id = fp.parcel_id
        ORDER BY csr.verification_timestamp DESC
        LIMIT 1
      )
    )
  ) INTO v_parcels
  FROM public.farmer_parcels fp
  WHERE fp.fid = p_fid;

  RETURN jsonb_build_object(
    'farmer_profile', v_profile,
    'parcels', COALESCE(v_parcels, '[]'::jsonb)
  );
END;
$$;

-- Seed Default Production Farmer Data
INSERT INTO public.farmer_profiles (
  full_name, fid, state_farmer_id, state_code, state_name, district, mandal, village, ekyc_verified, credit_score, credit_grade, kcc_limit
) VALUES (
  'B. Jaswanth Reddy', 'FR-2026-9874512', 'TS-WGL-8941', 'TS', 'Telangana', 'Warangal', 'Geesugonda', 'Dharmaram', true, 785, 'Grade A+ (Prime Ag-Credit)', 300000.00
) ON CONFLICT (fid) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  state_farmer_id = EXCLUDED.state_farmer_id;

-- Seed Land Parcels with PostGIS Polygon WKT (Longitude First [lon, lat])
INSERT INTO public.farmer_parcels (
  fid, parcel_id, survey_number, sub_survey, khasra_no, khata_no, area_acres, pattadar_name, ownership_type, soil_type, water_source, center_point, boundary_polygon, state_code, portal_url
) VALUES
(
  'FR-2026-9874512',
  'PL-TS-WGL-142A2',
  '142/A-2',
  '2',
  'KH-142-A2',
  'TS-WGL-8941',
  2.50,
  'B. Jaswanth Reddy',
  'INDIVIDUAL_100',
  'Black Cotton Soil (pH 6.8)',
  'Solar Drip',
  ST_SetSRID(ST_MakePoint(79.5941, 17.9689), 4326)::geography,
  ST_GeogFromText('SRID=4326;POLYGON((79.5928 17.9702, 79.5955 17.9710, 79.5962 17.9685, 79.5934 17.9678, 79.5928 17.9702))'),
  'TS',
  'https://dharani.telangana.gov.in/'
),
(
  'FR-2026-9874512',
  'PL-TS-WGL-98B1',
  '98/B-1',
  '1',
  'KH-98-B1',
  'TS-WGL-8941',
  1.25,
  'B. Jaswanth Reddy',
  'INDIVIDUAL_100',
  'Red Loamy Soil',
  'Borewell',
  ST_SetSRID(ST_MakePoint(79.5920, 17.9655), 4326)::geography,
  ST_GeogFromText('SRID=4326;POLYGON((79.5910 17.9664, 79.5932 17.9672, 79.5938 17.9650, 79.5916 17.9642, 79.5910 17.9664))'),
  'TS',
  'https://dharani.telangana.gov.in/'
),
(
  'FR-2026-9874512',
  'PL-TS-WGL-1041',
  '104/1',
  '1',
  'KH-104-1',
  'TS-WGL-8941',
  0.75,
  'B. Jaswanth Reddy',
  'INDIVIDUAL_100',
  'Alluvial Loam',
  'Canal Water',
  ST_SetSRID(ST_MakePoint(79.5905, 17.9620), 4326)::geography,
  ST_GeogFromText('SRID=4326;POLYGON((79.5895 17.9628, 79.5915 17.9635, 79.5922 17.9615, 79.5900 17.9608, 79.5895 17.9628))'),
  'TS',
  'https://dharani.telangana.gov.in/'
)
ON CONFLICT (parcel_id) DO NOTHING;

-- Seed Crop Survey Records
INSERT INTO public.crop_survey_records (
  survey_id, parcel_id, survey_number, season, crop_name, seed_variety, area_acres, days_since_sowing, irrigation_method, growth_stage, health_status, officer_name, officer_badge, verification_status, verification_timestamp
) VALUES
(
  'ECROP-2026-KHARIF-98214',
  'PL-TS-WGL-142A2',
  '142/A-2',
  'Kharif 2026',
  'Cotton',
  'Bt Cotton Hybrid',
  2.50,
  45,
  'Solar Drip',
  'Vegetative / Squaring',
  'Optimal',
  'M. Srinivas Rao',
  'Agronomy Officer #412 & VRO',
  'VERIFIED_BY_OFFICER',
  '2026-08-15T10:30:00Z'
),
(
  'ECROP-2026-KHARIF-98215',
  'PL-TS-WGL-98B1',
  '98/B-1',
  'Kharif 2026',
  'Guntur Teja Chilli',
  'Teja Supreme',
  1.25,
  52,
  'Borewell Sprinkler',
  'Flowering & Fruiting',
  'Healthy',
  'M. Srinivas Rao',
  'Agronomy Officer #412',
  'VERIFIED_BY_OFFICER',
  '2026-08-18T11:15:00Z'
),
(
  'ECROP-2026-KHARIF-98216',
  'PL-TS-WGL-1041',
  '104/1',
  'Kharif 2026',
  'Paddy (BPT 5204)',
  'Samba Mahsuri (BPT 5204)',
  0.75,
  38,
  'Canal Irrigated',
  'Tillering',
  'Excellent',
  'M. Srinivas Rao',
  'Agronomy Officer #412',
  'VERIFIED_BY_OFFICER',
  '2026-08-20T14:00:00Z'
)
ON CONFLICT (survey_id) DO NOTHING;
