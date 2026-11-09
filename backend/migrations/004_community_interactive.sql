-- ============================================================================
-- 004_community_interactive.sql
-- NuKropAI Enterprise AgriTech: Interactive Kisan Community
-- Adds user_id to community_posts, post_likes, user_follows, count triggers, and RLS
-- ============================================================================

-- 1. Ensure community_posts has user_id and proper columns
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

-- Add user_id column if table already existed without it
ALTER TABLE public.community_posts 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Index on community_posts(user_id) for author post lookups
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id 
ON public.community_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_community_posts_crop_id 
ON public.community_posts(crop_id);

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at 
ON public.community_posts(created_at DESC);

-- 2. Create post_likes Table
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

-- 3. Create user_follows Table
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

-- 4. Automated Counter Trigger: post_likes -> community_posts.likes_count
CREATE OR REPLACE FUNCTION public.fn_sync_post_likes_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_likes_count();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for Mobile/Web Client Access
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
