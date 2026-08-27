-- ============================================================
-- 014 — Collab Matching
-- Opt-in system for streamer-to-streamer collab suggestions.
-- ============================================================

-- Users opt-in to be discoverable for collabs
CREATE TABLE IF NOT EXISTS collab_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  tagline TEXT,                                -- short "looking for..." line
  preferred_categories TEXT[] DEFAULT '{}',     -- content types they want to collab on
  min_followers INT DEFAULT 0,                 -- minimum partner follower count
  max_followers INT,                           -- maximum partner follower count (null = no limit)
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE collab_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collab profile"
  ON collab_profiles FOR ALL USING (auth.uid() = user_id);

-- Weekly computed suggestions
CREATE TABLE IF NOT EXISTS collab_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_score INT NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  reasons JSONB NOT NULL DEFAULT '[]',         -- ["Similar audience size", "Both create hype content"]
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'dismissed', 'contacted')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_user_id)
);

CREATE INDEX idx_collab_suggestions_user ON collab_suggestions(user_id);
CREATE INDEX idx_collab_suggestions_status ON collab_suggestions(user_id, status);

ALTER TABLE collab_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own collab suggestions"
  ON collab_suggestions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own collab suggestions"
  ON collab_suggestions FOR UPDATE USING (auth.uid() = user_id);
