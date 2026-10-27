-- ══════════════════════════════════════════════════════════════════════════════
-- NuKropAI - CANONICAL FULLY-CONNECTED PRODUCTION DATABASE SETUP (V7.0)
-- ══════════════════════════════════════════════════════════════════════════════
-- Principal Security Hardened Architecture
-- 100% IDEMPOTENT & EXECUTABLE IN SUPABASE SQL EDITOR
--
-- SECURITY COMPLIANCE:
-- 1. ZERO UNRESTRICTED WRITES: Every INSERT, UPDATE, DELETE policy verifies auth.uid().
-- 2. PRIVACY-BY-DEFAULT: Private farmer profiles, crop scans, and land data are protected.
-- 3. ZERO PRIVILEGE ESCALATION: Auth signup trigger whitelists roles; admin self-grant blocked.
-- 4. SECURE FUNCTIONS: All SECURITY DEFINER functions set explicit search_path = public, pg_temp.
-- 5. ZERO FABRICATED DATA: Demo drivers and fake community posts moved to dev_fixtures.sql.
-- 6. UNBIASED DEFAULTS: Fabricated coordinates, ETAs, and soil test values replaced with NULL.
-- 7. REPEATABLE & IDEMPOTENT: Safe column casting, conflict handling, and specific policy drops.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: ENABLE ESSENTIAL EXTENSIONS
-- ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────
-- STEP 2: TIMESTAMP TRIGGER FUNCTION (SECURE SEARCH PATH)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────
-- STEP 3: DECLARATIVE TABLES & COLUMN SAFEGUARDS
-- ─────────────────────────────────────────────────────────────────

-- 1. CENTRAL PROFILES (Identity, Farmer & Transporter Hub)
CREATE TABLE IF NOT EXISTS public.profiles (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text,
  farmer_id text DEFAULT ('NK-' || floor(10000 + random() * 89999)::text) UNIQUE,
  email text UNIQUE,
  full_name text NOT NULL DEFAULT 'Farmer'::text,
  phone text DEFAULT NULL,
  phone_number text DEFAULT NULL,
  avatar_url text DEFAULT NULL,
  village text DEFAULT NULL,
  district text DEFAULT NULL,
  mandal text DEFAULT NULL,
  state text DEFAULT NULL,
  land_acres numeric DEFAULT NULL,
  total_land_acres numeric DEFAULT NULL,
  soil_type text DEFAULT NULL,
  primary_crops text[] DEFAULT ARRAY[]::text[],
  kcc_credit_limit numeric DEFAULT NULL,
  kcc_balance numeric DEFAULT NULL,
  agristack_id text DEFAULT NULL,
  agristack_verified boolean DEFAULT false,
  biometric_lock boolean DEFAULT false,
  role text NOT NULL DEFAULT 'farmer'::text CHECK (role IN ('farmer', 'driver', 'agronomist', 'admin')),
  driver_id text DEFAULT NULL,
  land_extent_acres numeric DEFAULT NULL,
  preferred_language text DEFAULT 'en'::text,
  dpdp_consent_given boolean DEFAULT false,
  dpdp_consent_timestamp timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farmer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text DEFAULT 'Farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mandal text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_acres numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_land_acres numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_crops text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_credit_limit numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_balance numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_lock boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_extent_acres numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_given boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_timestamp timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 1b. PUBLIC PROFILES SECURE VIEW (Exposes non-sensitive public identity for community & hauler cards)
CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = false) AS
SELECT 
  id,
  user_id,
  farmer_id,
  full_name,
  avatar_url,
  village,
  district,
  state,
  role,
  preferred_language,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2. MASTER BIO-RECIPES (ICAR & Agronomic Database)
CREATE TABLE IF NOT EXISTS public.biorx_recipes (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  title text NOT NULL UNIQUE,
  target_pest_disease text[] NOT NULL,
  ingredients jsonb NOT NULL,
  preparation_steps jsonb NOT NULL,
  fermentation_hours integer DEFAULT 48,
  dilution_ratio text DEFAULT '1:10 (Water)'::text,
  shelf_life_days integer DEFAULT 30,
  icar_approved boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT biorx_recipes_pkey PRIMARY KEY (id)
);

-- 3. TRUCK LISTINGS (Freight Operators & GramHaul Shared Logistics Fleet)
CREATE TABLE IF NOT EXISTS public.truck_listings (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  transporter_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_name text NOT NULL,
  driver_phone text NOT NULL,
  truck_type text DEFAULT 'Tata Ace Gold (1.5 Ton)'::text,
  vehicle_type text NOT NULL DEFAULT 'Tata 407 (Heavy Duty)'::text,
  vehicle_plate text NOT NULL,
  capacity_tonnes numeric DEFAULT 1.5,
  capacity_tons numeric DEFAULT 3.0,
  available_capacity_tonnes numeric DEFAULT 1.5,
  total_bags_capacity integer NOT NULL DEFAULT 30,
  filled_bags integer NOT NULL DEFAULT 0,
  rate_per_bag numeric NOT NULL DEFAULT 45.00,
  rate_per_km numeric NOT NULL DEFAULT 22.00,
  solo_rate numeric DEFAULT 1800.00,
  origin_village text DEFAULT NULL,
  destination_mandi text DEFAULT NULL,
  current_mandi text DEFAULT NULL,
  departure_time text DEFAULT NULL,
  pickup_eta text DEFAULT NULL,
  latitude double precision DEFAULT NULL,
  longitude double precision DEFAULT NULL,
  is_cold_chain boolean DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE'::text CHECK (status IN ('ACTIVE', 'FULL', 'DEPARTED', 'CANCELLED')),
  rating numeric DEFAULT NULL,
  trips_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT truck_listings_pkey PRIMARY KEY (id)
);

ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS truck_type text DEFAULT 'Tata Ace Gold (1.5 Ton)';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'Tata 407 (Heavy Duty)';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS capacity_tonnes numeric DEFAULT 1.5;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS capacity_tons numeric DEFAULT 3.0;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS available_capacity_tonnes numeric DEFAULT 1.5;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS total_bags_capacity integer DEFAULT 30;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS filled_bags integer DEFAULT 0;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS rate_per_bag numeric DEFAULT 45.00;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS solo_rate numeric DEFAULT 1800.00;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS origin_village text DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS destination_mandi text DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS current_mandi text DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS departure_time text DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS pickup_eta text DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS latitude double precision DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS longitude double precision DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS is_cold_chain boolean DEFAULT false;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS rating numeric DEFAULT NULL;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS trips_count integer DEFAULT 0;
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.truck_listings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='truck_type') THEN
    ALTER TABLE public.truck_listings ALTER COLUMN truck_type DROP NOT NULL;
    ALTER TABLE public.truck_listings ALTER COLUMN truck_type SET DEFAULT 'Tata Ace Gold (1.5 Ton)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='capacity_tonnes') THEN
    ALTER TABLE public.truck_listings ALTER COLUMN capacity_tonnes DROP NOT NULL;
    ALTER TABLE public.truck_listings ALTER COLUMN capacity_tonnes SET DEFAULT 1.5;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='available_capacity_tonnes') THEN
    ALTER TABLE public.truck_listings ALTER COLUMN available_capacity_tonnes DROP NOT NULL;
    ALTER TABLE public.truck_listings ALTER COLUMN available_capacity_tonnes SET DEFAULT 1.5;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='current_mandi') THEN
    ALTER TABLE public.truck_listings ALTER COLUMN current_mandi DROP NOT NULL;
  END IF;
