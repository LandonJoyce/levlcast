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
  -- When the OBS panel last checked in. A phone in voice mode uses it to
  -- tell whether to speak the panel's nudges or work them out itself.
  panel_seen_at    timestamptz,
  -- The listening coach (Pro). It hears the stream the way a viewer does:
  -- each call picks up the audio segments after listen_seq from the
  -- stream's playlist (listen_url, refreshed now and then). The lock keeps
  -- two open docks from both transcribing the same audio.
  listen_url        text,
  listen_url_at     timestamptz,
  listen_seq        bigint,
  listen_lock_until timestamptz,
  coached_at        timestamptz,
  -- What this stream's coaching used, for the monthly cap and for pricing.
  listened_seconds  integer NOT NULL DEFAULT 0,
  coach_calls       integer NOT NULL DEFAULT 0,
  coach_tokens_in   integer NOT NULL DEFAULT 0,
  coach_tokens_out  integer NOT NULL DEFAULT 0,
  tts_chars         integer NOT NULL DEFAULT 0,
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

-- ── Nudges, passed from the OBS panel to a phone in voice mode ─────────
-- The panel is the only place that can hear the mic and see the scenes
-- (OBS runs on the streamer's computer), so it sends each nudge here and
-- the phone reads them out. The listening coach's tips land here too
-- (source 'coach'). say = the line read out loud, when it differs from
-- the title and action shown on screen.
CREATE TABLE IF NOT EXISTS public.live_cues (
  id         bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  title      text NOT NULL,
  action     text NOT NULL,
  say        text,
  tone       text NOT NULL DEFAULT 'nudge',
  source     text NOT NULL DEFAULT 'panel',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_cues_session ON public.live_cues (session_id, id);

-- ── What the listening coach heard, line by line ───────────────────────
-- The stream's own audio, transcribed: the streamer, and whatever else
-- viewers hear. The coach reads the last few minutes of it.
CREATE TABLE IF NOT EXISTS public.live_lines (
  id         bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  said_at    timestamptz NOT NULL,
  text       text NOT NULL
);
CREATE INDEX IF NOT EXISTS live_lines_session ON public.live_lines (session_id, said_at);

ALTER TABLE public.live_docks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_samples  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_cues     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_lines    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own live lines" ON public.live_lines;
CREATE POLICY "read own live lines" ON public.live_lines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "read own live cues" ON public.live_cues;
CREATE POLICY "read own live cues" ON public.live_cues
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

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
