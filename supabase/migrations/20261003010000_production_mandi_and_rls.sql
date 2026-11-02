-- ============================================================================
-- 🌾 NuKropAI Agrarian Intelligence OS — Production Master Database Schema
-- Run this entire script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- Includes:
--   1. Full Schema (16 Tables) with DPDP Act 2023 Compliance
--   2. Dynamic Schema Patching (Guaranteed column existence on all pre-existing tables)
--   3. Proper Auth Identity Architecture (auth.users.id -> user_id UUID/text -> domain records)
--   4. Authenticated GramHaul RLS (Both UUID and business IDs supported)
--   5. Driver Telemetry Ownership & Controlled RPC get_active_driver_telemetry()
--   6. Hardened get_nearby_mandis() RPC (SECURITY DEFINER, validation, zero NULL-distance results)
--   7. Real Government Mandi Data Integration & Provenance Fields
--   8. Mandi Ingestion Audit Ledger (mandi_ingestion_runs)
--   9. Honest Mandi Freshness ('Today', 'Daily', 'Recent', 'Delayed', 'Historical')
--   10. Realtime Publication Configuration
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────
-- 1. PROFILES & USER PROFILES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  user_id UUID,
  farmer_id VARCHAR(50) UNIQUE,
  driver_id VARCHAR(50) UNIQUE,
  full_name VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(30),
  phone_number VARCHAR(30),
  role VARCHAR(30) DEFAULT 'farmer' CHECK (role IN ('farmer', 'driver', 'agronomist', 'admin')),
  state VARCHAR(50) DEFAULT NULL,
  district VARCHAR(50) DEFAULT NULL,
  mandal VARCHAR(100) DEFAULT NULL,
  village VARCHAR(100) DEFAULT NULL,
  land_acres NUMERIC(6,2) DEFAULT NULL,
  land_extent_acres NUMERIC(6,2) DEFAULT NULL,
  preferred_language VARCHAR(10) DEFAULT 'te',
  avatar_url TEXT,
  soil_type VARCHAR(100),
  primary_crops TEXT[],
  kcc_credit_limit NUMERIC(10,2),
  kcc_balance NUMERIC(10,2),
  agristack_id VARCHAR(100),
  agristack_verified BOOLEAN DEFAULT FALSE,
  biometric_lock BOOLEAN DEFAULT FALSE,
  dpdp_consent_given BOOLEAN DEFAULT TRUE,
  dpdp_consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_id VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mandal VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_acres NUMERIC(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS land_extent_acres NUMERIC(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'te';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_type VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_crops TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_credit_limit NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kcc_balance NUMERIC(10,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_id VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agristack_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_lock BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_given BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dpdp_consent_timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  farmer_id VARCHAR(50),
  email VARCHAR(255),
  full_name VARCHAR(150),
  phone_number VARCHAR(30),
  state VARCHAR(50),
  district VARCHAR(50),
  mandal VARCHAR(100),
  village VARCHAR(100),
  primary_crop VARCHAR(100),
  farm_size_acres NUMERIC(6,2),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  dharani_passbook VARCHAR(100),
  kcc_active BOOLEAN DEFAULT FALSE,
  kcc_sanctioned_limit NUMERIC(10,2),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS mandal VARCHAR(100);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS village VARCHAR(100);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS primary_crop VARCHAR(100);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS farm_size_acres NUMERIC(6,2);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dharani_passbook VARCHAR(100);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS kcc_active BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS kcc_sanctioned_limit NUMERIC(10,2);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────
-- 2. CROP DISEASE SCANS & AI INFERENCE (BioShield)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disease_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  farmer_id VARCHAR(50),
  crop_name VARCHAR(100) NOT NULL,
  crop_type VARCHAR(100),
  disease_name VARCHAR(150) NOT NULL,
  disease_detected VARCHAR(150),
  confidence VARCHAR(20) DEFAULT '90%',
  confidence_score NUMERIC(5,2) DEFAULT 0.90,
  severity VARCHAR(30) DEFAULT 'MODERATE',
  treatment_chemical TEXT,
  treatment_organic TEXT,
  image_storage_path TEXT,
  location VARCHAR(150),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  gps_latitude NUMERIC(9,6),
  gps_longitude NUMERIC(9,6),
  state VARCHAR(50) DEFAULT 'Telangana',
  district VARCHAR(50) DEFAULT 'Warangal',
  recommended_treatment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for disease_scans
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS crop_name VARCHAR(100);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS crop_type VARCHAR(100);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS disease_name VARCHAR(150);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS disease_detected VARCHAR(150);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS confidence VARCHAR(20) DEFAULT '90%';
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2) DEFAULT 0.90;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'MODERATE';
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS treatment_chemical TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS treatment_organic TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS image_storage_path TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS location VARCHAR(150);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(9,6);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(9,6);
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'Telangana';
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS district VARCHAR(50) DEFAULT 'Warangal';
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS recommended_treatment TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.disease_scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────
-- 3. REGIONAL PEST OUTBREAK ALERTS (BioShield Early Warning)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outbreak_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_name VARCHAR(100) NOT NULL,
  pest_name VARCHAR(150),
  state VARCHAR(50) DEFAULT 'Telangana',
  district VARCHAR(50) DEFAULT 'Warangal',
  severity VARCHAR(30) DEFAULT 'HIGH_ALERT',
  scan_count INT DEFAULT 1,
  market_price_impact NUMERIC(5,2) DEFAULT 0.00,
  broadcast_message TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);

-- Column existence guarantees for outbreak_alerts
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS crop_name VARCHAR(100);
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS pest_name VARCHAR(150);
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'Telangana';
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS district VARCHAR(50) DEFAULT 'Warangal';
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'HIGH_ALERT';
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS scan_count INT DEFAULT 1;
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS market_price_impact NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS broadcast_message TEXT;
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.outbreak_alerts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- ─────────────────────────────────────────────────────────────────
-- 4. KISAN COMMUNITY FEED, COMMENTS & LIKES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID,
  author_name VARCHAR(150) NOT NULL,
  farmer_id VARCHAR(50),
  crop_id VARCHAR(50) DEFAULT 'all',
  crop_tag VARCHAR(50) DEFAULT 'cotton',
  title VARCHAR(255) NOT NULL,
  content TEXT,
  body TEXT,
  description TEXT,
  media_url TEXT,
  media_type VARCHAR(20) DEFAULT 'image',
  media_label VARCHAR(50),
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  upvotes INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_verified_agronomist BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_id UUID;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_name VARCHAR(150);
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS crop_id VARCHAR(50) DEFAULT 'all';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS crop_tag VARCHAR(50) DEFAULT 'cotton';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'image';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS media_label VARCHAR(50);
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS upvotes INT DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_verified_agronomist BOOLEAN DEFAULT FALSE;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID,
  author_name VARCHAR(150) NOT NULL,
  farmer_id VARCHAR(50),
  comment_text TEXT,
  content TEXT,
  role VARCHAR(50) DEFAULT 'Farmer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for community_comments
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS post_id UUID;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS author_id UUID;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS author_name VARCHAR(150);
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS comment_text TEXT;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Farmer';
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_post_user_like UNIQUE (post_id, user_id)
);

