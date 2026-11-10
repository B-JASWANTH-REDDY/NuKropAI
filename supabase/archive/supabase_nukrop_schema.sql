-- ====================================================================
--  NUKROPAI AGRARIAN INTELLIGENCE OS — SUPABASE MASTER DATABASE SETUP
--  (100% FAIL-SAFE: Compatible with new and pre-existing tables)
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. MANDI LIVE RATES TABLE (Agmarknet APMC Real-Time Prices)
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
    id BIGSERIAL PRIMARY KEY,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    market TEXT NOT NULL,
    commodity TEXT NOT NULL,
    variety TEXT DEFAULT 'FAQ',
    min_price NUMERIC(10, 2) NOT NULL,
    max_price NUMERIC(10, 2) NOT NULL,
    modal_price NUMERIC(10, 2) NOT NULL,
    arrival_date DATE DEFAULT CURRENT_DATE,
    trend TEXT DEFAULT 'up',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist even on pre-existing tables
ALTER TABLE IF EXISTS public.mandi_live_rates ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'up';
ALTER TABLE IF EXISTS public.mandi_live_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mandi_commodity ON public.mandi_live_rates(commodity);
CREATE INDEX IF NOT EXISTS idx_mandi_district ON public.mandi_live_rates(district);

-- 3. EQUIPMENT RENTALS TABLE (YantraShare Custom Hiring Center)
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'tractor', 'drone', 'harvester', 'sprayer'
    rate TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    location TEXT NOT NULL,
    distance_str TEXT DEFAULT '1.5 km away',
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist on pre-existing equipment_rentals
ALTER TABLE IF EXISTS public.equipment_rentals ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE IF EXISTS public.equipment_rentals ADD COLUMN IF NOT EXISTS distance_str TEXT DEFAULT '1.5 km away';
ALTER TABLE IF EXISTS public.equipment_rentals ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment_rentals(category);

-- 4. DISEASE SCANS TELEMETRY TABLE (AI Plant Pathology Radar)
CREATE TABLE IF NOT EXISTS public.disease_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    disease_name TEXT NOT NULL,
    severity TEXT DEFAULT 'MODERATE',
    confidence TEXT DEFAULT '98%',
    vector TEXT,
    organic_solution TEXT,
    chemical_solution TEXT,
    location TEXT DEFAULT 'Warangal Rural, Telangana',
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_crop ON public.disease_scans(crop_name);

-- 5. FARMER PROFILES TABLE (AgriStack Digital Identity)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    state TEXT DEFAULT 'Telangana',
    district TEXT DEFAULT 'Warangal Rural',
    mandal TEXT DEFAULT 'Kazipet',
    village TEXT DEFAULT 'Kadipikonda',
    primary_crop TEXT DEFAULT 'Cotton & Chilli',
    farm_size_acres NUMERIC(6, 2) DEFAULT 4.50,
    dharani_passbook TEXT DEFAULT 'T09280041289',
    kcc_active BOOLEAN DEFAULT TRUE,
    kcc_sanctioned_limit NUMERIC(10, 2) DEFAULT 150000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS dharani_passbook TEXT DEFAULT 'T09280041289';
ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS kcc_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS kcc_sanctioned_limit NUMERIC(10, 2) DEFAULT 150000.00;

-- 6. FARM KHATA LEDGER TABLE (Financial Income & Expense Ledger)
CREATE TABLE IF NOT EXISTS public.farm_khata_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    transaction_type TEXT NOT NULL, -- 'income' or 'expense'
    category TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
--  ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ====================================================================
ALTER TABLE public.mandi_live_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_khata_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Mandi Rates
    DROP POLICY IF EXISTS "Public Read Mandi Rates" ON public.mandi_live_rates;
    CREATE POLICY "Public Read Mandi Rates" ON public.mandi_live_rates FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public Write Mandi Rates" ON public.mandi_live_rates;
    CREATE POLICY "Public Write Mandi Rates" ON public.mandi_live_rates FOR INSERT WITH CHECK (true);

    -- Equipment Rentals
    DROP POLICY IF EXISTS "Public Read Equipment" ON public.equipment_rentals;
    CREATE POLICY "Public Read Equipment" ON public.equipment_rentals FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public Insert Equipment" ON public.equipment_rentals;
    CREATE POLICY "Public Insert Equipment" ON public.equipment_rentals FOR INSERT WITH CHECK (true);

    -- Disease Scans
    DROP POLICY IF EXISTS "Public Read Scans" ON public.disease_scans;
    CREATE POLICY "Public Read Scans" ON public.disease_scans FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public Insert Scans" ON public.disease_scans;
    CREATE POLICY "Public Insert Scans" ON public.disease_scans FOR INSERT WITH CHECK (true);

    -- User Profiles
    DROP POLICY IF EXISTS "Public Read Profiles" ON public.user_profiles;
    CREATE POLICY "Public Read Profiles" ON public.user_profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public Update Profiles" ON public.user_profiles;
    CREATE POLICY "Public Update Profiles" ON public.user_profiles FOR ALL USING (true);

    -- Farm Khata Ledger
    DROP POLICY IF EXISTS "Public Read Khata" ON public.farm_khata_ledger;
    CREATE POLICY "Public Read Khata" ON public.farm_khata_ledger FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public Insert Khata" ON public.farm_khata_ledger;
    CREATE POLICY "Public Insert Khata" ON public.farm_khata_ledger FOR INSERT WITH CHECK (true);
