/**
 * lib/transcribe.ts — which service turns stream audio into text.
 *
 * Soniox (lib/soniox.ts) whenever SONIOX_API_KEY is set, since 2026-10-12:
 * a third of Deepgram's price, and on real streams it caught more of what
 * was said and kept the game's voice lines apart from the streamer.
 *
 * Deepgram (lib/deepgram.ts) is the backup. If Soniox fails on a piece of
 * audio (an outage, or the account out of credit), that piece goes to
 * Deepgram, so nothing fails because of Soniox. Without SONIOX_API_KEY
 * everything goes to Deepgram as it did before.
 */
import { PassThrough } from "stream";
import { transcribeClip, transcribePassThrough, type TranscribeResult } from "./deepgram";
import { transcribeSoniox } from "./soniox";
import { streamSegmentsToPassThrough } from "./twitch";

export function sonioxOn(): boolean {
  return !!process.env.SONIOX_API_KEY;
}

function reason(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200);
}

/** Everything a stream wrote, or its error. */
function collect(stream: PassThrough): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    stream.on("data", (d: Buffer) => parts.push(d));
    stream.on("end", () => resolve(Buffer.concat(parts)));
    stream.on("error", reject);
  });
}

/**
 * A run of a VOD's segments: one part of a report, or the free preview's
 * opening. Keywords only reach Deepgram (Soniox doesn't charge for them, but
 * it hasn't been tried with them yet).
 */
export async function transcribeSegments(urls: string[], initSegment: Buffer | null, keywords: string[] = []): Promise<TranscribeResult> {
  if (!sonioxOn()) return transcribePassThrough(streamSegmentsToPassThrough(urls, initSegment), keywords);

  // Soniox takes a whole file, so the segments are gathered first. A
  // segment that won't download fails the part here, as it always has.
  const audio = await collect(streamSegmentsToPassThrough(urls, initSegment));
  try {
    const started = Date.now();
    const result = await transcribeSoniox(audio);
    console.log(`[transcribe] Soniox: ${result.words.length} words in ${Math.round((Date.now() - started) / 1000)}s`);
    return result;
  } catch (err) {
    console.warn(`[transcribe] Soniox failed, sending this part to Deepgram: ${reason(err)}`);
    const again = new PassThrough();
    again.end(audio);
    return transcribePassThrough(again, keywords);
  }
}

/** The last few seconds of a live stream, for the listening coach. */
export async function transcribeLive(audio: Buffer): Promise<TranscribeResult> {
  if (!sonioxOn()) return transcribeClip(audio);
  try {
    // Speakers aren't needed live, and a tip that waits too long is useless.
    return await transcribeSoniox(audio, { speakers: false, timeoutMs: 20_000 });
  } catch (err) {
    console.warn(`[transcribe] Soniox failed on live audio, using Deepgram: ${reason(err)}`);
    return transcribeClip(audio);
  }
}