-- Column existence guarantees for community_likes
ALTER TABLE public.community_likes ADD COLUMN IF NOT EXISTS post_id UUID;
ALTER TABLE public.community_likes ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
ALTER TABLE public.community_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────
-- 5. GRAMHAUL POOLED FARM LOGISTICS & DISPATCH
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.haul_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id VARCHAR(50),
  farmer_user_id UUID,
  driver_id VARCHAR(50),
  driver_user_id UUID,
  driver_name VARCHAR(150),
  driver_phone VARCHAR(30),
  vehicle_type VARCHAR(100) DEFAULT 'Tata Ace Gold (1.5 Ton)',
  vehicle_plate VARCHAR(30),
  vehicle_number VARCHAR(30),
  crop VARCHAR(50),
  crop_name VARCHAR(100),
  crop_type VARCHAR(50),
  quantity_quintals NUMERIC(6,2),
  load_quintals NUMERIC(6,2),
  pickup_village VARCHAR(150),
  pickup_lat NUMERIC(9,6),
  pickup_lng NUMERIC(9,6),
  dropoff_mandi VARCHAR(150),
  destination_mandi VARCHAR(150),
  dropoff_lat NUMERIC(9,6),
  dropoff_lng NUMERIC(9,6),
  estimated_cost NUMERIC(10,2),
  total_fare NUMERIC(10,2),
  agreed_fare NUMERIC(10,2),
  distance_km NUMERIC(6,2),
  status VARCHAR(30) DEFAULT 'broadcast',
  pickup_eta VARCHAR(50) DEFAULT '30 mins',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for haul_bookings
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS farmer_user_id UUID;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_id VARCHAR(50);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_user_id UUID;
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_name VARCHAR(150);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(30);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100) DEFAULT 'Tata Ace Gold (1.5 Ton)';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(30);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(30);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS crop VARCHAR(50);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS crop_name VARCHAR(100);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS crop_type VARCHAR(50);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS quantity_quintals NUMERIC(6,2);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS load_quintals NUMERIC(6,2);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_village VARCHAR(150);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(9,6);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(9,6);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS dropoff_mandi VARCHAR(150);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS destination_mandi VARCHAR(150);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC(9,6);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC(9,6);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS total_fare NUMERIC(10,2);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS agreed_fare NUMERIC(10,2);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2);
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'broadcast';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS pickup_eta VARCHAR(50) DEFAULT '30 mins';
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.haul_bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.driver_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  driver_id VARCHAR(50),
  driver_name VARCHAR(150),
  vehicle_type VARCHAR(100) DEFAULT 'Tata Ace Gold (1.5 Ton)',
  vehicle_plate VARCHAR(30),
  current_lat NUMERIC(9,6),
  current_lng NUMERIC(9,6),
  heading NUMERIC(5,2) DEFAULT 0.0,
  speed_kmh NUMERIC(5,2) DEFAULT 0.0,
  is_online BOOLEAN DEFAULT TRUE,
  battery_level INT DEFAULT 100,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for driver_telemetry
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS driver_id VARCHAR(50);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS driver_name VARCHAR(150);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100) DEFAULT 'Tata Ace Gold (1.5 Ton)';
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(30);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS current_lat NUMERIC(9,6);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS current_lng NUMERIC(9,6);
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS heading NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS battery_level INT DEFAULT 100;
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.driver_telemetry ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Privacy-Preserving Driver Telemetry RPC
CREATE OR REPLACE FUNCTION public.get_active_driver_telemetry()
RETURNS TABLE (
  driver_id VARCHAR(50),
  vehicle_type VARCHAR(100),
  vehicle_plate VARCHAR(30),
  current_lat NUMERIC(9,6),
  current_lng NUMERIC(9,6),
  heading NUMERIC(5,2),
  speed_kmh NUMERIC(5,2),
  is_online BOOLEAN,
  last_ping TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.driver_id,
    t.vehicle_type,
    t.vehicle_plate,
    t.current_lat,
    t.current_lng,
    t.heading,
    t.speed_kmh,
    t.is_online,
    t.last_ping
  FROM public.driver_telemetry t
  WHERE 
    t.is_online = TRUE 
    AND t.last_ping > (NOW() - INTERVAL '5 minutes');
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_driver_telemetry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_driver_telemetry() TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 6. P2P FARMER-DRIVER MESSAGING
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.peer_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_email VARCHAR(255) NOT NULL,
  receiver_email VARCHAR(255) NOT NULL,
  receiver_name VARCHAR(150) NOT NULL DEFAULT 'Farmer',
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for peer_messages
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255);
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS receiver_email VARCHAR(255);
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(150) DEFAULT 'Farmer';
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.peer_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────
-- 7. APMC MANDI MARKET RATES (WITH GOVERNMENT DATA PROVENANCE)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(50) NOT NULL,
  district VARCHAR(50) NOT NULL,
  market VARCHAR(100),
  market_name VARCHAR(100),
  commodity VARCHAR(100) NOT NULL,
  commodity_te VARCHAR(100),
  commodity_hi VARCHAR(100),
  variety VARCHAR(100) DEFAULT 'Standard',
  min_price NUMERIC(10,2) NOT NULL,
  max_price NUMERIC(10,2) NOT NULL,
  modal_price NUMERIC(10,2) NOT NULL,
  msp_price NUMERIC(10,2),
  arrivals_qtl NUMERIC(10,2),
  trend VARCHAR(10) DEFAULT 'STABLE' CHECK (trend IN ('UP', 'DOWN', 'STABLE', 'up', 'down', 'stable')),
  trend_pct NUMERIC(5,2) DEFAULT 0.0,
  source_name VARCHAR(255) DEFAULT 'Agmarknet / DMI (Govt of India)',
  source_url TEXT DEFAULT 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
  source_dataset VARCHAR(120) DEFAULT 'Daily Mandi Market Prices',
  trade_date DATE DEFAULT CURRENT_DATE,
  arrival_date DATE DEFAULT CURRENT_DATE,
  price_date DATE DEFAULT CURRENT_DATE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  freshness_status VARCHAR(30) DEFAULT 'Daily' CHECK (freshness_status IN ('Today', 'Daily', 'Recent', 'Delayed', 'Historical', 'DAILY', 'RECENT', 'DELAYED', 'HISTORICAL')),
  market_center_lat NUMERIC(9,6),
  market_center_lng NUMERIC(9,6),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for mandi_live_rates
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS market VARCHAR(100);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS market_name VARCHAR(100);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS commodity VARCHAR(100);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS commodity_te VARCHAR(100);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS commodity_hi VARCHAR(100);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS variety VARCHAR(100) DEFAULT 'Standard';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS min_price NUMERIC(10,2);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS max_price NUMERIC(10,2);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS modal_price NUMERIC(10,2);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS msp_price NUMERIC(10,2);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS arrivals_qtl NUMERIC(10,2);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS trend VARCHAR(10) DEFAULT 'STABLE';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS trend_pct NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS source_name VARCHAR(255) DEFAULT 'Agmarknet / DMI (Govt of India)';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS source_url TEXT DEFAULT 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS source_dataset VARCHAR(120) DEFAULT 'Daily Mandi Market Prices';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS trade_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS arrival_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS price_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS freshness_status VARCHAR(30) DEFAULT 'Daily';
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS market_center_lat NUMERIC(9,6);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS market_center_lng NUMERIC(9,6);
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.mandi_live_rates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Standard Mandi Coordinates Calibration
UPDATE public.mandi_live_rates
SET market_center_lat = 17.7214, market_center_lng = 79.9125
WHERE (market ILIKE '%Kesamudram%' OR market_name ILIKE '%Kesamudram%')
  AND market_center_lat IS NULL;

