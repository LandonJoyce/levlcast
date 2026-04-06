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

IMPORTANT: The transcript uses plain integer seconds (e.g. 813s means 813 seconds). Output "start" and "end" as plain integers in seconds — NOT as decimals, NOT as MM:SS format. A clip must be at least 20 seconds long.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "title": "<hook-style title under 60 chars — based only on what the streamer clearly said, not guessed gameplay>",
    "start": <start time as plain integer seconds, e.g. 813>,
    "end": <end time as plain integer seconds, e.g. 868>,
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
      .map((s) => `[${toSeconds(s.start)}-${toSeconds(s.end)}] ${s.text}`)
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
      .map((s) => `[${toSeconds(s.start)}-${toSeconds(s.end)}] ${s.text}`)
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
  streamer_type: "gaming" | "just_chatting" | "irl" | "variety" | "educational";
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
    system: `You are an elite Twitch growth coach. You give direct, honest feedback based only on what actually happened in the stream. Your job is not to make the streamer feel good — it is to make them better next stream.

CORE PRINCIPLE: Every single piece of feedback must be connected to improvement. A strength is only worth mentioning if you also tell the streamer how to do more of it. A problem is only worth mentioning if you also give them one specific thing to try next stream. If you cannot give actionable advice tied to THIS stream, leave it out.

WHAT SEPARATES GROWING STREAMERS FROM STUCK ONES:
- They fill silence with personality, not just gameplay narration
- They acknowledge chat by name and make viewers feel seen
- They build on their best moments instead of moving past them quickly
- They have a consistent energy baseline, not random spikes
- They know what kind of content they are and lean into it

You never give generic advice that could apply to anyone. You never praise things that aren't genuinely strong. You never list a problem without a fix.`,
    messages: [
      {
        role: "user",
        content: `Review this Twitch stream and produce a coaching report the streamer can act on before their next stream.

STREAM INFO:
- Title: "${vodTitle}"
- Duration: ${totalMinutes} minutes
- Talking pace: ~${wordsPerMinute} words/minute (normal conversation ~130 wpm; engaging streamers typically 140-170 wpm)
- ${deadAirSummary}

AI-DETECTED PEAK MOMENTS:
${peaksSummary}

TRANSCRIPT SAMPLE (5 evenly-spaced sections across the full stream):
${transcript}

STEP 1 — IDENTIFY STREAMER TYPE:
- "gaming": playing a video game, commentary focused on gameplay
- "just_chatting": talking to chat, no game or game is secondary
- "irl": real life, outdoors, events, daily life
- "variety": switching between games or formats
- "educational": tutorials, guides, how-to content

Adapt ALL feedback to what is appropriate for their type. A gaming streamer who is quiet during intense gameplay is normal. A just chatting streamer who goes quiet for 30 seconds is a problem.

EVALUATION CHECKLIST — use this to find specific moments:

1. ENERGY BASELINE: Did the streamer maintain a consistent energy floor? Note where it dropped and when it peaked.
2. DEAD AIR: Use the gap data above. For each significant gap, was it gameplay silence (acceptable) or dead air with no content reason (bad)?
3. PERSONALITY MOMENTS: Did the streamer have moments where their genuine personality came through clearly? How often?
4. CHAT PRESENCE: Did the streamer address chat by name, react to messages, build on what chat said? Or did they talk past chat?
5. MOMENTUM: Did the stream build toward something, or did it feel like the same vibe for the entire duration?
6. PEAK QUALITY: Look at the detected peaks. If there were strong peaks, what created them? If peaks were weak or absent, what was missing?

SCORING GUIDE — be honest, most streams are 50-70:
- 85-100: Rare. High energy, strong personality, great chat interaction, multiple clip-worthy moments.
- 70-84: Solid. Real strengths showing. A couple clear things to fix.
- 55-69: Average. Watchable but forgettable. Energy or engagement needs work.
- 40-54: Below average. Dead air, weak engagement, or flat delivery throughout.
- Below 40: Core delivery issues. Fundamentals need attention.

ENERGY TREND:
- building: energy increased noticeably as the stream progressed
- declining: started stronger, faded in the second half
- consistent: same level throughout
- volatile: sharp spikes and drops with no clear trend

VIEWER RETENTION RISK:
- low: a viewer who joins would likely stay
- medium: some drop-off points but mostly retaining
- high: multiple moments where a viewer would leave

OUTPUT RULES — follow these exactly:
- Reference timestamps and describe what happened in your own words. NEVER quote the transcript directly — Deepgram transcription has errors and any direct quote will look wrong.
- Strengths: what worked AND one specific way to do more of it next stream
- Improvements: what the problem was (with timestamp or example) AND one concrete fix to try next stream — not a general tip, a specific action
- Goals: specific enough that the streamer knows exactly what to do, doable in a single stream
- Recommendation: the single highest-leverage change. If they do one thing from this report, this is it.
- No emojis. No generic advice. If feedback doesn't apply specifically to this stream, cut it.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "overall_score": <integer 0-100>,
  "streamer_type": "<gaming | just_chatting | irl | variety | educational>",
  "stream_summary": "<2-3 sentences: what kind of stream this was, the overall vibe, and the most important takeaway for the streamer>",
  "energy_trend": "<building | declining | consistent | volatile>",
  "viewer_retention_risk": "<low | medium | high>",
  "strengths": [
    "<what worked in this stream + timestamp or example + how to do more of it next stream>",
    "<what worked in this stream + timestamp or example + how to do more of it next stream>",
    "<what worked in this stream + timestamp or example + how to do more of it next stream>"
  ],
  "improvements": [
    "<specific problem with timestamp or example> — Next stream: <one concrete action to fix it>",
    "<specific problem with timestamp or example> — Next stream: <one concrete action to fix it>",
    "<specific problem with timestamp or example> — Next stream: <one concrete action to fix it>"
  ],
  "best_moment": {
    "time": "<MM:SS>",
    "description": "<what happened, why it worked, and what it shows about what this streamer is capable of when they hit their stride>"
  },
  "content_mix": [
    { "category": "<gameplay | chat interaction | commentary | educational | funny | hype>", "percentage": <integer 0-100> }
  ],
  "recommendation": "<the single most impactful change this streamer can make next stream — specific to what you saw, actionable immediately>",
  "next_stream_goals": [
    "<specific, doable action for next stream — not a vague goal, a concrete thing to try>",
    "<specific, doable action for next stream — not a vague goal, a concrete thing to try>",
    "<specific, doable action for next stream — not a vague goal, a concrete thing to try>"
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

// Used in transcript lines fed to Claude for peak detection.
// Plain integer seconds (e.g. "813s") avoids the M:SS colon being
// misread as a decimal point, which caused Claude to output start=13.33
// instead of start=813 — producing 0.1-second "clips" that fail validation.
function toSeconds(seconds: number): string {
  return `${Math.round(seconds)}s`;
}