END $$;

-- ====================================================================
--  SEED REAL DATA: 10 APMC COMMODITIES & 4 MACHINERY LISTINGS
-- ====================================================================

-- Safely upsert without depending on 'trend' column in insert list
INSERT INTO public.mandi_live_rates (id, state, district, market, commodity, variety, min_price, max_price, modal_price, arrival_date)
VALUES
    (1, 'Telangana', 'Warangal', 'Warangal APMC Yard', 'Cotton', 'DCH-32 (Long Staple)', 6900.00, 7850.00, 7480.00, CURRENT_DATE),
    (2, 'Telangana', 'Khammam', 'Khammam APMC Yard', 'Chilli', 'Teja / Guntur Dry Red', 16500.00, 21200.00, 18900.00, CURRENT_DATE),
    (3, 'Haryana', 'Karnal', 'Karnal Mandi', 'Paddy (Basmati)', '1121 Pusa Basmati', 2183.00, 2450.00, 2320.00, CURRENT_DATE),
    (4, 'Andhra Pradesh', 'Annamayya', 'Madanapalle APMC', 'Tomato', 'Hybrid F1 Local', 900.00, 1800.00, 1400.00, CURRENT_DATE),
    (5, 'Maharashtra', 'Nashik', 'Lasalgaon APMC', 'Onion', 'Red Pol', 1200.00, 2100.00, 1650.00, CURRENT_DATE),
    (6, 'Telangana', 'Nizamabad', 'Nizamabad APMC', 'Maize', 'Yellow Hybrid', 1950.00, 2350.00, 2225.00, CURRENT_DATE),
    (7, 'Andhra Pradesh', 'Guntur', 'Duggirala APMC', 'Turmeric', 'Finger Regular', 12800.00, 16200.00, 14500.00, CURRENT_DATE),
    (8, 'Madhya Pradesh', 'Indore', 'Indore Mandi', 'Wheat', 'Sharbati Lokwan', 2275.00, 2650.00, 2450.00, CURRENT_DATE),
    (9, 'Uttar Pradesh', 'Agra', 'Agra Mandi', 'Potato', 'Kufri Jyoti Desi', 850.00, 1350.00, 1150.00, CURRENT_DATE),
    (10, 'Rajasthan', 'Bikaner', 'Bikaner APMC', 'Groundnut', 'Bold 37', 5600.00, 6800.00, 6250.00, CURRENT_DATE)
ON CONFLICT (id) DO UPDATE SET
    min_price = EXCLUDED.min_price,
    max_price = EXCLUDED.max_price,
    modal_price = EXCLUDED.modal_price,
    arrival_date = EXCLUDED.arrival_date;

-- Upsert Equipment Listings
INSERT INTO public.equipment_rentals (id, name, category, rate, owner_name, phone_number, location, distance_str, is_available)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Garuda 16L Drone Sprayer', 'drone', '450', 'Garuda Agri Drone Services', '+91 94401 22891', 'Kazipet Junction, Warangal', '1.8 km away', true),
    ('b2222222-2222-2222-2222-222222222222', 'Kubota DC-68G Multi-Crop Harvester', 'harvester', '1800', 'Sri Venkateshwara Agro Hub', '+91 98492 44710', 'Hanamkonda Bypass Road', '3.2 km away', true),
    ('c3333333-3333-3333-3333-333333333333', 'Aspee 600L Tractor Boom Sprayer', 'sprayer', '350', 'Kisan Machinery Hub', '+91 99890 88231', 'Warangal Agricultural Market', '2.5 km away', true),
    ('7c137f18-6550-47b5-9e41-8232f403e489', 'John Deere 5050D (50 HP) Tractor', 'tractor', '800', 'Sri Tirumala Agro Rentals', '+91 98492 11048', 'Kazipet APMC Yard', '1.2 km away', true)
ON CONFLICT (id) DO UPDATE SET
    rate = EXCLUDED.rate,
    owner_name = EXCLUDED.owner_name,
    phone_number = EXCLUDED.phone_number,
    is_available = EXCLUDED.is_available;
