-- 007_vod_word_timestamps.sql
--
-- Persist Deepgram word-level timestamps on the vods row so that clip
-- generation can burn TikTok-style word-synced captions without re-running
-- transcription. JSONB compresses well; a 3-hour stream is typically ~1MB.

ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS word_timestamps JSONB;

COMMENT ON COLUMN vods.word_timestamps IS
  'Array of {word, start, end, speaker?} from Deepgram nova-3. Used by cutClip to burn word-synced captions into clips.';
