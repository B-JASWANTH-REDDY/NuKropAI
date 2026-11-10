import sys
sys.stdout.reconfigure(encoding='utf-8')

# Read CANONICAL_PRODUCTION_SETUP.sql
with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Update public_profiles view in Step 4B to remove user_id and village
old_view = """CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = false) AS
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

GRANT SELECT ON public.public_profiles TO anon, authenticated;"""

new_view = """CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = false) AS
SELECT 
  id,
  farmer_id,
  full_name,
  avatar_url,
  district,
  state,
  role,
  agristack_verified,
  preferred_language,
  created_at
FROM public.profiles;

REVOKE INSERT, UPDATE, DELETE ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;"""

assert old_view in sql, "Could not find old_view in CANONICAL_PRODUCTION_SETUP.sql"
sql = sql.replace(old_view, new_view, 1)
print("Updated public.public_profiles view: user_id and village removed, write permissions revoked.")

# 2. Update community_stories RLS policies (eliminate OR true, eliminate anon write/delete, enforce ownership)
old_stories_rls = """CREATE POLICY "community_stories_read" ON public.community_stories
  FOR SELECT USING (expires_at > now() OR auth.uid()::text = user_id OR auth.uid()::text = author_id OR true);

CREATE POLICY "community_stories_insert" ON public.community_stories
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR auth.role() = 'anon'
  );

CREATE POLICY "community_stories_delete" ON public.community_stories
  FOR DELETE USING (auth.uid()::text = user_id OR auth.uid()::text = author_id OR auth.role() = 'anon');"""

new_stories_rls = """-- Public can read unexpired stories; owners can read their own active or archived stories
CREATE POLICY "community_stories_read" ON public.community_stories
  FOR SELECT USING (
    expires_at > now() 
    OR (auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id))
  );

-- Only authenticated users can create stories for their own identity (no impersonation, zero anon insert)
CREATE POLICY "community_stories_insert" ON public.community_stories
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
  );

-- Story owners can update their stories
DROP POLICY IF EXISTS "community_stories_update" ON public.community_stories;
CREATE POLICY "community_stories_update" ON public.community_stories
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
  );

-- Only the story owner can delete their story (zero anonymous deletion)
CREATE POLICY "community_stories_delete" ON public.community_stories
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND (auth.uid()::text = user_id OR auth.uid()::text = author_id)
  );"""

assert old_stories_rls in sql, "Could not find old_stories_rls in CANONICAL_PRODUCTION_SETUP.sql"
sql = sql.replace(old_stories_rls, new_stories_rls, 1)
print("Updated community_stories RLS policies: removed OR true, removed anon write/delete, enforced strict ownership.")

# 3. Update Step 4: Remove destructive UPDATE khata_transactions user_id = NULL and remove blanket EXCEPTION WHEN OTHERS THEN NULL
old_step4 = """-- ─────────────────────────────────────────────────────────────────
-- STEP 4: MIGRATION & EXPLICIT FOREIGN KEY REPAIR
-- ─────────────────────────────────────────────────────────────────
-- Drop view if exists before column alterations so dependent rule _RETURN never blocks type sanitization
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Explicitly sanitizes and casts primary/foreign key columns without
-- blind dynamic policy drops, only executing if data type is not already text.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.profiles ALTER COLUMN id TYPE text USING id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.profiles ALTER COLUMN user_id TYPE text USING user_id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='khata_transactions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khata_transactions' AND column_name='id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.khata_transactions ALTER COLUMN id TYPE text USING id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khata_transactions' AND column_name='user_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khata_transactions' AND column_name='user_id' AND data_type != 'text') THEN
        BEGIN
          ALTER TABLE public.khata_transactions ALTER COLUMN user_id TYPE text USING user_id::text;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
      UPDATE public.khata_transactions SET user_id = NULL WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = khata_transactions.user_id);
      ALTER TABLE public.khata_transactions DROP CONSTRAINT IF EXISTS khata_transactions_user_id_fkey;
      ALTER TABLE public.khata_transactions ADD CONSTRAINT khata_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='haul_bookings') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.haul_bookings ALTER COLUMN id TYPE text USING id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='farmer_user_id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.haul_bookings ALTER COLUMN farmer_user_id TYPE text USING farmer_user_id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='driver_user_id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.haul_bookings ALTER COLUMN driver_user_id TYPE text USING driver_user_id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='truck_listings') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.truck_listings ALTER COLUMN id TYPE text USING id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='user_id' AND data_type != 'text') THEN
      BEGIN
        ALTER TABLE public.truck_listings ALTER COLUMN user_id TYPE text USING user_id::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;
END $$;"""

