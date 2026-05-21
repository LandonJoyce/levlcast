/**
 * lib/pacing.ts
 *
 * Lightweight telemetry over the streamer's transcript shape — sentence
 * length variance + punctuation density. Cheap to compute (no audio,
 * no model calls) and gives Claude objective backing when it claims
 * the delivery felt fatigued, monotone, or theatrical.
 *
 * The rule for the model lives in the system prompt's INTERPRETATION
 * RULES section: low variance + low WPM = fatigue; low variance + high
 * WPM = hype repetition. We deliberately do NOT pre-label these as
 * HIGH/LOW here — raw numbers only, Claude reasons over them.
 */

import type { TranscriptSegment } from "./deepgram";

export interface PacingProfile {
  /** Population variance of word counts per sentence, in words². */
  sentenceVariance: number;
  /** Exclamation marks per 1000 words. */
  exclamationDensity: number;
  /** Question marks per 1000 words. */
  questionDensity: number;
  /** Sentence count used for variance — < 10 means variance is unreliable. */
  sentenceCount: number;
  /** Total word count across all segments. */
  totalWords: number;
}

/**
 * Compute pacing telemetry from a diarization-filtered transcript.
 * Caller is expected to pass segments that have already been narrowed
 * to the streamer's own voice (filterDominantSpeaker / BRB trim).
 */
export function computePacingProfile(segments: TranscriptSegment[]): PacingProfile | null {
  if (segments.length === 0) return null;

  // Concatenate transcript and split on Deepgram-added sentence terminators.
  // smart_format on nova-3 produces punctuated sentences so this is the
  // ground truth for what the ASR considered a sentence boundary.
  const fullText = segments.map((s) => s.text).join(" ").trim();
  if (!fullText) return null;

  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return null;

  const wordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  if (totalWords === 0) return null;

  const mean = totalWords / wordCounts.length;
  const variance = wordCounts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / wordCounts.length;

  let exclamations = 0;
  let questions = 0;
  for (const ch of fullText) {
    if (ch === "!") exclamations++;
    else if (ch === "?") questions++;
  }

  const exclamationDensity = (exclamations / totalWords) * 1000;
  const questionDensity = (questions / totalWords) * 1000;

  return {
    sentenceVariance: variance,
    exclamationDensity,
    questionDensity,
    sentenceCount: sentences.length,
    totalWords,
  };
}

/**
 * Render the pacing profile as a prompt-ready block. Returns "" when
 * the sample is too small to be meaningful (< 10 sentences) so callers
 * can splat into prompts unconditionally.
 */
export function formatPacingForPrompt(profile: PacingProfile | null): string {
  if (!profile) return "";
  if (profile.sentenceCount < 10) return "";

  return [
    "**Pacing Profile (raw telemetry — interpret using the rules in the system prompt):**",
    `  Sentence length variance: ${profile.sentenceVariance.toFixed(1)} words²  (across ${profile.sentenceCount} sentences)`,
    `  Exclamation density: ${profile.exclamationDensity.toFixed(1)} per 1k words`,
    `  Question density: ${profile.questionDensity.toFixed(1)} per 1k words`,
  ].join("\n");
}
