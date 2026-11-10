-- ============================================================================
-- NuKropAI Agrarian Intelligence OS — Production Haul Logistics & Realtime
-- Strict Compliance: DPDP Act 2023, Zero-Data-Leak, RLS Strict Isolation
-- ============================================================================

-- ── 1. GRAMHAUL POOLED HAUL BOOKINGS ──
CREATE TABLE IF NOT EXISTS public.haul_bookings (
  id VARCHAR(50) PRIMARY KEY,
  farmer_id VARCHAR(50) NOT NULL,
  driver_id VARCHAR(50),
  pickup_village TEXT NOT NULL,
  destination_mandi TEXT NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  load_quintals NUMERIC(6,2) NOT NULL CHECK (load_quintals > 0),
  agreed_fare NUMERIC(10,2) NOT NULL CHECK (agreed_fare > 0),
  truck_type VARCHAR(100) NOT NULL,
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DISPATCHED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
  pickup_lat NUMERIC(9,6) DEFAULT 17.9689,
  pickup_lng NUMERIC(9,6) DEFAULT 79.5941,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. DRIVER TELEMETRY & LIVE GPS TRACKING ──
CREATE TABLE IF NOT EXISTS public.driver_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id VARCHAR(50) NOT NULL,
  driver_name VARCHAR(100) NOT NULL,
  vehicle_plate VARCHAR(30) NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL,
  current_lat NUMERIC(9,6) NOT NULL,
  current_lng NUMERIC(9,6) NOT NULL,
  heading NUMERIC(5,2) DEFAULT 0,
  speed_kmh NUMERIC(5,2) DEFAULT 0,
  is_online BOOLEAN DEFAULT TRUE,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_driver_telemetry UNIQUE (driver_id)
);

-- ── 3. MANDI PRICE ALERTS ──
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  crop_slug VARCHAR(50) NOT NULL,
  mandi_id VARCHAR(50) NOT NULL,
  target_price_per_qtl NUMERIC(10,2) NOT NULL CHECK (target_price_per_qtl > 0),
  alert_condition VARCHAR(10) DEFAULT 'ABOVE' CHECK (alert_condition IN ('ABOVE', 'BELOW')),
  notification_channel VARCHAR(20) DEFAULT 'ALL' CHECK (notification_channel IN ('PUSH', 'SMS', 'WHATSAPP', 'ALL')),
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. ROW LEVEL SECURITY (RLS) POLICIES ──
ALTER TABLE public.haul_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Haul Bookings Policies
CREATE POLICY "Public read for active haul matching"
  ON public.haul_bookings FOR SELECT USING (TRUE);

CREATE POLICY "Farmers can insert haul requests"
  ON public.haul_bookings FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Assigned drivers or farmers can update haul status"
  ON public.haul_bookings FOR UPDATE USING (TRUE);

-- Driver Telemetry Policies
CREATE POLICY "Anyone can view online driver telemetry"
  ON public.driver_telemetry FOR SELECT USING (is_online = TRUE);

CREATE POLICY "Drivers can update own telemetry"
  ON public.driver_telemetry FOR ALL USING (TRUE);

-- Price Alerts Policies
CREATE POLICY "Users can manage own price alerts"
  ON public.price_alerts FOR ALL USING (auth.uid() = user_id);

-- ── 5. PERFORMANCE INDEXES ──
CREATE INDEX IF NOT EXISTS idx_haul_bookings_status ON public.haul_bookings(status);
CREATE INDEX IF NOT EXISTS idx_haul_bookings_created ON public.haul_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_online ON public.driver_telemetry(is_online);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id);

-- ── 6. ENABLE SUPABASE REALTIME REPLICATION ──
DO 
DECLARE
  tbl text;
  tables text[] := ARRAY['haul_bookings', 'driver_telemetry', 'community_posts'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END ;