new_step4 = """-- ─────────────────────────────────────────────────────────────────
-- STEP 4: MIGRATION & EXPLICIT FOREIGN KEY REPAIR
-- ─────────────────────────────────────────────────────────────────
-- Drop public_profiles view without CASCADE to prevent view rewrite rule lock during migration
DROP VIEW IF EXISTS public.public_profiles;

-- PRESERVE FINANCIAL TRANSACTION OWNERSHIP:
-- Ensure referenced profile records exist for all historical khata transactions.
-- NEVER set user_id = NULL on financial transactions!
INSERT INTO public.profiles (id, full_name, role)
SELECT DISTINCT kt.user_id, 'Farmer (Ledger Account)', 'farmer'
FROM public.khata_transactions kt
WHERE kt.user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = kt.user_id)
ON CONFLICT (id) DO NOTHING;

-- Explicitly inspect and cast primary/foreign key columns without blanket exception swallowing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id' AND data_type != 'text') THEN
      ALTER TABLE public.profiles ALTER COLUMN id TYPE text USING id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id' AND data_type != 'text') THEN
      ALTER TABLE public.profiles ALTER COLUMN user_id TYPE text USING user_id::text;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='khata_transactions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khata_transactions' AND column_name='id' AND data_type != 'text') THEN
      ALTER TABLE public.khata_transactions ALTER COLUMN id TYPE text USING id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khata_transactions' AND column_name='user_id' AND data_type != 'text') THEN
      ALTER TABLE public.khata_transactions ALTER COLUMN user_id TYPE text USING user_id::text;
    END IF;
    ALTER TABLE public.khata_transactions DROP CONSTRAINT IF EXISTS khata_transactions_user_id_fkey;
    ALTER TABLE public.khata_transactions ADD CONSTRAINT khata_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='haul_bookings') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='id' AND data_type != 'text') THEN
      ALTER TABLE public.haul_bookings ALTER COLUMN id TYPE text USING id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='farmer_user_id' AND data_type != 'text') THEN
      ALTER TABLE public.haul_bookings ALTER COLUMN farmer_user_id TYPE text USING farmer_user_id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='haul_bookings' AND column_name='driver_user_id' AND data_type != 'text') THEN
      ALTER TABLE public.haul_bookings ALTER COLUMN driver_user_id TYPE text USING driver_user_id::text;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='truck_listings') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='id' AND data_type != 'text') THEN
      ALTER TABLE public.truck_listings ALTER COLUMN id TYPE text USING id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='truck_listings' AND column_name='user_id' AND data_type != 'text') THEN
      ALTER TABLE public.truck_listings ALTER COLUMN user_id TYPE text USING user_id::text;
    END IF;
  END IF;
END $$;"""

assert old_step4 in sql, "Could not find old_step4 in CANONICAL_PRODUCTION_SETUP.sql"
sql = sql.replace(old_step4, new_step4, 1)
print("Updated Step 4: preserved financial ownership, removed destructive NULLing, removed blanket exception swallowing.")

# 4. Update Step 8 Realtime: Remove blanket WHEN OTHERS THEN NULL
old_realtime_loop = """      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION 
          WHEN duplicate_object THEN NULL;
          WHEN OTHERS THEN NULL;
        END;
      END IF;"""

new_realtime_loop = """      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION 
          WHEN duplicate_object THEN NULL;
        END;
      END IF;"""

assert old_realtime_loop in sql, "Could not find old_realtime_loop in CANONICAL_PRODUCTION_SETUP.sql"
sql = sql.replace(old_realtime_loop, new_realtime_loop, 1)
print("Updated Step 8 Realtime: removed blanket WHEN OTHERS THEN NULL, keeping duplicate_object safety.")

with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

with open('supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

# Also update NUKROP_SUPABASE_ADDITIONS.sql
with open('supabase/NUKROP_SUPABASE_ADDITIONS.sql', 'r', encoding='utf-8') as f:
    add_sql = f.read()

# Update public_profiles in additions if present
if 'CREATE OR REPLACE VIEW public.public_profiles AS' in add_sql:
    add_old_view = """CREATE OR REPLACE VIEW public.public_profiles AS
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
FROM public.profiles;"""
    add_new_view = """CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  farmer_id,
  full_name,
  avatar_url,
  district,
  state,
  role,
  agristack_verified,
  preferred_language,
  created_at
FROM public.profiles;

REVOKE INSERT, UPDATE, DELETE ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;"""
    if add_old_view in add_sql:
        add_sql = add_sql.replace(add_old_view, add_new_view, 1)
        print("Updated NUKROP_SUPABASE_ADDITIONS.sql public_profiles view.")

# Update community_stories RLS in additions if present
if old_stories_rls in add_sql:
    add_sql = add_sql.replace(old_stories_rls, new_stories_rls, 1)
    print("Updated NUKROP_SUPABASE_ADDITIONS.sql community_stories RLS.")

with open('supabase/NUKROP_SUPABASE_ADDITIONS.sql', 'w', encoding='utf-8') as f:
    f.write(add_sql)

print("Successfully updated all SQL files with hardened security and migration safeguards!")
