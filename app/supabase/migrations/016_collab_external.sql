-- ============================================================
-- 016 — Collab Matching: Support external Twitch streamers
-- Drops FK on match_user_id so we can store non-LevlCast users.
-- Adds external streamer fields (twitch_id, login, display_name, etc.)
-- ============================================================

-- Drop the FK constraint so match_user_id can be null for external matches
ALTER TABLE collab_suggestions DROP CONSTRAINT IF EXISTS collab_suggestions_match_user_id_fkey;

-- Make match_user_id nullable (null = external Twitch streamer)
ALTER TABLE collab_suggestions ALTER COLUMN match_user_id DROP NOT NULL;

-- Add external streamer fields
ALTER TABLE collab_suggestions
  ADD COLUMN IF NOT EXISTS twitch_id TEXT,
  ADD COLUMN IF NOT EXISTS twitch_login TEXT,
  ADD COLUMN IF NOT EXISTS twitch_display_name TEXT,
  ADD COLUMN IF NOT EXISTS twitch_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS follower_count INT,
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;

-- Update unique constraint to handle external matches
-- Drop old unique and create a new one that includes twitch_id
ALTER TABLE collab_suggestions DROP CONSTRAINT IF EXISTS collab_suggestions_user_id_match_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_unique_match
  ON collab_suggestions(user_id, COALESCE(match_user_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(twitch_id, ''));
