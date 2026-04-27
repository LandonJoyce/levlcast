-- 008_vod_game_category.sql
--
-- Stores the detected game category per VOD so the transcription
-- pipeline can boost the right vocabulary into Deepgram via its
-- keywords parameter, and so the UI can later let users override the
-- detection.
--
-- Categories: mmo | fps | battle_royale | moba | fighting | card_game | racing | sandbox | general

ALTER TABLE vods
  ADD COLUMN IF NOT EXISTS game_category TEXT;

COMMENT ON COLUMN vods.game_category IS
  'Detected game category from VOD title (mmo, fps, battle_royale, moba, fighting, card_game, racing, sandbox, general). Drives Deepgram keyword boosting during transcription.';
