-- Add failed_reason to vods so users can see why analysis failed
ALTER TABLE vods ADD COLUMN IF NOT EXISTS failed_reason TEXT;
