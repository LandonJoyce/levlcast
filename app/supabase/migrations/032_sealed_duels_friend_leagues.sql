-- 032_sealed_duels_friend_leagues.sql
--
-- Three things that make a report worth coming back for.
--
-- SEALED RESULTS. A finished report arrives sealed. The streamer calls it
-- (win or loss) and then opens it, and the result plays out. The call is
-- kept, so match history can say "Called it". Everything already analyzed
-- counts as opened, so nobody's history turns into a wall of sealed rows.
--
-- SEALED EXTRA STREAM. A free streamer who has used both weekly reports
-- can still analyze one more stream that week. It comes back sealed and
-- stays locked until Monday's reset, or until they go Pro. The week it
-- was analyzed in is stored so the lock can be checked.
--
-- DUELS AND FRIEND LEAGUES. A duel is a one-week 1v1 started from an
-- invite link: whoever gains more rank points in the seven days wins. A
-- friend league is a private group, also joined by link, with a weekly
-- table of points gained. Neither pays rank points; they are bragging
-- rights. Like leagues, the tables are server-only: RLS on, no policies.

-- ── Sealed results ───────────────────────────────────────────────────────

ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS result_opened_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS result_call       TEXT CHECK (result_call IN ('win', 'loss')),
  ADD COLUMN IF NOT EXISTS sealed_extra_week DATE;

COMMENT ON COLUMN vods.result_opened_at IS
  'When the streamer opened this report. NULL means the result is still sealed.';
COMMENT ON COLUMN vods.result_call IS
  'The streamer''s call (win or loss) made before opening the result.';
COMMENT ON COLUMN vods.sealed_extra_week IS
  'Set when a free streamer analyzed this as their sealed extra stream: the Monday of that week. Locked until the week ends or they go Pro.';

-- Everything analyzed before this existed is already opened.
UPDATE vods
   SET result_opened_at = COALESCE(analyzed_at, now())
 WHERE status = 'ready'
   AND result_opened_at IS NULL;

CREATE INDEX IF NOT EXISTS vods_sealed_extra_idx ON vods (user_id, sealed_extra_week)
  WHERE sealed_extra_week IS NOT NULL;

-- The browser can read its own vods but must not open, call or unlock them
-- directly: opening goes through the server, which checks the lock. Same
-- trigger as 031, with the new columns added.
CREATE OR REPLACE FUNCTION protect_vod_rank_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.rank_delta IS NOT NULL
         OR NEW.rank_points_after IS NOT NULL
         OR NEW.rank_tier_change IS NOT NULL
         OR NEW.coach_report IS NOT NULL
         OR NEW.result_opened_at IS NOT NULL
         OR NEW.result_call IS NOT NULL
         OR NEW.sealed_extra_week IS NOT NULL THEN
        RAISE EXCEPTION 'Reports and rank can only be written by the server';
      END IF;
    ELSIF NEW.rank_delta IS DISTINCT FROM OLD.rank_delta
       OR NEW.rank_points_after IS DISTINCT FROM OLD.rank_points_after
       OR NEW.rank_tier_change IS DISTINCT FROM OLD.rank_tier_change
       OR NEW.coach_report IS DISTINCT FROM OLD.coach_report
       OR NEW.result_opened_at IS DISTINCT FROM OLD.result_opened_at
       OR NEW.result_call IS DISTINCT FROM OLD.result_call
       OR NEW.sealed_extra_week IS DISTINCT FROM OLD.sealed_extra_week THEN
      RAISE EXCEPTION 'Reports and rank can only be written by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Duels ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS duels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The code in the invite link, levlcast.com/duel/<code>.
  code              TEXT NOT NULL UNIQUE,
  challenger_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Set when someone accepts the link.
  opponent_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- open: link waiting for someone. active: running. finished: scored.
  -- cancelled: the challenger withdrew the link.
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'active', 'finished', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  -- Written when the duel is scored: rank points each side gained in the
  -- seven days, placements excluded. NULL winner on a draw.
  challenger_points INTEGER,
  opponent_points   INTEGER,
  winner_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CHECK (opponent_id IS NULL OR opponent_id <> challenger_id)
);

CREATE INDEX IF NOT EXISTS duels_challenger_idx ON duels (challenger_id, status);
CREATE INDEX IF NOT EXISTS duels_opponent_idx ON duels (opponent_id, status);

ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

-- ── Friend leagues ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friend_leagues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The code in the invite link, levlcast.com/join/<code>.
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friend_league_members (
  league_id  UUID NOT NULL REFERENCES friend_leagues(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS friend_league_members_user_idx ON friend_league_members (user_id);

ALTER TABLE friend_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_league_members ENABLE ROW LEVEL SECURITY;
