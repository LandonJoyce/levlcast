-- ============================================================
-- 013 — Content Performance Reports
-- Weekly computed reports showing which content categories
-- drive the most growth and engagement.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Array of { category, vod_count, avg_score, total_peaks, follower_delta, avg_duration_min }
  category_breakdown JSONB NOT NULL DEFAULT '[]',

  top_category TEXT,           -- best-performing category this period
  insight TEXT,                -- Claude-generated insight
  recommendation TEXT,         -- Claude-generated recommendation
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, period_start)
);

CREATE INDEX idx_content_reports_user ON content_reports(user_id);
CREATE INDEX idx_content_reports_period ON content_reports(user_id, period_start DESC);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content reports"
  ON content_reports FOR SELECT USING (auth.uid() = user_id);
