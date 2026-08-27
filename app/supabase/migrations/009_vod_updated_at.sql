-- ============================================================
-- LevlCast — Add updated_at to vods table
-- Enables stuck-VOD cleanup cron to detect analysis that started
-- but never finished (uses updated_at instead of created_at).
-- ============================================================

ALTER TABLE vods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows
UPDATE vods SET updated_at = created_at WHERE updated_at IS NULL;

-- Auto-update trigger so every status change updates updated_at
CREATE OR REPLACE FUNCTION update_vods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vods_updated_at_trigger ON vods;
CREATE TRIGGER vods_updated_at_trigger
  BEFORE UPDATE ON vods
  FOR EACH ROW EXECUTE FUNCTION update_vods_updated_at();
