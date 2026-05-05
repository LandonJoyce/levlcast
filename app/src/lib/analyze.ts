/**
 * lib/analyze.ts — AI peak detection and coaching report generation.
 *
 * This is the core of LevlCast. It uses Claude to:
 *   1. detectPeaks()      — find the best viral clip moments in a VOD transcript
 *   2. generateCoachReport() — produce a scored coaching report for the streamer
 *
 * HOW PEAK DETECTION WORKS:
 *   - Short VODs (<= 25 min): single Claude call on the full transcript
 *   - Long VODs: split into 20-minute chunks, run each independently,
 *     then do a final re-ranking pass to pick the best 5 overall
 *
 * MODELS USED:
 *   - Peak detection: claude-sonnet-4-6 (high quality — this is the MVP feature)
 *   - Coaching report: claude-sonnet-4-6 (flagship feature)
 *
 * See src/types/index.ts for the Peak and CoachReport type definitions.
 */

import Anthropic from "@anthropic-ai/sdk";
import { TranscriptSegment } from "./deepgram";
import { withRetry } from "./retry";

export interface Peak {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason: string;
  caption: string;
  hook: string;
}

/**
 * Filter transcript segments to only the dominant speaker.
 * Deepgram diarization assigns a speaker ID to each utterance. The speaker
 * with the most total talking time is the streamer — game NPCs, music, and
 * other voices will have far less speaking time and are filtered out.
 * Falls back to the full segment list if no speaker data is present.
 */
function filterDominantSpeaker(segments: TranscriptSegment[]): TranscriptSegment[] {
  const hasSpeakerData = segments.some((s) => s.speaker !== undefined);
  if (!hasSpeakerData) return segments;

  // Sum speaking duration per speaker ID
  const speakerTime: Record<number, number> = {};
  for (const seg of segments) {
    if (seg.speaker === undefined) continue;
    speakerTime[seg.speaker] = (speakerTime[seg.speaker] ?? 0) + (seg.end - seg.start);
  }

  const entries = Object.entries(speakerTime).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return segments;

  const dominant = Number(entries[0][0]);
  const filtered = segments.filter((s) => s.speaker === undefined || s.speaker === dominant);

  const removed = segments.length - filtered.length;
  if (removed > 0) {
    console.log(`[analyze] Diarization: dominant speaker=${dominant} (${Math.round(speakerTime[dominant])}s), removed ${removed} segments from other speakers`);
  }

  return filtered;
}

/**
 * Build a transcript string from segments, with explicit pause markers.
 * Pauses of 8+ seconds are marked so Claude understands the stream's rhythm.
 */
