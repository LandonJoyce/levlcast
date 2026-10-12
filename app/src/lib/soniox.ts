/**
 * lib/soniox.ts — transcription through Soniox's async API.
 *
 * What lib/transcribe.ts uses since 2026-10-12, with Deepgram
 * (lib/deepgram.ts) as the backup. Soniox is $0.10 an hour with speaker
 * labels and language detection included, against $0.31 for Deepgram nova-3
 * multilingual. Side by side on 12 minutes each of three real streams it
 * caught more of what was said (25% more on a loud shooter) and put the
 * game's voice lines on their own speaker, which the reports drop. It
 * returns the same TranscribeResult as Deepgram, so nothing after
 * transcription can tell which one ran.
 *
 * Soniox reads files, not streams: the audio is uploaded, a job is started
 * on it, and the transcript is fetched once the job is done (seconds for a
 * 12-minute part). Both are deleted afterwards, since an account holds at
 * most 1,000 files and 2,000 jobs.
 */
import type { CaptionWord, TranscribeResult, TranscriptSegment } from "./deepgram";
import { isMpegTs, tsToAdts } from "./audio-demux";
import { audioToAdts } from "./ffmpeg";

const SONIOX_API = process.env.SONIOX_BASE_URL || "https://api.soniox.com";
const MODEL = "stt-async-v5";
/** A pause this long starts a new line, the same as Deepgram's utt_split. */
const LINE_GAP_SECONDS = 1.5;
const POLL_MS = 700;
const JOB_TIMEOUT_MS = 240_000;

/** One piece of Soniox's transcript: a word, part of one, or punctuation. */
export interface SonioxToken {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence?: number;
  speaker?: string;
  language?: string;
}

export interface SonioxOptions {
  /**
   * Copy the audio out of its container first. On by default: Soniox
   * refuses MPEG-TS, which is how Twitch serves most VODs and streams.
   */
  remux?: boolean;
  /** Tell speakers apart (reports: to keep game voices out). On by default. */
  speakers?: boolean;
  /** Give up after this long. The live coach can't wait 4 minutes. */
  timeoutMs?: number;
  /** Likely languages, such as ["en"]: a hint, not a limit. */
  languageHints?: string[];
  /** What the stream is, and words to expect (game, champion and map names). */
  context?: { topic?: string; terms?: string[] };
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SONIOX_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.SONIOX_API_KEY}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
}

async function read<T>(res: Response, doing: string): Promise<T> {
  if (!res.ok) throw new Error(`Soniox ${res.status} ${doing}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/**
 * The audio as AAC. MPEG-TS is unpacked in code (lib/audio-demux.ts, byte
 * for byte what ffmpeg gives, in milliseconds); anything else, such as
 * fragmented MP4, goes through ffmpeg.
 */
async function asAac(audio: Buffer): Promise<Buffer> {
  if (isMpegTs(audio)) {
    const aac = tsToAdts(audio);
    if (aac) return aac;
  }
  return audioToAdts(audio);
}

export async function transcribeSoniox(audio: Buffer, opts: SonioxOptions = {}): Promise<TranscribeResult> {
  const remux = opts.remux !== false;
  const body = remux ? await asAac(audio) : audio;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body)]), remux ? "audio.aac" : "audio");
  const file = await read<{ id: string }>(await call("/v1/files", { method: "POST", body: form }), "uploading the audio");

  let jobId: string | null = null;
  try {
    const context = opts.context?.topic || opts.context?.terms?.length
      ? {
          general: [{ key: "domain", value: "Twitch livestream" }, ...(opts.context.topic ? [{ key: "topic", value: opts.context.topic }] : [])],
          ...(opts.context.terms?.length ? { terms: opts.context.terms.slice(0, 200) } : {}),
        }
      : null;
    const job = await read<{ id: string }>(
      await call("/v1/transcriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          file_id: file.id,
          enable_speaker_diarization: opts.speakers !== false,
          enable_language_identification: true,
          ...(opts.languageHints?.length ? { language_hints: opts.languageHints } : {}),
          ...(context ? { context } : {}),
        }),
      }),
      "starting the transcription"
    );
    jobId = job.id;

    const started = Date.now();
    for (;;) {
      const job = await read<{ status: string; error_message?: string | null }>(await call(`/v1/transcriptions/${jobId}`), "checking the transcription");
      if (job.status === "completed") break;
      if (job.status === "error") throw new Error(`Soniox couldn't transcribe this audio: ${job.error_message || "no reason given"}`);
      if (Date.now() - started > (opts.timeoutMs ?? JOB_TIMEOUT_MS)) throw new Error("Soniox took too long on this part of the stream");
      await new Promise((r) => setTimeout(r, POLL_MS));
    }

    const transcript = await read<{ tokens?: SonioxToken[] }>(await call(`/v1/transcriptions/${jobId}/transcript`), "fetching the transcript");
    return fromTokens(transcript.tokens ?? []);
  } finally {
    await Promise.allSettled([
      jobId ? call(`/v1/transcriptions/${jobId}`, { method: "DELETE" }) : Promise.resolve(),
      call(`/v1/files/${file.id}`, { method: "DELETE" }),
    ]);
  }
}

/**
 * Soniox's pieces as Deepgram-shaped words and lines. A piece starting with
 * a space starts a word, and so does a new speaker; anything else (the rest
 * of a word, or punctuation) joins the word before it, so words come out
 * punctuated the way captions show them ("Wait!"). Lines break on a new
 * speaker or a pause of LINE_GAP_SECONDS, as Deepgram's utterances do.
 */
export function fromTokens(tokens: SonioxToken[]): TranscribeResult {
  const words: CaptionWord[] = [];
  for (const t of tokens) {
    const text = t.text?.trim();
    if (!text) continue;
    const speaker = t.speaker !== undefined && t.speaker !== null && t.speaker !== "" ? Number(t.speaker) : undefined;
    const prev = words[words.length - 1];
    const newWord = !prev || /^\s/.test(t.text) || speaker !== prev.speaker;
    if (newWord) {
      words.push({ word: text, start: t.start_ms / 1000, end: t.end_ms / 1000, ...(Number.isFinite(speaker) ? { speaker } : {}) });
    } else {
      prev.word += text;
      prev.end = Math.max(prev.end, t.end_ms / 1000);
    }
  }

  const segments: TranscriptSegment[] = [];
  let line: CaptionWord[] = [];
  const close = () => {
    if (!line.length) return;
    segments.push({
      text: line.map((w) => w.word).join(" "),
      start: line[0].start,
      end: line[line.length - 1].end,
      ...(line[0].speaker !== undefined ? { speaker: line[0].speaker } : {}),
    });
    line = [];
  };
  for (const w of words) {
    const last = line[line.length - 1];
    if (last && (w.speaker !== last.speaker || w.start - last.end >= LINE_GAP_SECONDS)) close();
    line.push(w);
  }
  close();
  return { segments, words };
}
