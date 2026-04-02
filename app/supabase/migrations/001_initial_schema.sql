-- ============================================================
-- LevlCast — Initial Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- ── Profiles (extends Supabase Auth) ──
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  twitch_id TEXT UNIQUE NOT NULL,
  twitch_login TEXT NOT NULL,
  twitch_display_name TEXT,
  twitch_avatar_url TEXT,
  twitch_access_token TEXT,
  twitch_refresh_token TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  revenuecat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Usage tracking (per-month processing limits) ──
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                    -- '2026-03' format
  transcribed_minutes FLOAT DEFAULT 0,   -- total Deepgram minutes used
  clips_generated INT DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  UNIQUE(user_id, month)
);

-- ── VODs from Twitch ──
CREATE TABLE vods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  twitch_vod_id TEXT UNIQUE NOT NULL,
  title TEXT,
  duration_seconds INT,
  thumbnail_url TEXT,
  stream_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'transcribing', 'analyzing', 'ready', 'failed')),
  transcription_url TEXT,                 -- Supabase Storage path
  peak_data JSONB,                        -- AI-detected peak moments
  estimated_cost FLOAT,                   -- show user before processing
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vods_user ON vods(user_id);
CREATE INDEX idx_vods_status ON vods(status);

-- ── Generated clips ──
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vod_id UUID REFERENCES vods(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time_seconds INT NOT NULL,
  end_time_seconds INT NOT NULL,
  duration_seconds INT GENERATED ALWAYS AS (end_time_seconds - start_time_seconds) STORED,
  video_url TEXT,                          -- Supabase Storage path
  thumbnail_url TEXT,
  caption_text TEXT,                       -- AI-generated caption
  peak_score FLOAT,                        -- 0.0 to 1.0
  peak_category TEXT,                      -- clutch_play | funny | hype | educational | rage | wholesome
  peak_reason TEXT,                        -- human-readable explanation
  status TEXT DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clips_user ON clips(user_id);
CREATE INDEX idx_clips_vod ON clips(vod_id);

-- ── Social media posts ──
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  platform_post_id TEXT,
  platform_url TEXT,
  caption TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'posted', 'failed')),
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_posts_clip ON posts(clip_id);

-- ── Post analytics (fetched periodically) ──
CREATE TABLE post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- ── Stream analytics (Twitch data, correlated with clips) ──
CREATE TABLE stream_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stream_date TIMESTAMPTZ,
  avg_viewers INT,
  peak_viewers INT,
  new_followers INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Subscriptions (synced from RevenueCat webhooks) ──
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  revenuecat_id TEXT,
  product_id TEXT,                         -- rc product identifier
  plan TEXT CHECK (plan IN ('free', 'starter', 'pro')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'billing_issue')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- ── Background jobs (optional visibility into pipeline) ──
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('transcribe', 'analyze', 'clip', 'post')),
  reference_id UUID,
  status TEXT DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_user ON jobs(user_id);

-- ============================================================
-- Row Level Security — users can only access their own data
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vods ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Usage logs
CREATE POLICY "Users read own usage"
  ON usage_logs FOR SELECT USING (auth.uid() = user_id);

-- VODs
CREATE POLICY "Users manage own vods"
  ON vods FOR ALL USING (auth.uid() = user_id);

-- Clips
CREATE POLICY "Users manage own clips"
  ON clips FOR ALL USING (auth.uid() = user_id);

-- Posts
CREATE POLICY "Users manage own posts"
  ON posts FOR ALL USING (auth.uid() = user_id);

-- Post analytics (read via join on posts)
CREATE POLICY "Users read own post analytics"
  ON post_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts WHERE posts.id = post_analytics.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Stream analytics
CREATE POLICY "Users manage own stream analytics"
  ON stream_analytics FOR ALL USING (auth.uid() = user_id);

-- Subscriptions
CREATE POLICY "Users read own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Jobs
CREATE POLICY "Users read own jobs"
  ON jobs FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- Storage buckets (create in Supabase Dashboard → Storage)
-- ============================================================
-- Bucket: "clips" (public, max 100MB per file)
-- Bucket: "transcriptions" (private, max 50MB per file)