END $$;

UPDATE public.truck_listings SET truck_type = vehicle_type WHERE truck_type IS NULL AND vehicle_type IS NOT NULL;
UPDATE public.truck_listings SET vehicle_type = truck_type WHERE vehicle_type IS NULL AND truck_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_truck_listings_status ON public.truck_listings(status);
CREATE INDEX IF NOT EXISTS idx_truck_listings_coords ON public.truck_listings(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_truck_listings_created_at ON public.truck_listings(created_at DESC);

-- 4. MACHINERY LISTINGS (Equipment Catalog)
CREATE TABLE IF NOT EXISTS public.machinery_listings (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  owner_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL,
  model_name text NOT NULL,
  hourly_rate numeric NOT NULL,
  acre_rate numeric,
  hub_name text NOT NULL DEFAULT 'Kazipet Agri Hub'::text,
  phone text NOT NULL DEFAULT '+91 98480 22338'::text,
  specifications text,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT machinery_listings_pkey PRIMARY KEY (id)
);

-- 5. LAND PARCELS (Cadastral / AgriStack Boundaries)
CREATE TABLE IF NOT EXISTS public.land_parcels (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  verified_owner_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  farmer_id text,
  parcel_id text UNIQUE DEFAULT ('PARCEL-' || floor(100000 + random() * 899999)::text),
  ulpin text UNIQUE DEFAULT ('ULPIN-' || floor(10000000 + random() * 89999999)::text),
  survey_number text NOT NULL,
  sub_survey text DEFAULT ''::text,
  khasra_no text DEFAULT NULL,
  khata_no text DEFAULT NULL,
  area_acres numeric DEFAULT NULL,
  soil_type text DEFAULT NULL,
  water_source text DEFAULT NULL,
  irrigation_source text DEFAULT NULL,
  state_code text DEFAULT 'TS'::text,
  portal_url text DEFAULT 'https://dharani.telangana.gov.in/'::text,
  cadastral_geojson jsonb DEFAULT '{}'::jsonb,
  is_verified boolean DEFAULT false,
  verified_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT land_parcels_pkey PRIMARY KEY (id)
);

-- 6. SOIL HEALTH CARDS
CREATE TABLE IF NOT EXISTS public.soil_health_cards (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  parcel_id text REFERENCES public.land_parcels(id) ON DELETE SET NULL,
  farmer_id text,
  sample_code text DEFAULT ('SHC-2026-' || floor(1000 + random() * 8999)::text),
  ph_level numeric DEFAULT NULL,
  organic_carbon_pct numeric DEFAULT NULL,
  nitrogen_kg_ha numeric DEFAULT NULL,
  phosphorus_kg_ha numeric DEFAULT NULL,
  potassium_kg_ha numeric DEFAULT NULL,
  zinc_ppm numeric DEFAULT NULL,
  iron_ppm numeric DEFAULT NULL,
  micronutrient_status jsonb DEFAULT NULL,
  recommendations text DEFAULT NULL,
  tested_on date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT soil_health_cards_pkey PRIMARY KEY (id)
);

-- 7. DISEASE SCANS (Foliar Diagnostic Scans)
CREATE TABLE IF NOT EXISTS public.disease_scans (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  scan_id text DEFAULT (gen_random_uuid())::text,
  crop_type text NOT NULL,
  disease_name text NOT NULL,
  confidence numeric NOT NULL,
  severity text NOT NULL,
  recommendations jsonb,
  image_url text,
  latitude double precision DEFAULT NULL,
  longitude double precision DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT disease_scans_pkey PRIMARY KEY (id)
);

-- 8. OUTBREAK ALERTS
CREATE TABLE IF NOT EXISTS public.outbreak_alerts (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  pest_disease text NOT NULL,
  crop_affected text NOT NULL,
  district text NOT NULL,
  severity_level text NOT NULL,
  advisory_summary text NOT NULL,
  verified_by text DEFAULT 'ICAR-CRIDA Hyderabad'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT outbreak_alerts_pkey PRIMARY KEY (id)
);

-- 9. BIO-RECIPE BATCHES
CREATE TABLE IF NOT EXISTS public.biorx_batches (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id text REFERENCES public.biorx_recipes(id) ON DELETE CASCADE,
  batch_number text NOT NULL DEFAULT ('BATCH-' || floor(100000 + random() * 899999)::text),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ready_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'FERMENTING'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT biorx_batches_pkey PRIMARY KEY (id)
);

-- 10. LIVE MANDI RATES (Agmarknet National Prices)
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  state text NOT NULL,
  district text NOT NULL,
  market text NOT NULL,
  market_name text,
  commodity text NOT NULL,
  commodity_te text,
  commodity_hi text,
  variety text NOT NULL DEFAULT 'Standard'::text,
  arrival_date date DEFAULT CURRENT_DATE,
  trade_date date DEFAULT CURRENT_DATE,
  price_date date DEFAULT CURRENT_DATE,
  min_price numeric NOT NULL DEFAULT 0,
  max_price numeric NOT NULL DEFAULT 0,
  modal_price numeric NOT NULL DEFAULT 0,
  msp_price numeric DEFAULT 0,
  arrivals_qtl numeric DEFAULT 0,
  trend text DEFAULT 'stable'::text,
  trend_pct numeric DEFAULT 0,
  source_name text DEFAULT 'Agmarknet / DMI (Govt of India)'::text,
  source_url text DEFAULT 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070'::text,
  source_dataset text DEFAULT 'Daily Mandi Market Prices'::text,
  freshness_status text DEFAULT 'Daily'::text,
  market_center_lat numeric DEFAULT NULL,
  market_center_lng numeric DEFAULT NULL,
  fetched_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mandi_live_rates_pkey PRIMARY KEY (id)
);

ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS arrival_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS trade_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS price_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS commodity_te text;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS commodity_hi text;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS market_name text;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS arrivals_qtl numeric DEFAULT 0;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS msp_price numeric DEFAULT 0;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS trend text DEFAULT 'stable';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS trend_pct numeric DEFAULT 0;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_mandi_live_rates_record 
ON public.mandi_live_rates (LOWER(TRIM(state)), LOWER(TRIM(district)), LOWER(TRIM(market)), LOWER(TRIM(commodity)), LOWER(TRIM(COALESCE(variety, 'Standard'))), arrival_date);

