/**
 * lib/captions.ts — TikTok/Shorts-style word-synced caption rendering.
 *
 * Pipeline:
 *   1. sliceWordsForClip()   — clip-window slice + dominant speaker filter,
 *                              rebased to clip-relative timestamps (t=0 at clip start)
 *   2. groupWordsIntoCards() — pack into 1–3 word "cards" (max ~1.6s each)
 *   3. buildCaptionFilters() — emit a chain of FFmpeg drawtext filters,
 *                              one per card, gated by enable=between(t,a,b).
 *
 * Why drawtext + textfile (not the subtitles filter):
 *   eugeneware/ffmpeg-static b6.0 ships WITHOUT libass. The subtitles filter
 *   silently no-ops on Vercel. drawtext with a downloaded TTF font works.
 *
 * Why one textfile per card (not text='...'):
 *   Filtergraph escaping of single quotes, colons, commas, and backslashes is
 *   a minefield. Writing each card's text to its own file and pointing to it
 *   with textfile= sidesteps all of it.
 */

import { writeFile } from "fs/promises";
import { join } from "path";
import type { CaptionWord } from "./deepgram";

export type { CaptionWord } from "./deepgram";

/**
 * Slice the VOD-wide word list down to one clip's window, filter to the
 * dominant speaker (the streamer) and rebase timestamps so t=0 is clip start.
 *
 * Words straddling the boundary are kept and clamped — a word ending 200ms
 * after the clip ends would otherwise pop off mid-utterance.
 */
export function sliceWordsForClip(
  vodWords: CaptionWord[] | null | undefined,
  clipStart: number,
  clipEnd: number
): CaptionWord[] {
  if (!vodWords || vodWords.length === 0) return [];

  const dominant = pickDominantSpeaker(vodWords, clipStart, clipEnd);
  const duration = clipEnd - clipStart;

  const sliced: CaptionWord[] = [];
  for (const w of vodWords) {
    if (w.end <= clipStart || w.start >= clipEnd) continue;
    if (dominant !== null && w.speaker !== undefined && w.speaker !== dominant) continue;

    const start = Math.max(0, w.start - clipStart);
    const end = Math.min(duration, w.end - clipStart);
    if (end - start < 0.05) continue; // sub-50ms slivers are noise

    sliced.push({ word: w.word, start, end, speaker: w.speaker });
  }

  return sliced;
}

/**
 * The streamer is whoever talks the most inside the clip window.
 * Falls back to null (don't filter) if speakers are missing/tied.
 */
function pickDominantSpeaker(
  words: CaptionWord[],
  clipStart: number,
  clipEnd: number
): number | null {
  const totals: Record<number, number> = {};
  for (const w of words) {
    if (w.speaker === undefined) continue;
    if (w.end <= clipStart || w.start >= clipEnd) continue;
    const overlap = Math.min(w.end, clipEnd) - Math.max(w.start, clipStart);
    if (overlap <= 0) continue;
    totals[w.speaker] = (totals[w.speaker] ?? 0) + overlap;
  }
  const ranked = Object.entries(totals).sort(([, a], [, b]) => b - a);
  if (ranked.length === 0) return null;
  return Number(ranked[0][0]);
}

export interface CaptionCard {
  text: string;
  start: number;
  end: number;
}

const MAX_WORDS_PER_CARD = 3;
const MAX_CARD_DURATION_S = 1.6;
const NEW_CARD_GAP_S = 0.35;
const MIN_CARD_DURATION_S = 0.4;

/**
 * Pack words into short cards that look like TikTok auto-captions.
 *
 * Rules (in order of priority):
 *   - new card after a >0.35s silence gap
 *   - new card when current would exceed 1.6s of screen time
 *   - new card after 3 words
 *   - cards with fewer than 0.4s of show-time get extended slightly so the
 *     viewer can actually read them
 */
export function groupWordsIntoCards(words: CaptionWord[]): CaptionCard[] {
  if (words.length === 0) return [];

  const cards: CaptionCard[] = [];
  let bucket: CaptionWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const text = bucket.map((w) => w.word).join(" ").trim();
    if (text.length === 0) { bucket = []; return; }
    let start = bucket[0].start;
    let end = bucket[bucket.length - 1].end;
    if (end - start < MIN_CARD_DURATION_S) {
      end = start + MIN_CARD_DURATION_S;
    }
    cards.push({ text, start, end });
    bucket = [];
  };

  for (const word of words) {
    if (bucket.length === 0) { bucket.push(word); continue; }

    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const gap = word.start - last.end;
    const wouldDuration = word.end - first.start;

    if (
      bucket.length >= MAX_WORDS_PER_CARD ||
      wouldDuration > MAX_CARD_DURATION_S ||
      gap > NEW_CARD_GAP_S
    ) {
      flush();
    }
    bucket.push(word);
  }
  flush();

  // Stop a card from staying on screen past the next card's start.
  for (let i = 0; i < cards.length - 1; i++) {
    if (cards[i].end > cards[i + 1].start) {
      cards[i].end = cards[i + 1].start;
    }
  }

  return cards;
}

export interface CaptionRenderConfig {
  fontPath: string;
  /** Output frame height in pixels. Caption sits at ~78% of this. */
  videoHeight: number;
  /** Output frame width in pixels. Used to pick a font size that scales. */
  videoWidth: number;
  /** Where to write per-card textfiles. Caller controls cleanup. */
  tempDir: string;
}

export interface CaptionRenderResult {
  /** FFmpeg filter string starting with a leading "," — concatenate to a chain. */
  filter: string;
  /** Files written to tempDir. Caller deletes them. */
  textFiles: string[];
}

/**
 * Build the drawtext chain for a list of cards.
 *
 * Returns a string that BEGINS WITH "," so it can be appended directly to an
 * existing filter chain (e.g. "...setpts=PTS-STARTPTS{captionFilter}[vout]").
 * If there are no cards, returns "" (chain stays valid).
 */
export async function buildCaptionFilters(
  cards: CaptionCard[],
  config: CaptionRenderConfig
): Promise<CaptionRenderResult> {
  if (cards.length === 0) return { filter: "", textFiles: [] };

  // Use a fixed pixel font size — scales acceptably across 720p/1080p
  // sources. Y is expressed relative to actual output height so captions
  // always sit near the bottom regardless of source resolution.
  const fontSize = 64;
  const borderWidth = 5;
  const lineSpacing = 10;
  // 8% margin from the bottom of the frame
  const yExpr = "h-text_h-(h*0.08)";

  const parts: string[] = [];
  const textFiles: string[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const filePath = join(config.tempDir, `cap-${i}.txt`);
    await writeFile(filePath, card.text);
    textFiles.push(filePath);

    // Single-quoted enable value — FFmpeg treats chars inside ''
    // literally, so the commas inside between() reach the expression
    // evaluator un-mangled. DO NOT also \-escape the commas; that
    // produces between(t\,5\,7) which the expr parser silently rejects
    // (filter renders nothing, no error).
    const enable = `between(t,${card.start.toFixed(3)},${card.end.toFixed(3)})`;
    parts.push(
      `drawtext=` +
      `textfile=${filePath}:` +
      `fontfile=${config.fontPath}:` +
      `fontcolor=white:` +
      `fontsize=${fontSize}:` +
      `borderw=${borderWidth}:` +
      `bordercolor=black:` +
      `box=1:boxcolor=black@0.5:boxborderw=18:` +
      `x=(w-text_w)/2:y=${yExpr}:` +
      `line_spacing=${lineSpacing}:` +
      `enable='${enable}'`
    );
  }

  return { filter: "," + parts.join(","), textFiles };
}
