import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Locate the early public_profiles view definition
early_view_block = """-- 1b. PUBLIC PROFILES SECURE VIEW (Exposes non-sensitive public identity for community & hauler cards)
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
"""

assert early_view_block in sql, "Could not find early_view_block in SQL!"
sql = sql.replace(early_view_block, "", 1)
print("Removed early public_profiles view definition.")

# 2. Locate Step 4 block
step4_old = """-- ─────────────────────────────────────────────────────────────────
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
END $$;"""

step4_new = """-- ─────────────────────────────────────────────────────────────────
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
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 4B: PUBLIC PROFILES SECURE VIEW (DPDP Act 2023 Identity Shield)
-- ─────────────────────────────────────────────────────────────────
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
"""

assert step4_old in sql, "Could not find step4_old in SQL!"
sql = sql.replace(step4_old, step4_new, 1)
print("Replaced step 4 with hardened idempotent type-casting and step 4B view.")

with open('supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("Saved updated supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql and CANONICAL_PRODUCTION_SETUP.sql successfully!")
