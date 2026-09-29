-- 036: what decides what someone gets can only be written by the server.
--
-- The browser talks to the database with the user's own session, and the
-- policies from 001 let a signed-in user change anything on their own rows.
-- 018 and 031/032 closed that for plan, subscription, rank, reports and
-- sealed results. Still open until this migration:
--
--   profiles.twitch_id         the free weekly allowance is counted per
--                              Twitch id, so changing it handed out a fresh
--                              allowance every time: unlimited free reports
--   profiles.pro_plus          a $14.99 Pro account could give itself the
--   profiles.founding_member   $29.99 Pro Plus limits, or founding limits
--                              with no per-stream length cap
--   profiles.stripe_customer_id  pointing it at someone else's customer
--                              opened their billing portal
--   profiles.twitch_login / twitch_display_name / twitch_avatar_url
--                              anyone could appear on the leaderboard as
--                              another streamer
--   vods.duration_seconds / analyzed_at / status / twitch_vod_id
--                              shrinking a stream's length got past the
--                              length and hour caps; clearing dates reset
--                              the hours counted this month; inserting rows
--                              let anyone analyze any VOD under any length
--   clips (any column)         deleting clip rows reset Pro's monthly count
--
-- Every legitimate write to these already goes through the server with the
-- service role (sign-in, Stripe and RevenueCat webhooks, the Twitch sync,
-- the analysis pipeline), which none of this affects. The iPhone app only
-- reads streams and clips.
--
-- Run AFTER the deploy that moves the stream sync and the Analyze claim to
-- the service role, or those two break until it lands.

-- ── Profiles: server-owned columns ──────────────────────────────────────
-- Compared through to_jsonb so a column that doesn't exist on some
-- database reads as null on both sides instead of failing every update.
CREATE OR REPLACE FUNCTION protect_profile_server_columns()
RETURNS trigger AS $$
DECLARE
  col text;
  new_row jsonb;
  old_row jsonb;
BEGIN
  IF auth.role() = 'authenticated' THEN
    new_row := to_jsonb(NEW);
    old_row := to_jsonb(OLD);
    FOREACH col IN ARRAY ARRAY[
      'twitch_id', 'twitch_login', 'twitch_display_name', 'twitch_avatar_url',
      'founding_member', 'pro_plus',
      'stripe_customer_id', 'revenuecat_id', 'trial_discount_started_at',
      'coaching_arc', 'created_at'
    ] LOOP
      IF new_row -> col IS DISTINCT FROM old_row -> col THEN
        RAISE EXCEPTION 'Only the server can change %', col;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_server_columns_trigger ON profiles;
CREATE TRIGGER protect_profile_server_columns_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_server_columns();

-- ── Streams and clips: read-only from the browser ───────────────────────
DROP POLICY IF EXISTS "Users manage own vods" ON vods;
DROP POLICY IF EXISTS "Users read own vods" ON vods;
CREATE POLICY "Users read own vods"
  ON vods FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own clips" ON clips;
DROP POLICY IF EXISTS "Users read own clips" ON clips;
CREATE POLICY "Users read own clips"
  ON clips FOR SELECT USING (auth.uid() = user_id);

-- What's left. vods and clips should show only SELECT; a policy added by
-- hand in the dashboard that allows anything else would still let the
-- browser write, and needs dropping too.
SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('vods', 'clips', 'profiles')
 ORDER BY tablename, policyname;
