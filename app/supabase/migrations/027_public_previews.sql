-- Public VOD previews (no account required)
--
-- Backs the /analyze flow: a visitor pastes any public Twitch VOD URL and
-- gets a real coach report on the first N minutes without signing in. This
-- is the top of the funnel, so it is deliberately kept OUT of the `vods`
-- table — a preview has no owner, must never count against anyone's plan
-- limits, and must never appear in a user's dashboard.
--
-- Rows are keyed by twitch_vod_id so the result is CACHED: the second
-- person to paste the same link pays nothing and gets an instant page.
-- That cache is also what makes the shareable link stable.
--
-- Cost control lives in the API route (per-IP and global daily caps), not
-- here. This table only records what was produced.
CREATE TABLE IF NOT EXISTS public_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Twitch's VOD id. Unique, because this row IS the cache entry.
  twitch_vod_id TEXT NOT NULL UNIQUE,

  -- Denormalised Twitch metadata so the result page renders without a
  -- second Helix call (and still renders if Twitch is down).
  title TEXT,
  streamer_login TEXT,
  streamer_display_name TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  game_category TEXT,

  -- How much of the VOD was actually analyzed. Stored rather than assumed
  -- so that changing the preview window later does not silently relabel
  -- every historical row.
  analyzed_seconds INTEGER NOT NULL,

  -- Same shapes the dashboard report already renders.
  coach_report JSONB,
  peak_data JSONB,

  -- pending | transcribing | analyzing | ready | failed
  status TEXT NOT NULL DEFAULT 'pending',
  failed_reason TEXT,

  -- Coarse abuse/attribution signal. Not shown anywhere in the UI.
  created_ip TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

-- The cache lookup and the "is it done yet" poll both hit this.
CREATE INDEX IF NOT EXISTS public_previews_twitch_vod_id_idx
  ON public_previews (twitch_vod_id);

-- Supports the global daily spend cap query in the API route.
CREATE INDEX IF NOT EXISTS public_previews_created_at_idx
  ON public_previews (created_at DESC);

-- Per-IP rate limiting survives serverless restarts by counting rows.
CREATE INDEX IF NOT EXISTS public_previews_ip_created_idx
  ON public_previews (created_ip, created_at DESC);

-- RLS on with NO policies: the anon key can read nothing directly. Every
-- read and write goes through the service-role admin client in our own
-- routes, which is what lets us serve previews publicly while keeping the
-- table itself closed to arbitrary client queries.
ALTER TABLE public_previews ENABLE ROW LEVEL SECURITY;
