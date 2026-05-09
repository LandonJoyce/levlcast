-- 012_reel_segments.sql
--
-- Adds reel_segments JSONB to clips so the editor can render correct captions
-- for highlight reels.
--
-- A reel stitches N non-contiguous VOD windows into one short. Without
-- per-segment metadata, the editor has no way to know which VOD seconds the
-- reel is actually showing at any given playback position, so it can't slice
-- the right words for captioning.
--
-- Each entry: { vodStart, vodEnd, reelStart, reelEnd }
--   vodStart/vodEnd : original VOD seconds for this segment
--   reelStart/reelEnd : reel-local seconds (0 = first frame of reel)

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS reel_segments JSONB;

COMMENT ON COLUMN clips.reel_segments IS
  'For caption_style=reel: array of {vodStart, vodEnd, reelStart, reelEnd} per stitched segment. Used by the editor to remap VOD word timestamps to reel-local time.';
