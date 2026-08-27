-- ============================================================
-- LevlCast — VOD share tokens
-- Allows users to share a public read-only report card link.
-- Token is a random UUID set on demand, null = not shared.
-- ============================================================

ALTER TABLE vods ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT NULL;