function buildTranscript(segments: TranscriptSegment[]): string {
  const lines: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    lines.push(`[${toSeconds(seg.start)}-${toSeconds(seg.end)}] ${seg.text}`);
    if (i < segments.length - 1) {
      const gap = segments[i + 1].start - seg.end;
      if (gap >= 8) {
        lines.push(`--- ${Math.round(gap)}s pause ---`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Snap a peak's boundaries to the nearest utterance boundaries.
 * Prevents clips from starting/ending mid-sentence.
 * If the timestamp falls in a gap between utterances, finds the closest one.
 * Caps expansion at MAX_SNAP_DRIFT seconds to prevent clips ballooning over speech gaps.
 */
function snapToUtteranceBoundaries(peak: Peak, segments: TranscriptSegment[]): Peak {
  if (segments.length === 0) return peak;

  const MAX_SNAP_DRIFT = 10; // never push a boundary more than 10s from Claude's pick

  // Find the nearest utterance start at or before peak.start (within drift limit)
  let snappedStart = peak.start;
  let bestStartDist = Infinity;
  for (const seg of segments) {
    if (seg.start <= peak.start) {
      const dist = peak.start - seg.start;
      if (dist < bestStartDist && dist <= MAX_SNAP_DRIFT) {
        bestStartDist = dist;
        snappedStart = seg.start;
      }
    }
  }
  // If nothing was before peak.start within drift, find the closest utterance after (within drift)
  if (bestStartDist === Infinity) {
    for (const seg of segments) {
      const dist = Math.abs(seg.start - peak.start);
      if (dist < bestStartDist && dist <= MAX_SNAP_DRIFT) {
        bestStartDist = dist;
        snappedStart = seg.start;
      }
    }
  }

  // Find the nearest utterance end at or after peak.end (within drift limit)
  let snappedEnd = peak.end;
  let bestEndDist = Infinity;
  for (const seg of segments) {
    if (seg.end >= peak.end) {
      const dist = seg.end - peak.end;
      if (dist < bestEndDist && dist <= MAX_SNAP_DRIFT) {
        bestEndDist = dist;
        snappedEnd = seg.end;
      }
    }
  }
  // If nothing was after peak.end within drift, find the closest utterance before (within drift)
  if (bestEndDist === Infinity) {
    for (const seg of segments) {
      const dist = Math.abs(seg.end - peak.end);
      if (dist < bestEndDist && dist <= MAX_SNAP_DRIFT) {
        bestEndDist = dist;
        snappedEnd = seg.end;
      }
    }
  }

  // Enforce max clip duration (90s) — trim end if snap expanded too much
  const MAX_CLIP_DURATION = 90;
  if (snappedEnd - snappedStart > MAX_CLIP_DURATION) {
    snappedEnd = snappedStart + MAX_CLIP_DURATION;
  }

  if (snappedEnd - snappedStart >= 15) {
    return { ...peak, start: snappedStart, end: snappedEnd };
  }
  return peak;
}

/**
 * Deduplicate peaks that overlap — when two peaks start within `thresholdSeconds`
 * of each other, keep the higher-scored one. This handles overlapping chunks
 * detecting the same moment independently.
 */
function deduplicatePeaks(peaks: Peak[], thresholdSeconds: number): Peak[] {
  const sorted = [...peaks].sort((a, b) => b.score - a.score);
  const kept: Peak[] = [];
  for (const peak of sorted) {
    const isDuplicate = kept.some(
      (k) => Math.abs(k.start - peak.start) < thresholdSeconds
    );
    if (!isDuplicate) kept.push(peak);
  }
  return kept;
}

/**
 * Calculate words per minute for a set of segments.
 */
function calcWPM(segs: TranscriptSegment[]): number {
  if (segs.length < 2) return 0;
  const totalWords = segs.reduce((sum, s) => sum + s.text.split(" ").length, 0);
  const durationMin = (segs[segs.length - 1].end - segs[0].start) / 60;
  return durationMin > 0 ? Math.round(totalWords / durationMin) : 0;
}

/**
 * Extract transcript lines around each detected peak.
 * Gives the coach context about what was actually happening at the best moments.
 */
function buildPeakContextWindows(peaks: Peak[], segments: TranscriptSegment[]): string {
  if (peaks.length === 0) return "";

  const lines: string[] = [];
  // Show context around the top 4 peaks max to keep prompt size reasonable
  for (const peak of peaks.slice(0, 4)) {
    const windowStart = Math.max(0, peak.start - 50);
    const windowEnd = peak.end + 35;
    const window = segments.filter((s) => s.start >= windowStart && s.start <= windowEnd);
    if (window.length === 0) continue;
    lines.push(`--- Peak context: "${peak.title}" at ${formatTime(peak.start)} (score: ${peak.score.toFixed(2)}) ---`);
    window.forEach((s) => lines.push(`[${formatTime(s.start)}] ${s.text}`));
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Analyze a transcript with Claude to find peak/viral moments.
 * Returns scored peaks with clip boundaries, captions, and scroll-stopping hooks.
 */
function buildPeakDetectionPrompt(vodTitle: string, transcript: string, chatPulse?: string): string {
  return `You are selecting clips from a Twitch VOD transcript for TikTok and YouTube Shorts. Your job is to find moments that will stop someone mid-scroll — someone who has never seen this streamer before and has no loyalty to them.

Stream title: "${vodTitle}"

Timestamped transcript (--- Xs pause --- marks significant silences):
${transcript}

${chatPulse ? chatPulse + "\n" : ""}

━━━ WHAT MAKES A CLIP GO VIRAL ━━━

Every clip that performs has THREE things:
1. A HOOK in the first 2-3 seconds that creates an open loop or instant reaction ("wait, what is happening?")
2. A BUILD — rising tension, escalating energy, or a setup that makes you lean in
3. A PAYOFF — the reaction, the punchline, the win, the loss, the moment that releases the tension

If a moment has all three, it is a clip. If it is missing any one of them, it is not.

━━━ THE 8 CLIP ARCHETYPES — match every moment to one ━━━

1. HYPE — The "LET'S GO" moment. Energy spike, celebration, win, clutch play. Fast speech, exclamations, repeating words ("yes yes yes", "let's go let's go"). Viewer reaction: "that was insane."
   Viral trigger: people share things that made them feel excited.

2. COMEDY — Unexpected twist, absurd observation, self-aware joke, timing that lands perfectly. The streamer is either the punchline or delivers one. Viewer reaction: "I'm dead."
   Viral trigger: people share things that made them laugh out loud.

3. RAGE/TILT — Genuine frustration, salt, disbelief at the game or a situation. NOT performed anger — real emotional response. The best rage clips follow a 3-stage arc: (1) TRIGGER — something specific happens that starts the frustration; (2) ESCALATION — mounting frustration, shorter sentences, word repetition, the streamer narrating their own tilt ("I'm actually tilting right now", "this is genuinely griefing", "I'm going insane", "I'm cooked"); (3) PEAK + AFTERMATH — the explosion, then either self-aware laughter at themselves or continued escalation. The AFTERMATH is critical — the moment the streamer laughs at themselves or decides to keep going anyway is the most human part and what gets shared. A clip that catches all three stages beats a clip that catches only the peak. Viewer reaction: "this is literally me."
   Viral trigger: extreme relatability — everyone has felt this exact feeling, and the aftermath makes it safe to laugh about.

4. CLUTCH — High-stakes moment that looked LOST then flipped. CRITICAL: the clip MUST start at the worst point — the moment it looks most hopeless, most wrong, most over. If you start the clip after the clutch is already in progress, you lose the entire hook. The viewer needs to see the nadir first. Setup (it looks lost) → Build (it gets worse OR the streamer rallies) → Payoff (it works against all odds). Viewer reaction: "how did they do that."
   Viral trigger: people share survival and skill moments they want their friends to witness.

5. HOT TAKE — Bold opinion stated with conviction. Controversial read, unpopular opinion, calling something out. The streamer takes a real position, not a soft one. Viewer reaction: "I agree / I strongly disagree."
   Viral trigger: opinion content drives comments and shares.

6. STORY — Has a clear beginning, middle, and end inside the clip window. Setup establishes stakes, something happens, streamer reacts with resolution. Viewer reaction: "wait what happened next."
   Viral trigger: narrative tension keeps people watching to the end.

7. EMOTIONAL — Genuine vulnerability, heartfelt moment, real connection with chat. NOT performed emotion — something the streamer actually feels. Viewer reaction: "this hit different."
   Viral trigger: authentic human moments are rare online and get shared.

8. KNOWLEDGE DROP — Explains something in a way that makes the viewer say "I never thought of it that way." A fast, confident insight or strategy breakdown. Viewer reaction: "I learned something."
   Viral trigger: people share content that makes them look smart when they share it.

━━━ VERBAL SIGNALS — scan for these patterns ━━━

HIGH-CONFIDENCE clip signals (almost always a clip):
- Exclamations that open an utterance: "WAIT—", "NO—", "BRO—", "OH MY GOD—", "WHAT—", "NO WAY—", "YO—", "HOLD ON—"
- Word repetition with rising energy: "no no no no", "yes yes yes", "go go go", "wait wait wait"
- Laughter markers: "I'm dead", "I can't", "bro stop", "I'm crying", "I'm done"
- Conviction language: "real talk", "genuinely", "I actually think", "unpopular opinion", "nobody talks about this"
- Disbelief: "there is no way", "how is that even legal", "that is actually insane", "I'm not making this up"
- Story payoff signals: "and then—", "so what happened was—", "I kid you not"
- Self-roast or self-awareness: streamer laughing at their own mistake or calling themselves out
- TENSION-SNAP: a pause of 3-8 seconds (marked "--- Xs pause ---" in the transcript) immediately before a high-energy utterance. The silence is the setup — it signals something happened that left the streamer momentarily speechless before they exploded. This is especially powerful as the clip's opening hook. Do NOT discard this pattern as "dead air" — it is the calm before the storm and viewers feel it.

MEDIUM-CONFIDENCE signals (needs context check):
- Rhetorical questions with stakes: "why would you ever—", "who decided that—"
- Escalating commentary during gameplay: pace quickens, sentences get shorter
- Direct address to chat with emotion: "chat did you see that", "chat I'm not okay"

NOT a clip (skip immediately):
- Flat narration: "ok so", "alright", "let me", "now I'm going to"
- Reading donations or subs without a reaction that stands alone
- Explaining game mechanics with no emotional hook
- Any moment where speech is slow, low-energy, or monotone
- Extended silence (5+ seconds) in the MIDDLE of the clip with no setup function — dead air that kills momentum mid-arc. Exception: a silence at the START of the clip that serves as a tension-snap hook (see HIGH-CONFIDENCE above) is not dead air — it IS the hook.
- Moments that need 10+ minutes of context to understand why they matter

━━━ SCORING ━━━

Be harsh. Most streams have 1-3 real clips. Padding with weak moments makes the product look bad.

- 0.85-1.0: Mid-scroll stopper. Hook is immediate. No context needed. Universal emotion. Could perform on any account.
- 0.70-0.84: Strong clip. Clear arc, clear payoff. Works standalone with minor context.
- 0.60-0.69: Decent clip. Has a genuine moment but hook is softer or needs mild context.
- Below 0.60: Do not include.

Ask yourself for every candidate: "Would I stop scrolling for this if I had never heard of this streamer?" If the honest answer is no, the score is below 0.60.

CHAT PULSE SCORING: If a chat pulse section is present in the input above, match its timestamps to your clip candidates. Any clip whose window overlaps a notable chat activity spike earns +0.05 to +0.10 to its score. Chat spikes are the most reliable external signal that a moment actually landed with a live audience — even a verbally understated moment that lit up chat is worth more than a high-energy moment that got no response. A chat spike with no obvious verbal signal is a high-priority candidate: something happened that the streamer may have undersold.

━━━ CLIP BOUNDARIES — CRITICAL ━━━

Your timestamps MUST match utterances in the transcript exactly. Do not estimate.

Step by step:
1. Find the PAYOFF utterance — the exact line where the peak moment lands
2. Find the BUILD — go back 2-4 utterances to where the setup begins
3. Set START = timestamp of the first utterance of the build
4. Set END = timestamp 1-2 utterances after the payoff (let the reaction breathe)
5. Check: does the clip arc have setup, build, and payoff within your start/end window? If not, adjust.

Duration: 30-90 seconds. Sweet spot is 45-75 seconds.
Never cut mid-utterance. Land on complete sentences.
Timestamps are plain seconds (e.g. 234 = 234 seconds into the stream).
Output start and end as plain integers. Minimum clip: 20 seconds.
No emojis. Clean text only.

TIGHTNESS CHECK — before finalizing each clip, ask: "Can I trim 5-10 seconds from the front without losing the hook or context?" Start the clip at the FIRST moment a stranger would feel something — confusion, curiosity, or energy — not the first moment of calm setup narration. A 40s clip that hooks in 2 seconds beats a 65s clip with 20s of context preamble. Trim aggressively from the front. Be more generous at the end — let the reaction breathe.

━━━ NO QUOTES — GLOBAL RULE (CRITICAL) ━━━

You are working from a machine transcript that may mishear words, merge utterances, or miss speech entirely. Putting the wrong words in the streamer's mouth on a public TikTok title or caption is catastrophic — it makes the whole product look dishonest. Therefore:

- NEVER put the streamer's words in quotation marks in ANY field (title, caption, hook, reason). No single quotes, no double quotes, no backticks around dialogue. Zero exceptions.
- NEVER use em dashes (—) in any field. Use a period or rewrite the sentence.
- NEVER paraphrase what the streamer said as if it were a direct statement (e.g. "streamer says he hates the new patch"). Describe the moment, not the words.
- If you are tempted to quote, describe the ACTION and EMOTION instead: "a rage outburst after the team wipe", "a blunt hot take on the new meta", "a clutch reaction when the round flipped".
- When in doubt — and you should be in doubt often — DO NOT QUOTE. Omit the dialogue entirely and lean on the arc/emotion. A vague-but-true description beats a confident-but-wrong quote every time.
- Titles must read like TikTok titles but NEVER be a fabricated quote. "The clutch that should not have worked" is good. "\"I can't believe that worked\" — clutch finish" is banned.
- Captions describe the moment and tease the payoff. They do NOT narrate what the streamer said.
- Hook field: describe what HAPPENS (a reaction, a tone shift, a visible spike in energy) — never what is SAID word-for-word.

If this rule conflicts with anything else above, this rule wins.

━━━ OUTPUT FORMAT ━━━

Respond with ONLY a JSON array. No markdown, no code fences, no explanation.

[
  {
    "title": "<hook-style title under 60 chars — reads like a TikTok title, not a label. NEVER a quote. Describe the moment, not the words.>",
    "start": <integer seconds — exact utterance timestamp from transcript>,
    "end": <integer seconds — exact utterance timestamp from transcript>,
    "score": <0.0-1.0>,
    "category": "<hype | funny | rage | clutch | hot_take | story | emotional | educational>",
    "reason": "<2-3 sentences: what is the arc, what emotional beats anchor it, why a stranger would care. No quoted dialogue.>",
    "hook": "<describe what a stranger SEES/HEARS happening in the first 2-3 seconds — a laugh, a sudden shout, an energy spike, a shocked pause. Never word-for-word dialogue. No em dashes.>",
    "caption": "<TikTok/Shorts caption under 150 chars. Use one of these proven formats: (1) Relatability: 'when the game does this to you 💀' or 'POV: [specific situation]'; (2) Escalation tease: 'it started as [mild thing] then...'; (3) Statement hook: '[what happened] and I am not okay'. Hashtags at the end only — 3-4 max. Never quote the streamer. HASHTAG RULE: only use the specific game name as a hashtag if it appears verbatim in the stream title. Use #gaming #Twitch #clutch #PVP #FPS etc. instead of a game you are not certain of.>"
  }
]

Return 1-6 clips sorted by score descending. Fewer great clips beats more mediocre ones every time.`;
}

async function runPeakDetection(
  anthropic: Anthropic,
  vodTitle: string,
  segments: TranscriptSegment[],
  chatPulse?: string
): Promise<Peak[]> {
  const transcript = buildTranscript(segments);

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `You are a senior clip editor who has spent years cutting Twitch VODs into viral TikToks and YouTube Shorts. You know the difference between a moment that excites the streamer's existing fans and a moment that will stop a complete stranger mid-scroll. You think in terms of clip arcs — setup, build, payoff — and you are ruthless about quality. You would rather return two perfect clips than six mediocre ones. You understand that the first 2-3 seconds of a clip determine everything, and you select boundaries with surgical precision so every clip starts on a hook and ends on a resolution.`,
    messages: [{ role: "user", content: buildPeakDetectionPrompt(vodTitle, transcript, chatPulse) }],
  }), 3, 1000);

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const peaks: Peak[] = JSON.parse(cleaned);
    return peaks
      .filter((p) => p.start >= 0 && p.end > p.start && p.score >= MIN_PEAK_SCORE)
      .map((p) => snapToUtteranceBoundaries(p, segments));
  } catch {
    console.error("Failed to parse Claude peak response:", text);
    return [];
  }
}

// How long each transcript chunk is when splitting long VODs.
const CHUNK_SECONDS = 20 * 60;

// Overlap between adjacent chunks so moments on boundaries aren't split.
const CHUNK_OVERLAP = 2 * 60;

// Maximum peaks returned per VOD.
const MAX_PEAKS = 6;

// Top candidates to consider during the re-ranking pass on long VODs.
const RERANK_CANDIDATE_LIMIT = 18;

// Minimum virality score. 0.60 = decent clip with some context.
const MIN_PEAK_SCORE = 0.60;

export async function detectPeaks(
  segments: TranscriptSegment[],
  vodTitle: string,
  chatPulse?: string
): Promise<Peak[]> {
  const anthropic = new Anthropic();

  // Strip non-streamer voices (game NPCs, co-streamers, background audio)
  // before sending to Claude — only analyze what the streamer actually said
  segments = filterDominantSpeaker(segments);

  const vodDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;

  if (vodDuration <= CHUNK_SECONDS + 5 * 60) {
    const peaks = await runPeakDetection(anthropic, vodTitle, segments, chatPulse);
    return peaks.sort((a, b) => b.score - a.score).slice(0, MAX_PEAKS);
  }

  // Build overlapping chunks so moments on boundaries aren't lost.
  // Each chunk overlaps the next by CHUNK_OVERLAP seconds.
  const chunks: TranscriptSegment[][] = [];
  let chunkStart = 0;
  while (chunkStart < vodDuration) {
    const chunkEnd = chunkStart + CHUNK_SECONDS;
    chunks.push(segments.filter((s) => s.start >= chunkStart && s.start < chunkEnd));
    chunkStart += CHUNK_SECONDS - CHUNK_OVERLAP;
  }

  const allPeaks: Peak[] = [];
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const peaks = await runPeakDetection(anthropic, vodTitle, chunk, chatPulse);
    allPeaks.push(...peaks);
  }

  // Deduplicate peaks from overlapping regions — if two peaks start within 30s
  // of each other, keep the one with the higher score
  const deduped = deduplicatePeaks(allPeaks, 30);

  const topCandidates = deduped
    .sort((a, b) => b.score - a.score)
    .slice(0, RERANK_CANDIDATE_LIMIT);

  if (topCandidates.length <= MAX_PEAKS) {
    return topCandidates;
  }

  const candidateSummary = topCandidates
    .map((p, i) => `${i + 1}. [${formatTime(p.start)}-${formatTime(p.end)}] "${p.title}" (score: ${p.score.toFixed(2)}) — ${p.reason}`)
    .join("\n");

  const rerankResponse = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `You are a viral content strategist selecting the best clips from a Twitch stream for TikTok. You are ruthlessly selective — you would rather return fewer clips than include mediocre ones.`,
    messages: [{
      role: "user",
      content: `From these ${topCandidates.length} candidate clips, pick the BEST ${MAX_PEAKS} (or fewer if quality drops off) for TikTok.

SELECTION CRITERIA — in order of importance:
1. Works standalone with ZERO context — a stranger who never watched this streamer would still care
2. Strong hook in the first 3 seconds — exclamation, reaction, or unexpected statement
3. Clear emotional payoff — the clip builds to something and delivers
4. The "reason" describes a genuine peak moment, not just normal conversation

REJECT candidates where:
- The reason describes normal conversation or generic commentary, not a real reaction
- The moment only matters with full stream context
- The streamer sounds flat or monotone based on the description
- The score is barely above 0.60 and the reason is weak

Return ONLY a JSON array of their 1-based numbers, e.g. [2, 5, 7, 11, 14, 16]. No explanation.

Candidates:
${candidateSummary}`,
    }],
  }), 3, 1000);

  try {
    const rerankText = rerankResponse.content[0].type === "text" ? rerankResponse.content[0].text : "";
    const cleaned = rerankText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const indices: number[] = JSON.parse(cleaned);
    return indices
      .filter((i) => i >= 1 && i <= topCandidates.length)
      .map((i) => topCandidates[i - 1])
      .slice(0, MAX_PEAKS);
  } catch {
    return topCandidates.slice(0, MAX_PEAKS);
  }
}


