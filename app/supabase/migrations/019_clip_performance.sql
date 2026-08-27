-- Migration 019: Clip performance tracking
-- Lets users log how a clip performed after sharing it.
-- views_count and follows_gained are manually entered by the user.

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS views_count INT,
  ADD COLUMN IF NOT EXISTS follows_gained INT,
  ADD COLUMN IF NOT EXISTS performance_note TEXT;
