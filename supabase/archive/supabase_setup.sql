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

-- 3. Peer-to-Peer 1-on-1 Messages / Community Posts
CREATE TABLE IF NOT EXISTS public.peer_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_email VARCHAR(255) NOT NULL,
    receiver_email VARCHAR(255) NOT NULL,
    receiver_name VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.community_posts (
    id SERIAL PRIMARY KEY,
    author_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    crop_id VARCHAR(100),
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
    owner_email VARCHAR(255),
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
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read and write on user_profiles" ON public.user_profiles;
CREATE POLICY "Allow public read and write on user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on mandi_live_rates" ON public.mandi_live_rates;
CREATE POLICY "Allow public read and write on mandi_live_rates" ON public.mandi_live_rates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on peer_messages" ON public.peer_messages;
CREATE POLICY "Allow public read and write on peer_messages" ON public.peer_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on community_posts" ON public.community_posts;
CREATE POLICY "Allow public read and write on community_posts" ON public.community_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on equipment_rentals" ON public.equipment_rentals;
CREATE POLICY "Allow public read and write on equipment_rentals" ON public.equipment_rentals FOR ALL USING (true) WITH CHECK (true);