export interface CoachReport {
  overall_score: number;
  streamer_type: "gaming" | "just_chatting" | "irl" | "variety" | "educational";
  energy_trend: "building" | "declining" | "consistent" | "volatile";
  strengths: string[];
  improvements: string[];
  best_moment: { time: string; description: string };
  recommendation: string;
  next_stream_goals: string[];
  viewer_retention_risk: "low" | "medium" | "high";
  cold_open: { score: "strong" | "weak" | "average"; note: string };
  // Closing score — mirrors cold_open for how the stream ended. Optional
  // because historical reports predate this field.
  closing?: { score: "strong" | "weak" | "average"; note: string };
  // Detected growth-killing behaviors in the transcript — each MUST include
  // a real quote from the transcript as proof. Empty array is preferred over
  // false positives.
  anti_patterns?: Array<{
    time: string;
    type:
      | "viewer_count_apology"
      | "follow_begging"
      | "lurker_shaming"
      | "pre_stream_drain"
      | "self_defeat";
    quote: string;
    note: string;
  }>;
  // One screenshot-worthy stat or observation from this stream. Something the
  // streamer would feel good sharing on Twitter/Discord.
  shareable_win?: { stat: string; context: string };
  dead_zones?: Array<{ time: string; duration: number }>;
  // 2-4 sentence narrative summary of what this stream was about — shown before scores
  stream_story?: string;
  // 1-2 sentences on the viewer community this content attracts and whether this stream served them
  community_note?: string;
  // Component breakdown — 4 sub-scores that feed into overall_score
  score_breakdown?: {
    energy: number;      // 0-100: speaking energy, pacing, WPM consistency
    engagement: number;  // 0-100: chat interaction, personality, reactions
    consistency: number; // 0-100: sustained quality vs. crashes and dead zones
    content: number;     // 0-100: content quality, originality, opinion strength
  };
  // Longitudinal coaching — populated when prior stream history is available
  trend_vs_history?: {
    direction: "improving" | "declining" | "consistent" | "first_stream";
    note: string; // 1-2 sentences referencing specific prior streams
  };
  // The single worst energy crash in the stream — what happened and when
  momentum_crash?: {
    time: string;
    duration_min: number;
    note: string;
  };
  // Computed metric: average wpm during active speech windows only (excludes gaps)
  commentary_density?: number;
}

/** Summary of a prior stream used for longitudinal coaching context. */
export interface PriorCoachSummary {
  date: string;          // ISO date string
  score: number;
  recommendation: string;
  top_improvement: string;
}

