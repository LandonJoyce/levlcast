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
export async function detectPeaks(
  segments: TranscriptSegment[],
  vodTitle: string
): Promise<Peak[]> {
  const anthropic = new Anthropic();

  const transcript = segments
    .map((s) => `[${formatTime(s.start)}-${formatTime(s.end)}] ${s.text}`)
    .join("\n");

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You are a viral content strategist who specializes in Twitch-to-TikTok clip selection. You have deep knowledge of what makes gaming and streaming content stop people mid-scroll. You understand pacing, emotional peaks, and the psychology of short-form content. You are ruthlessly selective — you only flag moments that could genuinely perform.`,
    messages: [
      {
        role: "user",
        content: `Find the top viral clip moments from this Twitch stream transcript.

Stream title: "${vodTitle}"

Timestamped transcript:
${transcript}

WHAT MAKES A GREAT TWITCH CLIP:
- A moment where the streamer's emotion spikes suddenly (shock, hype, laughter, rage, disbelief)
- A payoff moment after visible buildup (clutch play, comeback, funny fail)
- A hot take or strong opinion that would spark debate in comments
- A genuinely funny or unexpected reaction that doesn't need context to land
- A teaching moment with a clear insight that viewers would screenshot or save
- The streamer saying something that would make viewers tag a friend
- Moments where chat would have exploded (even if you can't see chat, look for verbal cues like "let's go", "no way", "chat", laughter, repeated excitement)

WHAT TO AVOID:
- Slow moments with no clear payoff
- Inside jokes that need too much context
- Moments that are mid-sentence or cut off awkwardly
- Filler content (bathroom breaks, loading screens, AFK moments)

SCORING RUBRIC (0.0 - 1.0):
- 0.9-1.0: Will stop mid-scroll. Universally funny, hype, or emotionally resonant. No context needed.
- 0.7-0.89: Strong clip. Clear emotion or payoff. Works for the streamer's audience.
- 0.5-0.69: Decent clip. Has a moment but needs context or niche appeal.
- Below 0.5: Do not include.

CLIP BOUNDARIES:
- Include 3-5 seconds of buildup before the peak so viewers feel the tension
- Include 2-3 seconds after the payoff so the reaction lands fully
- Target 30-75 seconds. Never exceed 90 seconds.

IMPORTANT: No emojis anywhere. Clean text only.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "title": "<hook-style title under 60 chars — make it a statement or reaction, not a description>",
    "start": <start time in seconds>,
    "end": <end time in seconds>,
    "score": <virality score 0.0-1.0>,
    "category": "<hype | funny | emotional | educational>",
    "reason": "<why this moment will perform — be specific about the emotional trigger>",
    "hook": "<describe the opening 3 seconds of this clip that will stop someone from scrolling>",
    "caption": "<TikTok caption under 150 chars — conversational, not salesy, with 3-4 relevant hashtags>"
  }
]

Return 3-5 peaks sorted by score descending. Be selective — 3 great clips beats 5 mediocre ones. If there are no moments scoring above 0.5, return [].`,
      },
    ],
  }), 3, 1000);

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const peaks: Peak[] = JSON.parse(cleaned);
    return peaks
      .filter((p) => p.start >= 0 && p.end > p.start && p.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    console.error("Failed to parse Claude peak response:", text);
    return [];
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
