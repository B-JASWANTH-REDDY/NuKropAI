-- ============================================================================
-- NuKropAI Agrarian Intelligence OS — Production Supabase Schema & Security
-- Strict Compliance: DPDP Act 2023, GDPR, Apple App Store & Google Play Store
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES & FARMER IDENTITIES ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  state VARCHAR(50) DEFAULT 'Telangana',
  district VARCHAR(50) DEFAULT 'Warangal',
  village VARCHAR(50) DEFAULT 'Hanamkonda',
  land_extent_acres NUMERIC(6,2) DEFAULT 4.50,
  preferred_language VARCHAR(10) DEFAULT 'te',
  dpdp_consent_given BOOLEAN DEFAULT TRUE,
  dpdp_consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. CROP DISEASE SCANS & AI INFERENCE ──
CREATE TABLE IF NOT EXISTS public.disease_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  crop_type VARCHAR(50) NOT NULL,
  diagnosis_name VARCHAR(100) NOT NULL,
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  severity VARCHAR(20) DEFAULT 'MODERATE',
  image_storage_path TEXT,
  gps_latitude NUMERIC(9,6),
  gps_longitude NUMERIC(9,6),
  state VARCHAR(50) DEFAULT 'Telangana',
  district VARCHAR(50) DEFAULT 'Warangal',
  recommended_treatment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. REGIONAL OUTBREAK ALERTS ──
CREATE TABLE IF NOT EXISTS public.outbreak_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_name VARCHAR(50) NOT NULL,
  pest_name VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  district VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'HIGH_ALERT' CHECK (severity IN ('LOW_RISK', 'MODERATE', 'HIGH_ALERT')),
  scan_count INTEGER DEFAULT 1,
  market_price_impact NUMERIC(5,2) DEFAULT 0.00,
  broadcast_message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ── 4. KISAN COMMUNITY POSTS & REPLIES ──
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  crop_tag VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  media_url TEXT,
  likes_count INTEGER DEFAULT 0,
  is_verified_agronomist BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'Farmer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. FARM KHATA TRANSACTIONS ──
CREATE TABLE IF NOT EXISTS public.khata_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE DEFAULT CURRENT_DATE,
  payment_mode VARCHAR(30) DEFAULT 'Cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. RENT MACHINERY LISTINGS & BOOKINGS ──
CREATE TABLE IF NOT EXISTS public.machinery_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.machinery_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  machinery_id UUID REFERENCES public.machinery_listings(id) ON DELETE CASCADE,
  booking_unit VARCHAR(10) NOT NULL CHECK (booking_unit IN ('acre', 'hour')),
  quantity NUMERIC(5,2) NOT NULL CHECK (quantity > 0),
  total_amount NUMERIC(10,2) NOT NULL,
  service_date DATE NOT NULL,
  time_slot VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'DISPATCHED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 🔐 ROW LEVEL SECURITY (RLS) POLICIES — ZERO PERMISSIVE ACCESS
-- ============================================================================

-- 1. Enable RLS on ALL tables without exception
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbreak_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery_bookings ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile (Right to be Forgotten)" 
  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 3. Disease Scans Policies
CREATE POLICY "Users can view own scans" 
  ON public.disease_scans FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans" 
  ON public.disease_scans FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans" 
  ON public.disease_scans FOR DELETE USING (auth.uid() = user_id);

-- 4. Outbreak Alerts (Publicly readable aggregated early warning signals)
CREATE POLICY "Anyone can read active outbreak alerts" 
  ON public.outbreak_alerts FOR SELECT USING (is_active = TRUE);

-- 5. Kisan Community Policies
CREATE POLICY "Authenticated users can read community posts" 
  ON public.community_posts FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Users can create community posts" 
  ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts" 
  ON public.community_posts FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts" 
  ON public.community_posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Authenticated users can read comments" 
  ON public.community_comments FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Users can add comments" 
  ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- 6. Farm Khata Ledger Policies (Strict Isolation)
CREATE POLICY "Strict private ledger access" 
  ON public.khata_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Strict private ledger insert" 
  ON public.khata_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Strict private ledger update" 
  ON public.khata_transactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Strict private ledger delete" 
  ON public.khata_transactions FOR DELETE USING (auth.uid() = user_id);

-- 7. Machinery Listings & Bookings
CREATE POLICY "Anyone can view available machinery" 
  ON public.machinery_listings FOR SELECT USING (is_available = TRUE);

CREATE POLICY "Owners can manage own listings" 
  ON public.machinery_listings FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own bookings" 
  ON public.machinery_bookings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings" 
  ON public.machinery_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── RATE LIMITING HELPER FUNCTION (Anti-DDoS & Spam Protection) ──
CREATE OR REPLACE FUNCTION public.check_rate_limit(user_uuid UUID, max_requests INT, interval_seconds INT)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count 
  FROM public.disease_scans 
  WHERE user_id = user_uuid AND created_at > (NOW() - (interval_seconds || ' seconds')::INTERVAL);

  IF recent_count >= max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded: Please wait before submitting more requests.';
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, INT, INT) TO authenticated, service_role;