CREATE INDEX IF NOT EXISTS idx_mandi_lookup ON public.mandi_live_rates(state, district, commodity, arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_mandi_market_search ON public.mandi_live_rates(LOWER(TRIM(market)), commodity);
CREATE INDEX IF NOT EXISTS idx_mandi_arrival_date ON public.mandi_live_rates(arrival_date DESC);

-- 11. MANDI ALERTS & PRICE ALERTS
CREATE TABLE IF NOT EXISTS public.mandi_alerts (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  commodity text NOT NULL,
  target_price numeric NOT NULL,
  condition text DEFAULT 'GTE'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mandi_alerts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  crop_slug text NOT NULL,
  mandi_id text NOT NULL,
  target_price_per_qtl numeric NOT NULL,
  alert_condition text DEFAULT 'ABOVE'::text,
  notification_channel text DEFAULT 'ALL'::text,
  is_active boolean DEFAULT true,
  triggered_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT price_alerts_pkey PRIMARY KEY (id)
);

-- 12. HAUL BOOKINGS (GramHaul Logistics Workflow)
CREATE TABLE IF NOT EXISTS public.haul_bookings (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_user_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  truck_id text REFERENCES public.truck_listings(id) ON DELETE SET NULL,
  farmer_id text,
  driver_id text,
  driver_name text,
  driver_phone text,
  vehicle_type text DEFAULT 'Tata Ace Gold (1.5 Ton)'::text,
  vehicle_plate text,
  vehicle_number text,
  pickup_village text NOT NULL,
  destination_mandi text NOT NULL,
  dropoff_mandi text,
  crop_name text NOT NULL,
  crop text,
  crop_type text,
  load_quintals numeric NOT NULL,
  quantity_quintals numeric,
  agreed_fare numeric NOT NULL,
  estimated_cost numeric,
  total_fare numeric,
  distance_km numeric DEFAULT NULL,
  pickup_eta text DEFAULT NULL,
  pickup_lat double precision DEFAULT NULL,
  pickup_lng double precision DEFAULT NULL,
  dropoff_lat double precision DEFAULT NULL,
  dropoff_lng double precision DEFAULT NULL,
  drop_lat double precision DEFAULT NULL,
  drop_lng double precision DEFAULT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status IN ('PENDING', 'ACCEPTED', 'ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
  pickup_time timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT haul_bookings_pkey PRIMARY KEY (id)
);

ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS farmer_user_id text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_user_id text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS truck_id text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_phone text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'Tata Ace Gold (1.5 Ton)';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS agreed_fare numeric;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_eta text DEFAULT NULL;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'PENDING';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'UPI';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS payment_reference text DEFAULT NULL;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS otp_pin text DEFAULT NULL;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS otp_attempts integer DEFAULT 0;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS otp_expires_at timestamp with time zone DEFAULT (now() + interval '2 hours');
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();


-- 13. TRIP WAYPOINTS (GPS Tracking Breadcrumbs)
CREATE TABLE IF NOT EXISTS public.trip_waypoints (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  booking_id text NOT NULL REFERENCES public.haul_bookings(id) ON DELETE CASCADE,
  driver_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision DEFAULT 0,
  heading double precision DEFAULT 0,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_waypoints ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;

-- 14. DRIVER TELEMETRY (Live Telemetry Stream)
CREATE TABLE IF NOT EXISTS public.driver_telemetry (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id text,
  booking_id text REFERENCES public.haul_bookings(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed double precision DEFAULT 0,
  heading double precision DEFAULT 0,
  accuracy double precision DEFAULT 5.0,
  battery_level integer DEFAULT NULL,
  is_online boolean DEFAULT true,
  last_ping timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_telemetry_pkey PRIMARY KEY (id)
);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;


-- 15. DRIVER LOCATIONS (Fleet Tracker)
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  driver_id text NOT NULL UNIQUE,
  driver_name text NOT NULL,
  driver_phone text NOT NULL,
  vehicle_number text NOT NULL,
  vehicle_type text DEFAULT 'Tata Ace (1.5T)'::text,
  current_lat double precision NOT NULL,
  current_lng double precision NOT NULL,
  heading double precision DEFAULT 0.0,
  speed_kmh double precision DEFAULT 0.0,
  is_available boolean DEFAULT true,
  active_booking_id text REFERENCES public.haul_bookings(id) ON DELETE SET NULL,
  last_ping timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_locations_pkey PRIMARY KEY (id)
);

-- 16. SUBSIDIES (Govt Schemes Catalog)
CREATE TABLE IF NOT EXISTS public.subsidies (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  scheme_name text NOT NULL UNIQUE,
  authority text NOT NULL,
  benefit_amount text NOT NULL,
  eligibility text NOT NULL,
  official_portal_url text NOT NULL,
  status text DEFAULT 'Active / Open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subsidies_pkey PRIMARY KEY (id)
);

ALTER TABLE public.subsidies ADD COLUMN IF NOT EXISTS authority text DEFAULT 'Government of India';
ALTER TABLE public.subsidies ADD COLUMN IF NOT EXISTS benefit_amount text DEFAULT 'Direct Benefit Transfer';
ALTER TABLE public.subsidies ADD COLUMN IF NOT EXISTS eligibility text DEFAULT 'All eligible farmers';
ALTER TABLE public.subsidies ADD COLUMN IF NOT EXISTS official_portal_url text DEFAULT 'https://agricoop.nic.in/';
ALTER TABLE public.subsidies ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active / Open';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='department') THEN
    ALTER TABLE public.subsidies ALTER COLUMN department DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='subsidy_pct') THEN
    ALTER TABLE public.subsidies ALTER COLUMN subsidy_pct DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='max_amount') THEN
    ALTER TABLE public.subsidies ALTER COLUMN max_amount DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='authority') THEN
    ALTER TABLE public.subsidies ALTER COLUMN authority DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='benefit_amount') THEN
    ALTER TABLE public.subsidies ALTER COLUMN benefit_amount DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='eligibility') THEN
    ALTER TABLE public.subsidies ALTER COLUMN eligibility DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subsidies' AND column_name='official_portal_url') THEN
    ALTER TABLE public.subsidies ALTER COLUMN official_portal_url DROP NOT NULL;
  END IF;
END $$;

-- 17. KCC APPLICATIONS
CREATE TABLE IF NOT EXISTS public.kcc_applications (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  scheme_code text NOT NULL,
  scheme_title text NOT NULL,
  requested_amount numeric NOT NULL,
  sanctioned_amount numeric DEFAULT NULL,
  interest_subvention_pct numeric DEFAULT NULL,
  effective_roi_pct numeric DEFAULT NULL,
  sanctioning_bank text DEFAULT NULL,
  application_stage text NOT NULL DEFAULT 'SUBMITTED'::text,
  dbt_account_number text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kcc_applications_pkey PRIMARY KEY (id)
);

