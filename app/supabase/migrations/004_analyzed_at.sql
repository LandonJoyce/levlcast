-- Add analyzed_at timestamp to track when analysis actually ran (not when VOD was synced)
-- This prevents the bypass where old synced VODs could be analyzed without counting toward limits

ALTER TABLE vods ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Index for fast monthly count queries
CREATE INDEX IF NOT EXISTS vods_analyzed_at_user_idx ON vods (user_id, analyzed_at);