const CATEGORY_COACHING_GUIDE: Record<string, string> = {
  gaming: `GAMING STREAMER COACHING STANDARDS:

WHO WATCHES GAMING STREAMS AND WHAT THEY WANT:
Gaming viewers chose this stream over thousands of others playing the same game. That means they're there for the PERSONALITY attached to the gameplay, not just the gameplay. They clip and share hype, rage, and funny moments — they're your natural marketing department if you give them material. They follow streamers who have strong opinions on the game (patches, meta, other players, design choices) because it gives them something to agree or argue with. Competitive game viewers respect skill and call out bad play bluntly. Story/RPG game viewers want genuine discovery — they want to feel the story through you. Cozy game viewers want warmth and parasocial comfort. Know which of these you're curating and lean into it — the chat will reflect back exactly what you give them. A passionate opinionated gaming chat is built by a passionate opinionated streamer.

WHAT TO GIVE YOUR COMMUNITY: Strong takes on the game. Genuine vocal reactions that let them feel the stakes. Running commentary that adds personality on top of what's on screen — not narrating the obvious, but adding your lens to it. Make your regulars feel rewarded with callbacks and inside jokes. Make new viewers feel welcomed with brief context. The community you build will clip moments that match your energy — give them the energy worth clipping.

THE CHAT LOOP IN GAMING: Gaming chat becomes addictive when the streamer and chat are in a feedback loop — streamer makes a big play, chat explodes, streamer feeds off that energy and escalates, chat gets louder. When this loop is firing, viewers feel like they're part of the hype, not watching it. They come back because they want to be IN that room again. A gaming streamer who ignores chat during big moments breaks this loop and makes chat feel like an audience, not a stadium.

COMMENTARY: The commentary IS the content — not just narrating what's on screen, but adding personality, prediction, and emotion on top of it. Silence during intense gameplay is fine. Silence during downtime is dead content.

OPINIONS ON THE GAME: Big gaming streamers share strong opinions constantly — on patches, meta, other streamers' decisions, bad design, what the game gets right. Opinion-driven commentary creates clips and debate. A streamer who just plays without a point of view is invisible.

HYPE ARCHITECTURE: Top streamers manufacture peaks — they verbally escalate tension before a big play, they announce stakes before a clutch moment, they set up the story before something pays off. Average streamers just react after the fact.

TRANSITIONS & DOWNTIME: Loading screens, queue waits, and game deaths are when great gaming streamers build community — personal stories, asking chat for hot takes, giving opinions on the meta. These moments separate 1k streamers from 100-viewer streamers.

FAILURE FRAMING: The best gaming streamers are entertaining whether winning or losing because they frame both as stories. Self-deprecating humor in failure, genuine rage that becomes a bit, analysis of what went wrong — all of these keep viewers invested when the game isn't going well.

CHAT AS STADIUM: Treat chat like a crowd watching a live event. Big moments are announced with energy. Low moments are narrated with drama. The streamer creates the emotional arc, not just the game.

WHAT TO LOOK FOR: Is commentary adding personality or narrating the obvious? Are dead moments being used for community building? Are they sharing opinions that create debate? Did they build to moments or just react? Are they making failure entertaining? Is the advice calibrated to the specific type of gaming community (competitive, story, cozy) this title suggests?`,

  just_chatting: `JUST CHATTING STREAMER COACHING STANDARDS:

WHO WATCHES JUST CHATTING STREAMS AND WHAT THEY WANT:
Just chatting viewers have explicitly chosen a personality over any content. They're not here for information or gameplay — they're here for THIS person. That's both the highest ceiling and the hardest room to keep. These viewers are parasocial by nature — they feel like they know the streamer personally, they defend them in other communities, they come back daily. They clip and share hot takes, debate moments, and vulnerable personal stories. They have zero tolerance for filler — if there's no personality driving the conversation, they leave within minutes. They are the most loyal community type if you earn it, and the most fickle if you don't. They WANT to feel like they're hanging out with a friend who has a point of view on everything. Their chat WILL reflect the streamer's energy exactly — a flat detached streamer gets a flat detached chat. An opinionated passionate streamer gets a chat that argues, defends, and clips everything.

WHAT TO GIVE YOUR COMMUNITY: Unfiltered personality. Real stories with stakes. Opinions they can agree with or push back on. Remember their regulars by name — these viewers become your loudest advocates when they feel seen. The just chatting community grows through word-of-mouth, clips, and genuinely entertaining moments — not discoverability. Give them content worth talking about.

THE CHAT LOOP IN JUST CHATTING: This community type lives and dies by the parasocial bidirectional relationship. It works like this: streamer shares something real → chat responds personally → streamer acknowledges a specific person → that person feels seen → they become a loyal regular → they bring others. The inverse kills it: streamer talks at chat → chat sends generic responses → streamer reads them generically → nobody feels part of anything → they lurk and eventually leave. Just chatting streamers who make specific chatters feel genuinely known create the most addictive communities on Twitch — people come back because they feel like they exist there.

RADICAL AUTHENTICITY: Performed emotions or polished delivery kills just chatting. The most growth comes from unfiltered genuine personality — uncertainty, contradictions, oversharing. Viewers follow because it feels real.

OPINION DENSITY: Hot takes create organic clip spread. A strong opinion — even controversial — generates debate, sharing, and return visits. Streamers who avoid controversy avoid organic growth. The question to ask: did they say anything that someone would screenshot and argue about?

STORYTELLING STRUCTURE: Top just chatting streamers don't just talk — they build stories with a premise, escalation, and payoff. "So this actually happened to me…" → setup → build → reaction. Rambling without structure loses viewers even if the content is interesting.

CHAT AS CO-STAR: The best just chatting streamers turn chat messages into comedic material or debate partners. They argue with chatters, bring up a comment to make the room react, remember what a regular said last week. Chat shapes the stream.

PARASOCIAL DEPTH: Remembering regulars by name, referencing past streams, treating chat like a room of friends converts lurkers into loyals. Streamers who never build this relationship stay small.

CALLBACKS: Did they reference something from earlier in the stream or a past stream? Callbacks reward loyal viewers and create the sense that this streamer has a continuous world, not just isolated sessions.

WHAT TO LOOK FOR: Is genuine personality showing or is it a performance? Are they making strong takes that could generate debate? Are they building actual relationships with chat or just responding and moving on? Did any storytelling land or fall flat? Did they callback to anything?`,

  irl: `IRL STREAMER COACHING STANDARDS:

WHO WATCHES IRL STREAMS AND WHAT THEY WANT:
IRL viewers are vicarious adventurers — they're watching to experience places and situations they can't or won't themselves. They want to feel like they're on the adventure with the streamer. They clip unexpected moments, authentic stranger interactions, and genuine reactions to the environment. They're forgiving of technical hiccups but completely unforgiving of boredom — if the environment isn't being made interesting, they leave. IRL communities are some of the most reactive and engaged when it's working: they vote on decisions, they react to the environment in real time, they feel like co-pilots. When it stops working, they feel like they're watching someone walk around staring at their phone. The community the streamer builds is usually adventurous and opinionated — they'll push the streamer to do more, go further, engage more. Give them moments worth pushing for.

WHAT TO GIVE YOUR COMMUNITY: Make them feel like they're there. Narrate your thoughts out loud. Let them influence decisions. React genuinely to unexpected things — don't manage or dampen reactions. The IRL community wants to feel like the stream could go anywhere at any moment.

THE CHAT LOOP IN IRL: IRL chat is at its most addictive when it becomes a co-pilot — "chat voted and I went in, here's what happened." Viewers who influenced a decision feel ownership over what happens next. They come back to see the outcome of their suggestion, to see what happens when the streamer follows their advice. When IRL streamers ignore chat's input entirely, they break this ownership loop and viewers go from participants to passive watchers.

ENVIRONMENTAL NARRATION: The location is a co-character. Top IRL streamers narrate their environment and give the viewer a perspective, not just carry a camera. "What you're looking at is…" / "This place is wild because…" — they translate their environment into content.

INTERNAL MONOLOGUE: Narrating internal thoughts in real time creates intimacy and makes the viewer feel inside the streamer's head. "I'm actually nervous about this" / "I don't know if I should go in" — this is the IRL version of hype architecture.

STRANGER INTERACTIONS: Natural conversations that go somewhere unexpected beat scripted interactions every time. Did they engage anyone? Did it go somewhere real or did they bail early?

UNSCRIPTED REACTIONS: Genuine unscripted reactions are the content. Managing or dampening these kills them. The best IRL moments are when something unexpected happens and they let themselves react fully.

CHAT AS COMPANION: Did they loop chat in? "Chat should I go in?" / "Chat what do you think of this?" — making chat feel like they're on the adventure with the streamer.

WHAT TO LOOK FOR: Is the viewer getting a genuine perspective on the environment? Are internal thoughts being narrated? Did any stranger interaction go somewhere real? Is chat being treated as a companion or ignored?`,

  variety: `VARIETY STREAMER COACHING STANDARDS:

WHO WATCHES VARIETY STREAMS AND WHAT THEY WANT:
Variety viewers have self-selected for the person, not the content. They usually found this streamer through a specific game or moment and decided to follow the person regardless of what they play. That means they're generally loyal, but they also need to be constantly reminded WHY they followed — the consistent personality and values that make this streamer recognizable no matter what's on screen. New viewers landing on a variety stream have no game anchor, so they need to feel the personality immediately or they leave. Variety communities are often long-term fans who feel invested — they discuss the streamer's opinions on games, they debate game choices, they react to transitions. They clip moments that show the streamer's personality more than gameplay peaks. The risk: without a consistent identity, the community becomes a scattered group who each like different game eras of the streamer and don't cohesively grow together.

WHAT TO GIVE YOUR COMMUNITY: A consistent voice they can recognize in any game. Bring them along explicitly through transitions. Have opinions that carry across contexts — the streamer's perspective on games, life, and ideas is what binds the community, not any single game.

THE CHAT LOOP IN VARIETY: Variety communities bond over the streamer's reactions and opinions, not the game itself. The loop: streamer has a strong take on a new game → chat debates it → streamer engages the debate → viewers feel like their opinion matters in this community → they come back for the next game because they want to be part of that conversation again. Variety streamers who ignore chat's game opinions miss the one thing that makes their community coherent across different titles.

CONSISTENT PERSONALITY: The personality, not the game, is what viewers follow. Top variety streamers have a recognizable identity — a tone, a set of opinions, a reaction style — that's consistent whether they're playing an FPS or a cozy game. Did this stream show a clear personality, or did they just mold to whatever the current game demanded?

TRANSITION CRAFTSMANSHIP: Smooth transitions need narrative connective tissue. Top variety streamers bring chat along explicitly — "Alright we're done with that, I want to try something completely different" — not just switching without comment. Abrupt transitions reset momentum and lose new viewers.

OPINIONS ACROSS CONTEXTS: The best variety streamers have takes on everything — they'll share an opinion on the game they just switched away from, compare the two, or bring in outside context. This creates the sense that they're a personality, not just a game-switching machine.

ENERGY MANAGEMENT: Switching games can re-energize but can also reset momentum. Top variety streamers time switches to capitalize on energy highs or to escape energy lows strategically — they're intentional about it.

WHAT TO LOOK FOR: Is there a consistent personality recognizable across any game? Are transitions smooth with connective tissue? Would a new viewer understand who this person is regardless of what they're playing? Are they sharing opinions that carry over between games?`,

  educational: `EDUCATIONAL STREAMER COACHING STANDARDS:

WHO WATCHES EDUCATIONAL STREAMS AND WHAT THEY WANT:
Educational stream viewers are the most intentional audience on Twitch — they showed up to learn something specific, and they're impatient if they feel their time is being wasted. They're also the most likely to share content outside Twitch: clips go to YouTube, Reddit, Twitter, Discord servers. They deeply reward genuine expertise and punish overconfidence they can see through. Their engagement pattern is different from other communities: they ask questions, they push back on errors, they remember what was said in previous streams. They build real knowledge relationships with streamers they trust. The educational community grows through reputation — if the streamer is consistently right, helpful, and honest about uncertainty, word spreads. If they overclaim or waste time, that also spreads. These viewers are more forgiving of production quality but less forgiving of wasted time or wrong information.

WHAT TO GIVE YOUR COMMUNITY: Respect their time — have a clear direction for each stream and deliver on it. Be honest about uncertainty — "I'm not 100% sure, let me work through this" is content. Let chat push back and engage with corrections respectfully. These viewers want to learn WITH you, not just FROM you.

THE CHAT LOOP IN EDUCATIONAL: Educational chat becomes addictive when viewers feel like their questions and pushback shaped what was taught. The loop: viewer asks a question → streamer takes it seriously and builds on it → that viewer now owns part of the stream's direction → they come back because they feel like a contributor, not a student. When educational streamers dismiss or skip chat questions to stay on script, they break the one thing that separates them from a YouTube video: live interaction that shapes the content in real time.

TEACHING AS ENTERTAINMENT: Socratic method, real-time problem solving, genuine curiosity make learning feel like discovery. Dry lecture delivery drives viewers away. Did this stream feel like watching someone figure something out, or like a lecture?

ACCESSIBLE COMPLEXITY: Analogies and metaphors that make difficult topics click instantly. If a viewer needs background knowledge to follow along, most leave. Did they explain things in a way that a smart beginner could follow, or did they assume knowledge?

AUTHENTIC UNCERTAINTY: Acknowledging mistakes and confusion builds trust. Working through uncertainty live is more valuable than projecting false confidence. "I'm actually not sure about this, let me think through it…" is content. Bluffing through gaps loses the audience when they catch it.

STRUCTURED PAYOFFS: Top educational streamers give the viewer a destination upfront — "By the end of this I'm going to show you…" — and then deliver on it. Structure keeps retention high.

CHAT-DRIVEN PIVOTS: Letting chat questions steer the content creates investment and ownership. Did they respond to questions in a way that deepened the topic, or did they dismiss them to stay on script?

WHAT TO LOOK FOR: Is the teaching style engaging or dry lecture? Are complex topics made genuinely accessible? Is uncertainty handled authentically or faked? Did chat shape the direction at any point?`,
};