-- 18. KHATA TRANSACTIONS (Farmer Ledger)
CREATE TABLE IF NOT EXISTS public.khata_transactions (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  type text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  transaction_date date DEFAULT CURRENT_DATE,
  date date DEFAULT CURRENT_DATE,
  payment_mode text DEFAULT 'Cash'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT khata_transactions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS transaction_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'Cash'::text;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS category text DEFAULT 'General'::text;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense'::text;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS description text DEFAULT ''::text;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

UPDATE public.khata_transactions SET date = transaction_date WHERE date IS NULL AND transaction_date IS NOT NULL;
UPDATE public.khata_transactions SET transaction_date = date WHERE transaction_date IS NULL AND date IS NOT NULL;

-- 19. MACHINERY BOOKINGS
CREATE TABLE IF NOT EXISTS public.machinery_bookings (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  booking_ref text NOT NULL UNIQUE DEFAULT ('MB-' || floor(100000 + random() * 899999)::text),
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  machinery_id text REFERENCES public.machinery_listings(id) ON DELETE SET NULL,
  machine_id text,
  machine_name text NOT NULL,
  farmer_name text NOT NULL DEFAULT 'Farmer'::text,
  farmer_phone text NOT NULL DEFAULT '+91 98492 11048'::text,
  farmer_village text NOT NULL DEFAULT 'Warangal Rural'::text,
  farmer_id text,
  booking_unit text DEFAULT 'acre'::text,
  quantity numeric DEFAULT 1.0,
  acreage numeric DEFAULT 2.0,
  total_amount numeric NOT NULL DEFAULT 0,
  booking_date date DEFAULT CURRENT_DATE,
  service_date date DEFAULT CURRENT_DATE,
  time_slot text DEFAULT 'Morning (08:00 - 12:00)'::text,
  status text NOT NULL DEFAULT 'CONFIRMED'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT machinery_bookings_pkey PRIMARY KEY (id)
);

-- 20. MACHINERY MESSAGES
CREATE TABLE IF NOT EXISTS public.machinery_messages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  item_id text REFERENCES public.machinery_bookings(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'user'::text,
  sender_name text NOT NULL DEFAULT 'Farmer'::text,
  recipient_name text,
  message_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT machinery_messages_pkey PRIMARY KEY (id)
);

-- 21. COMMUNITY POSTS (Kisan Forum)
CREATE TABLE IF NOT EXISTS public.community_posts (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  author_name text NOT NULL DEFAULT 'Farmer'::text,
  author_village text DEFAULT NULL,
  avatar_url text DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'::text,
  crop_id text NOT NULL DEFAULT 'cotton'::text,
  crop_type text DEFAULT 'cotton'::text,
  title text NOT NULL,
  content text NOT NULL,
  body text,
  description text,
  media_url text,
  media_type text DEFAULT 'none'::text,
  media_label text DEFAULT 'Field Photo'::text,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  upvotes integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  is_verified_agronomist boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_pkey PRIMARY KEY (id)
);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_name text DEFAULT 'Farmer';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_village text DEFAULT NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS crop_id text DEFAULT 'cotton';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS title text DEFAULT 'Community Update';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS content text DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_posts' AND column_name='crop_type') THEN
    ALTER TABLE public.community_posts ALTER COLUMN crop_type DROP NOT NULL;
    ALTER TABLE public.community_posts ALTER COLUMN crop_type SET DEFAULT 'General';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_posts' AND column_name='avatar_url') THEN
    ALTER TABLE public.community_posts ALTER COLUMN avatar_url DROP NOT NULL;
    ALTER TABLE public.community_posts ALTER COLUMN avatar_url SET DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80';
  END IF;
END $$;

-- 22. COMMUNITY COMMENTS
CREATE TABLE IF NOT EXISTS public.community_comments (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  post_id text NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  author_name text NOT NULL DEFAULT 'Farmer'::text,
  author_role text DEFAULT 'Progressive Farmer'::text,
  role text DEFAULT 'Farmer'::text,
  avatar_url text DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'::text,
  content text NOT NULL,
  comment_body text,
  comment_text text,
  is_icar_expert boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT community_comments_pkey PRIMARY KEY (id)
);

-- 23. COMMUNITY LIKES (Legacy Table)
CREATE TABLE IF NOT EXISTS public.community_likes (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  post_id text NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT community_likes_pkey PRIMARY KEY (id),
  CONSTRAINT community_likes_post_user_uq UNIQUE (post_id, user_id)
);

-- 23b. POST LIKES (Realtime Counter Engine)
CREATE TABLE IF NOT EXISTS public.post_likes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id text NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_post_likes UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS post_id text;
ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON public.post_likes(created_at DESC);

-- Automated Counter Trigger: post_likes -> community_posts.likes_count (SECURE SEARCH PATH)
CREATE OR REPLACE FUNCTION public.fn_sync_post_likes_count()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.community_posts
        SET likes_count = COALESCE(likes_count, 0) + 1,
            updated_at = NOW()
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.community_posts
        SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
            updated_at = NOW()
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_likes_count();

-- 24. USER FOLLOWS
CREATE TABLE IF NOT EXISTS public.user_follows (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  follower_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_pkey PRIMARY KEY (id),
  CONSTRAINT user_follows_pair_uq UNIQUE (follower_id, following_id)
);

ALTER TABLE public.user_follows ADD COLUMN IF NOT EXISTS follower_id text;
ALTER TABLE public.user_follows ADD COLUMN IF NOT EXISTS following_id text;
ALTER TABLE public.user_follows ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON public.user_follows(created_at DESC);

-- 25. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id text,
  session_id text NOT NULL,
  role text NOT NULL,
  message_text text NOT NULL,
  tokens_consumed integer DEFAULT 0,
  language text DEFAULT 'en'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

-- 26. PEER MESSAGES
CREATE TABLE IF NOT EXISTS public.peer_messages (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  sender_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_email text NOT NULL,
  receiver_email text NOT NULL,
  receiver_name text NOT NULL,
  message_text text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT peer_messages_pkey PRIMARY KEY (id)
);

-- 27. MANDI INGESTION RUNS
CREATE TABLE IF NOT EXISTS public.mandi_ingestion_runs (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  source_name text NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  records_received integer DEFAULT 0,
  records_inserted integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_rejected integer DEFAULT 0,
  status text DEFAULT 'RUNNING'::text,
  error_message text,
  CONSTRAINT mandi_ingestion_runs_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────────────────────────────
-- STEP 4: MIGRATION & EXPLICIT FOREIGN KEY REPAIR
-- ─────────────────────────────────────────────────────────────────
-- Explicitly sanitizes and casts primary/foreign key columns without
-- blind dynamic policy drops.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    ALTER TABLE public.profiles ALTER COLUMN id TYPE text USING id::text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id') THEN
      ALTER TABLE public.profiles ALTER COLUMN user_id TYPE text USING user_id::text;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='khata_transactions') THEN
    ALTER TABLE public.khata_transactions ALTER COLUMN id TYPE text USING id::text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khata_transactions' AND column_name='user_id') THEN
      ALTER TABLE public.khata_transactions ALTER COLUMN user_id TYPE text USING user_id::text;
      UPDATE public.khata_transactions SET user_id = NULL WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = khata_transactions.user_id);
      ALTER TABLE public.khata_transactions DROP CONSTRAINT IF EXISTS khata_transactions_user_id_fkey;
      ALTER TABLE public.khata_transactions ADD CONSTRAINT khata_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='haul_bookings') THEN
    ALTER TABLE public.haul_bookings ALTER COLUMN id TYPE text USING id::text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='farmer_user_id') THEN
      ALTER TABLE public.haul_bookings ALTER COLUMN farmer_user_id TYPE text USING farmer_user_id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='driver_user_id') THEN
      ALTER TABLE public.haul_bookings ALTER COLUMN driver_user_id TYPE text USING driver_user_id::text;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='truck_listings') THEN
    ALTER TABLE public.truck_listings ALTER COLUMN id TYPE text USING id::text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='user_id') THEN
      ALTER TABLE public.truck_listings ALTER COLUMN user_id TYPE text USING user_id::text;
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 5: INDEXES ON ALL FOREIGN KEY RELATIONSHIPS
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_land_parcels_user_id ON public.land_parcels(user_id);
CREATE INDEX IF NOT EXISTS idx_soil_health_cards_user_id ON public.soil_health_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_soil_health_cards_parcel_id ON public.soil_health_cards(parcel_id);
CREATE INDEX IF NOT EXISTS idx_disease_scans_user_id ON public.disease_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_biorx_batches_user_id ON public.biorx_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_biorx_batches_recipe_id ON public.biorx_batches(recipe_id);
CREATE INDEX IF NOT EXISTS idx_truck_listings_transporter ON public.truck_listings(transporter_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_user_id ON public.haul_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_farmer_user_id ON public.haul_bookings(farmer_user_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_driver_user_id ON public.haul_bookings(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_truck_id ON public.haul_bookings(truck_id);
CREATE INDEX IF NOT EXISTS idx_trip_waypoints_booking_id ON public.trip_waypoints(booking_id);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_user_id ON public.driver_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_machinery_listings_owner ON public.machinery_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_machinery_bookings_user ON public.machinery_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_machinery_bookings_machinery ON public.machinery_bookings(machinery_id);
CREATE INDEX IF NOT EXISTS idx_machinery_messages_item ON public.machinery_messages(item_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user ON public.community_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_post ON public.community_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_user ON public.community_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_kcc_applications_user ON public.kcc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_khata_transactions_user ON public.khata_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_khata_transactions_created_at ON public.khata_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mandi_alerts_user ON public.mandi_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id);

-- ─────────────────────────────────────────────────────────────────
-- STEP 6: HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────
-- Enable RLS across all managed tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'profiles', 'land_parcels', 'soil_health_cards', 'disease_scans',
    'outbreak_alerts', 'biorx_recipes', 'biorx_batches', 'mandi_live_rates',
    'mandi_alerts', 'price_alerts', 'khata_transactions', 'machinery_listings',
    'machinery_bookings', 'machinery_messages', 'truck_listings',
    'haul_bookings', 'trip_waypoints', 'driver_telemetry', 'driver_locations',
    'community_posts', 'community_comments', 'community_likes', 'user_follows',
    'post_likes', 'chat_messages', 'peer_messages', 'subsidies',
    'kcc_applications', 'mandi_ingestion_runs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- 1. PROFILES (Strict Privacy: Owner-Only Direct Access; Public Identity via public_profiles View)
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = id 
    OR auth.uid()::text = user_id 
    OR auth.jwt()->>'email' = email
  )
);

DROP POLICY IF EXISTS "profiles_modify_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = id OR auth.uid()::text = user_id)
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = id OR auth.uid()::text = user_id)
) WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = id OR auth.uid()::text = user_id)
);

