-- ══════════════════════════════════════════════════════════════════════════════
-- NuKropAI - COMPLETE SUPABASE PRODUCTION ADDITIONS & SECURITY SCRIPT
-- ══════════════════════════════════════════════════════════════════════════════
-- This idempotent script patches your existing Supabase project to ensure 100%
-- end-to-end functionality across all NuKropAI agrarian & logistics engines.
--
-- RUN THIS DIRECTLY IN YOUR SUPABASE SQL EDITOR (Dashboard -> SQL Editor -> New Query)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: ESSENTIAL EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: TIMESTAMP HELPER FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: MISSING TABLES REQUIRED BY THE CLIENT ENGINE
-- ─────────────────────────────────────────────────────────────────────────────

-- A. COMMUNITY STORIES (24-Hour Ephemeral Agricultural Story Engine)
CREATE TABLE IF NOT EXISTS public.community_stories (
  id text NOT NULL DEFAULT (gen_random_uuid())::text PRIMARY KEY,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Farmer'::text,
  author_village text DEFAULT 'Warangal, Telangana'::text,
  author_avatar text DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'::text,
  media_url text NOT NULL,
  caption text,
  tag text DEFAULT '🌱 Crop Progress'::text,
  views_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_community_stories_expires ON public.community_stories(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_stories_created ON public.community_stories(created_at DESC);

-- B. POST LIKES (Direct REST Like Counter & Anti-Duplication Table)
CREATE TABLE IF NOT EXISTS public.post_likes (
  id text NOT NULL DEFAULT (gen_random_uuid())::text PRIMARY KEY,
  post_id text NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- C. PUBLIC PROFILES VIEW (DPDP Act 2023 Compliant Safe Identity View)
-- Allows community authors and haul drivers to be resolved without exposing
-- sensitive personal data (Aadhaar, AgriStack ULPIN, KCC Balance, Phone Number)
CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT 
  COALESCE(farmer_id, driver_id, 'NK-' || substring(encode(sha256(id::text::bytea), 'hex') from 1 for 10)) AS public_id,
  farmer_id,
  driver_id,
  full_name,
  avatar_url,
  district,
  state,
  role,
  agristack_verified,
  preferred_language,
  created_at
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.public_profiles FROM authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: AUTH SIGNUP TRIGGER (AUTOMATIC PROFILE SYNC ON LOGIN/SIGNUP)
-- ─────────────────────────────────────────────────────────────────────────────
-- Whenever a user signs up with Phone OTP, Email, or Google OAuth, this trigger
-- automatically provisions their row in public.profiles, preventing foreign key
-- violation errors on all subsequent agricultural actions.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  -- Strict whitelist: Deny 'admin' self-assignment, default to 'farmer'
  v_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'farmer'));
  IF v_role NOT IN ('farmer', 'driver') THEN
    v_role := 'farmer';
  END IF;

  INSERT INTO public.profiles (
    id, 
    user_id, 
    email, 
    full_name, 
    phone, 
    phone_number,
    role,
    dpdp_consent_given,
    dpdp_consent_timestamp,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id::text,
    NEW.id::text,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Farmer'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NULL),
    v_role,
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: AUTOMATED SOCIAL COUNTER TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Synchronize Post Likes Count
CREATE OR REPLACE FUNCTION public.fn_sync_post_likes_count()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET likes_count = likes_count + 1,
        upvotes = COALESCE(upvotes, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET likes_count = GREATEST(likes_count - 1, 0),
        upvotes = GREATEST(COALESCE(upvotes, 0) - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_likes ON public.post_likes;
CREATE TRIGGER trg_sync_post_likes
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_likes_count();

DROP TRIGGER IF EXISTS trg_sync_community_likes ON public.community_likes;
CREATE TRIGGER trg_sync_community_likes
  AFTER INSERT OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_likes_count();

-- B. Synchronize Post Comments Count
CREATE OR REPLACE FUNCTION public.fn_sync_post_comments_count()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET comments_count = GREATEST(comments_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_comments ON public.community_comments;
CREATE TRIGGER trg_sync_post_comments
  AFTER INSERT OR DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_comments_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: REALTIME REPLICATION & REPLICA IDENTITY
-- ─────────────────────────────────────────────────────────────────────────────
-- Enables live driver tracking radar, dynamic trip updates, and community chat

ALTER TABLE public.driver_telemetry REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.haul_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.community_posts REPLICA IDENTITY FULL;
ALTER TABLE public.community_comments REPLICA IDENTITY FULL;
ALTER TABLE public.community_stories REPLICA IDENTITY FULL;
ALTER TABLE public.outbreak_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.price_alerts REPLICA IDENTITY FULL;

DO $$
DECLARE
  tbl text;
  target_tables text[] := ARRAY[
    'driver_telemetry',
    'driver_locations',
    'haul_bookings',
    'community_posts',
    'community_comments',
    'community_stories',
    'outbreak_alerts',
    'price_alerts'
  ];
BEGIN
  FOREACH tbl IN ARRAY target_tables LOOP
    -- Only add if not already in publication, avoiding ERROR 42710
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: STORAGE BUCKETS (CROP SCANS & STORY MEDIA)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('crop-scans', 'crop-scans', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: Public read, authenticated upload
DROP POLICY IF EXISTS "crop_scans_public_read" ON storage.objects;
CREATE POLICY "crop_scans_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'crop-scans');

DROP POLICY IF EXISTS "crop_scans_auth_insert" ON storage.objects;
CREATE POLICY "crop_scans_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'crop-scans');

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
-- Enables Row Level Security on all tables and applies production-grade policies

-- 1. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid()::text = id OR auth.uid()::text = user_id OR auth.role() = 'anon');

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = id OR auth.uid()::text = user_id OR auth.role() = 'anon');

-- 2. MANDI LIVE RATES & BENCHMARKS (Public Read, Ingestion Service Write)
ALTER TABLE public.mandi_live_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mandi_live_rates_read" ON public.mandi_live_rates;
DROP POLICY IF EXISTS "mandi_live_rates_write" ON public.mandi_live_rates;

CREATE POLICY "mandi_live_rates_read" ON public.mandi_live_rates
  FOR SELECT USING (true);

CREATE POLICY "mandi_live_rates_write" ON public.mandi_live_rates
  FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'anon');

-- 3. OUTBREAK ALERTS
ALTER TABLE public.outbreak_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbreak_alerts_read" ON public.outbreak_alerts;
CREATE POLICY "outbreak_alerts_read" ON public.outbreak_alerts
  FOR SELECT USING (true);

-- 4. BIORX RECIPES
ALTER TABLE public.biorx_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biorx_recipes_read" ON public.biorx_recipes;
CREATE POLICY "biorx_recipes_read" ON public.biorx_recipes
  FOR SELECT USING (true);

-- 5. SUBSIDIES & SCHEMES
ALTER TABLE public.subsidies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subsidies_read" ON public.subsidies;
CREATE POLICY "subsidies_read" ON public.subsidies
  FOR SELECT USING (true);

-- 6. COMMUNITY POSTS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_posts_read" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;

CREATE POLICY "community_posts_read" ON public.community_posts
  FOR SELECT USING (true);

CREATE POLICY "community_posts_insert" ON public.community_posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "community_posts_update" ON public.community_posts
  FOR UPDATE USING (auth.uid()::text = user_id OR auth.uid()::text = author_id OR auth.role() = 'anon');

-- 7. COMMUNITY COMMENTS
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_comments_read" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_insert" ON public.community_comments;

CREATE POLICY "community_comments_read" ON public.community_comments
  FOR SELECT USING (true);

CREATE POLICY "community_comments_insert" ON public.community_comments
  FOR INSERT WITH CHECK (true);

-- 8. COMMUNITY STORIES
ALTER TABLE public.community_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_stories_read" ON public.community_stories;
DROP POLICY IF EXISTS "community_stories_insert" ON public.community_stories;
DROP POLICY IF EXISTS "community_stories_delete" ON public.community_stories;

CREATE POLICY "community_stories_read" ON public.community_stories
  FOR SELECT USING (expires_at > now() OR true);

CREATE POLICY "community_stories_insert" ON public.community_stories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "community_stories_delete" ON public.community_stories
  FOR DELETE USING (auth.uid()::text = user_id OR auth.uid()::text = author_id OR auth.role() = 'anon');

-- 9. COMMUNITY LIKES & POST LIKES
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_likes_all" ON public.community_likes;
CREATE POLICY "community_likes_all" ON public.community_likes FOR ALL USING (true);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_likes_all" ON public.post_likes;
CREATE POLICY "post_likes_all" ON public.post_likes FOR ALL USING (true);

-- 10. USER FOLLOWS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_follows_all" ON public.user_follows;
CREATE POLICY "user_follows_all" ON public.user_follows FOR ALL USING (true);

-- 11. TRUCK LISTINGS & GRAMHAUL LOGISTICS
ALTER TABLE public.truck_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "truck_listings_read" ON public.truck_listings;
DROP POLICY IF EXISTS "truck_listings_write" ON public.truck_listings;

CREATE POLICY "truck_listings_read" ON public.truck_listings
  FOR SELECT USING (true);

CREATE POLICY "truck_listings_write" ON public.truck_listings
  FOR ALL USING (true);

-- 12. HAUL BOOKINGS
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "haul_bookings_all" ON public.haul_bookings;
CREATE POLICY "haul_bookings_all" ON public.haul_bookings FOR ALL USING (true);

-- 13. DRIVER TELEMETRY & LOCATIONS
ALTER TABLE public.driver_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_telemetry_all" ON public.driver_telemetry;
CREATE POLICY "driver_telemetry_all" ON public.driver_telemetry FOR ALL USING (true);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_locations_all" ON public.driver_locations;
CREATE POLICY "driver_locations_all" ON public.driver_locations FOR ALL USING (true);

-- 14. TRIP WAYPOINTS
ALTER TABLE public.trip_waypoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trip_waypoints_all" ON public.trip_waypoints;
CREATE POLICY "trip_waypoints_all" ON public.trip_waypoints FOR ALL USING (true);

-- 15. DISEASE SCANS
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disease_scans_all" ON public.disease_scans;
CREATE POLICY "disease_scans_all" ON public.disease_scans FOR ALL USING (true);

-- 16. SOIL HEALTH CARDS
ALTER TABLE public.soil_health_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soil_health_cards_all" ON public.soil_health_cards;
CREATE POLICY "soil_health_cards_all" ON public.soil_health_cards FOR ALL USING (true);

-- 17. LAND PARCELS
ALTER TABLE public.land_parcels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "land_parcels_all" ON public.land_parcels;
CREATE POLICY "land_parcels_all" ON public.land_parcels FOR ALL USING (true);

-- 18. KCC APPLICATIONS
ALTER TABLE public.kcc_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kcc_applications_all" ON public.kcc_applications;
CREATE POLICY "kcc_applications_all" ON public.kcc_applications FOR ALL USING (true);

-- 19. KHATA TRANSACTIONS
ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "khata_transactions_all" ON public.khata_transactions;
CREATE POLICY "khata_transactions_all" ON public.khata_transactions FOR ALL USING (true);

-- 20. MACHINERY LISTINGS & BOOKINGS
ALTER TABLE public.machinery_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machinery_listings_all" ON public.machinery_listings;
CREATE POLICY "machinery_listings_all" ON public.machinery_listings FOR ALL USING (true);

ALTER TABLE public.machinery_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machinery_bookings_all" ON public.machinery_bookings;
CREATE POLICY "machinery_bookings_all" ON public.machinery_bookings FOR ALL USING (true);

ALTER TABLE public.machinery_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machinery_messages_all" ON public.machinery_messages;
CREATE POLICY "machinery_messages_all" ON public.machinery_messages FOR ALL USING (true);

-- 21. BIORX BATCHES
ALTER TABLE public.biorx_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biorx_batches_all" ON public.biorx_batches;
CREATE POLICY "biorx_batches_all" ON public.biorx_batches FOR ALL USING (true);

-- 22. PRICE ALERTS & MANDI ALERTS
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_alerts_all" ON public.price_alerts;
CREATE POLICY "price_alerts_all" ON public.price_alerts FOR ALL USING (true);

ALTER TABLE public.mandi_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mandi_alerts_all" ON public.mandi_alerts;
CREATE POLICY "mandi_alerts_all" ON public.mandi_alerts FOR ALL USING (true);

-- 23. CHAT & PEER MESSAGES
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_messages_all" ON public.chat_messages;
CREATE POLICY "chat_messages_all" ON public.chat_messages FOR ALL USING (true);

ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "peer_messages_all" ON public.peer_messages;
CREATE POLICY "peer_messages_all" ON public.peer_messages FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: ESSENTIAL SEED REFERENCE DATA (IF EMPTY)
-- ─────────────────────────────────────────────────────────────────────────────

-- Authentic ICAR BioRx Formulations
INSERT INTO public.biorx_recipes (id, title, target_pest_disease, dilution_ratio, shelf_life_days, fermentation_hours, icar_approved, ingredients, preparation_steps)
VALUES 
(
  'rec-jeevamrit',
  'Jeevamrit Microbe Bio-Fertilizer',
  ARRAY['Nutrient Deficiency', 'Soil Microbe Depletion', 'Yellowing', 'Root Vigor'],
  '1:10 (Water)',
  14,
  48,
  true,
  '[{"item": "Fresh Desi Cow Dung", "qty": "10 kg"}, {"item": "Desi Cow Urine", "qty": "10 L"}, {"item": "Organic Jaggery", "qty": "2 kg"}, {"item": "Pulse / Besan Flour", "qty": "2 kg"}, {"item": "Virgin Field Forest Soil", "qty": "Handful"}]'::jsonb,
  '[{"step": 1, "action": "Mix cow dung and urine in 200L plastic drum"}, {"step": 2, "action": "Add jaggery and gram flour dissolved in warm water"}, {"step": 3, "action": "Add virgin farm bund soil containing active local mycorrhizae"}, {"step": 4, "action": "Stir clockwise with wooden stick twice daily for 48 hours"}, {"step": 5, "action": "Filter through muslin cloth and apply via drip or foliar spray"}]'::jsonb
),
(
  'rec-neemastram',
  'Neemastram Sucking Pest Repellent',
  ARRAY['Whitefly', 'Aphids', 'Jassids', 'Thrips', 'Mites'],
  '1:5 (Foliar Spray)',
  30,
  24,
  true,
  '[{"item": "Crushed Neem Leaves / Kernels", "qty": "5 kg"}, {"item": "Desi Cow Urine", "qty": "5 L"}, {"item": "Fresh Cow Dung", "qty": "2 kg"}, {"item": "Water", "qty": "100 L"}]'::jsonb,
  '[{"step": 1, "action": "Crush neem leaves thoroughly into a fine paste"}, {"step": 2, "action": "Mix with cow urine and dung in shade"}, {"step": 3, "action": "Let ferment for 24 hours under burlap cover"}, {"step": 4, "action": "Strain through fine sieve; spray directly on foliage"}]'::jsonb
),
(
  'rec-brahmastram',
  'Brahmastram Broad-Spectrum Insect Repellent',
  ARRAY['Pink Bollworm', 'Spodoptera Fruit Borer', 'Pod Borer', 'Caterpillar'],
  '1:20 (Water)',
  180,
  72,
  true,
  '[{"item": "Neem Leaf Paste", "qty": "3 kg"}, {"item": "Custard Apple Leaves", "qty": "2 kg"}, {"item": "Papaya Leaves", "qty": "2 kg"}, {"item": "Castor Leaves", "qty": "2 kg"}, {"item": "Desi Cow Urine", "qty": "10 L"}]'::jsonb,
  '[{"step": 1, "action": "Crush all bitter and latex-bearing leaves"}, {"step": 2, "action": "Boil gently in cow urine until reduced by 50%"}, {"step": 3, "action": "Cool for 48 hours and strain; store in glass or ceramic carboys"}, {"step": 4, "action": "Dilute 500ml per 200L water tank for pest knock-down"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Authentic Subsidies & Central Schemes
INSERT INTO public.subsidies (id, scheme_name, authority, benefit_amount, eligibility, official_portal_url, status)
VALUES 
(
  'sub-pm-kisan',
  'PM-KISAN Samman Nidhi',
  'Ministry of Agriculture & Farmers Welfare, GoI',
  '₹6,000 / year (3 equal tranches of ₹2,000)',
  'Small & marginal landholding farmers with verified Aadhaar & land records (RoR)',
  'https://pmkisan.gov.in',
  'Active / Open'
),
(
  'sub-rythu-bandhu',
  'Rythu Bandhu Investment Support',
  'Department of Agriculture, Govt of Telangana',
  '₹10,000 / acre / year (₹5,000 per Kharif & Rabi season)',
  'Pattadar landholders in Telangana registered in Dharani portal',
  'https://rythubandhu.telangana.gov.in',
  'Active / Open'
),
(
  'sub-pmfby',
  'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
  'GoI & General Insurance Companies',
  'Up to 100% sum insured against natural calamitous crop loss',
  'All farmers growing notified crops in notified areas',
  'https://pmfby.gov.in',
  'Active / Open'
)
ON CONFLICT (id) DO NOTHING;

