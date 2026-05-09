-- 011_clip_edits.sql
--
-- Adds the columns needed for the in-app clip editor:
--   - edited_captions    : user-edited caption cards (override the auto-generated ones)
--   - candidate_frames   : cached thumbnail candidate URLs for the hook-frame picker
--
-- Both are JSONB arrays. NULL means "not edited / not extracted yet" — the
-- export pipeline falls back to auto-generated captions and the existing
-- thumbnail_url respectively.

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS edited_captions JSONB,
  ADD COLUMN IF NOT EXISTS candidate_frames JSONB;

COMMENT ON COLUMN clips.edited_captions IS
  'User-edited caption cards (array of {start,end,text}). When present, overrides auto-generated word-synced captions on re-export.';

COMMENT ON COLUMN clips.candidate_frames IS
  'Cached array of R2 URLs for hook-frame thumbnail candidates. Populated lazily when the editor first extracts frames.';
