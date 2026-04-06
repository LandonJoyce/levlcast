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

  const allLines = segments.map((s) => `[${formatTime(s.start)}] ${s.text}`);

  // Sample beginning, middle, and end to see the full arc of the stream
  const chunkSize = 80;
  const mid = Math.floor(allLines.length / 2);
  const beginningLines = allLines.slice(0, chunkSize);
  const middleLines = allLines.slice(Math.max(0, mid - Math.floor(chunkSize / 2)), mid + Math.floor(chunkSize / 2));
  const endLines = allLines.slice(Math.max(0, allLines.length - chunkSize));

  const transcript = [
    "--- Stream Opening (first ~10 minutes) ---",
    beginningLines.join("\n"),
    "\n--- Stream Middle ---",
    middleLines.join("\n"),
    "\n--- Stream Closing (last ~10 minutes) ---",
    endLines.join("\n"),
  ].join("\n");

  const peaksSummary = peaks.length > 0
    ? peaks.map((p) => `- "${p.title}" at ${formatTime(p.start)} [${p.category}, score: ${p.score.toFixed(2)}]\n  Why it worked: ${p.reason}`).join("\n")
    : "No standout moments were detected in this stream.";

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: `You are an elite Twitch growth coach with a track record of helping streamers go from 0 to full-time. You are direct, honest, and specific. You never give generic advice. You watch the actual footage (in this case the transcript) and give feedback that is tailored to exactly what happened in this stream. You know the difference between a streamer who is one habit away from breaking through and one who has fundamental problems to fix. Your feedback is valuable because it is true, not because it is kind.`,
    messages: [
      {
        role: "user",
        content: `Review this Twitch stream and give the streamer a coaching report.

Stream title: "${vodTitle}"

AI-detected peak moments:
${peaksSummary}

Transcript sample (opening, middle, and closing of the stream):
${transcript}

SCORING GUIDE — be honest and calibrated:
- 85-100: Exceptional stream. High energy throughout, strong chat engagement, clear personality, memorable moments. Rare.
- 70-84: Good stream with real strengths. A few clear things to fix but the foundation is solid.
- 55-69: Average stream. Watchable but forgettable. Needs work on consistency and engagement.
- 40-54: Below average. Energy problems, dead air, or weak content. Significant improvement needed.
- Below 40: Serious issues. Fundamental problems with delivery, content, or engagement.

Most streams score between 50-75. Be honest — a streamer who scores 90 on a mediocre stream learns nothing.

ENERGY TREND DEFINITIONS:
- building: stream clearly got better as it went on, energy increased
- declining: started strong but faded, energy dropped noticeably
- consistent: maintained the same level throughout (good or bad)
- volatile: big spikes and drops, unpredictable energy

VIEWER RETENTION RISK:
- low: viewers would likely stay the whole stream
- medium: some drop-off points but mostly retaining
- high: multiple moments where viewers would click away

IMPORTANT: No emojis. Be direct. Reference specific things from the transcript, not generic advice.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "overall_score": <integer 0-100, calibrated honestly>,
  "stream_summary": "<2-3 sentences that honestly summarize the stream — what kind of stream it was, the general vibe, and the most notable thing about it>",
  "energy_trend": "<building | declining | consistent | volatile>",
  "viewer_retention_risk": "<low | medium | high>",
  "strengths": [
    "<specific strength with an example from the stream>",
    "<specific strength with an example from the stream>",
    "<specific strength with an example from the stream>"
  ],
  "improvements": [
    "<specific problem + exactly what to do differently, with a concrete example from this stream>",
    "<specific problem + exactly what to do differently, with a concrete example from this stream>",
    "<specific problem + exactly what to do differently, with a concrete example from this stream>"
  ],
  "best_moment": {
    "time": "<MM:SS>",
    "description": "<what happened, why it worked, and what it reveals about the streamer's strengths>"
  },
  "content_mix": [
    { "category": "<gameplay | chat interaction | commentary | educational | funny | hype>", "percentage": <integer 0-100> }
  ],
  "recommendation": "<the single highest-leverage thing this streamer should do differently next stream — be specific, actionable, and direct>",
  "next_stream_goals": [
    "<specific measurable goal for next stream>",
    "<specific measurable goal for next stream>",
    "<specific measurable goal for next stream>"
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
