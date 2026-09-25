-- 031_leagues.sql
--
-- Weekly leagues, and a lock on the ladder.
--
-- LEAGUES. Every Monday the streamers who analysed something in the last
-- four weeks are sorted by rank and cut into groups of about eight. The
-- week is a race on rank points gained: every analysed stream counts, and
-- whoever sits one place above you is your rival. On the following Monday
-- the top three of each group are paid 20 / 10 / 5 rank points. See
-- lib/league.ts for the rules and the reasoning behind them.
--
-- Someone who analyses mid-week without a group is added to the nearest
-- one on the spot, so a streamer never has to wait for Monday to play.
--
-- Standings are tallied here, at analysis time, rather than recomputed
-- from vods. vods rows are deletable by their owner, and a race you can
-- win by deleting your worst stream is not a race.
--
-- Both tables are server-only. RLS is on with no policies, so the client
-- can neither read nor write them; pages read them through the admin
-- client and select only public fields, the same pattern the public
-- leaderboard uses.

CREATE TABLE IF NOT EXISTS leagues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Monday (UTC) the league runs from. It ends the following Monday.
  week_start  DATE NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set once final places are written and bonuses paid.
  settled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS leagues_week_idx ON leagues (week_start);

CREATE TABLE IF NOT EXISTS league_members (
  league_id           UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Copied from the league so one-group-per-week can be a constraint
  -- rather than a hope.
  week_start          DATE NOT NULL,
  -- Rating when they joined. Used to place mid-week joiners in the group
  -- nearest their rank.
  rank_points_at_join INTEGER NOT NULL DEFAULT 0,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Running tally for the week, bumped by league_record_stream().
  points_gained       INTEGER NOT NULL DEFAULT 0,
  streams_played      INTEGER NOT NULL DEFAULT 0,
  -- Written once, at settlement.
  final_position      INTEGER,
  bonus_points        INTEGER,
  rank_points_after   INTEGER,
  PRIMARY KEY (league_id, user_id),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS league_members_user_idx ON league_members (user_id, week_start);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- In by default, out on request. League-mates see a streamer's Twitch
-- name, avatar, emblem and weekly points; never their coach score.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS league_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.league_opt_out IS
  'True when the streamer asked not to be placed in weekly leagues.';

-- Add one analysed stream to a member's weekly tally. Atomic, so two
-- analyses finishing together cannot lose each other's points.
CREATE OR REPLACE FUNCTION league_record_stream(p_user_id UUID, p_week_start DATE, p_delta INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE league_members
     SET points_gained  = points_gained + p_delta,
         streams_played = streams_played + 1
   WHERE user_id = p_user_id
     AND week_start = p_week_start
     AND final_position IS NULL;
$$;

REVOKE ALL ON FUNCTION league_record_stream(UUID, DATE, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION league_record_stream(UUID, DATE, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION league_record_stream(UUID, DATE, INT) TO service_role;

-- Write one member's final place and pay their bonus, in one transaction.
--
-- The row is claimed first (final_position IS NULL), so a settlement that
-- is retried after a partial failure skips everyone already paid instead
-- of paying them twice. The bonus is an increment, not a read-then-write,
-- so it cannot overwrite a rank change landing at the same moment.
-- Returns the rating after the bonus, or NULL if already settled.
CREATE OR REPLACE FUNCTION settle_league_member(
  p_league_id UUID,
  p_user_id   UUID,
  p_position  INT,
  p_bonus     INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_after INT;
BEGIN
  UPDATE league_members
     SET final_position = p_position,
         bonus_points   = p_bonus
   WHERE league_id = p_league_id
     AND user_id = p_user_id
     AND final_position IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_bonus > 0 THEN
    UPDATE profiles
       SET rank_points = LEAST(4000, GREATEST(0, COALESCE(rank_points, 0) + p_bonus))
     WHERE id = p_user_id
    RETURNING rank_points INTO v_after;
  ELSE
    SELECT rank_points INTO v_after FROM profiles WHERE id = p_user_id;
  END IF;

  UPDATE league_members
     SET rank_points_after = v_after
   WHERE league_id = p_league_id
     AND user_id = p_user_id;

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION settle_league_member(UUID, UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION settle_league_member(UUID, UUID, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION settle_league_member(UUID, UUID, INT, INT) TO service_role;

-- ── Lock the ladder ──────────────────────────────────────────────────────
--
-- "Users update own profile" and "Users manage own vods" allow any column
-- on your own row, and 018 only fenced off the subscription columns. That
-- left rank writable from the browser console:
--
--   supabase.from('profiles').update({ rank_points: 4000 })
--
-- is Grandmaster and the top of the public leaderboard, and editing
-- coach_report scores or rank_delta on your own vods rewrites your match
-- history. With leagues paying out, that stops being cosmetic. Same shape
-- as 018: authenticated end users are refused, the service role (every
-- server path that legitimately moves rank) is not.

CREATE OR REPLACE FUNCTION protect_profile_rank_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.rank_points IS DISTINCT FROM OLD.rank_points
       OR NEW.rank_last_was_loss IS DISTINCT FROM OLD.rank_last_was_loss THEN
      RAISE EXCEPTION 'Rank can only be changed by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_rank_columns_trigger ON profiles;
CREATE TRIGGER protect_profile_rank_columns_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_rank_columns();

CREATE OR REPLACE FUNCTION protect_vod_rank_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.rank_delta IS NOT NULL
         OR NEW.rank_points_after IS NOT NULL
         OR NEW.rank_tier_change IS NOT NULL
         OR NEW.coach_report IS NOT NULL THEN
        RAISE EXCEPTION 'Reports and rank can only be written by the server';
      END IF;
    ELSIF NEW.rank_delta IS DISTINCT FROM OLD.rank_delta
       OR NEW.rank_points_after IS DISTINCT FROM OLD.rank_points_after
       OR NEW.rank_tier_change IS DISTINCT FROM OLD.rank_tier_change
       OR NEW.coach_report IS DISTINCT FROM OLD.coach_report THEN
      RAISE EXCEPTION 'Reports and rank can only be written by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_vod_rank_columns_trigger ON vods;
CREATE TRIGGER protect_vod_rank_columns_trigger
  BEFORE INSERT OR UPDATE ON vods
  FOR EACH ROW EXECUTE FUNCTION protect_vod_rank_columns();
