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
function buildPeakDetectionPrompt(vodTitle: string, transcript: string): string {
  return `Find the best moments to clip from this Twitch stream transcript for TikTok/short-form content.

Stream title: "${vodTitle}"

Timestamped transcript (--- Xs pause --- marks significant silences):
${transcript}

YOUR JOB: Find 3-6 moments where the streamer has a genuine strong reaction or says something compelling enough to stop a viewer mid-scroll. These need to hook someone in the first 3 seconds.

VERBAL PATTERNS THAT ALMOST ALWAYS MAKE GREAT CLIPS — actively look for these:
- Exclamations at the start of an utterance: "WAIT", "NO", "BRO", "OH MY GOD", "WHAT", "ARE YOU SERIOUS", "NO WAY", "YO"
- Repeated escalating words: "let's go let's go let's go", "no no no no", "wait wait wait", "oh oh oh"
- Genuine laughter: "haha", "I'm dead", "I can't", "I'm crying", "bro I'm done"
- Hot takes stated with conviction: "I actually think [strong opinion]", "real talk", "unpopular opinion", "nah [take]"
- Disbelief or shock: "I can't believe", "how is that even", "there's no way", "that is actually insane"
- Story setup with a clear payoff — buildup followed by a strong reaction
- Genuine frustration, rage, or hype clearly expressed out loud
- Anything where the streamer goes loud, fast, or emotional in their speech rhythm

WHAT IS NOT A CLIP — do NOT select these:
- Normal conversation that happens to mention an interesting topic but has no emotional peak or reaction
- Generic commentary or narration ("ok so now we're going to...", "alright let's see...")
- Moments that only make sense with full stream context — if a stranger wouldn't care, skip it
- Quiet moments, setup time, or intro segments — silence is not a clip
- Anything where the streamer sounds flat, tired, or monotone — energy is required
- Moments where the streamer is just reading chat or donations without adding personality

SOURCE QUALITY:
This transcript was pre-filtered using speaker diarization to include only the streamer's voice — game audio, music, and NPC dialogue have been removed. Every line is something the streamer actually said. If you still see anything that looks like scripted dialogue or song lyrics, skip it — it slipped through the filter.

SCORING — be harsh. Most streams only have 1-3 genuinely good clips. Do NOT inflate scores to fill the 3-6 range. If only 2 moments clear the bar, return 2. An honest empty list is better than 6 mediocre clips.
- 0.85-1.0: Stops mid-scroll. Strong hook in first 3 seconds, universal reaction, needs zero context.
- 0.70-0.84: Strong clip. Clear emotional peak with payoff, works standalone.
- 0.60-0.69: Decent clip. Relatable with minimal context.
- Below 0.60: Not a clip. Do not include.

CLIP BOUNDARIES — THIS IS CRITICAL, read carefully:
Your timestamps MUST match the transcript. Do not estimate or approximate — find the EXACT utterance timestamps from the transcript that contain the peak moment.

Step-by-step for each clip:
1. Find the KEY utterance — the exact line in the transcript where the peak reaction happens
2. Read the timestamp on that line — this is your anchor point
3. Start = the timestamp of the utterance 1-2 lines BEFORE the key utterance (for setup/context)
4. End = the timestamp of the utterance 1-2 lines AFTER the key utterance (for the reaction to land)
5. Verify: are all the words you're quoting in "reason" actually between your start and end times? If not, adjust.

Duration: 30-90 seconds total. Sweet spot is 45-75 seconds.
Land on complete sentences — never cut mid-utterance.

Timestamps are plain seconds (e.g. 813 = 813 seconds into the stream).
Output "start" and "end" as plain integers. Minimum clip length: 20 seconds.
No emojis. Clean text only.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "title": "<hook-style title under 60 chars — what the streamer said or reacted to>",
    "start": <start time as plain integer seconds — must be the timestamp of a real utterance in the transcript>,
    "end": <end time as plain integer seconds — must be the timestamp of a real utterance in the transcript>,
    "score": <virality score 0.0-1.0>,
    "category": "<hype | funny | emotional | educational>",
    "reason": "<why this will perform — quote the EXACT words from the transcript that signal the peak, with their timestamps>",
    "hook": "<what happens in the opening 3 seconds that stops someone scrolling>",
    "caption": "<TikTok caption under 150 chars — conversational, not salesy, 3-4 relevant hashtags>"
  }
]

Return 1-6 peaks sorted by score descending. If nothing clears 0.60, return []. It is better to return fewer high-quality clips than to pad with mediocre ones.`;
}

