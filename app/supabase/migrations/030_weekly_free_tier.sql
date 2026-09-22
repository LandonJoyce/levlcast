-- 030_weekly_free_tier.sql
--
-- Free tier moves from "2 analyses, ever" to a weekly allowance.
--
-- WHY. The product's hook is cross-stream: report N sets one priority and
-- report N+1 grades whether it got fixed. A lifetime cap of 2 meant a free
-- user reached that payoff exactly once and was then locked out forever, so
-- no habit could form and rank — a ladder — was played for two games and
-- abandoned. Conversion after the cap was tightened from 3 to 2 on
-- 2026-06-05 ran roughly a third of what it had been before.
--
-- An analysis costs about $0.53 (2.1h median VOD at ~$0.25/h blended), and
-- the whole product ran 13 analyses in the last 30 days. The scarcity was
-- never protecting much.
--
-- WHAT CHANGES. Lifetime counters stay exactly as they are, still keyed by
-- twitch_id so they survive account deletion, and are now used for
-- reporting rather than enforcement. Enforcement moves to the weekly
-- columns, which reset on the Monday boundary.
--
-- Existing free users who already burned their two lifetime analyses come
-- back unblocked on the next read, because week_start starts NULL and any
-- NULL week is treated as a fresh week.

ALTER TABLE trial_records
  ADD COLUMN IF NOT EXISTS week_start         DATE,
  ADD COLUMN IF NOT EXISTS analyses_this_week INT NOT NULL DEFAULT 0 CHECK (analyses_this_week >= 0),
  ADD COLUMN IF NOT EXISTS clips_this_week    INT NOT NULL DEFAULT 0 CHECK (clips_this_week >= 0);

COMMENT ON TABLE trial_records IS
  'Free-tier counters keyed by twitch_id (survives profile deletion). analyses_used/clips_used are lifetime totals kept for reporting; analyses_this_week/clips_this_week are what the limit actually enforces, reset each Monday.';

COMMENT ON COLUMN trial_records.week_start IS
  'Monday of the week the weekly counters belong to (UTC). NULL or any older date means the weekly counters are stale and read as zero.';

-- Same atomic upsert as before, now also rolling the weekly counters over.
--
-- The reset happens inside the same statement as the increment rather than
-- as a separate "if stale then zero" write. A read-then-reset would let two
-- concurrent analyses landing on a week boundary each see a stale week,
-- each reset to zero, and each write 1 — handing out a free extra analysis
-- every Monday.
--
-- date_trunc('week') is Monday-based in Postgres, which is what the
-- TypeScript side computes too. Both run in UTC.
CREATE OR REPLACE FUNCTION trial_record_increment(
  p_twitch_id TEXT,
  p_analyses  INT DEFAULT 0,
  p_clips     INT DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week DATE := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
BEGIN
  INSERT INTO trial_records (
    twitch_id, analyses_used, clips_used,
    analyses_this_week, clips_this_week, week_start,
    first_seen_at, last_used_at
  )
  VALUES (
    p_twitch_id, GREATEST(p_analyses, 0), GREATEST(p_clips, 0),
    GREATEST(p_analyses, 0), GREATEST(p_clips, 0), v_week,
    now(), now()
  )
  ON CONFLICT (twitch_id) DO UPDATE
    SET analyses_used = trial_records.analyses_used + GREATEST(p_analyses, 0),
        clips_used    = trial_records.clips_used    + GREATEST(p_clips, 0),
        analyses_this_week = CASE
          WHEN trial_records.week_start IS DISTINCT FROM v_week
            THEN GREATEST(p_analyses, 0)
          ELSE trial_records.analyses_this_week + GREATEST(p_analyses, 0)
        END,
        clips_this_week = CASE
          WHEN trial_records.week_start IS DISTINCT FROM v_week
            THEN GREATEST(p_clips, 0)
          ELSE trial_records.clips_this_week + GREATEST(p_clips, 0)
        END,
        week_start   = v_week,
        last_used_at = now();
END;
$$;

REVOKE ALL ON FUNCTION trial_record_increment(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trial_record_increment(TEXT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION trial_record_increment(TEXT, INT, INT) TO service_role;


-- ── Streak ───────────────────────────────────────────────────────────────
--
-- Consecutive weeks with at least one analysis. This is the return reason
-- the lifetime cap made impossible: you cannot keep a streak on an
-- allowance you already spent forever.
--
-- Stored as a count plus the week it was last credited, so the same week
-- cannot increment twice and a missed week is detectable on read without a
-- scheduled job. A streak is "alive" while streak_week is this week or last
-- week; anything older has lapsed and displays as zero.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_weeks INT NOT NULL DEFAULT 0 CHECK (streak_weeks >= 0),
  ADD COLUMN IF NOT EXISTS streak_week  DATE;

COMMENT ON COLUMN profiles.streak_weeks IS
  'Consecutive weeks with at least one completed analysis.';
COMMENT ON COLUMN profiles.streak_week IS
  'Monday (UTC) of the most recent week that counted toward the streak. If older than last week the streak has lapsed.';

-- Credit the current week toward a user's streak. Idempotent within a week:
-- calling it twice in the same week leaves the count unchanged, so it can be
-- called on every completed analysis without a guard at the call site.
CREATE OR REPLACE FUNCTION streak_touch(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week DATE := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_prev DATE;
  v_cur  INT;
  v_new  INT;
BEGIN
  SELECT streak_week, streak_weeks INTO v_prev, v_cur
  FROM profiles WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_new := CASE
    WHEN v_prev = v_week              THEN GREATEST(v_cur, 1)  -- already counted this week
    WHEN v_prev = v_week - 7          THEN v_cur + 1           -- continued from last week
    ELSE 1                                                     -- first week, or lapsed
  END;

  UPDATE profiles
     SET streak_weeks = v_new,
         streak_week  = v_week,
         updated_at   = now()
   WHERE id = p_user_id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION streak_touch(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION streak_touch(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION streak_touch(UUID) TO service_role;
