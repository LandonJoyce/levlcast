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

  const slice = (speakerFilter: number | null): CaptionWord[] => {
    const out: CaptionWord[] = [];
    for (const w of vodWords) {
      if (w.end <= clipStart || w.start >= clipEnd) continue;
      if (speakerFilter !== null && w.speaker !== undefined && w.speaker !== speakerFilter) continue;
      const start = Math.max(0, w.start - clipStart);
      const end = Math.min(duration, w.end - clipStart);
      if (end - start < 0.05) continue;
      out.push({ word: w.word, start, end, speaker: w.speaker });
    }
    return out;
  };

  const filtered = slice(dominant);
  // If speaker filtering wiped everything out, fall back to all speakers —
  // better to show captions from a co-streamer than show nothing.
  if (filtered.length === 0 && dominant !== null) return slice(null);
  return filtered;
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

// Tuned for the TikTok / Reels pace — short bursts, snap fast.
const MAX_WORDS_PER_CARD = 2;
const MAX_CARD_DURATION_S = 1.3;
const NEW_CARD_GAP_S = 0.28;
const MIN_CARD_DURATION_S = 0.35;

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

export type CaptionStyle = "bold" | "boxed" | "minimal" | "classic" | "neon" | "fire" | "impact";

export interface CaptionRenderConfig {
  fontPath: string;
  /** Output frame height in pixels. Caption sits at ~78% of this. */
  videoHeight: number;
  /** Output frame width in pixels. Used to pick a font size that scales. */
  videoWidth: number;
  /** Where to write per-card textfiles. Caller controls cleanup. */
  tempDir: string;
  /** Visual style for the captions. Defaults to "bold". */
  style?: CaptionStyle;
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

  const style = config.style ?? "bold";
  const yExpr = "(h*0.70)-(text_h/2)";

  const parts: string[] = [];
  const textFiles: string[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const filePath = join(config.tempDir, `cap-${i}.txt`);
    const enable = `between(t,${card.start.toFixed(3)},${card.end.toFixed(3)})`;

    let drawtextArgs: string;

    if (style === "boxed") {
      await writeFile(filePath, card.text.toUpperCase());
      const fontSize = 68;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=white:fontsize=${fontSize}:borderw=0:` +
        `box=1:boxcolor=black@0.55:boxborderw=14:` +
        `shadowcolor=black@0:shadowx=0:shadowy=0:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    } else if (style === "minimal") {
      await writeFile(filePath, card.text);
      const fontSize = 54;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=white@0.92:fontsize=${fontSize}:borderw=3:bordercolor=black@0.7:` +
        `shadowcolor=black@0.5:shadowx=2:shadowy=3:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    } else if (style === "classic") {
      // Bright yellow text with thick black stroke — classic subtitle look.
      await writeFile(filePath, card.text.toUpperCase());
      const fontSize = 74;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=yellow:fontsize=${fontSize}:borderw=7:bordercolor=black:` +
        `shadowcolor=black:shadowx=3:shadowy=4:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    } else if (style === "neon") {
      // Bright cyan with matching dark border — high contrast pop.
      await writeFile(filePath, card.text.toUpperCase());
      const fontSize = 70;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=0x00EEFF:fontsize=${fontSize}:borderw=5:bordercolor=0x003344:` +
        `shadowcolor=0x001122:shadowx=3:shadowy=4:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    } else if (style === "fire") {
      // Bright orange text with deep red/black border — energetic.
      await writeFile(filePath, card.text.toUpperCase());
      const fontSize = 76;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=0xFF6B00:fontsize=${fontSize}:borderw=7:bordercolor=0x1A0000:` +
        `shadowcolor=0x330000:shadowx=4:shadowy=5:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    } else if (style === "impact") {
      // Maximum size, very thick stroke — fills the screen.
      await writeFile(filePath, card.text.toUpperCase());
      const fontSize = 96;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=white:fontsize=${fontSize}:borderw=12:bordercolor=black:` +
        `shadowcolor=black:shadowx=5:shadowy=6:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    } else {
      // bold (default) — heavy white + thick black stroke.
      await writeFile(filePath, card.text.toUpperCase());
      const fontSize = 78;
      drawtextArgs =
        `drawtext=` +
        `textfile=${filePath}:fontfile=${config.fontPath}:` +
        `fontcolor=white:fontsize=${fontSize}:borderw=8:bordercolor=black:` +
        `shadowcolor=black:shadowx=3:shadowy=4:` +
        `x=(w-text_w)/2:y=${yExpr}:` +
        `line_spacing=${Math.round(fontSize * 0.18)}:` +
        `enable='${enable}'`;
    }

    textFiles.push(filePath);
    parts.push(drawtextArgs);
  }

  return { filter: "," + parts.join(","), textFiles };
}