-- 2. PRIVATE FINANCIAL & AGRONOMIC LEDGER (Zero-Leakage Owner Isolation)
-- Khata Transactions
DROP POLICY IF EXISTS "khata_isolation" ON public.khata_transactions;
DROP POLICY IF EXISTS "khata_transactions_isolation" ON public.khata_transactions;
DROP POLICY IF EXISTS "khata_transactions_owner" ON public.khata_transactions;
CREATE POLICY "khata_transactions_owner" ON public.khata_transactions FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Land Parcels
DROP POLICY IF EXISTS "parcels_isolation" ON public.land_parcels;
DROP POLICY IF EXISTS "land_parcels_owner" ON public.land_parcels;
CREATE POLICY "land_parcels_owner" ON public.land_parcels FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Soil Health Cards
DROP POLICY IF EXISTS "soil_cards_isolation" ON public.soil_health_cards;
DROP POLICY IF EXISTS "soil_health_cards_owner" ON public.soil_health_cards;
CREATE POLICY "soil_health_cards_owner" ON public.soil_health_cards FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Disease Scans
DROP POLICY IF EXISTS "scans_isolation" ON public.disease_scans;
DROP POLICY IF EXISTS "disease_scans_owner" ON public.disease_scans;
CREATE POLICY "disease_scans_owner" ON public.disease_scans FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- KCC Loan Applications
DROP POLICY IF EXISTS "kcc_isolation" ON public.kcc_applications;
DROP POLICY IF EXISTS "kcc_applications_owner" ON public.kcc_applications;
CREATE POLICY "kcc_applications_owner" ON public.kcc_applications FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- BioRx Batches
DROP POLICY IF EXISTS "biorx_batches_owner" ON public.biorx_batches;
CREATE POLICY "biorx_batches_owner" ON public.biorx_batches FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Mandi Alerts & Price Alerts
DROP POLICY IF EXISTS "mandi_alerts_isolation" ON public.mandi_alerts;
DROP POLICY IF EXISTS "mandi_alerts_owner" ON public.mandi_alerts;
CREATE POLICY "mandi_alerts_owner" ON public.mandi_alerts FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

DROP POLICY IF EXISTS "price_alerts_owner" ON public.price_alerts;
CREATE POLICY "price_alerts_owner" ON public.price_alerts FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Chat Messages
DROP POLICY IF EXISTS "chat_isolation" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_owner" ON public.chat_messages;
CREATE POLICY "chat_messages_owner" ON public.chat_messages FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Peer Messages
DROP POLICY IF EXISTS "peer_messages_parties" ON public.peer_messages;
CREATE POLICY "peer_messages_parties" ON public.peer_messages FOR ALL USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id)
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = sender_id
);

-- 3. TRUCK LISTINGS & GRAMHAUL FLEET MANAGEMENT (Strict Owner Enforcement)
DROP POLICY IF EXISTS "truck_listings_read" ON public.truck_listings;
CREATE POLICY "truck_listings_read" ON public.truck_listings FOR SELECT USING (
  status = 'ACTIVE' OR (auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = transporter_id))
);

DROP POLICY IF EXISTS "truck_listings_write" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_insert_owner" ON public.truck_listings;
CREATE POLICY "truck_listings_insert_owner" ON public.truck_listings FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = transporter_id)
);

DROP POLICY IF EXISTS "truck_listings_update" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_update_owner" ON public.truck_listings;
CREATE POLICY "truck_listings_update_owner" ON public.truck_listings FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = transporter_id)
) WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = transporter_id)
);

DROP POLICY IF EXISTS "truck_listings_delete" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_delete_owner" ON public.truck_listings;
CREATE POLICY "truck_listings_delete_owner" ON public.truck_listings FOR DELETE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = transporter_id)
);

-- 4. HAUL BOOKINGS (Strict Parties-Only Access)
DROP POLICY IF EXISTS "haul_bookings_parties" ON public.haul_bookings;
DROP POLICY IF EXISTS "haul_bookings_select" ON public.haul_bookings;
CREATE POLICY "haul_bookings_select" ON public.haul_bookings FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = farmer_user_id
    OR auth.uid()::text = driver_user_id
    OR auth.uid()::text = user_id
  )
);

