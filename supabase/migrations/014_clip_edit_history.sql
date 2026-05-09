-- 014_clip_edit_history.sql
--
-- Lets a user revert a clip to the version it was at before they started
-- editing, so the editor isn't a one-way ratchet.
--
-- We don't keep a full history (per-edit row) because R2 already stores
-- every version's mp4 forever (cleanup cron runs separately) and 99% of
-- the value is "go back to the auto-generated version" not "step back one
-- edit at a time". Two snapshots:
--
--   original_*       — the very first auto-generated version. Set once at
--                      first edit, never overwritten. This is the safety
--                      net the streamer reverts to when they overedit.
--   edited_at        — timestamp of the last edit, drives "Revert to
--                      original" button visibility.
--
-- Existing edited_captions / candidate_frames stay where they are.

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS original_video_url        TEXT,
  ADD COLUMN IF NOT EXISTS original_source_video_url TEXT,
  ADD COLUMN IF NOT EXISTS original_start_time_seconds INT,
  ADD COLUMN IF NOT EXISTS original_end_time_seconds   INT,
  ADD COLUMN IF NOT EXISTS original_caption_style    TEXT,
  ADD COLUMN IF NOT EXISTS edited_at                 TIMESTAMPTZ;

COMMENT ON COLUMN clips.original_video_url IS
  'Snapshot of video_url before first edit. Used by Revert to restore the auto-generated cut.';
COMMENT ON COLUMN clips.original_source_video_url IS
  'Snapshot of source_video_url (clean) before first edit.';
COMMENT ON COLUMN clips.edited_at IS
  'Timestamp of the most recent edit. NULL means the clip is still the auto-generated original.';
