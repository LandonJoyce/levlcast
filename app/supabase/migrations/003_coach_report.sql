-- Add coach_report column to vods
ALTER TABLE vods ADD COLUMN IF NOT EXISTS coach_report JSONB;

-- Follower snapshots for growth attribution
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitch', 'tiktok', 'youtube', 'instagram')),
  follower_count INT NOT NULL,
  snapped_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_platform ON follower_snapshots(user_id, platform, snapped_at DESC);

ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots"
  ON follower_snapshots FOR ALL USING (auth.uid() = user_id);
