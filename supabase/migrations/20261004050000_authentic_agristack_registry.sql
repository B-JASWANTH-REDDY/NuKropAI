-- ============================================================================
-- MIGRATION: 20261004050000_authentic_agristack_registry.sql
-- DESCRIPTION: Authentic AgriStack DPI, PostGIS Cadastral Registry & Saved Parcels
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. All-India Sovereign Farmer Identity Table
CREATE TABLE IF NOT EXISTS public.farmer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  fid VARCHAR(50) UNIQUE NOT NULL, -- Sovereign AgriStack Farmer ID
  aadhaar_hash TEXT UNIQUE,         -- Encrypted / Hashed Aadhaar Token for DPI privacy
  is_ekyc_verified BOOLEAN DEFAULT true,
  state_farmer_id VARCHAR(50),
  state_code VARCHAR(10) DEFAULT 'TS',
  state_name VARCHAR(100) DEFAULT 'Telangana',
  district VARCHAR(100) DEFAULT 'Warangal',
  mandal VARCHAR(100) DEFAULT 'Geesugonda',
  village VARCHAR(100) DEFAULT 'Dharmaram',
  kcc_limit NUMERIC(12,2) DEFAULT 300000.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_fid ON public.farmer_profiles (fid);
CREATE INDEX IF NOT EXISTS idx_farmer_aadhaar ON public.farmer_profiles (aadhaar_hash);

-- 2. Land Parcels Table with PostGIS Polygon Geometry
CREATE TABLE IF NOT EXISTS public.land_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_owner_id UUID REFERENCES public.farmer_profiles(id) ON DELETE CASCADE,
  parcel_id VARCHAR(100) UNIQUE NOT NULL,
  ulpin VARCHAR(100) UNIQUE NOT NULL, -- 14-digit Unique Land Parcel ID (Bhu-Aadhaar)
  survey_number VARCHAR(50) NOT NULL,
  sub_survey VARCHAR(50) DEFAULT '',
  khasra_no VARCHAR(50) DEFAULT '',
  khata_no VARCHAR(50) DEFAULT '',
  area_acres NUMERIC(6,2) NOT NULL,
  soil_type VARCHAR(100) DEFAULT 'Black Cotton Soil (pH 6.8)',
  water_source VARCHAR(100) DEFAULT 'Solar Drip',
  center_point geography(POINT, 4326),
  boundary_geom geography(POLYGON, 4326) NOT NULL,
  state_code VARCHAR(10) DEFAULT 'TS',
  portal_url TEXT DEFAULT 'https://dharani.telangana.gov.in/',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_parcels_geom ON public.land_parcels USING GIST (boundary_geom);
CREATE INDEX IF NOT EXISTS idx_land_parcels_ulpin ON public.land_parcels (ulpin);
CREATE INDEX IF NOT EXISTS idx_land_parcels_survey ON public.land_parcels (survey_number);

-- 3. Digital Crop Survey (DCS) Sown Registry Table
CREATE TABLE IF NOT EXISTS public.crop_survey_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id VARCHAR(100) NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  seed_variety VARCHAR(100) NOT NULL,
  days_since_sowing INT NOT NULL DEFAULT 45,
  verification_timestamp TIMESTAMPTZ DEFAULT NOW(),
  irrigation_method VARCHAR(100) DEFAULT 'Solar Drip',
  growth_stage VARCHAR(100) DEFAULT 'Vegetative / Squaring',
  officer_name VARCHAR(150) DEFAULT 'M. Srinivas Rao (Agronomy Officer #412)',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_survey_pid ON public.crop_survey_records (parcel_id);

-- 4. User Saved Farmer Parcels Table ("Save to My Account")
CREATE TABLE IF NOT EXISTS public.saved_farmer_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  verified_parcel_id VARCHAR(100) NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, verified_parcel_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_parcels_user ON public.saved_farmer_parcels (account_id);

-- Enable RLS & Permissive Access
ALTER TABLE public.farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_survey_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_farmer_parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read farmer_profiles" ON public.farmer_profiles FOR SELECT USING (true);
CREATE POLICY "Public read land_parcels" ON public.land_parcels FOR SELECT USING (true);
CREATE POLICY "Public read crop_survey_records" ON public.crop_survey_records FOR SELECT USING (true);
CREATE POLICY "Users can manage saved_farmer_parcels" ON public.saved_farmer_parcels FOR ALL USING (true);

-- 5. RPC Function: fetch_authentic_agristack_registry
CREATE OR REPLACE FUNCTION public.fetch_authentic_agristack_registry(p_search_token TEXT)
RETURNS TABLE (
  farmer_name TEXT,
  farmer_fid VARCHAR(50),
  aadhaar_verified BOOLEAN,
  parcels_data JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.full_name::TEXT,
    p.fid::VARCHAR(50),
    p.is_ekyc_verified,
    coalesce(jsonb_agg(jsonb_build_object(
      'parcel_id', l.parcel_id,
      'survey_number', l.survey_number,
      'ulpin', l.ulpin,
      'area_acres', l.area_acres,
      'geojson', ST_AsGeoJSON(l.boundary_geom)::jsonb,
      'crop_name', c.crop_name,
      'seed_variety', c.seed_variety,
      'days_sown', c.days_since_sowing,
      'inspection_stamp', c.verification_timestamp,
      'irrigation_method', c.irrigation_method,
      'growth_stage', c.growth_stage,
      'officer_name', c.officer_name
    )) FILTER (WHERE l.id IS NOT NULL), '[]'::jsonb) AS parcels_data
  FROM public.farmer_profiles p
  LEFT JOIN public.land_parcels l ON l.verified_owner_id = p.id
  LEFT JOIN public.crop_survey_records c ON (c.parcel_id = l.parcel_id OR c.parcel_id = l.id::text)
  WHERE p.fid = p_search_token 
     OR p.aadhaar_hash = p_search_token 
     OR l.ulpin = p_search_token
     OR l.survey_number = p_search_token
  GROUP BY p.id, p.full_name, p.fid, p.is_ekyc_verified;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_authentic_agristack_registry(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_authentic_agristack_registry(TEXT) TO authenticated, service_role;
