-- Complete Supabase SQL Setup Script for NuKropAI
-- Copy and paste this script directly into your Supabase SQL Editor and click "Run"

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users / Farmer Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    state VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    district VARCHAR(100) NOT NULL DEFAULT 'Pune',
    primary_crop VARCHAR(100) DEFAULT 'Wheat',
    farm_size_acres NUMERIC(5,2) DEFAULT 2.50,
    latitude DOUBLE PRECISION DEFAULT 18.5204,
    longitude DOUBLE PRECISION DEFAULT 73.8567,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON public.user_profiles(state, district);

-- 2. Mandi Live Rates Table
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
    id SERIAL PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    market VARCHAR(100) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    variety VARCHAR(100) NOT NULL DEFAULT 'Standard',
    arrival_date VARCHAR(50) NOT NULL,
    min_price NUMERIC(12, 2) NOT NULL,
    max_price NUMERIC(12, 2) NOT NULL,
    modal_price NUMERIC(12, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mandi_commodity ON public.mandi_live_rates(commodity);
CREATE INDEX IF NOT EXISTS idx_mandi_state_district ON public.mandi_live_rates(state, district);

-- 3. Peer-to-Peer 1-on-1 Messages Table
CREATE TABLE IF NOT EXISTS public.peer_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_email VARCHAR(255) NOT NULL,
    receiver_email VARCHAR(255) NOT NULL,
    receiver_name VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_peer_messages_thread ON public.peer_messages(sender_email, receiver_email);

-- 4. Equipment & Vehicle Rentals Marketplace Table
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    rate VARCHAR(100) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    distance_str VARCHAR(100) DEFAULT '2.5 km away',
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_rentals_category ON public.equipment_rentals(category);

-- Enable Row Level Security (RLS) policies allowing public anonymous access for NuKrop app
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_live_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write on user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on mandi_live_rates" ON public.mandi_live_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on peer_messages" ON public.peer_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on equipment_rentals" ON public.equipment_rentals FOR ALL USING (true) WITH CHECK (true);

-- 5. Disease Scans Table (Anonymous Telemetry)
CREATE TABLE IF NOT EXISTS public.disease_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_name VARCHAR(100) NOT NULL,
    crop_name VARCHAR(100) NOT NULL DEFAULT 'General',
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    severity VARCHAR(50) NOT NULL DEFAULT 'Moderate',
    confidence INTEGER NOT NULL DEFAULT 90 CHECK (confidence BETWEEN 0 AND 100),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disease_scans_state_disease_time ON public.disease_scans(state, disease_name, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_scans_time ON public.disease_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_scans_crop ON public.disease_scans(crop_name);

-- 6. State Adjacencies Table (Symmetric Graph)
CREATE TABLE IF NOT EXISTS public.state_adjacencies (
    id SERIAL PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    neighbor_state VARCHAR(100) NOT NULL,
    border_risk_weight NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_state_neighbor UNIQUE (state, neighbor_state)
);

CREATE INDEX IF NOT EXISTS idx_state_adjacencies_state ON public.state_adjacencies(state);
CREATE INDEX IF NOT EXISTS idx_state_adjacencies_neighbor ON public.state_adjacencies(neighbor_state);

-- 7. Outbreak Alerts Table
CREATE TABLE IF NOT EXISTS public.outbreak_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_name VARCHAR(100) NOT NULL,
    source_state VARCHAR(100) NOT NULL,
    target_state VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('EPICENTER', 'EARLY_WARNING')),
    severity VARCHAR(50) NOT NULL DEFAULT 'MODERATE' CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    scan_count INTEGER NOT NULL DEFAULT 0,
    threshold_density INTEGER NOT NULL DEFAULT 100,
    time_window_hours INTEGER NOT NULL DEFAULT 168,
    message TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    predicted_market_impact_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_outbreak_alert_state UNIQUE (disease_name, source_state, target_state, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_outbreak_alerts_target_active ON public.outbreak_alerts(target_state, is_active);
CREATE INDEX IF NOT EXISTS idx_outbreak_alerts_source_disease ON public.outbreak_alerts(source_state, disease_name);
CREATE INDEX IF NOT EXISTS idx_outbreak_alerts_disease_active ON public.outbreak_alerts(disease_name, is_active);

-- Trigger Function: fn_evaluate_disease_outbreak()
CREATE OR REPLACE FUNCTION public.fn_evaluate_disease_outbreak()
RETURNS TRIGGER AS $$
DECLARE
    v_scan_count INTEGER;
    v_window_hours INTEGER := 168; -- 7 days rolling window
    v_threshold INTEGER := 100;
    v_severity VARCHAR(50);
    v_epicenter_msg TEXT;
    v_epicenter_action TEXT;
    v_epicenter_impact NUMERIC(6,2);
    v_neighbor_record RECORD;
    v_neighbor_msg TEXT;
    v_neighbor_action TEXT;
    v_neighbor_impact NUMERIC(6,2);
BEGIN
    SELECT COUNT(*)
    INTO v_scan_count
    FROM public.disease_scans
    WHERE disease_name = NEW.disease_name
      AND state = NEW.state
      AND scanned_at >= NOW() - (v_window_hours || ' hours')::INTERVAL;

    IF v_scan_count >= v_threshold THEN
        IF v_scan_count >= 300 THEN
            v_severity := 'CRITICAL';
            v_epicenter_impact := 35.00;
            v_neighbor_impact := 20.00;
        ELSIF v_scan_count >= 200 THEN
            v_severity := 'HIGH';
            v_epicenter_impact := 25.00;
            v_neighbor_impact := 15.00;
        ELSE
            v_severity := 'MODERATE';
            v_epicenter_impact := 15.00;
            v_neighbor_impact := 8.00;
        END IF;

        v_epicenter_msg := 'CRITICAL OUTBREAK DETECTED: ' || NEW.disease_name || ' outbreak confirmed in ' || NEW.state || ' with ' || v_scan_count || ' recent scan detections crossing density threshold (' || v_threshold || ').';
        v_epicenter_action := 'Deploy immediate containment, quarantine affected fields, apply targeted chemical/biological fungicides or insecticides, and alert local Krishi Vigyan Kendra (KVK).';

        -- 1. Upsert EPICENTER alert for source state
        INSERT INTO public.outbreak_alerts (
            disease_name,
            source_state,
            target_state,
            alert_type,
            severity,
            scan_count,
            threshold_density,
            time_window_hours,
            message,
            recommended_action,
            predicted_market_impact_pct,
            is_active,
            updated_at
        ) VALUES (
            NEW.disease_name,
            NEW.state,
            NEW.state,
            'EPICENTER',
            v_severity,
            v_scan_count,
            v_threshold,
            v_window_hours,
            v_epicenter_msg,
            v_epicenter_action,
            v_epicenter_impact,
            TRUE,
            NOW()
        )
        ON CONFLICT (disease_name, source_state, target_state, alert_type)
        DO UPDATE SET
            severity = EXCLUDED.severity,
            scan_count = EXCLUDED.scan_count,
            message = EXCLUDED.message,
            recommended_action = EXCLUDED.recommended_action,
            predicted_market_impact_pct = EXCLUDED.predicted_market_impact_pct,
            is_active = TRUE,
            updated_at = NOW();

        -- 2. Fan out EARLY_WARNING alerts for all adjacent neighboring states
        FOR v_neighbor_record IN
            SELECT neighbor_state, border_risk_weight
            FROM public.state_adjacencies
            WHERE state = NEW.state
        LOOP
            v_neighbor_msg := 'EARLY WARNING: Outbreak of ' || NEW.disease_name || ' detected in neighboring ' || NEW.state || ' (' || v_scan_count || ' active scans). High risk of trans-boundary spore/pest vector transmission to ' || v_neighbor_record.neighbor_state || '.';
            v_neighbor_action := 'Inspect border district fields daily, prepare preventative spraying protocols, and monitor Mandi arrivals from ' || NEW.state || '.';

            INSERT INTO public.outbreak_alerts (
                disease_name,
                source_state,
                target_state,
                alert_type,
                severity,
                scan_count,
                threshold_density,
                time_window_hours,
                message,
                recommended_action,
                predicted_market_impact_pct,
                is_active,
                updated_at
            ) VALUES (
                NEW.disease_name,
                NEW.state,
                v_neighbor_record.neighbor_state,
                'EARLY_WARNING',
                CASE WHEN v_severity = 'CRITICAL' THEN 'HIGH' ELSE 'MODERATE' END,
                v_scan_count,
                v_threshold,
                v_window_hours,
                v_neighbor_msg,
                v_neighbor_action,
                ROUND(v_neighbor_impact * v_neighbor_record.border_risk_weight, 2),
                TRUE,
                NOW()
            )
            ON CONFLICT (disease_name, source_state, target_state, alert_type)
            DO UPDATE SET
                severity = EXCLUDED.severity,
                scan_count = EXCLUDED.scan_count,
                message = EXCLUDED.message,
                recommended_action = EXCLUDED.recommended_action,
                predicted_market_impact_pct = EXCLUDED.predicted_market_impact_pct,
                is_active = TRUE,
                updated_at = NOW();
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_disease_scan_outbreak_eval ON public.disease_scans;
CREATE TRIGGER trg_disease_scan_outbreak_eval
AFTER INSERT ON public.disease_scans
FOR EACH ROW
EXECUTE FUNCTION public.fn_evaluate_disease_outbreak();

-- State Adjacencies Seed Data
INSERT INTO public.state_adjacencies (state, neighbor_state, border_risk_weight) VALUES
('Andhra Pradesh', 'Telangana', 1.00),
('Andhra Pradesh', 'Odisha', 0.90),
('Andhra Pradesh', 'Chhattisgarh', 0.85),
('Andhra Pradesh', 'Karnataka', 0.95),
('Andhra Pradesh', 'Tamil Nadu', 1.00),
('Andhra Pradesh', 'Puducherry', 0.80),
('Arunachal Pradesh', 'Assam', 1.00),
('Arunachal Pradesh', 'Nagaland', 0.90),
('Assam', 'Arunachal Pradesh', 1.00),
('Assam', 'Nagaland', 0.95),
('Assam', 'Manipur', 0.90),
('Assam', 'Mizoram', 0.90),
('Assam', 'Tripura', 0.90),
('Assam', 'Meghalaya', 1.00),
('Assam', 'West Bengal', 1.00),
('Bihar', 'Uttar Pradesh', 1.00),
('Bihar', 'Jharkhand', 1.00),
('Bihar', 'West Bengal', 0.95),
('Chhattisgarh', 'Madhya Pradesh', 1.00),
('Chhattisgarh', 'Maharashtra', 0.95),
('Chhattisgarh', 'Telangana', 0.90),
('Chhattisgarh', 'Andhra Pradesh', 0.85),
('Chhattisgarh', 'Odisha', 1.00),
('Chhattisgarh', 'Jharkhand', 0.95),
('Chhattisgarh', 'Uttar Pradesh', 0.90),
('Goa', 'Maharashtra', 1.00),
('Goa', 'Karnataka', 1.00),
('Gujarat', 'Rajasthan', 1.00),
('Gujarat', 'Madhya Pradesh', 0.95),
('Gujarat', 'Maharashtra', 1.00),
('Gujarat', 'Dadra and Nagar Haveli and Daman and Diu', 0.80),
('Haryana', 'Punjab', 1.00),
('Haryana', 'Himachal Pradesh', 0.90),
('Haryana', 'Rajasthan', 1.00),
('Haryana', 'Uttar Pradesh', 1.00),
('Haryana', 'Delhi', 1.00),
('Haryana', 'Chandigarh', 0.90),
('Himachal Pradesh', 'Jammu and Kashmir', 0.95),
('Himachal Pradesh', 'Ladakh', 0.85),
('Himachal Pradesh', 'Punjab', 1.00),
('Himachal Pradesh', 'Haryana', 0.90),
('Himachal Pradesh', 'Uttarakhand', 0.95),
('Himachal Pradesh', 'Uttar Pradesh', 0.80),
('Jharkhand', 'Bihar', 1.00),
('Jharkhand', 'Uttar Pradesh', 0.90),
('Jharkhand', 'Chhattisgarh', 0.95),
('Jharkhand', 'Odisha', 1.00),
('Jharkhand', 'West Bengal', 1.00),
('Karnataka', 'Goa', 1.00),
('Karnataka', 'Maharashtra', 1.00),
('Karnataka', 'Telangana', 0.95),
('Karnataka', 'Andhra Pradesh', 0.95),
('Karnataka', 'Tamil Nadu', 1.00),
('Karnataka', 'Kerala', 1.00),
('Kerala', 'Karnataka', 1.00),
('Kerala', 'Tamil Nadu', 1.00),
('Kerala', 'Puducherry', 0.80),
('Madhya Pradesh', 'Rajasthan', 1.00),
('Madhya Pradesh', 'Uttar Pradesh', 1.00),
('Madhya Pradesh', 'Chhattisgarh', 1.00),
('Madhya Pradesh', 'Maharashtra', 1.00),
('Madhya Pradesh', 'Gujarat', 0.95),
('Maharashtra', 'Gujarat', 1.00),
('Maharashtra', 'Madhya Pradesh', 1.00),
('Maharashtra', 'Chhattisgarh', 0.95),
('Maharashtra', 'Telangana', 1.00),
('Maharashtra', 'Karnataka', 1.00),
('Maharashtra', 'Goa', 1.00),
('Maharashtra', 'Dadra and Nagar Haveli and Daman and Diu', 0.80),
('Manipur', 'Nagaland', 0.95),
('Manipur', 'Assam', 0.90),
('Manipur', 'Mizoram', 0.95),
('Meghalaya', 'Assam', 1.00),
('Mizoram', 'Assam', 0.90),
('Mizoram', 'Manipur', 0.95),
('Mizoram', 'Tripura', 0.95),
('Nagaland', 'Arunachal Pradesh', 0.90),
('Nagaland', 'Assam', 0.95),
('Nagaland', 'Manipur', 0.95),
('Odisha', 'West Bengal', 1.00),
('Odisha', 'Jharkhand', 1.00),
('Odisha', 'Chhattisgarh', 1.00),
('Odisha', 'Andhra Pradesh', 0.90),
('Punjab', 'Jammu and Kashmir', 0.95),
('Punjab', 'Himachal Pradesh', 1.00),
('Punjab', 'Haryana', 1.00),
('Punjab', 'Rajasthan', 1.00),
('Punjab', 'Chandigarh', 0.90),
('Rajasthan', 'Punjab', 1.00),
('Rajasthan', 'Haryana', 1.00),
('Rajasthan', 'Uttar Pradesh', 1.00),
('Rajasthan', 'Madhya Pradesh', 1.00),
('Rajasthan', 'Gujarat', 1.00),
('Sikkim', 'West Bengal', 1.00),
('Tamil Nadu', 'Kerala', 1.00),
('Tamil Nadu', 'Karnataka', 1.00),
('Tamil Nadu', 'Andhra Pradesh', 1.00),
('Tamil Nadu', 'Puducherry', 0.90),
('Telangana', 'Maharashtra', 1.00),
('Telangana', 'Chhattisgarh', 0.90),
('Telangana', 'Karnataka', 0.95),
('Telangana', 'Andhra Pradesh', 1.00),
('Tripura', 'Assam', 0.90),
('Tripura', 'Mizoram', 0.95),
('Uttar Pradesh', 'Himachal Pradesh', 0.80),
('Uttar Pradesh', 'Haryana', 1.00),
('Uttar Pradesh', 'Delhi', 1.00),
('Uttar Pradesh', 'Rajasthan', 1.00),
('Uttar Pradesh', 'Madhya Pradesh', 1.00),
('Uttar Pradesh', 'Chhattisgarh', 0.90),
('Uttar Pradesh', 'Jharkhand', 0.90),
('Uttar Pradesh', 'Bihar', 1.00),
('Uttar Pradesh', 'Uttarakhand', 1.00),
('Uttarakhand', 'Himachal Pradesh', 0.95),
('Uttarakhand', 'Uttar Pradesh', 1.00),
('West Bengal', 'Sikkim', 1.00),
('West Bengal', 'Assam', 1.00),
('West Bengal', 'Bihar', 0.95),
('West Bengal', 'Jharkhand', 1.00),
('West Bengal', 'Odisha', 1.00),
('Delhi', 'Haryana', 1.00),
('Delhi', 'Uttar Pradesh', 1.00),
('Jammu and Kashmir', 'Ladakh', 0.90),
('Jammu and Kashmir', 'Himachal Pradesh', 0.95),
('Jammu and Kashmir', 'Punjab', 0.95),
('Ladakh', 'Jammu and Kashmir', 0.90),
('Ladakh', 'Himachal Pradesh', 0.85),
('Chandigarh', 'Punjab', 0.90),
('Chandigarh', 'Haryana', 0.90),
('Puducherry', 'Tamil Nadu', 0.90),
('Puducherry', 'Andhra Pradesh', 0.80),
('Puducherry', 'Kerala', 0.80),
('Dadra and Nagar Haveli and Daman and Diu', 'Gujarat', 0.80),
('Dadra and Nagar Haveli and Daman and Diu', 'Maharashtra', 0.80)
ON CONFLICT (state, neighbor_state) DO NOTHING;

-- RLS Policies for New Outbreak Tables
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_adjacencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbreak_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write on disease_scans" ON public.disease_scans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on state_adjacencies" ON public.state_adjacencies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on outbreak_alerts" ON public.outbreak_alerts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. GramHaul Shared Logistics Truck Listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.truck_listings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'Tata 407 (Heavy Duty)',
    vehicle_plate TEXT NOT NULL,
    capacity_tons NUMERIC(5,2) DEFAULT 3.0,
    total_bags_capacity INTEGER NOT NULL DEFAULT 30,
    filled_bags INTEGER NOT NULL DEFAULT 0,
    rate_per_bag NUMERIC(8,2) NOT NULL DEFAULT 45.00,
    rate_per_km NUMERIC(8,2) DEFAULT 20.00,
    solo_rate NUMERIC(10,2) DEFAULT 1800.00,
    origin_village TEXT NOT NULL,
    destination_mandi TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    pickup_eta TEXT DEFAULT '30 mins',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_cold_chain BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULL', 'DEPARTED', 'CANCELLED')),
    rating NUMERIC(2,1) DEFAULT 4.9,
    trips_count INTEGER DEFAULT 25,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truck_listings_status ON public.truck_listings(status);
CREATE INDEX IF NOT EXISTS idx_truck_listings_coords ON public.truck_listings(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_truck_listings_created_at ON public.truck_listings(created_at DESC);

ALTER TABLE public.truck_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on truck_listings" ON public.truck_listings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on truck_listings" ON public.truck_listings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on truck_listings" ON public.truck_listings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on truck_listings" ON public.truck_listings FOR DELETE USING (true);

INSERT INTO public.truck_listings (
    id, driver_name, driver_phone, vehicle_type, vehicle_plate, 
    capacity_tons, total_bags_capacity, filled_bags, rate_per_bag, 
    rate_per_km, solo_rate, origin_village, destination_mandi, departure_time, 
    pickup_eta, latitude, longitude, is_cold_chain, status, rating, trips_count
) VALUES
(
    'TRK-8419', 'Ramesh Yadav', '+91 98492 11048', 'Tata 407 (Heavy Duty)', 'TS-03-UB-8419',
    3.5, 30, 22, 45.00,
    22.00, 1800.00, 'Narsampet Rural', 'Warangal Enumamula APMC Yard', 'Today, 4:30 PM',
    '25 mins', 17.9750, 79.5990, FALSE, 'ACTIVE', 4.9, 142
),
(
    'TRK-4920', 'K. Venkatesham', '+91 94401 77391', 'Eicher Pro 2049 (Express)', 'AP-36-TA-4920',
    5.0, 45, 31, 65.00,
    28.00, 2800.00, 'Station Road, Warangal', 'Bowenpally APMC, Hyderabad', 'Today, 6:00 PM',
    '45 mins', 17.9880, 79.6150, FALSE, 'ACTIVE', 4.8, 98
),
(
    'TRK-1102', 'Md. Ismail Khan', '+91 99890 32184', 'Mahindra Bolero Maxi Truck', 'TS-04-EA-1102',
    2.0, 20, 14, 45.00,
    18.00, 1400.00, 'Mulugu Hub', 'Warangal Enumamula APMC Yard', 'Today, 5:15 PM',
    '35 mins', 17.9620, 79.6050, FALSE, 'ACTIVE', 4.9, 210
),
(
    'TRK-3391', 'Gurpreet Singh', '+91 98765 43210', 'Tata Ace (Chhota Hathi)', 'PB-10-CZ-3391',
    1.5, 15, 5, 40.00,
    16.00, 1200.00, 'Kazipet Mandi Gate', 'Warangal APMC Yard', 'Today, 5:45 PM',
    '20 mins', 17.9820, 79.5820, FALSE, 'ACTIVE', 5.0, 36
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. Interactive Kisan Community Features (Posts, Likes, Follows)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    author_name TEXT NOT NULL,
    author_village TEXT,
    avatar_url TEXT,
    crop_id TEXT,
    title TEXT NOT NULL,
    content TEXT,
    body TEXT,
    media_url TEXT,
    media_type TEXT,
    media_label TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_posts 
ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_crop_id ON public.community_posts(crop_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_likes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    post_id TEXT NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_post_likes UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON public.post_likes(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_follows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_follows UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON public.user_follows(created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_sync_post_likes_count()
RETURNS TRIGGER AS $$
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

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on community_posts') THEN
        CREATE POLICY "Allow public read on community_posts" ON public.community_posts FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on community_posts') THEN
        CREATE POLICY "Allow public insert on community_posts" ON public.community_posts FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow author update on community_posts') THEN
        CREATE POLICY "Allow author update on community_posts" ON public.community_posts FOR UPDATE USING (
            auth.uid()::text = user_id OR auth.role() = 'service_role' OR user_id IS NULL
        ) WITH CHECK (
            auth.uid()::text = user_id OR auth.role() = 'service_role' OR user_id IS NULL
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow author delete on community_posts') THEN
        CREATE POLICY "Allow author delete on community_posts" ON public.community_posts FOR DELETE USING (
            auth.uid()::text = user_id OR auth.role() = 'service_role' OR user_id IS NULL
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on post_likes') THEN
        CREATE POLICY "Allow public read on post_likes" ON public.post_likes FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on post_likes') THEN
        CREATE POLICY "Allow public insert on post_likes" ON public.post_likes FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on post_likes') THEN
        CREATE POLICY "Allow public update on post_likes" ON public.post_likes FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on post_likes') THEN
        CREATE POLICY "Allow public delete on post_likes" ON public.post_likes FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on user_follows') THEN
        CREATE POLICY "Allow public read on user_follows" ON public.user_follows FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on user_follows') THEN
        CREATE POLICY "Allow public insert on user_follows" ON public.user_follows FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on user_follows') THEN
        CREATE POLICY "Allow public update on user_follows" ON public.user_follows FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on user_follows') THEN
        CREATE POLICY "Allow public delete on user_follows" ON public.user_follows FOR DELETE USING (true);
    END IF;
END $$;


