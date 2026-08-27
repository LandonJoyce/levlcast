-- 009_vod_chat_pulse.sql
--
-- Stores bucketed chat metrics per VOD (volume, unique chatters,
-- sentiment indicators, detected events). We do NOT store raw chat
-- messages — for a 4-hour stream that's tens of thousands of rows
-- of mostly noise. The bucketed pulse is what the coach report and
-- clip-moment detection actually need.
--
-- Shape (JSONB array, one entry per ~30s bucket):
--   { start: number,           // VOD seconds, bucket start
--     end: number,             // VOD seconds, bucket end
--     count: number,           // total messages in bucket
--     uniqueChatters: number,  // distinct usernames in bucket
--     laughCount: number,      // lol/lmao/lul/kekw/omegalul/...
--     hypeCount: number,       // pog/pogchamp/w/fire/let's go/...
--     sadCount: number,        // f/rip/sadge/monkas/...
--     subEvents: number,       // sub/resub messages
--     bitEvents: number,       // cheer messages
--     raidEvents: number       // incoming raids
--   }

ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS chat_pulse JSONB;

COMMENT ON COLUMN vods.chat_pulse IS
  'Bucketed chat metrics from Twitch chat replay. Drives Chat Pulse visualization, chat-correlated coaching, and clip-moment scoring.';
