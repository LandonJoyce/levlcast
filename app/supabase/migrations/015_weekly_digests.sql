-- ============================================================
-- 015 — Weekly Manager Digests
-- Monday summary that reads like a personal streaming manager.
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,

  -- Raw stats
  streams_count INT NOT NULL DEFAULT 0,
  total_duration_min INT NOT NULL DEFAULT 0,
  avg_score INT,
  best_score INT,
  peaks_found INT NOT NULL DEFAULT 0,
  clips_generated INT NOT NULL DEFAULT 0,
  follower_delta INT NOT NULL DEFAULT 0,

  -- Digest sections (Claude-generated)
  headline TEXT NOT NULL,           -- e.g. "Solid week — 4 streams, avg 76 score, +120 followers"
  health_summary TEXT,              -- burnout status one-liner
  content_summary TEXT,             -- content performance one-liner
  collab_summary TEXT,              -- collab update one-liner
  action_items JSONB DEFAULT '[]',  -- ["Focus on hype content", "Try a collab this week"]

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_digests_user ON weekly_digests(user_id);
CREATE INDEX idx_weekly_digests_week ON weekly_digests(user_id, week_start DESC);

ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digests"
  ON weekly_digests FOR SELECT USING (auth.uid() = user_id);