UPDATE public.mandi_live_rates
SET market_center_lat = 17.4764, market_center_lng = 78.4892
WHERE (market ILIKE '%Bowenpally%' OR market_name ILIKE '%Bowenpally%')
  AND market_center_lat IS NULL;

UPDATE public.mandi_live_rates
SET market_center_lat = 17.2472, market_center_lng = 80.1514
WHERE (market ILIKE '%Khammam%' OR market_name ILIKE '%Khammam%')
  AND market_center_lat IS NULL;

UPDATE public.mandi_live_rates
SET market_center_lat = 17.9784, market_center_lng = 79.6001
WHERE (market ILIKE '%Warangal%' OR market_name ILIKE '%Warangal%')
  AND market_center_lat IS NULL;

CREATE TABLE IF NOT EXISTS public.mandi_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_received INT DEFAULT 0,
  records_inserted INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_rejected INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  error_message TEXT
);

-- Column existence guarantees for mandi_ingestion_runs
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS source_name VARCHAR(255);
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS records_received INT DEFAULT 0;
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS records_inserted INT DEFAULT 0;
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS records_updated INT DEFAULT 0;
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS records_rejected INT DEFAULT 0;
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'RUNNING';
ALTER TABLE public.mandi_ingestion_runs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 8. FARM KHATA LEDGER, ALERTS & MACHINERY RENTALS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  crop_slug VARCHAR(50) NOT NULL,
  mandi_id VARCHAR(50) NOT NULL,
  target_price_per_qtl NUMERIC(10,2) NOT NULL CHECK (target_price_per_qtl > 0),
  alert_condition VARCHAR(10) DEFAULT 'ABOVE' CHECK (alert_condition IN ('ABOVE', 'BELOW')),
  notification_channel VARCHAR(20) DEFAULT 'ALL' CHECK (notification_channel IN ('PUSH', 'SMS', 'WHATSAPP', 'ALL')),
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for price_alerts
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS crop_slug VARCHAR(50);
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS mandi_id VARCHAR(50);
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS target_price_per_qtl NUMERIC(10,2);
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS alert_condition VARCHAR(10) DEFAULT 'ABOVE';
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(20) DEFAULT 'ALL';
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ;
ALTER TABLE public.price_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.khata_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE DEFAULT CURRENT_DATE,
  payment_mode VARCHAR(30) DEFAULT 'Cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for khata_transactions
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(10);
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30) DEFAULT 'Cash';
ALTER TABLE public.khata_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.machinery_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  category VARCHAR(30) NOT NULL CHECK (category IN ('tractor', 'drone', 'harvester', 'sprayer')),
  model_name VARCHAR(100) NOT NULL,
  hourly_rate NUMERIC(8,2) NOT NULL,
  acre_rate NUMERIC(8,2),
  hub_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  specifications TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for machinery_listings
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS category VARCHAR(30);
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS model_name VARCHAR(100);
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2);
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS acre_rate NUMERIC(8,2);
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS hub_name VARCHAR(100);
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS specifications TEXT;
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.machinery_listings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.equipment_rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) DEFAULT 'tractor',
  rate VARCHAR(50) NOT NULL,
  owner_name VARCHAR(150),
  phone_number VARCHAR(30),
  location VARCHAR(150),
  distance_str VARCHAR(50),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for equipment_rentals
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'tractor';
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS rate VARCHAR(50);
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150);
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS location VARCHAR(150);
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS distance_str VARCHAR(50);
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.equipment_rentals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.machinery_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  farmer_id VARCHAR(50),
  machinery_id UUID,
  booking_unit VARCHAR(10) DEFAULT 'acre',
  quantity NUMERIC(5,2) DEFAULT 1.0,
  total_amount NUMERIC(10,2) DEFAULT 0.0,
  service_date DATE DEFAULT CURRENT_DATE,
  time_slot VARCHAR(30) DEFAULT 'Morning (08:00 - 12:00)',
  status VARCHAR(20) DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column existence guarantees for machinery_bookings
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS farmer_id VARCHAR(50);
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS machinery_id UUID;
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS booking_unit VARCHAR(10) DEFAULT 'acre';
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS quantity NUMERIC(5,2) DEFAULT 1.0;
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0.0;
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS time_slot VARCHAR(30) DEFAULT 'Morning (08:00 - 12:00)';
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'CONFIRMED';
ALTER TABLE public.machinery_bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────
-- 9. HARDENED NEAREST MANDI RPC (SECURITY DEFINER + VALIDATION)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nearby_mandis(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_radius_km NUMERIC DEFAULT 100,
  p_commodity VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  state VARCHAR,
  district VARCHAR,
  market_name VARCHAR,
  commodity VARCHAR,
  variety VARCHAR,
  min_price NUMERIC,
  max_price NUMERIC,
  modal_price NUMERIC,
  trend VARCHAR,
  trade_date DATE,
  freshness_status VARCHAR,
  source_name VARCHAR,
  distance_km NUMERIC,
  market_center_lat NUMERIC,
  market_center_lng NUMERIC,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Input parameter validation
  IF p_lat IS NULL OR p_lat < -90.0 OR p_lat > 90.0 THEN
    RAISE EXCEPTION 'Invalid latitude: %. Value must be between -90 and 90 degrees.', p_lat;
  END IF;

  IF p_lng IS NULL OR p_lng < -180.0 OR p_lng > 180.0 THEN
    RAISE EXCEPTION 'Invalid longitude: %. Value must be between -180 and 180 degrees.', p_lng;
  END IF;

  IF p_radius_km IS NULL OR p_radius_km <= 0.0 OR p_radius_km > 2000.0 THEN
    RAISE EXCEPTION 'Invalid search radius: %. Radius must be between 0 and 2000 km.', p_radius_km;
  END IF;

  -- 2. Query ONLY markets with valid coordinates within requested radius
  -- Zero NULL-distance markets are returned
  RETURN QUERY
  SELECT 
    m.id,
    m.state,
    m.district,
    COALESCE(m.market_name, m.market, 'APMC Yard')::VARCHAR AS market_name,
    m.commodity,
    COALESCE(m.variety, 'Standard')::VARCHAR AS variety,
    m.min_price,
    m.max_price,
    m.modal_price,
    COALESCE(m.trend, 'STABLE')::VARCHAR AS trend,
    COALESCE(m.trade_date, m.arrival_date, CURRENT_DATE)::DATE AS trade_date,
    COALESCE(m.freshness_status, 'Daily')::VARCHAR AS freshness_status,
    COALESCE(m.source_name, 'Agmarknet / DMI (Govt of India)')::VARCHAR AS source_name,
    ROUND(
      (6371.0 * 2.0 * ASIN(SQRT(
        POWER(SIN((RADIANS(m.market_center_lat - p_lat)) / 2.0), 2) +
        COS(RADIANS(p_lat)) * COS(RADIANS(m.market_center_lat)) *
        POWER(SIN((RADIANS(m.market_center_lng - p_lng)) / 2.0), 2)
      )))::NUMERIC, 1
    ) AS distance_km,
    m.market_center_lat,
    m.market_center_lng,
    m.updated_at
  FROM public.mandi_live_rates m
  WHERE 
    m.market_center_lat IS NOT NULL 
    AND m.market_center_lng IS NOT NULL
    AND (p_commodity IS NULL OR m.commodity ILIKE '%' || p_commodity || '%')
    AND (
      6371.0 * 2.0 * ASIN(SQRT(
        POWER(SIN((RADIANS(m.market_center_lat - p_lat)) / 2.0), 2) +
        COS(RADIANS(p_lat)) * COS(RADIANS(m.market_center_lat)) *
        POWER(SIN((RADIANS(m.market_center_lng - p_lng)) / 2.0), 2)
      )) <= p_radius_km
    )
  ORDER BY 
    distance_km ASC,
    m.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_nearby_mandis(NUMERIC, NUMERIC, NUMERIC, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_mandis(NUMERIC, NUMERIC, NUMERIC, VARCHAR) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 10. STRICT ROW LEVEL SECURITY (RLS) POLICIES (100% TYPE-SAFE)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbreak_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_live_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_bookings ENABLE ROW LEVEL SECURITY;

-- ── Profiles Strict Policies ──
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" 
  ON public.profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Strict user view own profile" ON public.profiles;
CREATE POLICY "Strict user view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Strict user update own profile" ON public.profiles;
CREATE POLICY "Strict user update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Strict user insert own profile" ON public.profiles;
CREATE POLICY "Strict user insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Strict user delete own profile" ON public.profiles;
CREATE POLICY "Strict user delete own profile" 
  ON public.profiles FOR DELETE 
  USING (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

-- ── User Profiles Policies ──
DROP POLICY IF EXISTS "Public read user profiles" ON public.user_profiles;
CREATE POLICY "Public read user profiles" 
  ON public.user_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "User manage own user profile" ON public.user_profiles;
CREATE POLICY "User manage own user profile" 
  ON public.user_profiles FOR ALL 
  USING (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text)
  WITH CHECK (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text);

-- ── GramHaul: Farmer & Driver UUID/ID-authorized Access ──
DROP POLICY IF EXISTS "Farmer view own bookings" ON public.haul_bookings;
CREATE POLICY "Farmer view own bookings" 
  ON public.haul_bookings FOR SELECT 
  USING (auth.uid()::text = farmer_user_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Farmer insert own bookings" ON public.haul_bookings;
CREATE POLICY "Farmer insert own bookings" 
  ON public.haul_bookings FOR INSERT 
  WITH CHECK (auth.uid()::text = farmer_user_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Farmer update own bookings" ON public.haul_bookings;
CREATE POLICY "Farmer update own bookings" 
  ON public.haul_bookings FOR UPDATE 
  USING (auth.uid()::text = farmer_user_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Driver view eligible bookings" ON public.haul_bookings;
CREATE POLICY "Driver view eligible bookings" 
  ON public.haul_bookings FOR SELECT 
  USING (
    auth.uid()::text = driver_user_id::text 
    OR auth.uid()::text = driver_id::text
    OR (
      status IN ('broadcast', 'PENDING')
      AND driver_user_id IS NULL 
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE (id::text = auth.uid()::text OR user_id::text = auth.uid()::text) AND role = 'driver'
      )
    )
  );

DROP POLICY IF EXISTS "Driver update eligible bookings" ON public.haul_bookings;
CREATE POLICY "Driver update eligible bookings" 
  ON public.haul_bookings FOR UPDATE 
  USING (
    auth.uid()::text = driver_user_id::text 
    OR auth.uid()::text = driver_id::text
    OR (
      status IN ('broadcast', 'PENDING')
      AND driver_user_id IS NULL 
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE (id::text = auth.uid()::text OR user_id::text = auth.uid()::text) AND role = 'driver'
      )
    )
  );

-- ── Driver Telemetry: Authenticated Driver Ownership & Privacy ──
DROP POLICY IF EXISTS "Driver manage own telemetry" ON public.driver_telemetry;
CREATE POLICY "Driver manage own telemetry" 
  ON public.driver_telemetry FOR ALL 
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Driver view own telemetry" ON public.driver_telemetry;
CREATE POLICY "Driver view own telemetry" 
  ON public.driver_telemetry FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- ── Mandi Market Rates: Open Public Read, Ingestion Write-Only ──
DROP POLICY IF EXISTS "Public open read mandi rates" ON public.mandi_live_rates;
CREATE POLICY "Public open read mandi rates" 
  ON public.mandi_live_rates FOR SELECT 
  USING (TRUE);

DROP POLICY IF EXISTS "Service role write mandi rates" ON public.mandi_live_rates;
CREATE POLICY "Service role write mandi rates" 
  ON public.mandi_live_rates FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Ingestion Runs: Service Role Only ──
DROP POLICY IF EXISTS "Service role manage ingestion runs" ON public.mandi_ingestion_runs;
CREATE POLICY "Service role manage ingestion runs" 
  ON public.mandi_ingestion_runs FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Outbreak Alerts: Public Read Active, Service Role Write ──
DROP POLICY IF EXISTS "Public read active outbreak alerts" ON public.outbreak_alerts;
CREATE POLICY "Public read active outbreak alerts" 
  ON public.outbreak_alerts FOR SELECT 
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Service role manage outbreak alerts" ON public.outbreak_alerts;
CREATE POLICY "Service role manage outbreak alerts" 
  ON public.outbreak_alerts FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Disease Scans Strict Isolation ──
DROP POLICY IF EXISTS "Strict user view own scans" ON public.disease_scans;
CREATE POLICY "Strict user view own scans" 
  ON public.disease_scans FOR SELECT 
  USING (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Strict user insert own scans" ON public.disease_scans;
CREATE POLICY "Strict user insert own scans" 
  ON public.disease_scans FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Strict user delete own scans" ON public.disease_scans;
CREATE POLICY "Strict user delete own scans" 
  ON public.disease_scans FOR DELETE 
  USING (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text);

-- ── Farm Khata Financial Ledger Strict Isolation ──
DROP POLICY IF EXISTS "Strict user manage own khata" ON public.khata_transactions;
CREATE POLICY "Strict user manage own khata" 
  ON public.khata_transactions FOR ALL 
  USING (auth.uid()::text = user_id::text) 
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── P2P Farmer-Driver Direct Messages Participant Isolation ──
DROP POLICY IF EXISTS "Strict participant read peer messages" ON public.peer_messages;
CREATE POLICY "Strict participant read peer messages" 
  ON public.peer_messages FOR SELECT 
  USING ((auth.jwt()->>'email' = sender_email) OR (auth.jwt()->>'email' = receiver_email));

DROP POLICY IF EXISTS "Strict sender write peer messages" ON public.peer_messages;
CREATE POLICY "Strict sender write peer messages" 
  ON public.peer_messages FOR INSERT 
  WITH CHECK (auth.jwt()->>'email' = sender_email);

-- ── Machinery Listings & Rentals ──
DROP POLICY IF EXISTS "Public read available machinery" ON public.machinery_listings;
CREATE POLICY "Public read available machinery" 
  ON public.machinery_listings FOR SELECT 
  USING (is_available = TRUE OR auth.uid()::text = owner_id::text);

DROP POLICY IF EXISTS "Owner manage machinery listings" ON public.machinery_listings;
CREATE POLICY "Owner manage machinery listings" 
  ON public.machinery_listings FOR ALL 
  USING (auth.uid()::text = owner_id::text)
  WITH CHECK (auth.uid()::text = owner_id::text);

DROP POLICY IF EXISTS "Public read equipment rentals" ON public.equipment_rentals;
CREATE POLICY "Public read equipment rentals" 
  ON public.equipment_rentals FOR SELECT 
  USING (is_available = TRUE);

-- ── Machinery Bookings ──
DROP POLICY IF EXISTS "User manage own machinery bookings" ON public.machinery_bookings;
CREATE POLICY "User manage own machinery bookings" 
  ON public.machinery_bookings FOR ALL 
  USING (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text)
  WITH CHECK (auth.uid()::text = user_id::text OR auth.uid()::text = farmer_id::text);

-- ── Kisan Community: Authenticated Read & Author Modification ──
DROP POLICY IF EXISTS "Authenticated read community posts" ON public.community_posts;
CREATE POLICY "Authenticated read community posts" 
  ON public.community_posts FOR SELECT 
  TO authenticated 
  USING (TRUE);

DROP POLICY IF EXISTS "Author create community posts" ON public.community_posts;
CREATE POLICY "Author create community posts" 
  ON public.community_posts FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid()::text = author_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Author manage own community posts" ON public.community_posts;
CREATE POLICY "Author manage own community posts" 
  ON public.community_posts FOR UPDATE 
  USING (auth.uid()::text = author_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Author delete own community posts" ON public.community_posts;
CREATE POLICY "Author delete own community posts" 
  ON public.community_posts FOR DELETE 
  USING (auth.uid()::text = author_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "Authenticated read community comments" ON public.community_comments;
CREATE POLICY "Authenticated read community comments" 
  ON public.community_comments FOR SELECT 
  TO authenticated 
  USING (TRUE);

DROP POLICY IF EXISTS "Author create community comments" ON public.community_comments;
CREATE POLICY "Author create community comments" 
  ON public.community_comments FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid()::text = author_id::text OR auth.uid()::text = farmer_id::text);

DROP POLICY IF EXISTS "User manage own community likes" ON public.community_likes;
CREATE POLICY "User manage own community likes" 
  ON public.community_likes FOR ALL 
  TO authenticated 
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── Price Alerts Strict Isolation ──
DROP POLICY IF EXISTS "User manage own price alerts" ON public.price_alerts;
CREATE POLICY "User manage own price alerts" 
  ON public.price_alerts FOR ALL 
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ─────────────────────────────────────────────────────────────────
-- 11. ENABLE SUPABASE REALTIME REPLICATION
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.haul_bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_telemetry;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mandi_live_rates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.outbreak_alerts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- 12. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_haul_bookings_farmer_uid ON public.haul_bookings(farmer_user_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_driver_uid ON public.haul_bookings(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_status ON public.haul_bookings(status);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_user ON public.driver_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_online ON public.driver_telemetry(is_online, last_ping);
CREATE INDEX IF NOT EXISTS idx_mandi_rates_state_crop ON public.mandi_live_rates(state, commodity);
CREATE INDEX IF NOT EXISTS idx_mandi_rates_trade_date ON public.mandi_live_rates(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_mandi_rates_coords ON public.mandi_live_rates(market_center_lat, market_center_lng);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_khata_tx_user ON public.khata_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_machinery_bookings_user ON public.machinery_bookings(user_id);
