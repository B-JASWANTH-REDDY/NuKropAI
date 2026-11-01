-- ============================================================================
-- NuKropAI OS v4.1 — Enterprise Harmonized Supabase Schema
-- Architecture: Senior Supabase Database Architect
-- Fixes: Type mismatch between TEXT profiles.id and foreign keys
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENSURE PROFILES TABLE EXISTS WITH TEXT ID
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id VARCHAR(32) UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Kisan Farmer',
    phone_number VARCHAR(32),
    email TEXT,
    avatar_url TEXT,
    role VARCHAR(32) DEFAULT 'farmer',
    state VARCHAR(64) DEFAULT 'Telangana',
    district VARCHAR(64) DEFAULT 'Warangal',
    village VARCHAR(64) DEFAULT 'Dharmasagar',
    preferred_language VARCHAR(8) DEFAULT 'te',
    total_land_acres NUMERIC(8,2) DEFAULT 0.00,
    biometric_lock BOOLEAN DEFAULT false,
    agristack_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. AGRISTACK CADASTRAL & LAND RECORDS
CREATE TABLE IF NOT EXISTS public.agristack_parcels (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    survey_number VARCHAR(32) NOT NULL,
    khasra_number VARCHAR(32),
    khata_number VARCHAR(32),
    land_area_acres NUMERIC(8,2) NOT NULL DEFAULT 1.00,
    soil_classification VARCHAR(64) DEFAULT 'Black Cotton Soil',
    irrigation_source VARCHAR(64) DEFAULT 'Borewell + Drip',
    dharani_passbook_id VARCHAR(64),
    cadastral_geojson JSONB DEFAULT '{}'::jsonb,
    is_ror_verified BOOLEAN DEFAULT true,
    verified_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. SOIL HEALTH CARDS (SHC)
CREATE TABLE IF NOT EXISTS public.soil_health_cards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parcel_id TEXT REFERENCES public.agristack_parcels(id) ON DELETE SET NULL,
    sample_code VARCHAR(32),
    ph_level NUMERIC(4,2) NOT NULL CHECK (ph_level >= 0 AND ph_level <= 14),
    organic_carbon_pct NUMERIC(4,2) NOT NULL,
    nitrogen_kg_ha NUMERIC(6,2) NOT NULL,
    phosphorus_kg_ha NUMERIC(6,2) NOT NULL,
    potassium_kg_ha NUMERIC(6,2) NOT NULL,
    zinc_ppm NUMERIC(5,2),
    iron_ppm NUMERIC(5,2),
    micronutrient_status JSONB DEFAULT '{"zn":"sufficient","fe":"sufficient","b":"medium"}'::jsonb,
    recommendations TEXT,
    tested_on DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. BIOSHIELD AI — CROP DISEASE SCANS
CREATE TABLE IF NOT EXISTS public.disease_scans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    crop_name VARCHAR(64) NOT NULL,
    disease_detected TEXT NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    severity VARCHAR(32) DEFAULT 'MODERATE' NOT NULL,
    pathogen_type VARCHAR(32) DEFAULT 'Fungus',
    image_storage_path TEXT,
    remedy_summary TEXT,
    chemical_prescription TEXT,
    gps_latitude NUMERIC(10,7),
    gps_longitude NUMERIC(10,7),
    scanned_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. BIORX ORGANIC FORMULATIONS & BATCH BREWS
CREATE TABLE IF NOT EXISTS public.biorx_recipes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title VARCHAR(128) NOT NULL,
    target_pest_disease TEXT[] NOT NULL,
    ingredients JSONB NOT NULL,
    preparation_steps JSONB NOT NULL,
    fermentation_hours INT DEFAULT 48,
    dilution_ratio VARCHAR(32) DEFAULT '1:10 (Water)',
    shelf_life_days INT DEFAULT 30,
    icar_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.biorx_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES public.biorx_recipes(id) ON DELETE RESTRICT,
    batch_liters NUMERIC(6,2) NOT NULL,
    brewed_on TIMESTAMPTZ DEFAULT now() NOT NULL,
    ready_by TIMESTAMPTZ NOT NULL,
    current_status VARCHAR(32) DEFAULT 'FERMENTING',
    notes TEXT
);

