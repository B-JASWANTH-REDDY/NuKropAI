import sys
sys.stdout.reconfigure(encoding='utf-8')

# Read CANONICAL_PRODUCTION_SETUP.sql
with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Add community_stories table declaration after community_posts
stories_table = """
-- 21B. COMMUNITY STORIES (24-Hour Ephemeral Agricultural Story Engine)
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

ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS author_id text;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS author_name text DEFAULT 'Farmer';
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS author_village text DEFAULT 'Warangal, Telangana';
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS author_avatar text;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS tag text DEFAULT '🌱 Crop Progress';
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.community_stories ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + interval '24 hours');

CREATE INDEX IF NOT EXISTS idx_community_stories_expires ON public.community_stories(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_stories_created ON public.community_stories(created_at DESC);
"""

if 'public.community_stories' not in sql:
    target_pos = sql.find('-- 21. COMMUNITY POSTS (Kisan Forum)')
    assert target_pos != -1, "Could not find community_posts section!"
    next_section = sql.find('-- 22. COMMUNITY COMMENTS', target_pos)
    assert next_section != -1, "Could not find community_comments section!"
    sql = sql[:next_section] + stories_table + "\n" + sql[next_section:]
    print("Added community_stories table to CANONICAL_PRODUCTION_SETUP.sql")

# 2. Add community_stories RLS policies
stories_rls = """
-- Community Stories Policies
ALTER TABLE public.community_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_stories_read" ON public.community_stories;
DROP POLICY IF EXISTS "community_stories_insert" ON public.community_stories;
DROP POLICY IF EXISTS "community_stories_delete" ON public.community_stories;

CREATE POLICY "community_stories_read" ON public.community_stories
  FOR SELECT USING (expires_at > now() OR auth.uid()::text = user_id OR auth.uid()::text = author_id OR true);

CREATE POLICY "community_stories_insert" ON public.community_stories
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR auth.role() = 'anon'
  );

CREATE POLICY "community_stories_delete" ON public.community_stories
  FOR DELETE USING (auth.uid()::text = user_id OR auth.uid()::text = author_id OR auth.role() = 'anon');
"""

if 'community_stories_read' not in sql:
    target_rls = sql.find('-- Community Posts\n')
    assert target_rls != -1, "Could not find community_posts policies!"
    next_rls = sql.find('-- Community Comments\n', target_rls)
    assert next_rls != -1, "Could not find community_comments policies!"
    sql = sql[:next_rls] + stories_rls + "\n" + sql[next_rls:]
    print("Added community_stories RLS to CANONICAL_PRODUCTION_SETUP.sql")

# 3. Enhance Realtime Publication block with pg_publication_tables loop
old_realtime = """DO $$
DECLARE
  pub_exists boolean;
  tbl text;
  tables text[] := ARRAY[
    'driver_telemetry',
    'driver_locations',
    'haul_bookings',
    'truck_listings',
    'trip_waypoints',
    'community_posts',
    'community_comments',
    'post_likes',
    'user_follows',
    'machinery_messages',
    'chat_messages',
    'peer_messages'
  ];
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  IF NOT pub_exists THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, proceed
      END;
    END IF;
  END LOOP;
END $$;"""

new_realtime = """DO $$
DECLARE
  pub_exists boolean;
  tbl text;
  tables text[] := ARRAY[
    'driver_telemetry',
    'driver_locations',
    'haul_bookings',
    'truck_listings',
    'trip_waypoints',
    'community_posts',
    'community_comments',
    'community_stories',
    'post_likes',
    'user_follows',
    'machinery_messages',
    'chat_messages',
    'peer_messages',
    'outbreak_alerts',
    'price_alerts'
  ];
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  IF NOT pub_exists THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
      EXCEPTION WHEN OTHERS THEN 
        NULL;
      END;

      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION 
          WHEN duplicate_object THEN NULL;
          WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;"""

assert old_realtime in sql, "Could not find old_realtime in CANONICAL_PRODUCTION_SETUP.sql"
sql = sql.replace(old_realtime, new_realtime, 1)
print("Updated realtime publication block in CANONICAL_PRODUCTION_SETUP.sql")

with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

# Also create COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql
with open('supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("Created supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql!")
