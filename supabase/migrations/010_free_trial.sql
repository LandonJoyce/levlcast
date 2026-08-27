-- 010_free_trial.sql
--
-- Replaces the monthly free tier with a one-time bypass-proof trial:
--   3 analyses + 5 clips lifetime, tracked per Twitch ID.
--
-- WHY twitch_id (not profile.id / auth.users.id):
--   Profiles cascade-delete with auth.users. Tracking trial usage on the
--   profile means deleting an account and re-signing in resets the trial.
--   twitch_id is immutable per Twitch account, so we key the trial table
--   on it. When a profile is deleted and the same person re-signs up
--   with the same Twitch login, the trial counters survive and they
--   pick up where they left off.
--
-- RLS: enabled with NO client-side policies. Only the service role
-- (admin client used in API routes / Inngest) can read or write this
-- table. Users have no direct access — the counters can't be tampered
-- with from the browser even if RLS were misconfigured downstream.

CREATE TABLE IF NOT EXISTS trial_records (
  twitch_id        TEXT PRIMARY KEY,
  analyses_used    INT NOT NULL DEFAULT 0 CHECK (analyses_used >= 0),
  clips_used       INT NOT NULL DEFAULT 0 CHECK (clips_used >= 0),
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trial_records ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies — only service role bypasses RLS.
-- If a future feature needs to expose trial usage to the user, expose
-- it via a SECURITY DEFINER function or read it server-side and pass
-- to the client; do not add a SELECT policy here.

COMMENT ON TABLE trial_records IS
  'Lifetime free-trial counters keyed by twitch_id (survives profile deletion). 3 analyses + 5 clips per Twitch user, ever.';

-- Atomic increment so concurrent clip/analyze success handlers can't lose
-- updates with a read-modify-write race. SECURITY DEFINER runs with the
-- function owner's privileges (postgres) so it can write through RLS even
-- though the calling role can't. The function does the upsert + increment
-- in one statement using ON CONFLICT.
CREATE OR REPLACE FUNCTION trial_record_increment(
  p_twitch_id TEXT,
  p_analyses  INT DEFAULT 0,
  p_clips     INT DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO trial_records (twitch_id, analyses_used, clips_used, first_seen_at, last_used_at)
  VALUES (p_twitch_id, GREATEST(p_analyses, 0), GREATEST(p_clips, 0), now(), now())
  ON CONFLICT (twitch_id) DO UPDATE
    SET analyses_used = trial_records.analyses_used + GREATEST(p_analyses, 0),
        clips_used    = trial_records.clips_used    + GREATEST(p_clips, 0),
        last_used_at  = now();
END;
$$;

-- Service role calls this; revoke from anon/authenticated to defence-in-depth.
REVOKE ALL ON FUNCTION trial_record_increment(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trial_record_increment(TEXT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION trial_record_increment(TEXT, INT, INT) TO service_role;