/** Compute per-minute WPM across the full stream. */
function buildEnergyMap(segments: TranscriptSegment[], vodDuration: number): { minute: number; wpm: number }[] {
  const totalMinutes = Math.ceil(vodDuration / 60);
  const result: { minute: number; wpm: number }[] = [];
  for (let m = 0; m < totalMinutes; m++) {
    const segs = segments.filter((s) => s.start >= m * 60 && s.start < (m + 1) * 60);
    result.push({ minute: m, wpm: calcWPM(segs) });
  }
  return result;
}

/**
 * Find the single worst energy crash: the longest contiguous run of low-wpm minutes.
 * Returns start/end minute, plus a short transcript excerpt from that window.
 */
function findMomentumCrash(
  energyMap: { minute: number; wpm: number }[],
  segments: TranscriptSegment[],
  lowThreshold = 60
): { startMin: number; endMin: number; excerpt: string } | null {
  if (energyMap.length < 3) return null;

  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (const { minute, wpm } of energyMap) {
    if (wpm < lowThreshold) {
      if (curStart === -1) curStart = minute;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }

  if (bestStart === -1 || bestLen < 2) return null;

  const winStart = bestStart * 60;
  const winEnd = (bestStart + bestLen) * 60;
  const winSegs = segments.filter((s) => s.start >= winStart && s.start < winEnd).slice(0, 8);
  const excerpt = winSegs.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n");

  return { startMin: bestStart, endMin: bestStart + bestLen, excerpt };
}

/** Render energy map as a compact ASCII sparkline for the prompt. */
function renderEnergySparkline(energyMap: { minute: number; wpm: number }[]): string {
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const maxWpm = Math.max(...energyMap.map((e) => e.wpm), 1);
  const line = energyMap.map(({ wpm }) => {
    const idx = Math.min(7, Math.floor((wpm / maxWpm) * 8));
    return blocks[idx];
  }).join("");
  return line;
}

/** Average WPM during active speech windows (excludes silent gaps). */
function calcCommentaryDensity(segments: TranscriptSegment[]): number {
  if (segments.length === 0) return 0;
  const totalWords = segments.reduce((sum, s) => sum + s.text.split(" ").length, 0);
  // Only count time the streamer was actually talking (sum of utterance durations)
  const speechSeconds = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const speechMin = speechSeconds / 60;
  return speechMin > 0 ? Math.round(totalWords / speechMin) : 0;
}

/**
 * Build problem-weighted transcript samples for the coach prompt.
 *
 * Strategy for long streams (>= 15 min):
 *   1. Opening — first 100 segments (always; cold-open quality + early vibe)
 *   2. Closing — last 80 segments (always; how the stream ended)
 *   3. Three worst-energy middle zones — 80 lines each, pulled from the
 *      5-minute blocks with the lowest average WPM between opening and closing.
 *      These are the dead spots the coach needs to see to give grounded advice.
 *
 * Total: ~340 lines (fewer tokens than the old even-5-sample approach, but
 * concentrated where the problems actually live instead of evenly spread).
 *
 * For short streams (< 15 min of energy data), falls back to 3 even sections
 * so short VODs still get full coverage without redundancy.
 */
function buildWeightedTranscriptSamples(
  segments: TranscriptSegment[],
  energyMap: { minute: number; wpm: number }[],
): string {
  const OPENING_LINES = 100;
  const BLOCK_LINES = 80;

  // Short-stream fallback: 3 even sections (opening/middle/closing)
  if (energyMap.length < 15) {
    const labels = ["Opening", "Middle", "Closing"];
    return Array.from({ length: 3 }, (_, i) => {
      const centerFraction = i / 2;
      const centerIdx = Math.floor(centerFraction * (segments.length - 1));
      const start = Math.max(0, centerIdx - Math.floor(OPENING_LINES / 2));
      const end = Math.min(segments.length, start + OPENING_LINES);
      const segsSlice = segments.slice(start, end);
      const wpm = calcWPM(segsSlice);
      const lines = segsSlice.map((s) => `[${formatTime(s.start)}] ${s.text}`);
      return `--- ${labels[i]} (${wpm} wpm) ---\n${lines.join("\n")}`;
    }).join("\n\n");
  }

  const sections: { label: string; text: string }[] = [];

  // 1. Opening
  const openingSegs = segments.slice(0, OPENING_LINES);
  sections.push({
    label: `Opening (${calcWPM(openingSegs)} wpm)`,
    text: openingSegs.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n"),
  });

  // 2. Closing
  const closingSegs = segments.slice(-BLOCK_LINES);
  sections.push({
    label: `Closing (${calcWPM(closingSegs)} wpm)`,
    text: closingSegs.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n"),
  });

  // 3. Worst-energy middle blocks
  const openingEndSec = openingSegs[openingSegs.length - 1]?.end ?? 0;
  const closingStartSec = closingSegs[0]?.start ?? (segments[segments.length - 1]?.end ?? 0);
  const BLOCK_SEC = 5 * 60;

  const middleBlocks: { startSec: number; avgWpm: number }[] = [];
  for (let t = openingEndSec; t + BLOCK_SEC < closingStartSec; t += BLOCK_SEC) {
    const blockSegs = segments.filter((s) => s.start >= t && s.start < t + BLOCK_SEC);
    if (blockSegs.length < 5) continue;
    middleBlocks.push({ startSec: t, avgWpm: calcWPM(blockSegs) });
  }

  // Take the 3 lowest-WPM blocks (worst dead zones)
  const worstBlocks = [...middleBlocks]
    .sort((a, b) => a.avgWpm - b.avgWpm)
    .slice(0, 3);

  for (const block of worstBlocks) {
    const blockSegs = segments
      .filter((s) => s.start >= block.startSec && s.start < block.startSec + BLOCK_SEC)
      .slice(0, BLOCK_LINES);
    if (blockSegs.length === 0) continue;
    const wpm = calcWPM(blockSegs);
    const tag = wpm < 80 ? "DEAD ZONE" : wpm < 110 ? "LOW ENERGY" : "quiet zone";
    sections.push({
      label: `${tag} at ${formatTime(block.startSec)} (${wpm} wpm)`,
      text: blockSegs.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n"),
    });
  }

  // Also include the 1 best-energy middle block so Claude can write
  // credible, specific strengths — not just problem-zone observations.
  const worstBlockStarts = new Set(worstBlocks.map((b) => b.startSec));
  const bestBlock = [...middleBlocks]
    .filter((b) => !worstBlockStarts.has(b.startSec))
    .sort((a, b) => b.avgWpm - a.avgWpm)[0];

  if (bestBlock) {
    const blockSegs = segments
      .filter((s) => s.start >= bestBlock.startSec && s.start < bestBlock.startSec + BLOCK_SEC)
      .slice(0, BLOCK_LINES);
    if (blockSegs.length > 0) {
      const wpm = calcWPM(blockSegs);
      sections.push({
        label: `PEAK ENERGY at ${formatTime(bestBlock.startSec)} (${wpm} wpm) — the stream's best stretch`,
        text: blockSegs.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n"),
      });
    }
  }

  // If no middle blocks found (very short gap between opening and closing), add even middle
  if (worstBlocks.length === 0) {
    const midStart = Math.floor(segments.length * 0.4);
    const midSegs = segments.slice(midStart, midStart + BLOCK_LINES);
    if (midSegs.length > 0) {
      sections.push({
        label: `Middle (${calcWPM(midSegs)} wpm)`,
        text: midSegs.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n"),
      });
    }
  }

  return sections.map((s) => `--- ${s.label} ---\n${s.text}`).join("\n\n");
}

/**
 * Generate an AI stream coaching report from a transcript and detected peaks.
 * Uses Sonnet for higher quality coaching feedback — this is the flagship feature.
 */
export async function generateCoachReport(
  segments: TranscriptSegment[],
  vodTitle: string,
  peaks: Peak[],
  priorReports?: PriorCoachSummary[],
  chatPulse?: string
): Promise<CoachReport | null> {
  const anthropic = new Anthropic();

  if (segments.length === 0) return null;

  // Strip non-streamer voices before analysis — same filter as peak detection
  segments = filterDominantSpeaker(segments);

  if (segments.length === 0) return null;

  const vodDuration = segments[segments.length - 1].end;
  const totalMinutes = Math.round(vodDuration / 60);

  // ── Full energy map (minute-by-minute WPM) — built first so sampling can use it ──
  const energyMap = buildEnergyMap(segments, vodDuration);
  const sparkline = renderEnergySparkline(energyMap);
  const sparklineLabel = energyMap
    .filter((e) => e.minute % 5 === 0)
    .map((e) => `${e.minute}m`)
    .join("   ");

  // ── Problem-weighted transcript samples (opening + closing + worst energy zones) ──
  const transcriptSamples = buildWeightedTranscriptSamples(segments, energyMap);

  // ── Peak context windows — transcript around each detected peak ──
  const peakContextBlock = buildPeakContextWindows(peaks, segments);

  // ── Dead air analysis ──
  interface DeadAirGap { start: number; end: number; duration: number }
  const deadAirGaps: DeadAirGap[] = [];
  let totalDeadAirSeconds = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap >= 10) {
      deadAirGaps.push({ start: segments[i - 1].end, end: segments[i].start, duration: Math.round(gap) });
      totalDeadAirSeconds += gap;
    }
  }
  const deadAirPct = vodDuration > 0 ? Math.round((totalDeadAirSeconds / vodDuration) * 100) : 0;
  const worstGaps = [...deadAirGaps].sort((a, b) => b.duration - a.duration).slice(0, 5);

  const deadAirSummary = deadAirGaps.length > 0
    ? `${deadAirGaps.length} silence gaps totaling ${Math.round(totalDeadAirSeconds / 60)}min (${deadAirPct}% of stream). Worst gaps: ${worstGaps.map((g) => `${formatTime(g.start)} (${g.duration}s)`).join(", ")}`
    : "No significant dead air detected.";

  // ── Overall speech stats ──
  const overallWPM = calcWPM(segments);
  const commentaryDensity = calcCommentaryDensity(segments);

  // ── Momentum crash — worst energy valley ──
  const crash = findMomentumCrash(energyMap, segments);
  const crashBlock = crash
    ? `MOMENTUM CRASH — worst dead zone (${crash.startMin}:00–${crash.endMin}:00, ${crash.endMin - crash.startMin} min at near-zero energy):
${crash.excerpt}`
    : "";

  // ── Prior stream history for longitudinal coaching ──
  const historyBlock = (priorReports && priorReports.length > 0)
    ? `PREVIOUS STREAM HISTORY (this streamer has been coached before — use this to spot patterns):
${priorReports.map((r, i) => `Stream ${i + 1} ago (${r.date}, score ${r.score}):
  Priority: ${r.recommendation}
  Top fix: ${r.top_improvement}`).join("\n")}

ANTI-REPETITION RULE — this is critical:
- Before writing each improvement, check if the same problem appeared in 2+ prior reports above.
- If yes: prefix that improvement with "RECURRING: " and be blunt — they have been told before.
- If no: this is a new finding from this stream — write it fresh, no prior-report language.
- Do NOT recycle prior reports' exact wording. If the same label would appear twice, drop the repeat.
- New problems visible only in this stream take priority over repeating history.
If this stream shows improvement on a past problem, note it in trend_vs_history — earned recognition matters.`
    : "";

  // ── Peaks summary for coaching context ──
  const peaksSummary = peaks.length > 0
    ? peaks.map((p) => `- "${p.title}" at ${formatTime(p.start)}–${formatTime(p.end)} [${p.category}, score: ${p.score.toFixed(2)}]\n  Why it works: ${p.reason}`).join("\n")
    : "No standout moments detected — the stream lacked clear viral peaks.";

  const categoryGuideBlock = Object.values(CATEGORY_COACHING_GUIDE).join("\n\n");

  const coachSystemPrompt = `You are a Twitch growth coach who is also a seasoned streamer yourself. You speak the language — you know what dead air feels like, what it means to go live cold, when chat is sleeping, when someone's in the zone vs grinding silent. Your feedback sounds like a knowledgeable streaming friend giving real talk, not a corporate consultant.

You are direct and honest. Your job is not to make the streamer feel good — it is to make them better. You use natural streaming culture language: dead air, chat sleeping, no hype, clipping moments, energy diff, grinding silent, lurker mode, going off, stream pacing.

VOICE RULES — non-negotiable:
- Write directly to the streamer as "you" and "your" everywhere except stream_story and community_note.
- Use contractions: it's, you're, didn't, wasn't, they're, that's, you've, don't.
- Short sentences. Hard cap: 15 words per sentence. If a sentence is longer, split it.
- No em-dashes to chain long thoughts. Use a period instead.
- Sound like a text message from a smart friend, not a film review.
- Never write "the streamer" in fields addressed to them — say "you".
- Never pad with filler. If you've made the point, stop. No "and that's the key" or "this is important" endings.

CORE PRINCIPLE: You watched this specific stream. You know what happened. Every piece of feedback references a real moment — a timestamp, a specific topic they talked about, a specific thing they did or didn't do. Generic advice that could apply to any streamer is useless and you never give it.

If you write a strength, you name the exact moment that showed it and tell them how to recreate it. If you write an improvement, you name when and where the problem showed up and give a fix that only makes sense for this specific stream.

CATEGORY COACHING STANDARDS — apply the section matching the streamer type you identify:
${categoryGuideBlock}`;

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3500,
    system: [
      {
        type: "text" as const,
        text: coachSystemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Review this Twitch stream and produce a coaching report the streamer can act on immediately.

IMPORTANT: This transcript has been pre-filtered using speaker diarization to include ONLY the streamer's voice. Game audio, NPC dialogue, music, and other speakers have already been removed. Every line you read is something the streamer actually said.

SILENCE CONTEXT — read this before judging dead air:
Dead air gaps in the transcript CAN mean the streamer was silent, BUT they can also mean:
- The streamer was watching content (a video, movie, short film, YouTube video) — silence during watch-alongs is NORMAL and expected. No one wants the streamer talking over every second of a video.
- The streamer had intro music/BRB screen playing while setting up — the first 3-5 minutes of a stream are setup time. Do NOT score this as a cold open problem. Reading chat, adjusting audio, warming up, sipping coffee before going into the bit is normal stream behavior. Judge the opening only from the moment the streamer is actively engaging.
- The streamer was in an intense gameplay moment where focus silence is natural (clutch plays, boss fights, tense situations).
- The game itself has cinematic cutscenes the streamer is watching.

Only flag silence as a real problem when the streamer SHOULD have been talking but wasn't — during downtime, between matches, during loading screens, or when chat is active and being ignored. Intentional silence during content consumption or intense gameplay is not dead air.

STREAM INFO:
- Title: "${vodTitle}"
- Duration: ${totalMinutes} minutes
- Commentary density: ${commentaryDensity} wpm (when actively speaking)

WPM TARGETS BY STREAMER TYPE — apply the range matching what you identify in Step 1:
- gaming:       120–160 wpm is normal; below 100 wpm = flat delivery
- just_chatting: 145–185 wpm is normal; below 120 wpm = flat delivery
- irl:           100–145 wpm is normal; below 80 wpm = flat delivery
- variety:       120–160 wpm is normal; below 100 wpm = flat delivery
- educational:   95–135 wpm is normal; below 80 wpm = flat delivery
(Commentary WPM measures active speech only — silence during gameplay or watchalongs does not count against this.)
- Overall stream pace (incl. gaps): ~${overallWPM} wpm
- Dead air: ${deadAirSummary}

ENERGY CURVE (minute-by-minute — each bar = 1 min, height = speaking energy):
${sparkline}
${sparklineLabel}

${crashBlock ? crashBlock + "\n" : ""}${historyBlock ? historyBlock + "\n" : ""}AI-DETECTED PEAK MOMENTS (the best clips the AI found):
${peaksSummary}

${peakContextBlock ? `TRANSCRIPT AT PEAK MOMENTS (read this carefully — this is the raw evidence for what made the best moments work or why moments are missing):
${peakContextBlock}` : ""}

${chatPulse ? chatPulse + "\n" : ""}STREAM TRANSCRIPT SAMPLES (problem-weighted — opening, closing, and worst-energy zones with wpm labels):
${transcriptSamples}

STEP 0 — FIND THE STREAM'S STORY (do this first, before anything else):
Read through the transcript and answer these questions internally — do not output the answers, but let them shape everything you write:
- What was this stream actually about? What was the main thing happening?
- What were the 2-3 pivotal moments — a big reaction, a turning point, a topic that lit up, a moment that fell flat?
- What would someone who missed the stream need to know to understand the feedback?
- What is the story arc — did it build somewhere, did something collapse, did something unexpected happen?
Every piece of feedback you write must connect back to this story.

STEP 1 — IDENTIFY STREAMER TYPE:
CRITICAL: The transcript above is voice-only — game audio, music, and NPC dialogue were stripped by speaker diarization before you saw it. A gaming stream WILL read like a monologue in the transcript because game sound is gone. Do NOT use transcript-only signals to decide if a game is being played.

Use the STREAM TITLE as the authoritative signal for gameplay:
- If the title names a specific video game (e.g. "Elder Scrolls Online", "FFXIV", "Genshin", "Minecraft", "WoW", "Fortnite", "Final Fantasy", "Dead by Daylight", etc.), the streamer_type is "gaming" — even if the transcript sounds conversational. Streamers talk over gameplay constantly; that's normal.
- If the title mentions multiple games or phrases like "variety", "game swap", "playing [X] then [Y]", use "variety".
- Only use "just_chatting" when the title itself indicates chat content (e.g. "Chill Chat", "Q&A", "Reacts", "Podcast", "Yapping") AND no specific game is named.
- "irl": title indicates outdoor/real-life content (e.g. "IRL walk", "Going out").
- "educational": title indicates tutorial/how-to content (e.g. "How to", "Guide", "Tutorial").

Classification rules:
- Title names a game → gaming (or variety if multiple) — this overrides any "sounds chatty" transcript vibe.
- Title is ambiguous/generic → fall back on transcript content.
- When in doubt between gaming and just_chatting, prefer gaming — variety streamers almost never stream pure chat.

CRITICAL — DO NOT HALLUCINATE GAME NAMES: If the stream title is ambiguous (e.g. "3v3s", "ranked grind", "late night stream", "session") and does not explicitly name a game, do NOT infer or name a specific game anywhere in your output — not in stream_story, not in feedback, not anywhere. Refer to "the game" or the game mode only. Naming the wrong game destroys report credibility instantly.

EVALUATION — work through ALL of these before writing a single word of feedback. Dead air gets AT MOST one improvement slot — the other two must come from the dimensions below:

1. ENERGY CURVE: Use the sparkline DATA only — this is a passive readout of WPM across the stream. Where did the graph drop to flat? Find the 1-2 worst drops and the 1 best high, and match those timestamps to the transcript to understand what was happening. This dimension is about READING what the data shows, not judging behavior.

2. DEAD AIR: Was silence intentional (gameplay, watchalong) or momentum loss? Only flag it if it genuinely hurt. One slot max — do not let this dominate.

3. OPINIONS & TAKES: Did the streamer share strong opinions? Hot takes on the game, meta, culture, or life? Or did they just narrate and react without a point of view? Big streamers are opinionated — they make people agree or disagree, and both are growth. If this stream was mostly neutral play-by-play with no strong take, that's worth flagging.

4. STORYTELLING & CALLBACKS: Did they tell any personal stories? Did they callback to earlier in the stream or a previous session? Callbacks ("remember when I said…", "like that time last week…") create continuity and make regulars feel rewarded. No callbacks = each stream feels disposable.

5. HYPE ARCHITECTURE: This is about INTENTIONAL BEHAVIOR — did they build to moments, or just react after the fact? Top streamers verbally escalate tension before a big play, set up bits with a premise, announce stakes before something happens. This is distinct from Energy Curve (which is raw WPM data) — a stream can have high WPM energy but zero intentional build-up, or low WPM but still manufacture moments well. Only flag this if you can see clear missed opportunities where they reacted instead of building.

6. TRANSITION HANDLING: What happened during loading screens, queue waits, game deaths, or menu time? These are when average streamers go quiet or ramble. Top streamers have a transition move — a story, a question for chat, a hot take. Did they use these moments or waste them?

7. CHAT SYMBIOSIS — THE BIDIRECTIONAL DANCE: This is one of the most important growth levers for small streamers and it's almost always missed. Chat and the streamer shape each other — the streamer's energy creates the chat's energy, and the chat's energy feeds back into the streamer. When this loop is working, it becomes addictive: viewers feel like they're PART of something, not watching something. They come back because they feel ownership of the stream.

What the loop looks like when it's working: streamer says something strong → chat reacts → streamer builds on that reaction → a specific chatter gets a moment → they feel seen → they tell people → they come back tomorrow.

What it looks like when it's broken: streamer reads a message → says "yeah lol" → moves on → chat feels like wallpaper → lurkers stay lurkers.

Look for:
- Did the streamer ever make a specific chatter feel genuinely seen (called by name, built a bit from their message, argued back, gave them a callback later)?
- Did the streamer's energy visibly lift when chat was active, and did chat's activity visibly lift when the streamer was on?
- Were there moments where the chat shaped the direction of the stream?
- Were there missed opportunities where chat was reacting and the streamer ignored or deflected?
- Does this stream feel like the chat would WANT to come back and participate, or like it doesn't matter whether they're there?

The goal isn't just reading chat — it's making individual chatters feel like they contributed to something. That's what builds the addiction. That's what makes the community.

8. AUDIENCE ONBOARDING: Did they ever acknowledge or welcome new viewers? Did they explain context ("so what I'm doing is…") or just play for their regulars? Streamers who never onboard new viewers have a ceiling on how big they can get.

9. VOCAL VARIETY: Based on the transcript, was their delivery flat and monotone (short statements, no escalation, no variation in sentence structure) or did it have range (long escalating sentences, sudden short punchy reactions, rhetorical questions to chat, building speculation)? Flat delivery kills retention even when the content is good.

10. PERSONALITY AUTHENTICITY: Were there moments where their real self came out — an unexpected reaction, an off-script thought, genuine frustration or joy? Or did the stream feel performed and safe? Vulnerability and imperfection are what get clipped and shared.

11. CLOSING ENERGY: How did the stream end? Did they build toward a finish (raid announcement, goal recap, memorable sign-off) or did it just fizzle? The last 10 minutes shapes whether a viewer comes back.

12. COMMUNITY CURATION: Based on the streamer type and what you can infer from the transcript — is the content actually serving the community this stream type attracts? What do viewers of THIS specific category want, and did this stream give it to them? Chats reflect the streamer — an engaged, opinionated, loyal community is built by a streamer who consistently gives them something to react to. If the stream is generic or safe, the community will stay small and passive. If there are specific moments where the streamer either nailed or missed what their community wants, name them.

13. HISTORY: If prior reports exist — specifically which problems are recurring vs. improved? Name the pattern directly.

DEAD AIR RULE: If dead air already appears as a strength (rare) or improvement, do NOT mention it again elsewhere. Repeating the same dimension in multiple fields is lazy coaching.

SCORING — calibrate honestly to what you actually observed. Do not compress scores into a default range. If the stream earns an 80, score it 80. If it earns a 45, score it 45:
- 85-100: Rare. High energy throughout, strong personality, opinionated delivery, great chat chemistry, multiple clip-worthy moments.
- 70-84: Solid. Clear strengths and 2-3 obvious fixes. Usually has opinions and some storytelling.
- 55-69: Average. Watchable but forgettable. Missing opinions, transitions, or chat depth.
- 40-54: Below average. Passive delivery, missed transitions, no real takes, or dead engagement.
- Below 40: Fundamentals need attention.

OUTPUT RULES:

NO QUOTES ANYWHERE — GLOBAL RULE: Do not reconstruct or quote what the streamer said word-for-word in any field. Not in cold_open, not in strengths, not in improvements, not in stream_story, not anywhere. You only see transcript samples — you will get words wrong and wrong words destroy the report's credibility. Describe what happened using timestamps and actions only. "At 3:12 the streamer had a rage outburst" — not "the streamer said 'holy shit I can't believe that'." This rule overrides everything else.

SOLE EXCEPTION — anti_patterns.quote: The quote field in anti_patterns entries is the one place exact transcript text is required. Pull the phrase verbatim from the transcript you were shown. If it does not appear in the transcript samples provided to you, do not flag the anti-pattern. Do not reconstruct from memory or paraphrase — the quote must be exactly as it appeared in the transcript. This exception applies ONLY to anti_patterns.quote and nowhere else.

- stream_story: 2 sentences max. What this stream was about and the one defining moment. No scores, no advice, no quoted words. If the title doesn't explicitly name a game, do not name one.
- community_note: 1 sentence. What this community wants and whether they got it. No quoted words.
- NEVER give generic advice. Every sentence must reference a specific timestamp or observable thing from this stream.
- Each improvement must come from a DIFFERENT evaluation dimension — never two improvements about the same issue. Dead air gets one slot max.
- Strengths: **2-3 word label** — name the exact moment at MM:SS, what the streamer did, and the specific behavior to repeat next stream. Limit: 30 words. Be precise — vague praise like "good energy" is useless. No quotes ever.
- Improvements: **2-3 word label** — what the problem was at MM:SS and the one-line fix. HARD LIMIT: 20 words. No quotes ever. If recurring, prefix with "RECURRING: ".
- Labels must sound like a fellow streamer. Dead air/energy: "Dead Air", "Silent Grind", "Energy Diff", "No Hype". Opinions: "No Take", "Playing It Safe". Storytelling: "No Callback", "No Setup". Transitions: "Dead Transition", "Wasted Downtime". Chat: "Chat Ignored", "Chat Wallpaper". Audience: "Audience Cold", "New Viewer Blind". Vocal: "Monotone Zone", "Flat Delivery". Hype: "Built That Up", "Let It Happen". Closing: "Cold Ending", "No Finish". NEVER: "Audience Disconnect", "Content Vacuum", "Viewer Arc".
- Best moment: write this like a coach reviewing game tape — (1) what was building before this moment that set it up, (2) the exact thing the streamer did at that second and why it landed, (3) how to engineer this intentionally on the next stream. 3 sentences. Actions and energy only — no reconstructed words.
- Recommendation: Lead with the insight, not a timestamp. 1-2 sentences. The single biggest lever. No quoted words.
- Goals (next_stream_goals): These are missions for the NEXT stream, not analysis of this one. Never use timestamps in goals. Goals describe a behavior to do or avoid in the next session. Each goal must be one clear sentence, specific enough to check off after the stream. Sound like a coach, not a report. No timestamps, no em dashes. Bad: "At 18:30 you went silent, so work on that." Good: "Pick one moment every 30 minutes to ask chat a direct question and wait for an answer."
- Cold open: evaluate from when the streamer STARTS actively engaging, not from the stream's timestamp 0. Settling in (reading chat, audio check, BRB screen, intro music, sipping coffee) is NOT a cold open problem — it's normal stream behavior. Score "strong" if they came in with clear energy and a hook once they started; "average" if they warmed up naturally into the stream; "weak" ONLY if they took more than 8 minutes to actually engage, opened with visibly negative/flat energy once engaged, or ignored active chat during the opening. Silence before they started engaging is never "weak". Note: 1 sentence describing what HAPPENED — no reconstructed quotes.
- Closing: score the last 5 minutes. Normal sign-off behavior (saying bye, thanking viewers, shouting out subs, hyping next stream) is NOT a closing problem. Score "strong" if they ended with energy, gratitude, and a clear next-stream hook; "average" if they wrapped up naturally; "weak" ONLY if they ended mid-content without warning, ended on visibly negative energy, complained about the stream as they ended, or trailed off silently. Note: 1 sentence describing what HAPPENED — no reconstructed quotes.
- Anti-patterns: scan the transcript for these 5 specific growth-killing behaviors and flag ONLY if you can produce an exact verbatim quote. Empty array is the correct output when none apply. DO NOT flag ambient negativity or interpretation — the quote must literally match the pattern's meaning.
  * viewer_count_apology: streamer apologizes for low viewers. Example quotes: "sorry it's just us today", "small crew today as usual", "I know it's just a few of you"
  * follow_begging: asks for follows/subs outside of a hype moment, or repeatedly. Example: "drop a follow if you're watching" said during low-energy section
  * lurker_shaming: complains about chat being quiet. Example: "chat is so dead today", "y'all are lurking hard", "why aren't you talking"
  * pre_stream_drain: low-energy negativity about streaming itself near the opening. Example: "I don't really want to be here", "I'm too tired for this", "why am I even streaming today"
  * self_defeat: self-deprecating statements about the streamer's own ability/growth. Example: "I'm not a good streamer", "I'll never grow", "nobody watches me anyway"
  Rules: every anti_patterns entry MUST include the exact verbatim quote from the transcript (not paraphrased, not reconstructed). If you cannot produce a real quote, do not flag. The quote field is the evidence — if it's wrong, the whole report loses trust. Note: 1 sentence of context (why it hurts, what was happening).
- Shareable win: one screenshot-worthy stat or observation the streamer would feel good sharing. Pull from real numbers (commentary density hit X wpm during Y, peak moment scored X/10, energy sustained above baseline for Z minutes) or one genuinely impressive moment described specifically. Must be real and verifiable from the data shown — no inflation. stat = the headline (under 80 chars). context = 1 sentence explaining it.
- score_breakdown: honest sub-scores 0-100 for energy, engagement, consistency, content.
- momentum_crash: describe the stretch, what was happening, what should have happened instead. No quoted words.
- trend_vs_history: only if prior history exists. Direct — "improving", "declining", or "consistent".
- No emojis. No padding. No filler.
- NO EM DASHES (—) anywhere in any field. Rewrite any sentence that would need one. Use a period, a comma, or split into two sentences instead.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "stream_story": "<2-4 sentences. The story arc of this stream — what happened, main turning points, overall vibe. No scores or advice. Written like a friend summarizing it.>",
  "community_note": "<1-2 sentences. Who watches this stream type, what they came for, and one specific thing this stream did or missed for that community.>",
  "overall_score": <integer 0-100>,
  "streamer_type": "<gaming | just_chatting | irl | variety | educational>",
  "energy_trend": "<building | declining | consistent | volatile>",
  "viewer_retention_risk": "<low | medium | high>",
  "score_breakdown": {
    "energy": <integer 0-100>,
    "engagement": <integer 0-100>,
    "consistency": <integer 0-100>,
    "content": <integer 0-100>
  },
  "cold_open": {
    "score": "<strong | average | weak>",
    "note": "<1 sentence about exactly what happened in the first 5 minutes>"
  },
  "closing": {
    "score": "<strong | average | weak>",
    "note": "<1 sentence about how the stream ended>"
  },
  "anti_patterns": [
    { "time": "<MM:SS>", "type": "<viewer_count_apology | follow_begging | lurker_shaming | pre_stream_drain | self_defeat>", "quote": "<exact verbatim phrase from the transcript>", "note": "<1 sentence of context>" }
  ],
  "shareable_win": {
    "stat": "<headline, under 80 chars — a real quotable stat or observation>",
    "context": "<1 sentence explaining why it's impressive>"
  },
  "strengths": [
    "**Label** — what you did at MM:SS and how to do more of it. Max 20 words. Use 'you'.",
    "**Label** — what you did at MM:SS and how to do more of it. Max 20 words. Use 'you'.",
    "**Label** — what you did at MM:SS and how to do more of it. Max 20 words. Use 'you'."
  ],
  "improvements": [
    "**Label** — what happened at MM:SS and the one fix. Max 20 words. Use 'you'.",
    "**Label** — what happened at MM:SS and the one fix. Max 20 words. Use 'you'.",
    "**Label** — what happened at MM:SS and the one fix. Max 20 words. Use 'you'."
  ],
  "best_moment": {
    "time": "<MM:SS>",
    "description": "<EXACTLY 3 sentences, max 20 words each. No em-dashes. Use 'you'. Sentence 1: what was building before (e.g. 'You'd been quiet for three minutes and chat was sitting still.'). Sentence 2: what you did at this moment and why it landed (e.g. 'Then you went on a run that built from setup into a payoff nobody saw coming.'). Sentence 3: how to engineer it next time (e.g. 'Frame the rivalry before the match starts so the trash talk has context when it hits.'). Actions only, no reconstructed words.>"
  },
  "recommendation": "<1-2 short sentences addressed to 'you'. Reference this specific stream. Most impactful change. No buildup. Use contractions.>",
  "next_stream_goals": [
    "<one sentence. A specific behavior to do next stream that fixes the biggest problem. No timestamps. No em dashes. Sounds like a coach, not a report. Use contractions.>",
    "<one sentence. A different behavior. Targets a different problem. No timestamps. No em dashes.>",
    "<one sentence. A different behavior. Targets a different problem. No timestamps. No em dashes.>"
  ],
  "momentum_crash": {
    "time": "<MM:SS of where the crash started>",
    "duration_min": <integer minutes the dead zone lasted>,
    "note": "<1-2 sentences: what was happening, why it died, what should have happened instead>"
  },
  "trend_vs_history": {
    "direction": "<improving | declining | consistent | first_stream>",
    "note": "<1-2 sentences referencing specific prior scores or problems if history exists, or 'First analyzed stream — no comparison available' if not>"
  }
}`,
      },
    ],
  }), 3, 1000);

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const report = JSON.parse(cleaned) as CoachReport;
    // Attach computed metrics directly — no need to re-derive from AI text
    report.commentary_density = commentaryDensity;
    if (worstGaps.length > 0) {
      report.dead_zones = worstGaps.map((g) => ({ time: formatTime(g.start), duration: g.duration }));
    }
    return report;
  } catch {
    console.error("Failed to parse coach report:", text);
    return null;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Used in transcript lines fed to Claude for peak detection.
// Plain integer seconds (e.g. "813s") avoids the M:SS colon being
// misread as a decimal point, which caused Claude to output start=13.33
// instead of start=813 — producing 0.1-second "clips" that fail validation.
function toSeconds(seconds: number): string {
  return `${Math.round(seconds)}s`;
}