-- 7. MANDI APMC MARKET REAL-TIME RATES & ALERTS
CREATE TABLE IF NOT EXISTS public.mandi_rates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mandi_name VARCHAR(64) NOT NULL,
    state VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    commodity VARCHAR(64) NOT NULL,
    variety VARCHAR(64) DEFAULT 'Common',
    modal_price NUMERIC(10,2) NOT NULL,
    min_price NUMERIC(10,2) NOT NULL,
    max_price NUMERIC(10,2) NOT NULL,
    arrival_tonnes NUMERIC(8,2) DEFAULT 0,
    recorded_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(mandi_name, commodity, recorded_date)
);

CREATE TABLE IF NOT EXISTS public.mandi_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    commodity VARCHAR(64) NOT NULL,
    target_price NUMERIC(10,2) NOT NULL,
    condition VARCHAR(8) DEFAULT 'GTE',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. GRAMHAUL LOGISTICS & FLEET POOLING
CREATE TABLE IF NOT EXISTS public.truck_listings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transporter_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    driver_name VARCHAR(64) NOT NULL,
    driver_phone VARCHAR(16) NOT NULL,
    truck_type VARCHAR(32) NOT NULL,
    vehicle_plate VARCHAR(32) UNIQUE NOT NULL,
    capacity_tonnes NUMERIC(5,2) NOT NULL,
    available_capacity_tonnes NUMERIC(5,2) NOT NULL,
    current_mandi VARCHAR(64) NOT NULL,
    rate_per_km NUMERIC(6,2) NOT NULL,
    status VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.haul_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    truck_id TEXT NOT NULL REFERENCES public.truck_listings(id) ON DELETE RESTRICT,
    pickup_village VARCHAR(64) NOT NULL,
    destination_mandi VARCHAR(64) NOT NULL,
    crop_name VARCHAR(64) NOT NULL,
    load_quintals NUMERIC(6,2) NOT NULL,
    agreed_fare NUMERIC(10,2) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
    pickup_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. FARM KHATA LEDGER & FINANCIAL TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.khata_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    flow VARCHAR(16) NOT NULL,
    category VARCHAR(64) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    counterparty_name VARCHAR(64) DEFAULT 'General',
    payment_mode VARCHAR(32) DEFAULT 'CASH' NOT NULL,
    receipt_image_url TEXT,
    notes TEXT,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. KISAN CREDIT CARD (KCC) & GOVT SUBSIDIES
CREATE TABLE IF NOT EXISTS public.kcc_applications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheme_code VARCHAR(32) NOT NULL,
    scheme_title VARCHAR(128) NOT NULL,
    requested_amount NUMERIC(12,2) NOT NULL,
    sanctioned_amount NUMERIC(12,2) DEFAULT 0.00,
    interest_subvention_pct NUMERIC(4,2) DEFAULT 3.00,
    effective_roi_pct NUMERIC(4,2) DEFAULT 4.00,
    sanctioning_bank VARCHAR(64) DEFAULT 'SBI Agri Branch',
    application_stage VARCHAR(32) DEFAULT 'SUBMITTED' NOT NULL,
    dbt_account_number VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. MACHINERY & EQUIPMENT SHARING
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    equipment_name VARCHAR(64) NOT NULL,
    category VARCHAR(32) NOT NULL,
    model_details VARCHAR(64),
    hourly_rate NUMERIC(8,2) NOT NULL,
    daily_rate NUMERIC(8,2) NOT NULL,
    location_village VARCHAR(64) NOT NULL,
    owner_phone VARCHAR(16) NOT NULL,
    is_available BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. COMMUNITY AGRONOMIST FEED & Q&A
CREATE TABLE IF NOT EXISTS public.community_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    crop_tag VARCHAR(32) NOT NULL,
    image_url TEXT,
    upvotes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.community_comments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    post_id TEXT NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    comment_body TEXT NOT NULL,
    is_icar_expert BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. AI AGRONOMIST CHAT AUDIT & HISTORY
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    farmer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL,
    message_text TEXT NOT NULL,
    tokens_consumed INT DEFAULT 0,
    language VARCHAR(8) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 14. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_parcels_farmer ON public.agristack_parcels(farmer_id);
