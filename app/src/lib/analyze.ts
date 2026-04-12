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
 */
function snapToUtteranceBoundaries(peak: Peak, segments: TranscriptSegment[]): Peak {
  if (segments.length === 0) return peak;

  let snappedStart = peak.start;
  for (const seg of segments) {
    if (seg.start <= peak.start && seg.end >= peak.start) {
      snappedStart = seg.start;
      break;
    }
  }

  let snappedEnd = peak.end;
  for (const seg of segments) {
    if (seg.start <= peak.end && seg.end >= peak.end) {
      snappedEnd = seg.end;
      break;
    }
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

SOURCE QUALITY:
This transcript was pre-filtered using speaker diarization to include only the streamer's voice — game audio, music, and NPC dialogue have been removed. Every line is something the streamer actually said. If you still see anything that looks like scripted dialogue or song lyrics, skip it — it slipped through the filter.

SCORING (0.0 - 1.0):
- 0.85-1.0: Stops mid-scroll. Strong hook in first 3 seconds, universal reaction, needs zero context.
- 0.70-0.84: Strong clip. Clear emotional peak with payoff, works standalone.
- 0.60-0.69: Decent clip. Relatable with minimal context.
- Below 0.60: Skip.

CLIP BOUNDARIES — be precise:
- Start: 4-6 seconds BEFORE the peak moment so the setup is there
- End: 3-5 seconds AFTER the reaction so it fully lands
- Duration: 30-90 seconds total. Sweet spot is 45-75 seconds.
- Land on complete sentences — never cut mid-utterance

Timestamps are plain seconds (e.g. 813 = 813 seconds into the stream).
Output "start" and "end" as plain integers. Minimum clip length: 20 seconds.
No emojis. Clean text only.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "title": "<hook-style title under 60 chars — what the streamer said or reacted to>",
    "start": <start time as plain integer seconds>,
    "end": <end time as plain integer seconds>,
    "score": <virality score 0.0-1.0>,
    "category": "<hype | funny | emotional | educational>",
    "reason": "<why this will perform — quote the exact words from the transcript that signal the peak>",
    "hook": "<what happens in the opening 3 seconds that stops someone scrolling>",
    "caption": "<TikTok caption under 150 chars — conversational, not salesy, 3-4 relevant hashtags>"
  }
]

Return 3-6 peaks sorted by score descending. If nothing clears 0.60, return [].`;
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
    system: `You are a viral content strategist selecting the best clips from a Twitch stream for TikTok.`,
    messages: [{
      role: "user",
      content: `From these ${topCandidates.length} candidate clips, pick the ${MAX_PEAKS} with the highest viral potential for TikTok. Prioritize clips that work standalone with no context, have a strong hook in the first 3 seconds, and have clear emotional payoff. Return ONLY a JSON array of their 1-based numbers, e.g. [2, 5, 7, 11, 14, 16]. No explanation.\n\nCandidates:\n${candidateSummary}`,
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

  // ── Peaks summary for coaching context ──
  const peaksSummary = peaks.length > 0
    ? peaks.map((p) => `- "${p.title}" at ${formatTime(p.start)}–${formatTime(p.end)} [${p.category}, score: ${p.score.toFixed(2)}]\n  Why it works: ${p.reason}`).join("\n")
    : "No standout moments detected — the stream lacked clear viral peaks.";

  const categoryGuideBlock = Object.values(CATEGORY_COACHING_GUIDE).join("\n\n");

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `You are a Twitch growth coach who is also a seasoned streamer yourself. You speak the language — you know what dead air feels like, what it means to go live cold, when chat is sleeping, when someone's in the zone vs grinding silent. Your feedback sounds like a knowledgeable streaming friend giving real talk, not a corporate consultant.

You are direct and honest. Your job is not to make the streamer feel good — it is to make them better. You use natural streaming culture language: dead air, chat sleeping, no hype, clipping moments, energy diff, grinding silent, lurker mode, going off, stream pacing.

CORE PRINCIPLE: You watched this specific stream. You know what happened. Every piece of feedback references a real moment — a timestamp, a specific topic they talked about, a specific thing they did or didn't do. Generic advice that could apply to any streamer is useless and you never give it.

If you write a strength, you name the exact moment that showed it and tell them how to recreate it. If you write an improvement, you name when and where the problem showed up and give a fix that only makes sense for this specific stream.`,
    messages: [
      {
        role: "user",
        content: `Review this Twitch stream and produce a coaching report the streamer can act on immediately.

IMPORTANT: This transcript has been pre-filtered using speaker diarization to include ONLY the streamer's voice. Game audio, NPC dialogue, music, and other speakers have already been removed. Every line you read is something the streamer actually said. Dead air gaps in the transcript reflect real silence from the streamer — not background audio.

STREAM INFO:
- Title: "${vodTitle}"
- Duration: ${totalMinutes} minutes
- Overall talking pace: ~${overallWPM} wpm (engaging streamers: 140-170 wpm; below 120 wpm = low energy)
- Dead air: ${deadAirSummary}

AI-DETECTED PEAK MOMENTS (the best clips the AI found):
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
- "gaming": playing a game, commentary on gameplay
- "just_chatting": talking to chat, no game or game is secondary
- "irl": real life, outdoors, events
- "variety": switching between games or formats
- "educational": tutorials, how-to content

CATEGORY COACHING STANDARDS (use the one matching the streamer type you identify):
${categoryGuideBlock}

EVALUATION — work through each before writing feedback:

1. ENERGY CURVE: Look at wpm per section. Where did energy spike and where did it crater? Name the specific moments.
2. DEAD AIR: Which gaps were from the game (acceptable) vs. losing momentum (bad)? Only flag the ones that actually hurt.
3. PERSONALITY: When did their real personality show? What triggered it? How often did it happen vs. how often were they just filling air?
4. CHAT: Were they treating chat as a co-star or an afterthought? Did any specific chat interaction go well or get ignored?
5. PEAKS: What specifically created the detected peaks? If peaks are weak or missing, what was happening in the transcript where a peak should have been?
6. NARRATIVE: Did the stream have a story? Did it build toward anything? Where did it feel alive vs. dead?

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
- Cold open: score the first 5 minutes only. "strong" = hooked immediately, energy and presence from first words. "average" = took a few minutes to find footing. "weak" = opened cold, silent, or directionless. Note: 1 sentence, specific to what actually happened in those first minutes.
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
  ]
}`,
      },
    ],
  }), 3, 1000);

  const text = response.content[0].type === "text" ? response.content[0].text : "";

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
