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
 *   - Peak detection: claude-haiku-4-5 (fast, cheap, good enough for scoring)
 *   - Coaching report: claude-sonnet-4-6 (slower, higher quality — flagship feature)
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
 * Analyze a transcript with Claude to find peak/viral moments.
 * Returns scored peaks with clip boundaries, captions, and scroll-stopping hooks.
 */
const PEAK_DETECTION_PROMPT = (vodTitle: string, transcript: string) => `Find the top viral clip moments from this Twitch stream transcript.

Stream title: "${vodTitle}"

Timestamped transcript:
${transcript}

CRITICAL RULE — CLARITY FIRST:
You are working from a speech transcript, not video. Audio transcription is imperfect — gaming terms, names, and in-game callouts are frequently misheard. You must ONLY clip moments where the streamer's emotional reaction is unmistakably clear in their own spoken words. Never infer what happened in the game from unclear transcript text. If you are not certain what the streamer said and why they reacted, skip it. A missed clip is better than a wrong one.

WHAT MAKES A GREAT TWITCH CLIP:
- The streamer explicitly expresses a clear emotion in words — laughter, yelling, shock, hype, disbelief
- Verbal cues that are unambiguous: "let's go", "no way", "are you kidding me", audible laughter, genuine rage
- A strong opinion or hot take stated clearly in words that would spark debate
- A funny moment where the streamer's reaction is the clip — not what happened in the game
- A teaching moment where the streamer explains something clearly and confidently

WHAT TO AVOID — BE STRICT:
- Any moment where you are guessing what happened based on unclear or potentially misheard words
- Gameplay callouts that depend on knowing what happened on screen — you cannot see the screen
- Moments where the emotion is mild or ambiguous — only clip strong, obvious reactions
- Inside jokes or moments needing too much context
- Filler content: loading screens, AFK, dead air
- If the transcript words seem garbled, misheard, or don't make sense in context — skip it
- BACKGROUND AUDIO: Streamers play music and watch videos (YouTube, clips, etc.) on stream. If the transcript contains lyrics (rhyming, repetitive lines, song-like structure), scripted dialogue, news-anchor speech, or any audio that sounds like it came from a video/media source rather than a natural live conversation — skip it entirely. You are only looking for the streamer's own authentic reactions and commentary. When in doubt about whether words came from the streamer or background media, skip it.

SCORING RUBRIC (0.0 - 1.0):
- 0.9-1.0: Will stop mid-scroll. The streamer's reaction is unmistakably clear and universally relatable. No context needed.
- 0.75-0.89: Strong clip. Clear emotion or payoff that is obvious from the words alone.
- 0.65-0.74: Decent clip. Reaction is clear but may need some context.
- Below 0.65: Do not include. When in doubt, leave it out.

CLIP BOUNDARIES:
- Include 3-5 seconds of buildup before the peak so viewers feel the tension
- Include 2-3 seconds after the payoff so the reaction lands fully
- Target 30-75 seconds. Never exceed 90 seconds.

IMPORTANT: No emojis anywhere. Clean text only.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "title": "<hook-style title under 60 chars — based only on what the streamer clearly said, not guessed gameplay>",
    "start": <start time in seconds>,
    "end": <end time in seconds>,
    "score": <virality score 0.0-1.0>,
    "category": "<hype | funny | emotional | educational>",
    "reason": "<why this moment will perform — quote the specific words from the transcript that confirm the emotion>",
    "hook": "<describe the opening 3 seconds of this clip that will stop someone from scrolling>",
    "caption": "<TikTok caption under 150 chars — conversational, not salesy, with 3-4 relevant hashtags>"
  }
]

Return 3-5 peaks sorted by score descending. Be selective — 3 accurate clips beats 5 guessed ones. If there are no moments scoring above 0.65, return [].`;