async function runPeakDetection(
  anthropic: Anthropic,
  vodTitle: string,
  segments: TranscriptSegment[]
): Promise<Peak[]> {
  const transcript = buildTranscript(segments);

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `You are a viral content strategist who specializes in Twitch-to-TikTok clip selection. You have a sharp eye for the exact moment in a stream that would stop someone scrolling — you understand pacing, emotional escalation, and what makes a stranger care about someone they've never watched. You are decisive and specific: you identify the exact utterances that make a moment work, and you pick clip boundaries that make the clip feel complete.`,
    messages: [{ role: "user", content: buildPeakDetectionPrompt(vodTitle, transcript) }],
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

// Maximum peaks returned per VOD.
const MAX_PEAKS = 6;

// Top candidates to consider during the re-ranking pass on long VODs.
const RERANK_CANDIDATE_LIMIT = 18;

// Minimum virality score. 0.60 = decent clip with some context.
const MIN_PEAK_SCORE = 0.60;

export async function detectPeaks(
  segments: TranscriptSegment[],
  vodTitle: string
): Promise<Peak[]> {
  const anthropic = new Anthropic();

  // Strip non-streamer voices (game NPCs, co-streamers, background audio)
  // before sending to Claude — only analyze what the streamer actually said
  segments = filterDominantSpeaker(segments);

  const vodDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;

  if (vodDuration <= CHUNK_SECONDS + 5 * 60) {
    const peaks = await runPeakDetection(anthropic, vodTitle, segments);
    return peaks.sort((a, b) => b.score - a.score).slice(0, MAX_PEAKS);
  }

  const chunks: TranscriptSegment[][] = [];
  let chunkStart = 0;
  while (chunkStart < vodDuration) {
    const chunkEnd = chunkStart + CHUNK_SECONDS;
    chunks.push(segments.filter((s) => s.start >= chunkStart && s.start < chunkEnd));
    chunkStart = chunkEnd;
  }

  const allPeaks: Peak[] = [];
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const peaks = await runPeakDetection(anthropic, vodTitle, chunk);
    allPeaks.push(...peaks);
  }

  const topCandidates = allPeaks
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
  dead_zones?: Array<{ time: string; duration: number }>;
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
What separates top gaming streamers from average ones:
- The commentary IS the content — not just narrating what is happening on screen, but adding personality, prediction, and emotion on top of it. Silence during intense gameplay can be fine, but silence during downtime is dead content.
- Live vocal reactions matter more than the outcome. A loud genuine reaction to a near-miss is more entertaining than winning silently. Top gaming streamers make the viewer FEEL the stakes.
- Downtime between action (loading, menus, queue waiting) is when great gaming streamers build community. They tell personal stories, ask chat questions, or give hot takes on the game or gaming culture. This is where personality is built.
- Confident voice even in failure. The best gaming streamers are entertaining whether winning or losing because they frame both as stories. Self-deprecating humor in failure keeps viewers invested.
- Strong opinions on the game — patches, meta, other players' decisions, bad design choices. Opinion-driven commentary creates clips and debate, which drives growth.
- Treating chat like a stadium crowd — big moments are announced with energy. Low moments are narrated with drama. The streamer creates the emotional arc for the viewer, not just the game.

Key coaching focus areas: Is commentary adding value or narrating the obvious? Are dead moments being energized? Are they sharing opinions worth clipping? Is energy proportional to what's happening?`,

  just_chatting: `JUST CHATTING STREAMER COACHING STANDARDS:
What separates top just chatting streamers from average ones:
- Radical authenticity is the product. Performed emotions or overly polished delivery kills it. The most growth comes from unfiltered, genuine personality.
- React content done right requires genuine real-time processing — first authentic reaction, not a performed one. Realness is what gets clipped.
- Parasocial relationship building: remembering regulars by name, referencing past streams, treating chat like a room of friends. This converts lurkers into loyals.
- Hot takes create organic clip spread. A strong opinion — even controversial — generates debate, sharing, and return visits. Streamers who avoid controversy avoid organic growth.
- Long-form conversation skills: holding attention through 2-4 hours with just personality. Requires genuine interests, stories, and opinions.
- Making chat part of the content: the best just chatting streamers turn chat messages into comedic material or debate partners. Chat is a co-star.

Key coaching focus areas: Is genuine personality showing or is it a performance? Are they building real relationships with chat? Are they sharing opinions strong enough to clip and argue about?`,

  irl: `IRL STREAMER COACHING STANDARDS:
What separates top IRL streamers from average ones:
- Environmental storytelling: the location is a co-character. Top IRL streamers narrate their environment and give the viewer a perspective, not just carry a camera.
- Engaging strangers authentically. Natural conversations that go somewhere unexpected beat scripted interactions every time.
- Narrating internal thoughts in real time creates intimacy and makes the viewer feel inside the streamer's head.
- Reacting naturally to unexpected moments is the content. Genuine unscripted reactions are the clips — managing these moments kills them.
- Chat as a companion: the best IRL streamers loop chat in, read reactions, ask chat what to do next.

Key coaching focus areas: Is the viewer getting a genuine perspective? Are thoughts being narrated out loud? Is chat being treated as a companion or ignored?`,

  variety: `VARIETY STREAMER COACHING STANDARDS:
What separates top variety streamers from average ones:
- The personality, not the game, is what viewers follow. A consistent identity makes them recognizable whether playing an FPS or a cozy game.
- Smooth transitions need narrative connective tissue. Top variety streamers bring chat along explicitly — they don't just switch.
- Building loyal audience who follow the person, not the category. This happens through consistent personality and values.
- Energy management: switching games can re-energize but can also reset momentum. Top variety streamers time switches to capitalize on energy, not escape it.

Key coaching focus areas: Is there a consistent personality recognizable across any game? Are transitions smooth? Would a new viewer understand who this person is regardless of what they're playing?`,

  educational: `EDUCATIONAL STREAMER COACHING STANDARDS:
What separates top educational streamers from average ones:
- Teaching as entertainment: Socratic method, real-time problem solving, genuine curiosity make learning feel like discovery. Dry lecture delivery drives viewers away.
- Accessible complexity: analogies and metaphors that make difficult topics click instantly. If a viewer needs background knowledge, most leave.
- Acknowledging mistakes and confusion builds trust. Working through uncertainty live is more valuable than projecting false confidence.
- Structured segments with clear payoffs keep retention high. Give the viewer a destination upfront.
- Chat-driven content: letting chat questions steer the content creates investment and ownership.

Key coaching focus areas: Is the teaching style engaging or dry lecture? Are complex topics made genuinely accessible? Is uncertainty handled authentically? Is chat shaping the direction?`,
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
 * Generate an AI stream coaching report from a transcript and detected peaks.
 * Uses Sonnet for higher quality coaching feedback — this is the flagship feature.
 */
export async function generateCoachReport(
  segments: TranscriptSegment[],
  vodTitle: string,
  peaks: Peak[],
  priorReports?: PriorCoachSummary[]
): Promise<CoachReport | null> {
  const anthropic = new Anthropic();

  if (segments.length === 0) return null;

  // Strip non-streamer voices before analysis — same filter as peak detection
  segments = filterDominantSpeaker(segments);

  if (segments.length === 0) return null;

  const vodDuration = segments[segments.length - 1].end;
  const totalMinutes = Math.round(vodDuration / 60);

  // ── Transcript samples: 5 evenly-spaced sections + context around each peak ──
  const LINES_PER_SECTION = 120;
  const sectionLabels = ["Opening", "Early", "Middle", "Late", "Closing"];
  const sectionTranscripts: string[] = [];

  for (let i = 0; i < 5; i++) {
    const centerFraction = i / 4;
    const centerIdx = Math.floor(centerFraction * (segments.length - 1));
    const start = Math.max(0, centerIdx - Math.floor(LINES_PER_SECTION / 2));
    const end = Math.min(segments.length, start + LINES_PER_SECTION);
    const secsInSection = segments.slice(start, end);
    const wpm = calcWPM(secsInSection);
    const lines = secsInSection.map((s) => `[${formatTime(s.start)}] ${s.text}`);
    sectionTranscripts.push(`--- ${sectionLabels[i]} (${wpm} wpm) ---\n${lines.join("\n")}`);
  }

  const transcriptSamples = sectionTranscripts.join("\n\n");

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

  // ── Full energy map (minute-by-minute WPM sparkline) ──
  const energyMap = buildEnergyMap(segments, vodDuration);
  const sparkline = renderEnergySparkline(energyMap);
  // Label every 5th minute for orientation
  const sparklineLabel = energyMap
    .filter((e) => e.minute % 5 === 0)
    .map((e) => `${e.minute}m`)
    .join("   ");

  // ── Momentum crash — worst energy valley ──
  const crash = findMomentumCrash(energyMap, segments);
  const crashBlock = crash
    ? `MOMENTUM CRASH — worst dead zone (${crash.startMin}:00–${crash.endMin}:00, ${crash.endMin - crash.startMin} min at near-zero energy):
${crash.excerpt}`
    : "";

  // ── Prior stream history for longitudinal coaching ──
  const historyBlock = (priorReports && priorReports.length > 0)
    ? `PREVIOUS STREAM HISTORY (this streamer has been coached before — use this to identify patterns, improvements, or recurring problems):
${priorReports.map((r, i) => `Stream ${i + 1} ago (${r.date}, score ${r.score}):
  Priority: ${r.recommendation}
  Top fix: ${r.top_improvement}`).join("\n")}

If the same problem has appeared in multiple past reports, name it directly — they've been told before and it's still happening.
If this stream shows improvement on a past problem, call it out — earned recognition is more motivating than generic praise.`
    : "";

  // ── Peaks summary for coaching context ──
  const peaksSummary = peaks.length > 0
    ? peaks.map((p) => `- "${p.title}" at ${formatTime(p.start)}–${formatTime(p.end)} [${p.category}, score: ${p.score.toFixed(2)}]\n  Why it works: ${p.reason}`).join("\n")
    : "No standout moments detected — the stream lacked clear viral peaks.";

  const categoryGuideBlock = Object.values(CATEGORY_COACHING_GUIDE).join("\n\n");

  const coachSystemPrompt = `You are a Twitch growth coach who is also a seasoned streamer yourself. You speak the language — you know what dead air feels like, what it means to go live cold, when chat is sleeping, when someone's in the zone vs grinding silent. Your feedback sounds like a knowledgeable streaming friend giving real talk, not a corporate consultant.

You are direct and honest. Your job is not to make the streamer feel good — it is to make them better. You use natural streaming culture language: dead air, chat sleeping, no hype, clipping moments, energy diff, grinding silent, lurker mode, going off, stream pacing.

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
- The streamer had intro music/BRB screen playing while setting up — the first 1-3 minutes of silence is almost always setup time, not a cold open problem.
- The streamer was in an intense gameplay moment where focus silence is natural (clutch plays, boss fights, tense situations).
- The game itself has cinematic cutscenes the streamer is watching.

Only flag silence as a real problem when the streamer SHOULD have been talking but wasn't — during downtime, between matches, during loading screens, or when chat is active and being ignored. Intentional silence during content consumption or intense gameplay is not dead air.

STREAM INFO:
- Title: "${vodTitle}"
- Duration: ${totalMinutes} minutes
- Commentary density: ${commentaryDensity} wpm (when actively speaking — target 140-170 wpm for engaging delivery; below 110 wpm = flat)
- Overall stream pace (incl. gaps): ~${overallWPM} wpm
- Dead air: ${deadAirSummary}

ENERGY CURVE (minute-by-minute — each bar = 1 min, height = speaking energy):
${sparkline}
${sparklineLabel}

${crashBlock ? crashBlock + "\n" : ""}${historyBlock ? historyBlock + "\n" : ""}AI-DETECTED PEAK MOMENTS (the best clips the AI found):
${peaksSummary}

${peakContextBlock ? `TRANSCRIPT AT PEAK MOMENTS (read this carefully — this is the raw evidence for what made the best moments work or why moments are missing):
${peakContextBlock}` : ""}

STREAM TRANSCRIPT SAMPLES (5 sections across the full stream, with wpm per section to show energy curve):
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

EVALUATION — work through each before writing feedback:

1. ENERGY CURVE: Use the sparkline and minute-by-minute data. Where exactly did energy die? What was happening in the transcript at those moments?
2. DEAD AIR: Which gaps were from the game (acceptable) vs. losing momentum (bad)? Only flag the ones that actually hurt.
3. PERSONALITY: When did their real personality show? What triggered it? How often did it happen vs. how often were they just filling air?
4. CHAT: Were they treating chat as a co-star or an afterthought? Did any specific chat interaction go well or get ignored?
5. PEAKS: What specifically created the detected peaks? If peaks are weak or missing, what was happening in the transcript where a peak should have been?
6. NARRATIVE: Did the stream have a story? Did it build toward anything? Where did it feel alive vs. dead?
7. HISTORY: If prior reports exist — has this streamer improved on past problems? Or are the same issues recurring? Name it directly.

SCORING — be honest, most streams land 50-70:
- 85-100: Rare. High energy throughout, strong personality, great chat chemistry, multiple clip-worthy moments.
- 70-84: Solid. Clear strengths. A couple obvious things to fix.
- 55-69: Average. Watchable but forgettable. Energy or engagement needs work.
- 40-54: Below average. Dead air, flat delivery, or weak engagement throughout.
- Below 40: Fundamentals need attention.

OUTPUT RULES:
- NEVER give generic advice. Every sentence must reference a specific moment, timestamp, or thing that actually happened in this stream.
- Strengths: **2-3 word label** — one sentence naming WHEN/WHAT the strength showed up and how to replicate it. Max 20 words after label.
- Improvements: **2-3 word label** — one sentence on exactly when/where the problem appeared, one sentence with a fix that only works for this stream. Max 25 words after label.
- Labels must sound like a fellow streamer: "Dead Air", "Chat Sleeping", "Going Off", "Energy Diff", "Grinding Silent", "Clipped That", "No Hype". Never: "Audience Disconnect", "Content Vacuum", "Viewer Arc".
- Best moment: tell the actual story of what happened — what the streamer said or did, what made it land. Not a description of the category of moment.
- Recommendation: 1-2 sentences. Reference what happened in this stream. The single biggest lever to pull next time.
- Goals: concrete and tied to this stream's specific issues. Not "engage more with chat" — tell them what to do that would have fixed the exact problem you saw today.
- Cold open: score the first 5 minutes only. "strong" = hooked immediately, energy and presence from first words. "average" = took a few minutes to find footing. "weak" = opened cold, directionless, or clearly disengaged. Note: 1 sentence, specific to what actually happened in those first minutes. IMPORTANT: many streamers have 1-3 minutes of intro screen/music/setup before they start talking — this is normal and NOT a weak cold open. Judge from when they actually start speaking, not from timestamp 0:00.
- momentum_crash: use the crash data provided. Describe the exact stretch where the stream flatlined and what the streamer should have done differently at that moment.
- trend_vs_history: only populate if prior stream history is provided. Be direct — "improving", "declining", or "consistent". Name specific streams or scores if relevant.
- No emojis. No padding. No filler.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "overall_score": <integer 0-100>,
  "streamer_type": "<gaming | just_chatting | irl | variety | educational>",
  "energy_trend": "<building | declining | consistent | volatile>",
  "viewer_retention_risk": "<low | medium | high>",
  "cold_open": {
    "score": "<strong | average | weak>",
    "note": "<1 sentence about exactly what happened in the first 5 minutes>"
  },
  "strengths": [
    "**Label** — specific moment + how to do more of it. Max 20 words.",
    "**Label** — specific moment + how to do more of it. Max 20 words.",
    "**Label** — specific moment + how to do more of it. Max 20 words."
  ],
  "improvements": [
    "**Label** — when/where it showed up. Fix specific to this stream. Max 25 words.",
    "**Label** — when/where it showed up. Fix specific to this stream. Max 25 words.",
    "**Label** — when/where it showed up. Fix specific to this stream. Max 25 words."
  ],
  "best_moment": {
    "time": "<MM:SS>",
    "description": "<2 sentences: the actual story of what happened and exactly why it worked>"
  },
  "recommendation": "<1-2 sentences. Reference this specific stream. Most impactful change. No buildup.>",
  "next_stream_goals": [
    "<one sentence, concrete, tied to what went wrong today>",
    "<one sentence, concrete, tied to what went wrong today>",
    "<one sentence, concrete, tied to what went wrong today>"
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
