import { Inngest } from "inngest";

/**
 * Inngest client — orchestrates the AI clipping pipeline.
 *
 * Pipeline steps (each is a separate function):
 *   1. transcribe-vod  → Deepgram batch transcription
 *   2. analyze-peaks   → Claude peak detection
 *   3. generate-clip   → ffmpeg clip extraction
 *   4. generate-caption → Claude platform-specific captions
 *   5. post-to-social  → YouTube/TikTok/Instagram posting
 */
export const inngest = new Inngest({
  id: "levlcast",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