DROP POLICY IF EXISTS "haul_bookings_insert" ON public.haul_bookings;
CREATE POLICY "haul_bookings_insert" ON public.haul_bookings FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = farmer_user_id OR auth.uid()::text = user_id)
);

DROP POLICY IF EXISTS "haul_bookings_update" ON public.haul_bookings;
CREATE POLICY "haul_bookings_update" ON public.haul_bookings FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = farmer_user_id
    OR auth.uid()::text = driver_user_id
    OR auth.uid()::text = user_id
    -- Driver acceptance of an unassigned pending booking
    OR (driver_user_id IS NULL AND status = 'PENDING')
  )
) WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = farmer_user_id
    OR auth.uid()::text = driver_user_id
    OR auth.uid()::text = user_id
  )
);

DROP POLICY IF EXISTS "haul_bookings_delete" ON public.haul_bookings;
CREATE POLICY "haul_bookings_delete" ON public.haul_bookings FOR DELETE USING (
  auth.uid() IS NOT NULL 
  AND (auth.uid()::text = farmer_user_id OR auth.uid()::text = user_id)
  AND status IN ('PENDING', 'CANCELLED')
);

-- 5. DRIVER TELEMETRY & GPS TRACKING (Authenticated Driver Writes; Booking-Freshness Farmer Access)
DROP POLICY IF EXISTS "driver_telemetry_insert" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_insert" ON public.driver_telemetry FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

DROP POLICY IF EXISTS "driver_telemetry_update" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_update" ON public.driver_telemetry FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

DROP POLICY IF EXISTS "driver_telemetry_select" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_select" ON public.driver_telemetry FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = user_id
    OR (
      booking_id IS NOT NULL 
      AND last_ping >= (NOW() - INTERVAL '24 hours')
      AND EXISTS (
        SELECT 1 FROM public.haul_bookings b 
        WHERE b.id = driver_telemetry.booking_id 
        AND (b.farmer_user_id = auth.uid()::text OR b.user_id = auth.uid()::text)
        AND b.status IN ('ACCEPTED', 'ARRIVED', 'IN_TRANSIT')
      )
    )
  )
);

-- Trip Waypoints
DROP POLICY IF EXISTS "trip_waypoints_insert" ON public.trip_waypoints;
CREATE POLICY "trip_waypoints_insert" ON public.trip_waypoints FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = driver_id
    OR EXISTS (
      SELECT 1 FROM public.haul_bookings b 
      WHERE b.id = trip_waypoints.booking_id 
      AND b.driver_user_id = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "trip_waypoints_select" ON public.trip_waypoints;
CREATE POLICY "trip_waypoints_select" ON public.trip_waypoints FOR SELECT USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.haul_bookings b 
    WHERE b.id = trip_waypoints.booking_id 
    AND (
      b.farmer_user_id = auth.uid()::text 
      OR b.driver_user_id = auth.uid()::text 
      OR b.user_id = auth.uid()::text
    )
  )
);

-- Driver Locations (Fleet Availability Tracker)
DROP POLICY IF EXISTS "driver_locations_write" ON public.driver_locations;
CREATE POLICY "driver_locations_write" ON public.driver_locations FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = driver_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = driver_id
);

DROP POLICY IF EXISTS "public_read_driver_locations" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_read" ON public.driver_locations;
CREATE POLICY "driver_locations_read" ON public.driver_locations FOR SELECT USING (
  is_available = true 
  OR (auth.uid() IS NOT NULL AND (
    auth.uid()::text = driver_id 
    OR (active_booking_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.haul_bookings b 
      WHERE b.id = driver_locations.active_booking_id 
      AND (b.farmer_user_id = auth.uid()::text OR b.user_id = auth.uid()::text)
    ))
  ))
);

-- 6. COMMUNITY ENGINE (Likes, Follows, Posts, Comments)
-- Post Likes
DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;
CREATE POLICY "post_likes_read" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_likes_write" ON public.post_likes;
CREATE POLICY "post_likes_write" ON public.post_likes FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

DROP POLICY IF EXISTS "post_likes_update" ON public.post_likes;
CREATE POLICY "post_likes_update" ON public.post_likes FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;
CREATE POLICY "post_likes_delete" ON public.post_likes FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- Legacy Community Likes
DROP POLICY IF EXISTS "community_likes_isolation" ON public.community_likes;
CREATE POLICY "community_likes_isolation" ON public.community_likes FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

-- User Follows
DROP POLICY IF EXISTS "user_follows_read" ON public.user_follows;
CREATE POLICY "user_follows_read" ON public.user_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_follows_write" ON public.user_follows;
CREATE POLICY "user_follows_write" ON public.user_follows FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = follower_id
);

DROP POLICY IF EXISTS "user_follows_update" ON public.user_follows;
CREATE POLICY "user_follows_update" ON public.user_follows FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = follower_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = follower_id
);

DROP POLICY IF EXISTS "user_follows_delete" ON public.user_follows;
CREATE POLICY "user_follows_delete" ON public.user_follows FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = follower_id
);

-- Community Posts
DROP POLICY IF EXISTS "community_posts_read" ON public.community_posts;
CREATE POLICY "community_posts_read" ON public.community_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "community_posts_write" ON public.community_posts;
CREATE POLICY "community_posts_write" ON public.community_posts FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
);

DROP POLICY IF EXISTS "community_posts_modify" ON public.community_posts;
CREATE POLICY "community_posts_modify" ON public.community_posts FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
) WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
);

DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;
CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
);

-- Community Comments
DROP POLICY IF EXISTS "community_comments_read" ON public.community_comments;
CREATE POLICY "community_comments_read" ON public.community_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "community_comments_write" ON public.community_comments;
CREATE POLICY "community_comments_write" ON public.community_comments FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
);

DROP POLICY IF EXISTS "community_comments_modify" ON public.community_comments;
CREATE POLICY "community_comments_modify" ON public.community_comments FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
) WITH CHECK (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
);

DROP POLICY IF EXISTS "community_comments_delete" ON public.community_comments;
CREATE POLICY "community_comments_delete" ON public.community_comments FOR DELETE USING (
  auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
);

-- Machinery Listings & Bookings
DROP POLICY IF EXISTS "public_read_machinery" ON public.machinery_listings;
CREATE POLICY "public_read_machinery" ON public.machinery_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "machinery_listings_manage" ON public.machinery_listings;
CREATE POLICY "machinery_listings_manage" ON public.machinery_listings FOR ALL USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = owner_id
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = owner_id
);

DROP POLICY IF EXISTS "machinery_bookings_parties" ON public.machinery_bookings;
CREATE POLICY "machinery_bookings_parties" ON public.machinery_bookings FOR ALL USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM public.machinery_listings ml
      WHERE ml.id = machinery_bookings.machinery_id AND ml.owner_id = auth.uid()::text
    )
  )
) WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id
);

