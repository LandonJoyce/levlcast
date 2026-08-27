-- ============================================================
-- 025 — Collab Finder v2
-- Replaces the algorithmic collab_suggestions cron system with a
-- double-opt-in marketplace where streamers send/accept/pass on
-- interest sends. See memory: project_collab_finder_v2
-- ============================================================

-- ─── 1. Drop the old algorithmic system ──────────────────────
-- Migration 014 introduced collab_profiles + collab_suggestions
-- (computed weekly cron). Migration 016 added external-streamer
-- support to collab_suggestions. Both are replaced wholesale; the
-- new design has live opt-in users (no precomputed cache) and
-- explicit user-initiated interests rather than algorithmic
-- suggestions.

DROP TABLE IF EXISTS collab_suggestions CASCADE;
DROP TABLE IF EXISTS collab_profiles CASCADE;


-- ─── 2. Profile additions ────────────────────────────────────
-- Per-user collab state lives on the profile, NOT a separate
-- table. Avoids an extra join on every browse query.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS discord_handle TEXT,
  ADD COLUMN IF NOT EXISTS collab_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collab_opt_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collab_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Discord handle format guard. Modern Discord usernames are 2-32 chars,
-- lowercase letters/digits/underscores/dots. Reject anything with whitespace,
-- the legacy "#1234" discriminator, or empty strings.
ALTER TABLE profiles
  ADD CONSTRAINT discord_handle_format
  CHECK (discord_handle IS NULL OR discord_handle ~ '^[a-z0-9._]{2,32}$');

-- Partial index — the browse query filters on collab_opt_in = true and we
-- expect the opted-in subset to be a small fraction of total users for a
-- long time. Partial index is much smaller and faster than full.
CREATE INDEX IF NOT EXISTS idx_profiles_collab_opt_in
  ON profiles(collab_opt_in_at DESC NULLS LAST)
  WHERE collab_opt_in = true;


-- ─── 3. collab_interests table ───────────────────────────────
-- Each row is one streamer expressing interest in collabing with
-- another. Status starts at 'pending' and transitions to either
-- 'accepted' or 'passed' once the recipient responds. There is
-- no "withdrawn" state — see one-shot-per-pair note below.

CREATE TABLE IF NOT EXISTS collab_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intro_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'passed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_interest CHECK (sender_id <> recipient_id),
  CONSTRAINT intro_text_length CHECK (char_length(intro_text) BETWEEN 1 AND 200),
  CONSTRAINT responded_consistency CHECK (
    (status = 'pending' AND responded_at IS NULL) OR
    (status IN ('accepted', 'passed') AND responded_at IS NOT NULL)
  )
);

-- ONE-SHOT-PER-PAIR enforcement at the DB level. Any pair only ever
-- gets one row regardless of status. Combined with the CHECK above:
--   - Cannot re-send after a pass (row exists)
--   - Cannot re-send after an accept (row exists)
--   - Cannot have two pending interests in the same direction
-- Spam is structurally impossible.
CREATE UNIQUE INDEX idx_collab_interests_pair
  ON collab_interests(sender_id, recipient_id);

-- Sender's outgoing list (their "sent" tab if we add it later)
CREATE INDEX idx_collab_interests_sender_created
  ON collab_interests(sender_id, created_at DESC);

-- Recipient's inbox — most queries hit (recipient_id, status='pending')
CREATE INDEX idx_collab_interests_recipient_status
  ON collab_interests(recipient_id, status, created_at DESC);

-- Monthly cap counting — sends in current calendar month for a sender
CREATE INDEX idx_collab_interests_sender_month
  ON collab_interests(sender_id, created_at);


-- ─── 4. Row Level Security ───────────────────────────────────
-- Sender can read + insert own rows; Recipient can read + update own
-- (to accept/pass). Discord handle reveal happens server-side: the
-- browse and inbox routes use the service role and only expose the
-- handle to BOTH parties AFTER a mutual accept. Direct profile RLS
-- (Users read own profile) prevents anyone from selecting another
-- user's discord_handle via the profiles table.

ALTER TABLE collab_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender reads own interests"
  ON collab_interests FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Recipient reads incoming interests"
  ON collab_interests FOR SELECT
  USING (auth.uid() = recipient_id);

-- Inserts must also pass the cap and one-shot-per-pair checks; those
-- live in the /api/collab/interest/send route because they need cross-
-- row queries that RLS can't express cleanly. The RLS check here only
-- enforces "you can only insert rows where you are the sender."
CREATE POLICY "Sender inserts own interests"
  ON collab_interests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Updates only allowed by the recipient and only to flip pending → accepted/passed.
-- We can't express that constraint cleanly in RLS WITH CHECK (which would need
-- access to the OLD row) so route handlers enforce status transition rules.
CREATE POLICY "Recipient updates incoming interests"
  ON collab_interests FOR UPDATE
  USING (auth.uid() = recipient_id);
