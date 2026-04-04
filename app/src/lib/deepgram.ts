/**
 * lib/deepgram.ts — audio transcription via the Deepgram API.
 *
 * FUNCTIONS:
 *   transcribePassThrough(stream) — preferred. Streams audio directly from a
 *     Node.js PassThrough (e.g. piped from Twitch M3U8) with no disk writes.
 *     Used in the Inngest analysis pipeline.
 *
 *   transcribeFile(filePath) — transcribes a local audio file already on disk.
 *     Used after FFmpeg has cut a clip to verify timing.
 *
 *   transcribeFromUrl(url) — asks Deepgram to fetch the URL itself.
 *     Currently unused — kept for reference. Deepgram's URL fetch doesn't work
 *     well with Twitch M3U8 playlists that require auth headers.
 *
 * SETTINGS (DEEPGRAM_PARAMS):
 *   model=nova-3      — Deepgram's best accuracy model
 *   utterances=true   — splits transcript by natural speech pauses (used for timestamps)
 *   utt_split=1.5     — 1.5 second silence = new utterance boundary
 */

import { createReadStream } from "fs";
import { PassThrough } from "stream";
import { withRetry } from "./retry";

const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";

const DEEPGRAM_PARAMS = new URLSearchParams({
  model: "nova-3",
  smart_format: "true",
  punctuate: "true",
  utterances: "true",
  utt_split: "1.5",
}).toString();

/**
 * Transcribe directly from a URL — no download needed.
 * Deepgram fetches the audio/M3U8 itself.
 */
export async function transcribeFromUrl(url: string): Promise<TranscriptSegment[]> {
  const res = await withRetry(() =>
    fetch(`${DEEPGRAM_API}?${DEEPGRAM_PARAMS}`, {
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

  const json = await res.json();
  const utterances: { transcript: string; start: number; end: number }[] =
    json.results?.utterances || [];

  return utterances.map((u) => ({
    text: u.transcript,
    start: u.start,
    end: u.end,
  }));
}

/**
 * Transcribe audio piped through a PassThrough stream — no disk writes.
 * Segments are streamed directly to Deepgram as they download.
 * The caller writes segment data to the returned PassThrough and calls .end() when done.
 */
export async function transcribePassThrough(stream: PassThrough): Promise<TranscriptSegment[]> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
    utt_split: "1.5",
  });

  const res = await fetch(`${DEEPGRAM_API}?${params}`, {
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
    throw new Error(`Deepgram ${res.status}: ${body}`);
  }

  const json = await res.json();
  const utterances: { transcript: string; start: number; end: number }[] =
    json.results?.utterances || [];

  return utterances.map((u) => ({
    text: u.transcript,
    start: u.start,
    end: u.end,
  }));
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * Transcribe a local audio file using Deepgram's pre-recorded API.
 * Accepts a file path and streams it — avoids loading the entire file into memory.
 */
export async function transcribeFile(
  filePath: string
): Promise<TranscriptSegment[]> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
    utt_split: "1.5",
  });

  const res = await withRetry(() => {
    const stream = createReadStream(filePath);
    return fetch(`${DEEPGRAM_API}?${params}`, {
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

  const json = await res.json();
  const utterances: { transcript: string; start: number; end: number }[] =
    json.results?.utterances || [];

  return utterances.map((u) => ({
    text: u.transcript,
    start: u.start,
    end: u.end,
  }));
}
