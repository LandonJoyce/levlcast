-- 013_highlight_reel_flag.sql
--
-- Splits the "this is a highlight reel" marker out of caption_style so users
-- can pick any visual caption style for their reels. Before this, caption_style
-- did double duty: it was both the visual style for the burn AND the marker
-- that distinguished reels from regular clips, which meant we couldn't expose
-- the caption style dropdown to reel users without losing the reel identity.
--
-- After this migration:
--   - is_highlight_reel : true if the clip is a stitched reel
--   - caption_style     : always a visual style (bold/boxed/minimal/...) — never "reel"

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS is_highlight_reel BOOLEAN NOT NULL DEFAULT false;

-- Backfill: anything that has caption_style='reel' was a highlight reel under
-- the old scheme. Flip the flag and reset its visual style to 'bold' (the
-- default the reel pipeline always burned with anyway).
UPDATE clips
   SET is_highlight_reel = true,
       caption_style     = 'bold'
 WHERE caption_style = 'reel';

CREATE INDEX IF NOT EXISTS idx_clips_highlight_reel
  ON clips(user_id, is_highlight_reel)
  WHERE is_highlight_reel = true;

COMMENT ON COLUMN clips.is_highlight_reel IS
  'True for multi-cut highlight reels stitched from several stream moments. Distinguishes reels from regular single-moment clips at the data layer so caption_style can stay a pure visual style.';
