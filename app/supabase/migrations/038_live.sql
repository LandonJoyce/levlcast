-- 038: Live. A private page a streamer docks inside OBS while they stream:
-- their viewers, chat and coaching cues as it happens, and a summary after.
--
-- Nothing here runs in the background. The dock asks the server for the
-- streamer's live numbers about once a minute while it's open, and those
-- answers are what get saved. A streamer who never opens the dock costs
-- nothing and gets no rows.
--
-- Every write goes through the server with the service role, so the only
-- policies are reads of your own rows.

-- ── Each streamer's private dock link ──────────────────────────────────
-- OBS can't sign in, so the dock is opened by a secret link instead. The
-- token is the only key it has: it shows that streamer's live numbers and
-- nothing else, and a new link can be made at any time to retire the old
-- one. Kept out of profiles so no profile read can ever expose it.
CREATE TABLE IF NOT EXISTS public.live_docks (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── One row per Twitch stream the dock saw ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  twitch_stream_id text NOT NULL,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  title            text,
  game_name        text,
  peak_viewers     integer NOT NULL DEFAULT 0,
  viewer_sum       bigint  NOT NULL DEFAULT 0,
  sample_count     integer NOT NULL DEFAULT 0,
  followers_start  integer,
  followers_end    integer,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, twitch_stream_id)
);
CREATE INDEX IF NOT EXISTS live_sessions_user_started ON public.live_sessions (user_id, started_at DESC);

-- ── Viewers, one row per minute of the stream ──────────────────────────
-- minute = whole minutes since the stream started, so a sample lines up
-- with the same minute of the VOD and its report.
CREATE TABLE IF NOT EXISTS public.live_samples (
  session_id  uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  minute      integer NOT NULL,
  viewers     integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, minute)
);

ALTER TABLE public.live_docks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_samples  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own dock" ON public.live_docks;
CREATE POLICY "read own dock" ON public.live_docks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own live sessions" ON public.live_sessions;
CREATE POLICY "read own live sessions" ON public.live_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own live samples" ON public.live_samples;
CREATE POLICY "read own live samples" ON public.live_samples
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