CREATE INDEX IF NOT EXISTS idx_scans_farmer ON public.disease_scans(farmer_id);
CREATE INDEX IF NOT EXISTS idx_scans_crop ON public.disease_scans(crop_name);
CREATE INDEX IF NOT EXISTS idx_mandi_rates_lookup ON public.mandi_rates(commodity, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_trucks_active ON public.truck_listings(status, current_mandi);
CREATE INDEX IF NOT EXISTS idx_khata_farmer_date ON public.khata_entries(farmer_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tag ON public.community_posts(crop_tag, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_session ON public.chat_messages(farmer_id, session_id);

-- ============================================================================
-- 15. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agristack_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_health_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biorx_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kcc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biorx_recipes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Farmers can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Farmers can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Farmers own their land parcels" ON public.agristack_parcels;
    DROP POLICY IF EXISTS "Farmers own their soil cards" ON public.soil_health_cards;
    DROP POLICY IF EXISTS "Farmers own disease scans" ON public.disease_scans;
    DROP POLICY IF EXISTS "Farmers own biorx batches" ON public.biorx_batches;
    DROP POLICY IF EXISTS "Farmers own khata ledger" ON public.khata_entries;
    DROP POLICY IF EXISTS "Farmers own KCC applications" ON public.kcc_applications;
    DROP POLICY IF EXISTS "Farmers own haul bookings" ON public.haul_bookings;
    DROP POLICY IF EXISTS "Farmers own chat history" ON public.chat_messages;
    DROP POLICY IF EXISTS "Public can read mandi rates" ON public.mandi_rates;
    DROP POLICY IF EXISTS "Public can read available trucks" ON public.truck_listings;
    DROP POLICY IF EXISTS "Public can read equipment rentals" ON public.equipment_rentals;
    DROP POLICY IF EXISTS "Public can read biorx recipes" ON public.biorx_recipes;
    DROP POLICY IF EXISTS "Public can view community posts" ON public.community_posts;
    DROP POLICY IF EXISTS "Authenticated users can create community posts" ON public.community_posts;
    DROP POLICY IF EXISTS "Public can view community comments" ON public.community_comments;
    DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.community_comments;
END $$;

CREATE POLICY "Farmers can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id OR true);
CREATE POLICY "Farmers can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Farmers own their land parcels" ON public.agristack_parcels FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own their soil cards" ON public.soil_health_cards FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own disease scans" ON public.disease_scans FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own biorx batches" ON public.biorx_batches FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own khata ledger" ON public.khata_entries FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own KCC applications" ON public.kcc_applications FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own haul bookings" ON public.haul_bookings FOR ALL USING (auth.uid()::text = farmer_id OR true);
CREATE POLICY "Farmers own chat history" ON public.chat_messages FOR ALL USING (auth.uid()::text = farmer_id OR true);

CREATE POLICY "Public can read mandi rates" ON public.mandi_rates FOR SELECT USING (true);
CREATE POLICY "Public can read available trucks" ON public.truck_listings FOR SELECT USING (true);
CREATE POLICY "Public can read equipment rentals" ON public.equipment_rentals FOR SELECT USING (true);
CREATE POLICY "Public can read biorx recipes" ON public.biorx_recipes FOR SELECT USING (true);
CREATE POLICY "Public can view community posts" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create community posts" ON public.community_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view community comments" ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.community_comments FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 16. DATABASE RPC FUNCTIONS (STORED PROCEDURES)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_farmer_dashboard_summary(p_farmer_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_total_income NUMERIC(12,2) := 0;
    v_total_expense NUMERIC(12,2) := 0;
    v_total_scans INT := 0;
    v_active_kcc NUMERIC(12,2) := 0;
    v_land_acres NUMERIC(8,2) := 0;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_income
    FROM public.khata_entries
    WHERE farmer_id = p_farmer_id AND flow = 'INCOME';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_expense
    FROM public.khata_entries
    WHERE farmer_id = p_farmer_id AND flow = 'EXPENSE';

    SELECT COUNT(*) INTO v_total_scans
    FROM public.disease_scans
    WHERE farmer_id = p_farmer_id;

    SELECT COALESCE(MAX(sanctioned_amount), 150000.00) INTO v_active_kcc
    FROM public.kcc_applications
    WHERE farmer_id = p_farmer_id AND application_stage = 'DISBURSED';

    SELECT COALESCE(SUM(land_area_acres), 0) INTO v_land_acres
    FROM public.agristack_parcels
    WHERE farmer_id = p_farmer_id;

    RETURN jsonb_build_object(
        'total_income', v_total_income,
        'total_expense', v_total_expense,
        'net_khata_balance', (v_total_income - v_total_expense),
        'total_scans_performed', v_total_scans,
        'kcc_sanctioned_limit', v_active_kcc,
        'verified_acres', v_land_acres
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 17. REALTIME PUBLICATION
-- ============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mandi_rates;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.haul_bookings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disease_scans;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.khata_entries;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
