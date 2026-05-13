/**
 * lib/deepgram.ts — audio transcription via the Deepgram API.
 *
 * Each transcribe function now returns BOTH:
 *   segments — utterance-level (used for peak detection / coach prompts)
 *   words    — word-level timing (used to burn TikTok-style captions
 *              into clips during generation)
 *
 * SETTINGS:
 *   model=nova-3      — Deepgram's best accuracy model
 *   utterances=true   — splits transcript by natural speech pauses
 *   utt_split=1.5     — 1.5 second silence = new utterance boundary
 *   diarize=true      — tag each utterance/word with speaker ID
 */

import { createReadStream } from "fs";
import { PassThrough } from "stream";
import { withRetry } from "./retry";

const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";

const BASE_PARAMS: Record<string, string> = {
  model: "nova-3",
  smart_format: "true",
  punctuate: "true",
  utterances: "true",
  utt_split: "1.5",
  disfluencies: "true",   // keep "uh", "oh", "wait", "what" — critical emotional markers
  diarize: "true",         // tag each utterance with speaker ID so we can filter to the streamer's voice
};

/**
 * Build the Deepgram URL with optional vocabulary boosting.
 *
 * Nova-3 dropped the legacy `keywords` parameter (with :N boost
 * suffix) in favor of `keyterm` — a flat list of terms, no boosts.
 * Inputs may carry the legacy ":N" suffix from older callers; strip
 * it here so the same keyword library serves both code paths.
 *
 * Cap conservatively at 100 terms; Deepgram's own limit is higher
 * but very long URLs occasionally trip CDN edge proxies.
 */
function buildDeepgramUrl(keywords: string[] = []): string {
  const params = new URLSearchParams(BASE_PARAMS);
  const seen = new Set<string>();
  for (const raw of keywords) {
    const term = raw.replace(/:\d+(\.\d+)?$/, "").trim();
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    params.append("keyterm", term);
    if (seen.size >= 100) break;
  }
  return `${DEEPGRAM_API}?${params.toString()}`;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  /** Speaker ID assigned by Deepgram diarization. 0 = first detected speaker, etc. */
  speaker?: number;
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
  speaker?: number;
}

export interface TranscribeResult {
  segments: TranscriptSegment[];
  words: CaptionWord[];
}

type DeepgramJson = {
  results?: {
    utterances?: Array<{ transcript: string; start: number; end: number; speaker?: number }>;
    channels?: Array<{
      alternatives?: Array<{
        words?: Array<{
          word: string;
          start: number;
          end: number;
          speaker?: number;
          punctuated_word?: string;
        }>;
      }>;
    }>;
  };
};

function parseDeepgramResponse(json: DeepgramJson): TranscribeResult {
  const utterances = json.results?.utterances ?? [];
  const segments: TranscriptSegment[] = utterances.map((u) => ({
    text: u.transcript,
    start: u.start,
    end: u.end,
    speaker: u.speaker,
  }));

  const rawWords = json.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  const words: CaptionWord[] = rawWords.map((w) => ({
    // Punctuated word reads naturally on screen ("Wait!" vs "wait")
    word: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
    speaker: w.speaker,
  }));

  return { segments, words };
}

/**
 * Transcribe directly from a URL — no download needed.
 * Deepgram fetches the audio/M3U8 itself.
 */
export async function transcribeFromUrl(url: string, keywords: string[] = []): Promise<TranscribeResult> {
  const res = await withRetry(() =>
    fetch(buildDeepgramUrl(keywords), {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    }), 3, 2000);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram ${res.status}: ${body}`);
  }

  return parseDeepgramResponse(await res.json());
}

/**
 * Transcribe audio piped through a PassThrough stream — no disk writes.
 * Segments are streamed directly to Deepgram as they download.
 * The caller writes segment data to the returned PassThrough and calls .end() when done.
 *
 * We can't generically retry a streaming POST because the body is a single-
 * consumption stream — by the time the call fails the stream is drained.
 * Transient 5xx retries therefore have to happen at the Inngest step level
 * (retries: 1 on analyzeVod). What we DO catch here: surface a clearer
 * error so the failure email is useful.
 */
export async function transcribePassThrough(
  stream: PassThrough,
  keywords: string[] = []
): Promise<TranscribeResult> {
  const res = await fetch(buildDeepgramUrl(keywords), {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "video/mp2t",
    },
    // @ts-ignore — Node.js streams are valid here
    body: stream,
    // @ts-ignore
    duplex: "half",
  });

  if (!res.ok) {
    const body = await res.text();
    // Deepgram returns 400 "corrupt or unsupported data" when the MPEG-TS
    // stream is malformed (truncated segment, mixed codecs, ad-insertion
    // HTML, etc.). The segment-level sync-byte check in twitch.ts catches
    // the most common cause but ad-codec switches can still slip through.
    if (res.status === 400 && body.includes("corrupt or unsupported data")) {
      throw new Error(
        "Audio stream contained data Deepgram couldn't decode (often caused " +
        "by an ad-insertion segment with a different codec). Please retry; " +
        "if it keeps failing, the source VOD has a codec switch we can't process."
      );
    }
    throw new Error(`Deepgram ${res.status}: ${body}`);
  }

  return parseDeepgramResponse(await res.json());
}

/**
 * Transcribe a local audio file using Deepgram's pre-recorded API.
 * Streams the file so we don't load it all into memory.
 */
export async function transcribeFile(filePath: string, keywords: string[] = []): Promise<TranscribeResult> {
  const res = await withRetry(() => {
    const stream = createReadStream(filePath);
    return fetch(buildDeepgramUrl(keywords), {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "video/mp2t",
      },
      // @ts-ignore — Node.js ReadStream is valid here but TS types don't know it
      body: stream,
      // @ts-ignore
      duplex: "half",
    });
  }, 3, 1000);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram ${res.status}: ${body}`);
  }

  return parseDeepgramResponse(await res.json());
}
