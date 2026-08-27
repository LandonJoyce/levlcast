-- 012: Burnout detection — weekly health snapshots per user
CREATE TABLE IF NOT EXISTS burnout_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  score_decline FLOAT,
  energy_decline FLOAT,
  session_shortening FLOAT,
  frequency_drop FLOAT,
  retention_risk FLOAT,
  growth_stall FLOAT,
  insight TEXT,
  recommendation TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_burnout_user ON burnout_snapshots(user_id);
CREATE INDEX idx_burnout_computed ON burnout_snapshots(user_id, computed_at DESC);

ALTER TABLE burnout_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own burnout snapshots"
  ON burnout_snapshots FOR SELECT
  USING (auth.uid() = user_id);
