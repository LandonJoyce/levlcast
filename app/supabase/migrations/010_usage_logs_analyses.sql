-- ============================================================
-- LevlCast — Track analyses in usage_logs
-- Makes the monthly analysis limit tamper-proof.
-- Counting from usage_logs instead of vods means deleting or
-- re-syncing a VOD cannot reset the user's analysis count.
-- Only the service role (admin client in Inngest) can increment.
-- ============================================================

ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS analyses_count INT DEFAULT 0;