async function runPeakDetection(
  anthropic: Anthropic,
  vodTitle: string,
  transcript: string
): Promise<Peak[]> {
  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You are a viral content strategist who specializes in Twitch-to-TikTok clip selection. You have deep knowledge of what makes gaming and streaming content stop people mid-scroll. You understand pacing, emotional peaks, and the psychology of short-form content. You are ruthlessly selective — you only flag moments that could genuinely perform.`,
    messages: [{ role: "user", content: PEAK_DETECTION_PROMPT(vodTitle, transcript) }],
  }), 3, 1000);

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const peaks: Peak[] = JSON.parse(cleaned);
    return peaks.filter((p) => p.start >= 0 && p.end > p.start && p.score >= MIN_PEAK_SCORE);
  } catch {
    console.error("Failed to parse Claude peak response:", text);
    return [];
  }
}

// How long each transcript chunk is when splitting long VODs.
// 20 minutes keeps each Claude call fast and within token limits.
const CHUNK_SECONDS = 20 * 60;

// Maximum peaks returned per VOD. Keeping this low forces quality over quantity.
const MAX_PEAKS = 5;

// Top candidates to consider during the re-ranking pass on long VODs.
// We take the best 3 from each chunk (up to 15 total) and re-rank them.
const RERANK_CANDIDATE_LIMIT = 15;

// Minimum virality score for a peak to be included. Claude's rubric:
//   0.65–0.74 = decent clip (clear reaction), 0.75+ = strong clip, 0.9+ = viral
const MIN_PEAK_SCORE = 0.65;

export async function detectPeaks(
  segments: TranscriptSegment[],
  vodTitle: string
): Promise<Peak[]> {
  const anthropic = new Anthropic();

  const vodDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;

  // Short VODs (<= 25 min): single pass, no chunking needed
  if (vodDuration <= CHUNK_SECONDS + 5 * 60) {
    const transcript = segments
      .map((s) => `[${formatTime(s.start)}-${formatTime(s.end)}] ${s.text}`)
      .join("\n");

    const peaks = await runPeakDetection(anthropic, vodTitle, transcript);
    return peaks.sort((a, b) => b.score - a.score).slice(0, MAX_PEAKS);
  }

  // Long VODs: split into 20-min chunks, run each, then re-rank the top candidates
  const chunks: TranscriptSegment[][] = [];
  let chunkStart = 0;
  while (chunkStart < vodDuration) {
    const chunkEnd = chunkStart + CHUNK_SECONDS;
    chunks.push(segments.filter((s) => s.start >= chunkStart && s.start < chunkEnd));
    chunkStart = chunkEnd;
  }

  // Process chunks sequentially to avoid hammering the API
  const allPeaks: Peak[] = [];
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const transcript = chunk
      .map((s) => `[${formatTime(s.start)}-${formatTime(s.end)}] ${s.text}`)
      .join("\n");
    const peaks = await runPeakDetection(anthropic, vodTitle, transcript);
    allPeaks.push(...peaks);
  }

  // If we have enough candidates, do a final re-ranking pass with the best 3 from each chunk
  const topCandidates = allPeaks
    .sort((a, b) => b.score - a.score)
    .slice(0, RERANK_CANDIDATE_LIMIT);

  if (topCandidates.length <= MAX_PEAKS) {
    return topCandidates;
  }

  // Re-rank pass: ask Claude to pick the best 5 from all candidates
  const candidateSummary = topCandidates
    .map((p, i) => `${i + 1}. [${formatTime(p.start)}-${formatTime(p.end)}] "${p.title}" (score: ${p.score.toFixed(2)}) — ${p.reason}`)
    .join("\n");

  const rerankResponse = await withRetry(() => anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are a viral content strategist selecting the best clips from a Twitch stream.`,
    messages: [{
      role: "user",
      content: `From these ${topCandidates.length} candidate clips from a long stream, pick the ${MAX_PEAKS} best based on viral potential. Return ONLY a JSON array of their numbers (1-based), e.g. [2, 5, 7, 11, 14]. No explanation.\n\nCandidates:\n${candidateSummary}`,
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
    // Fallback: just return top 5 by score
    return topCandidates.slice(0, 5);
  }
}


export interface CoachReport {
  overall_score: number;
  stream_summary: string;
  energy_trend: "building" | "declining" | "consistent" | "volatile";
  strengths: string[];
  improvements: string[];
  best_moment: { time: string; description: string };
  content_mix: { category: string; percentage: number }[];
  recommendation: string;
  next_stream_goals: string[];
  viewer_retention_risk: "low" | "medium" | "high";
}

/**
 * Generate an AI stream coaching report from a transcript and detected peaks.
 * Uses Sonnet for higher quality coaching feedback — this is the flagship feature.
 */
export async function generateCoachReport(
  segments: TranscriptSegment[],
  vodTitle: string,
  peaks: Peak[]
): Promise<CoachReport | null> {
  const anthropic = new Anthropic();

  if (segments.length === 0) return null;

  const vodDuration = segments[segments.length - 1].end;
  const totalMinutes = Math.round(vodDuration / 60);

  // Sample 5 evenly-spaced sections across the full stream so Claude sees the whole arc
  const LINES_PER_SECTION = 100;
  const sectionLabels = ["Opening", "Early", "Middle", "Late", "Closing"];
  const sectionTranscripts: string[] = [];

  for (let i = 0; i < 5; i++) {
    const centerFraction = i / 4; // 0, 0.25, 0.5, 0.75, 1.0
    const centerIdx = Math.floor(centerFraction * (segments.length - 1));
    const start = Math.max(0, centerIdx - Math.floor(LINES_PER_SECTION / 2));
    const end = Math.min(segments.length, start + LINES_PER_SECTION);
    const lines = segments.slice(start, end).map((s) => `[${formatTime(s.start)}] ${s.text}`);
    sectionTranscripts.push(`--- ${sectionLabels[i]} ---\n${lines.join("\n")}`);
  }

  const transcript = sectionTranscripts.join("\n\n");

  // Detect dead air — gaps of 10+ seconds between transcript segments
  const deadAirGaps: string[] = [];
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap >= 10) {
      deadAirGaps.push(`${formatTime(segments[i - 1].end)}–${formatTime(segments[i].start)} (${Math.round(gap)}s silence)`);
    }
  }
  const deadAirSummary = deadAirGaps.length > 0
    ? `Dead air detected at: ${deadAirGaps.slice(0, 8).join(", ")}${deadAirGaps.length > 8 ? ` and ${deadAirGaps.length - 8} more` : ""}`
    : "No significant dead air detected.";

  // Stream stats to help Claude calibrate
  const wordsPerMinute = totalMinutes > 0 ? Math.round(segments.reduce((acc, s) => acc + s.text.split(" ").length, 0) / totalMinutes) : 0;

  const peaksSummary = peaks.length > 0
    ? peaks.map((p) => `- "${p.title}" at ${formatTime(p.start)}–${formatTime(p.end)} [${p.category}, score: ${p.score.toFixed(2)}]\n  Reason: ${p.reason}`).join("\n")
    : "No standout moments were detected — the stream lacked clear viral peaks.";

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: `You are an elite Twitch growth coach. You have helped dozens of streamers go from 0 to full-time by identifying exactly what is holding them back and what they are already doing well. You are direct and honest — you never pad feedback with compliments that aren't earned. You know what separates streamers who grow from those who stay stuck: consistent energy, strong personality, chat interaction, clip-worthy moments, and clear value to the viewer. You base all feedback on what actually happened in the stream — you never give generic advice that could apply to any streamer.`,
    messages: [
      {
        role: "user",
        content: `Review this Twitch stream and give the streamer a detailed, honest coaching report.

STREAM INFO:
- Title: "${vodTitle}"
- Duration: ${totalMinutes} minutes
- Talking pace: ~${wordsPerMinute} words/minute (normal conversation is ~130 wpm; high energy streamers often hit 150-180 wpm)
- ${deadAirSummary}

AI-DETECTED PEAK MOMENTS (the best moments in this stream):
${peaksSummary}

TRANSCRIPT SAMPLE (5 sections evenly spaced across the full stream):
${transcript}

WHAT TO EVALUATE — be specific and reference actual timestamps and quotes:

1. ENERGY & CONSISTENCY: Was the streamer engaged and entertaining throughout? Did energy drop? Were there long silences or dead air? Reference the dead air gaps above.

2. PERSONALITY & AUTHENTICITY: Does the streamer have a clear, memorable personality? Do they talk TO the viewer or just narrate to themselves? Would a new viewer immediately understand who this person is?

3. CHAT INTERACTION: Does the streamer read and respond to chat? Streamers who ignore chat lose viewers. Look for evidence of chat interaction in the transcript.

4. CLIP-WORTHY MOMENTS: The detected peaks tell you what stood out. Were these genuinely strong moments or were there few/no peaks (meaning the stream was flat)?

5. TALKING PACE & DEAD AIR: Long silences kill viewer retention. More than 15 seconds of silence is a problem. Reference specific gaps from the dead air data.

6. CONTENT CLARITY: Is it clear what the streamer is playing/doing and why it's worth watching? Would a new viewer understand the context?

SCORING — be honest and calibrated (most streams score 50-75):
- 85-100: Exceptional. High energy, strong personality, chat interaction, clip-worthy moments throughout. Rare.
- 70-84: Good foundation. Real strengths, a few clear things to fix.
- 55-69: Average. Watchable but not memorable. Needs work on energy or engagement.
- 40-54: Below average. Dead air, low energy, or weak content. Significant work needed.
- Below 40: Fundamental problems with delivery or engagement.

ENERGY TREND:
- building: energy clearly increased as the stream went on
- declining: started strong, faded noticeably
- consistent: same level throughout (good or bad)
- volatile: big spikes and drops, unpredictable

VIEWER RETENTION RISK:
- low: viewers would likely stay the whole stream
- medium: some drop-off points, mostly retaining
- high: multiple moments where viewers would click away

RULES:
- Every strength and improvement MUST reference a specific timestamp or quote from the transcript
- Do not give advice that could apply to any streamer — make it specific to THIS stream
- If the stream had real problems, say so clearly — sugarcoating helps no one
- No emojis

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "overall_score": <integer 0-100>,
  "stream_summary": "<2-3 honest sentences: what kind of stream, the vibe, and the single most important thing to know about it>",
  "energy_trend": "<building | declining | consistent | volatile>",
  "viewer_retention_risk": "<low | medium | high>",
  "strengths": [
    "<specific strength — quote or timestamp from THIS stream, explain why it works>",
    "<specific strength — quote or timestamp from THIS stream, explain why it works>",
    "<specific strength — quote or timestamp from THIS stream, explain why it works>"
  ],
  "improvements": [
    "<specific problem with timestamp or example + exactly what to do differently next stream>",
    "<specific problem with timestamp or example + exactly what to do differently next stream>",
    "<specific problem with timestamp or example + exactly what to do differently next stream>"
  ],
  "best_moment": {
    "time": "<MM:SS>",
    "description": "<what happened, why it worked, what it reveals about the streamer's potential>"
  },
  "content_mix": [
    { "category": "<gameplay | chat interaction | commentary | educational | funny | hype>", "percentage": <integer 0-100> }
  ],
  "recommendation": "<the single most impactful change this streamer can make next stream — specific, actionable, based on what you saw>",
  "next_stream_goals": [
    "<measurable, specific goal based on a weakness you identified>",
    "<measurable, specific goal based on a weakness you identified>",
    "<measurable, specific goal based on a weakness you identified>"
  ]
}`,
      },
    ],
  }), 3, 1000);

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned) as CoachReport;
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
