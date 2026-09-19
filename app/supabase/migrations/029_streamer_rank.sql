-- Streamer rank
--
-- Replaces the raw 0-100 score as the headline number. The score still
-- exists and still drives everything; rank is what the user sees and
-- climbs. See lib/rank.ts for the model and the reasoning.

-- Current rating. NULL means never placed, which is what makes the first
-- analysed stream a placement rather than a climb.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rank_points INTEGER;

-- Whether the previous analysed stream lost points. Gates the demotion
-- shield: dropping a tier takes two bad streams in a row, never one.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rank_last_was_loss BOOLEAN NOT NULL DEFAULT FALSE;

-- Per-stream record of what this VOD did to the ladder, so a report can
-- show "+31, Silver III" instead of recomputing from history, and so the
-- rank-up moment can be replayed when someone re-opens an old report.
ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS rank_delta INTEGER;
ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS rank_points_after INTEGER;
-- 'up' | 'down' | NULL. Set only when the TIER changed, which is the
-- promotion moment worth celebrating.
ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS rank_tier_change TEXT;
