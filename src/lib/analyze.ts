import Anthropic from "@anthropic-ai/sdk";
import { TranscriptSegment } from "./deepgram";

export interface Peak {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason: string;
  caption: string;
}

/**
 * Analyze a transcript with Claude to find peak/viral moments.
 * Returns scored peaks with clip boundaries and captions.
 */
export async function detectPeaks(
  segments: TranscriptSegment[],
  vodTitle: string
): Promise<Peak[]> {
  const anthropic = new Anthropic();

  // Build a compact transcript with timestamps
  const transcript = segments
    .map((s) => `[${formatTime(s.start)}-${formatTime(s.end)}] ${s.text}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are analyzing a Twitch stream transcript to find the best moments for short-form clips (30-90 seconds). The VOD title is: "${vodTitle}"

Here is the timestamped transcript:

${transcript}

Find the top moments that would make great TikTok/YouTube Shorts clips. Look for:
- Hype moments (big plays, victories, clutch moments)
- Funny moments (jokes, fails, unexpected reactions)
- Emotional moments (rage, excitement, wholesome)
- Educational moments (tips, insights, hot takes)

For each moment, expand the time window slightly (add 3-5 seconds before and after) to capture full context. Aim for 30-90 second clips.

IMPORTANT: Do NOT use any emojis anywhere in your response. Keep all text clean and simple.

Respond with ONLY a JSON array (no markdown, no code fences) of objects with these fields:
- title: short clip title (catchy, under 60 chars, no emojis)
- start: start time in seconds (number)
- end: end time in seconds (number)
- score: virality score 0.0-1.0 (number)
- category: one of "hype", "funny", "emotional", "educational"
- reason: why this moment is clip-worthy (1 sentence, no emojis)
- caption: social media caption with hashtags (under 200 chars, no emojis)

Return up to 5 peaks, sorted by score descending. If the transcript is too short or has no notable moments, return an empty array [].`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const peaks: Peak[] = JSON.parse(cleaned);
    return peaks
      .filter((p) => p.start >= 0 && p.end > p.start && p.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    console.error("Failed to parse Claude response:", text);
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
}

/**
 * Generate an AI stream coaching report from a transcript and detected peaks.
 * Gives the streamer actionable feedback on what worked and what to improve.
 */
export async function generateCoachReport(
  segments: TranscriptSegment[],
  vodTitle: string,
  peaks: Peak[]
): Promise<CoachReport | null> {
  const anthropic = new Anthropic();

  const transcript = segments
    .map((s) => `[${formatTime(s.start)}] ${s.text}`)
    .join("\n");

  const peaksSummary = peaks
    .map((p) => `- ${p.title} at ${formatTime(p.start)} (${p.category}, score: ${p.score.toFixed(2)}): ${p.reason}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an expert Twitch stream growth coach. Analyze this stream and give the streamer specific, actionable feedback.

Stream title: "${vodTitle}"

Top moments detected:
${peaksSummary || "No standout moments detected."}

Transcript sample (first 4000 chars):
${transcript.slice(0, 4000)}

Give honest, specific coaching feedback. Be direct and actionable — not generic.

IMPORTANT: No emojis anywhere in your response.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "overall_score": <0-100 integer based on stream quality, engagement, and content variety>,
  "stream_summary": "<2-3 sentence honest summary of the stream>",
  "energy_trend": "<one of: building, declining, consistent, volatile>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<specific actionable improvement 1>", "<specific actionable improvement 2>"],
  "best_moment": { "time": "<MM:SS>", "description": "<what happened and why it worked>" },
  "content_mix": [
    { "category": "<hype|funny|educational|gameplay|chat interaction>", "percentage": <0-100 integer> }
  ],
  "recommendation": "<single most important thing to do differently next stream>"
}`,
      },
    ],
  });

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
