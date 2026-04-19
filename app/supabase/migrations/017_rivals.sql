-- Rivals: each user can challenge one other LevlCast user
-- The rival is looked up by Twitch login (display name search)
CREATE TABLE IF NOT EXISTS rivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rival_twitch_login TEXT NOT NULL,
  rival_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenger_id)
);

ALTER TABLE rivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rival"
  ON rivals FOR ALL
  USING (auth.uid() = challenger_id)
  WITH CHECK (auth.uid() = challenger_id);
