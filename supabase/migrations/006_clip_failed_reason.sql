-- Add failed_reason to clips so failures are visible in the UI and logs
ALTER TABLE clips ADD COLUMN IF NOT EXISTS failed_reason TEXT;
