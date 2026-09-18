-- Reddit outreach contacts
--
-- One row per Reddit account we have ever queued or messaged. The unique
-- index on reddit_username is the deduplication guarantee and the single
-- most important thing in this table: a person who has been contacted once
-- can never be contacted again, no matter how many times they post, how
-- many subreddits they post in, or how many harvest runs see them. Getting
-- this wrong is what turns outreach into spam and gets an account banned.
--
-- Rows are also kept for people we SKIP, so the filter never re-evaluates
-- and re-drafts for someone we already decided against.
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lowercased Reddit username. UNIQUE: the dedup guarantee.
  reddit_username TEXT NOT NULL UNIQUE,

  -- Where we found them.
  source TEXT NOT NULL,                 -- 'post' | 'comment'
  subreddit TEXT,
  permalink TEXT,
  post_title TEXT,
  post_excerpt TEXT,                    -- trimmed body we drafted from

  -- The drafted message. Written at harvest time so the sender only has to
  -- send, and so a human can read the queue before anything goes out.
  message_subject TEXT,
  message_body TEXT,

  -- queued   — drafted, waiting for its turn in the send schedule
  -- sending  — claimed by the dispatcher. A row stuck here means a send
  --            threw mid-flight; it is deliberately NEVER retried, because
  --            a message that may already have reached a real person must
  --            not go out twice.
  -- sent     — delivered
  -- skipped  — filtered out; kept so we never reconsider them
  -- failed   — Reddit rejected it; kept so we never retry forever
  status TEXT NOT NULL DEFAULT 'queued',
  skip_reason TEXT,
  fail_reason TEXT,

  -- Rotates the angle of the pitch so consecutive messages don't read as
  -- one template with the names swapped.
  angle TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- The dispatcher's query: oldest queued first.
CREATE INDEX IF NOT EXISTS outreach_contacts_status_created_idx
  ON outreach_contacts (status, created_at);

-- Daily send-rate accounting.
CREATE INDEX IF NOT EXISTS outreach_contacts_sent_at_idx
  ON outreach_contacts (sent_at DESC);

-- Service-role only. Nothing here should ever be readable by the anon key:
-- it is a list of people who have not asked to hear from us.
ALTER TABLE outreach_contacts ENABLE ROW LEVEL SECURITY;