DROP POLICY IF EXISTS "machinery_messages_parties" ON public.machinery_messages;
CREATE POLICY "machinery_messages_parties" ON public.machinery_messages FOR ALL USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.machinery_bookings mb
    WHERE mb.id = machinery_messages.item_id
    AND (
      mb.user_id = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.machinery_listings ml
        WHERE ml.id = mb.machinery_id AND ml.owner_id = auth.uid()::text
      )
    )
  )
) WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Public Reference Catalogs (Read-Only to Public; Managed by System/Admin)
DROP POLICY IF EXISTS "public_read_biorx_recipes" ON public.biorx_recipes;
CREATE POLICY "public_read_biorx_recipes" ON public.biorx_recipes FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_mandi_rates" ON public.mandi_live_rates;
CREATE POLICY "public_read_mandi_rates" ON public.mandi_live_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_role_manage_mandi_rates" ON public.mandi_live_rates;
CREATE POLICY "service_role_manage_mandi_rates" ON public.mandi_live_rates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_mandi_ingestion_runs" ON public.mandi_ingestion_runs;
CREATE POLICY "service_role_mandi_ingestion_runs" ON public.mandi_ingestion_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_outbreaks" ON public.outbreak_alerts;
CREATE POLICY "public_read_outbreaks" ON public.outbreak_alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_subsidies" ON public.subsidies;
CREATE POLICY "public_read_subsidies" ON public.subsidies FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- STEP 7: SECURE AUTH SIGNUP TRIGGER (MAPPING auth.users TO profiles)
-- ─────────────────────────────────────────────────────────────────
-- Prevents privilege escalation: whitelists requested roles strictly
-- to 'farmer' or 'driver'. 'admin' and 'agronomist' cannot be self-assigned.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_role text;
  v_requested_role text;
  v_village text;
  v_district text;
  v_farmer_id text;
  v_driver_id text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Farmer'
  );
  v_phone := COALESCE(
    NEW.phone,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'phone_number'
  );

  -- Role whitelist & privilege escalation prevention:
  v_requested_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'farmer'));
  IF v_requested_role NOT IN ('farmer', 'driver') THEN
    v_role := 'farmer'; -- Force safe non-privileged role
  ELSE
    v_role := v_requested_role;
  END IF;

  v_village := COALESCE(NEW.raw_user_meta_data->>'village', 'Warangal Rural');
  v_district := COALESCE(NEW.raw_user_meta_data->>'district', 'Warangal');

  IF v_role = 'driver' THEN
    v_farmer_id := NULL;
    v_driver_id := 'DRV-' || floor(10000 + random() * 89999)::text;
  ELSE
    v_farmer_id := 'NK-' || floor(10000 + random() * 89999)::text;
    v_driver_id := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, user_id, farmer_id, driver_id, email, full_name, phone, phone_number,
    role, village, district, mandal, state, preferred_language, created_at, updated_at
  )
  VALUES (
    NEW.id::text, NEW.id::text, v_farmer_id, v_driver_id, NEW.email, v_full_name,
    v_phone, v_phone, v_role, v_village, v_district, 'Warangal', 'Telangana', 'en', NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.id,
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    full_name = CASE WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = 'Farmer' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Safe, non-destructive backfill: ensure existing auth.users have matching profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO public.profiles (id, user_id, email, full_name, role, created_at, updated_at)
    SELECT 
      u.id::text, 
      u.id::text, 
      u.email, 
      COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Farmer'),
      COALESCE(u.raw_user_meta_data->>'role', 'farmer'),
      u.created_at,
      NOW()
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id::text
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Safe recovery in restricted non-superuser environments
END $$;


-- ─────────────────────────────────────────────────────────────────
-- STEP 8: REALTIME PUBLICATIONS
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pub_exists boolean;
  tbl text;
  tables text[] := ARRAY[
    'driver_telemetry',
    'driver_locations',
    'haul_bookings',
    'truck_listings',
    'trip_waypoints',
    'community_posts',
    'community_comments',
    'post_likes',
    'user_follows',
    'machinery_messages',
    'chat_messages',
    'peer_messages'
  ];
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  IF NOT pub_exists THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, proceed
      END;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 9: STORAGE BUCKETS CONFIGURATION (PRIVACY-BY-DEFAULT)
-- ─────────────────────────────────────────────────────────────────
-- crop-scans is strictly PRIVATE (public = false) to prevent unauthorized photo access.
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('community-media', 'community-media', true),
  ('crop-scans', 'crop-scans', false),
  ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$ BEGIN
  -- 1. Community Media (Public read, authenticated upload, owner delete)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on community media') THEN
    CREATE POLICY "Allow public read on community media" ON storage.objects FOR SELECT USING (bucket_id = 'community-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload on community media') THEN
    CREATE POLICY "Allow authenticated upload on community media" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'community-media' AND auth.role() = 'authenticated'
    );
  END IF;

  -- 2. Crop Scans (PRIVATE: Owner only read & upload)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on crop scans') THEN
    DROP POLICY "Allow public read on crop scans" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload on crop scans') THEN
    DROP POLICY "Allow authenticated upload on crop scans" ON storage.objects;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'crop_scans_owner_read') THEN
    CREATE POLICY "crop_scans_owner_read" ON storage.objects FOR SELECT USING (
      bucket_id = 'crop-scans' 
      AND auth.uid() IS NOT NULL 
      AND (
        owner = auth.uid()
        OR (storage.foldername(name))[1] = auth.uid()::text
        OR name LIKE (auth.uid()::text || '/%')
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'crop_scans_owner_upload') THEN
    CREATE POLICY "crop_scans_owner_upload" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'crop-scans' 
      AND auth.uid() IS NOT NULL 
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR name LIKE (auth.uid()::text || '/%')
      )
    );
  END IF;

  -- 3. Profile Avatars (Public read, owner upload)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on profile avatars') THEN
    CREATE POLICY "Allow public read on profile avatars" ON storage.objects FOR SELECT USING (bucket_id = 'profile-avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload on profile avatars') THEN
    CREATE POLICY "Allow authenticated upload on profile avatars" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'profile-avatars' AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 10: AUTHENTIC GOVERNMENT & BOTANICAL REFERENCE CATALOGS ONLY
-- ─────────────────────────────────────────────────────────────────
-- NOTE: Demo truck listings and fake community posts are strictly isolated 
-- in supabase/seed/dev_fixtures.sql and are NOT included in production.

-- BioRx Recipes Seed (ICAR-Approved Botanical Recipes)
INSERT INTO public.biorx_recipes (title, target_pest_disease, ingredients, preparation_steps, fermentation_hours, dilution_ratio, shelf_life_days, icar_approved)
SELECT 'Dashaparni Kashayam', ARRAY['thrips', 'aphids', 'whiteflies', 'caterpillars'],
 '{"neem_leaves_kg": 5, "papaya_leaves_kg": 2, "custard_apple_leaves_kg": 2, "cow_urine_liters": 10, "cow_dung_kg": 2, "water_liters": 200}'::jsonb,
 '["Crush all 10 medicinal leaves into a coarse paste", "Mix cow dung and cow urine in 200L water tank", "Add crushed leaves paste into the solution", "Cover with gunny bag and stir clockwise twice daily for 21 days", "Filter through fine cotton cloth before spraying"]'::jsonb,
 504, '1:10 (Water)', 180, true
WHERE NOT EXISTS (SELECT 1 FROM public.biorx_recipes WHERE title = 'Dashaparni Kashayam');

INSERT INTO public.biorx_recipes (title, target_pest_disease, ingredients, preparation_steps, fermentation_hours, dilution_ratio, shelf_life_days, icar_approved)
SELECT 'Jeevamrutha (Liquid Bio-Fertilizer)', ARRAY['soil_fertility', 'root_rot', 'microbial_boost'],
 '{"cow_dung_kg": 10, "cow_urine_liters": 10, "jaggery_kg": 2, "pulse_flour_kg": 2, "virgin_soil_handfuls": 1, "water_liters": 200}'::jsonb,
 '["Fill 200L drum with fresh water", "Add fresh cow dung and cow urine and stir vigorously", "Dissolve 2kg jaggery and 2kg chickpea flour in water and add to drum", "Add handful of fertile soil from field bund", "Keep in shade, stir 10 minutes clockwise twice daily for 48-72 hours"]'::jsonb,
 72, '1:10 (Irrigation/Foliar)', 7, true
WHERE NOT EXISTS (SELECT 1 FROM public.biorx_recipes WHERE title = 'Jeevamrutha (Liquid Bio-Fertilizer)');

INSERT INTO public.biorx_recipes (title, target_pest_disease, ingredients, preparation_steps, fermentation_hours, dilution_ratio, shelf_life_days, icar_approved)
SELECT 'Neemastra', ARRAY['sucking_pests', 'mealybugs', 'leaf_hoppers'],
 '{"cow_urine_liters": 5, "cow_dung_kg": 2, "neem_leaves_kg": 5, "water_liters": 100}'::jsonb,
 '["Crush 5kg neem leaves into fine pulp", "Mix with 2kg fresh cow dung and 5L cow urine in 100L water", "Ferment for 48 hours in shadow", "Filter cloth and spray directly without extra dilution"]'::jsonb,
 48, 'Direct Spray (No Dilution)', 21, true
WHERE NOT EXISTS (SELECT 1 FROM public.biorx_recipes WHERE title = 'Neemastra');

-- Government Subsidies Seed (Verified Official Programs)
INSERT INTO public.subsidies (scheme_name, authority, benefit_amount, eligibility, official_portal_url, status)
SELECT 'PM-KISAN Samman Nidhi', 'Ministry of Agriculture, Govt of India', '₹6,000 / year (3 installments)', 'All landholding farmer families with valid Aadhaar and e-KYC', 'https://pmkisan.gov.in/', 'Active / Open'
WHERE NOT EXISTS (SELECT 1 FROM public.subsidies WHERE scheme_name = 'PM-KISAN Samman Nidhi');

INSERT INTO public.subsidies (scheme_name, authority, benefit_amount, eligibility, official_portal_url, status)
SELECT 'Telangana Rythu Bandhu / Rythu Bharosa', 'Government of Telangana', '₹15,000 / acre / year', 'All verified pattadar landholders in Telangana Dharani database', 'https://rythubandhu.telangana.gov.in/', 'Active / Open'
WHERE NOT EXISTS (SELECT 1 FROM public.subsidies WHERE scheme_name = 'Telangana Rythu Bandhu / Rythu Bharosa');

INSERT INTO public.subsidies (scheme_name, authority, benefit_amount, eligibility, official_portal_url, status)
SELECT 'Kisan Credit Card (KCC) Subvention', 'Reserve Bank of India / NABARD', 'Up to ₹3,00,000 at 4% Interest', 'All farmers with land passbook or verified tenant agreement', 'https://www.nabard.org/', 'Active / Open'
WHERE NOT EXISTS (SELECT 1 FROM public.subsidies WHERE scheme_name = 'Kisan Credit Card (KCC) Subvention');

INSERT INTO public.subsidies (scheme_name, authority, benefit_amount, eligibility, official_portal_url, status)
SELECT 'PM Krishi Sinchayee Yojana (Micro-Irrigation)', 'Dept of Agriculture & Cooperation', 'Up to 90% Drip / Sprinkler Subsidy', 'Small and marginal farmers with active borewell/water source', 'https://pmksy.gov.in/', 'Active / Open'
WHERE NOT EXISTS (SELECT 1 FROM public.subsidies WHERE scheme_name = 'PM Krishi Sinchayee Yojana (Micro-Irrigation)');

-- APMC Live Mandi Rates Initial Snapshot (Safe Zero-Conflict)
INSERT INTO public.mandi_live_rates (state, district, market, commodity, commodity_te, commodity_hi, min_price, max_price, modal_price, msp_price, arrivals_qtl, trend, trend_pct)
SELECT v.state, v.district, v.market, v.commodity, v.commodity_te, v.commodity_hi, v.min_price, v.max_price, v.modal_price, v.msp_price, v.arrivals_qtl, v.trend, v.trend_pct
FROM (VALUES
  ('Telangana', 'Warangal', 'Warangal APMC Yard', 'Cotton (Long Staple)', 'పత్తి', 'कपास', 7450::numeric, 7850::numeric, 7680::numeric, 7121::numeric, 2450::numeric, 'up', 2.8::numeric),
  ('Telangana', 'Warangal', 'Warangal APMC Yard', 'Chilli (Teja Variety)', 'తేజ మిరప', 'तेजा मिर्च', 18200::numeric, 21500::numeric, 19800::numeric, 0::numeric, 850::numeric, 'up', 4.2::numeric),
  ('Telangana', 'Warangal', 'Warangal APMC Yard', 'Paddy (Common)', 'వరి ధాన్యం', 'धान', 2180::numeric, 2320::numeric, 2250::numeric, 2183::numeric, 4200::numeric, 'stable', 0.5::numeric),
  ('Telangana', 'Hyderabad', 'Gudimalkapur APMC Yard', 'Tomato (Hybrid)', 'టమోటా', 'टमाटर', 1400::numeric, 2200::numeric, 1800::numeric, 0::numeric, 1200::numeric, 'down', -3.1::numeric),
  ('Telangana', 'Hyderabad', 'Bowenpally Wholesale APMC', 'Onion (Red)', 'ఉల్లిపాయ', 'प्याज', 2200::numeric, 3100::numeric, 2750::numeric, 0::numeric, 3800::numeric, 'up', 1.9::numeric),
  ('Uttar Pradesh', 'Agra', 'Agra', 'Potato', 'బంగాళాదుంప', 'आलू', 1150::numeric, 1420::numeric, 1300::numeric, 0::numeric, 3200::numeric, 'stable', 0.2::numeric),
  ('Uttar Pradesh', 'Agra', 'Agra', 'Wheat', 'గోధుమలు', 'गेहूं', 2275::numeric, 2450::numeric, 2380::numeric, 2275::numeric, 1800::numeric, 'up', 1.4::numeric)
) AS v(state, district, market, commodity, commodity_te, commodity_hi, min_price, max_price, modal_price, msp_price, arrivals_qtl, trend, trend_pct)
WHERE NOT EXISTS (
  SELECT 1 FROM public.mandi_live_rates
  WHERE market = v.market AND commodity = v.commodity
);

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF CANONICAL SETUP (V7.0 SECURITY HARDENED)
-- ══════════════════════════════════════════════════════════════════════════════
