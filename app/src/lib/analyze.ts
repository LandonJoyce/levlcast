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

  // Snap start: find the utterance that contains or is closest before peak.start
  let snappedStart = peak.start;
  for (const seg of segments) {
    if (seg.start <= peak.start && seg.end >= peak.start) {
      snappedStart = seg.start;
      break;
    }
  }

  // Snap end: find the utterance that contains or is closest after peak.end
  let snappedEnd = peak.end;
  for (const seg of segments) {
    if (seg.start <= peak.end && seg.end >= peak.end) {
      snappedEnd = seg.end;
      break;
    }
  }

  // Only apply if it doesn't shrink the clip below 15 seconds
  if (snappedEnd - snappedStart >= 15) {
    return { ...peak, start: snappedStart, end: snappedEnd };
  }
  return peak;
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

BACKGROUND AUDIO — critical filter:
Streamers often have music or videos playing. Skip anything that looks like song lyrics (rhyming, repetitive structure), scripted dialogue, or text that sounds like it came from media rather than a live person talking. Only clip the streamer's own authentic voice and reactions.

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
// 20 minutes keeps each Claude call fast and within token limits.
const CHUNK_SECONDS = 20 * 60;

// Maximum peaks returned per VOD. Keeping this low forces quality over quantity.
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

  const vodDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;

  // Short VODs (<= 25 min): single pass, no chunking needed
  if (vodDuration <= CHUNK_SECONDS + 5 * 60) {
    const peaks = await runPeakDetection(anthropic, vodTitle, segments);
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
    const peaks = await runPeakDetection(anthropic, vodTitle, chunk);
    allPeaks.push(...peaks);
  }

  // If we have enough candidates, do a final re-ranking pass
  const topCandidates = allPeaks
    .sort((a, b) => b.score - a.score)
    .slice(0, RERANK_CANDIDATE_LIMIT);

  if (topCandidates.length <= MAX_PEAKS) {
    return topCandidates;
  }

  // Re-rank pass: ask Claude to pick the best from all candidates
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
    // Fallback: just return top by score
    return topCandidates.slice(0, MAX_PEAKS);
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
 * Category-specific coaching knowledge derived from studying what separates
 * top performers in each streaming category. Used to give targeted advice
 * that goes beyond generic streaming tips.
 */
const CATEGORY_COACHING_GUIDE: Record<string, string> = {
  gaming: `GAMING STREAMER COACHING STANDARDS:
What separates top gaming streamers from average ones:
- The commentary IS the content — not just narrating what is happening on screen, but adding personality, prediction, and emotion on top of it. Silence during intense gameplay can be fine, but silence during downtime is dead content.
- Live vocal reactions matter more than the outcome. A loud genuine reaction to a near-miss is more entertaining than winning silently. Top gaming streamers make the viewer FEEL the stakes.
- Downtime between action (loading, menus, queue waiting) is when great gaming streamers build community. They tell personal stories, ask chat questions, or give hot takes on the game or gaming culture. This is where personality is built.
- Confident voice even in failure. The best gaming streamers are entertaining whether winning or losing because they frame both as stories. Self-deprecating humor in failure keeps viewers invested.
- Strong opinions on the game — patches, meta, other players' decisions, bad design choices. Opinion-driven commentary creates clips and debate, which drives growth.
- Treating chat like a stadium crowd — big moments are announced with energy. Low moments are narrated with drama. The streamer creates the emotional arc for the viewer, not just the game.

Key coaching focus areas for gaming streamers:
- Is their commentary track adding value or just narrating the obvious?
- Are they energizing dead moments between gameplay action?
- Are they sharing opinions that would make a viewer want to clip and share?
- Is the energy proportional to what is happening on screen?`,

  just_chatting: `JUST CHATTING STREAMER COACHING STANDARDS:
What separates top just chatting streamers from average ones:
- Radical authenticity is the product. Audiences watch just chatting streams because they want to feel like they know someone. Performed emotions, forced reactions, or overly polished delivery kills this. The most growth comes from unfiltered, genuine personality.
- React content done right requires genuine real-time processing — the streamer's first authentic reaction, not a performed one. Top streamers react before they think about how they look. That realness is what gets clipped.
- Parasocial relationship building is a skill. Remembering regular chatters by name, referencing past streams, sharing personal updates, and treating chat like a room of friends they know — this is what converts casual viewers into loyal regulars.
- Hot takes create organic clip spread. A strong opinion stated clearly — even a controversial one — generates debate, sharing, and return visits. Streamers who avoid controversy also avoid organic growth.
- Long-form conversation skills: the ability to hold attention through 2-4 hours with just personality and talk. This requires having genuine interests, stories, and opinions — not just reacting to other people's content.
- Making chat part of the content: the best just chatting streamers turn chat messages into comedic material, debate partners, or story prompts. Chat is a co-star, not a side element.

Key coaching focus areas for just chatting streamers:
- Is the streamer showing genuine unfiltered personality or performing for the camera?
- Are they building real relationships with chat or talking at them?
- Are they sharing opinions strong enough to make someone want to clip and argue?
- Is there a clear point of view that a viewer could describe to someone else?`,

  irl: `IRL STREAMER COACHING STANDARDS:
What separates top IRL streamers from average ones:
- Environmental storytelling: the location is a co-character. Top IRL streamers narrate their environment, comment on what they see, and treat the real world as content. They do not just carry a camera — they give the viewer a perspective.
- Engaging strangers authentically. The best IRL moments come from genuine interactions, not forced ones. A natural conversation with a stranger that goes somewhere unexpected beats a scripted interaction every time.
- Narrating internal thoughts in real time. Top IRL streamers voice what they are thinking as they experience it — this creates intimacy and makes the viewer feel like they are inside the streamer's head. This is the IRL version of personality building.
- Reacting naturally to unexpected moments is the content. When something unexpected happens, the streamer's genuine unscripted reaction is the clip. Trying to manage or control these moments kills them.
- Building recurring arcs across streams. Top IRL streamers have ongoing threads — a place they keep returning to, a project they are working toward, a relationship with a recurring person in their life. Viewers follow arcs, not random days.
- Chat as a companion on the journey. The best IRL streamers loop chat in — reading chat reactions to what is happening, asking chat what to do next, sharing moments with chat like a friend who is there with them.

Key coaching focus areas for IRL streamers:
- Is the streamer giving the viewer a genuine perspective on the world they are moving through?
- Are they narrating thoughts and reactions out loud, or going quiet and losing the viewer?
- Are there natural moments that would feel authentic clipped out of context?
- Is chat being treated as a companion or ignored?`,

  variety: `VARIETY STREAMER COACHING STANDARDS:
What separates top variety streamers from average ones:
- The personality, not the game, is what viewers follow. Top variety streamers have a consistent identity that makes them recognizable whether they are playing an FPS, a simulator, or a cozy game. The content changes — the character does not.
- Smooth transitions between content types require narrative connective tissue. Top variety streamers frame transitions as part of the show: "alright we are done with that, let me tell you what we are getting into next." They bring chat along, they do not just switch.
- Building loyal audience who follow the person, not the category. This happens through consistent personality, consistent values, and making viewers feel like they know who this person is regardless of what they are playing.
- Cross-content chemistry: the best variety streamers find ways to connect different games or content types to their personality and to each other. They are not playing games — they are experiencing things and sharing that experience.
- Energy management across long variety sessions. Switching games can re-energize a stream, but it can also reset momentum. Top variety streamers read when energy is dropping and time switches to capitalize on it, not escape it.

Key coaching focus areas for variety streamers:
- Is there a consistent personality that would be recognizable across any game?
- Are transitions handled smoothly with chat brought along?
- Would a new viewer understand who this person is regardless of what they are playing?`,

  educational: `EDUCATIONAL STREAMER COACHING STANDARDS:
What separates top educational streamers from average ones:
- Teaching as entertainment: the best educational streamers use Socratic method, real-time problem solving, and genuine curiosity to make learning feel like discovery. Dry lecture delivery drives viewers away. The best educational content feels like watching someone figure something out in real time.
- Accessible complexity: top educational streamers find analogies, metaphors, and comparisons that make difficult topics click instantly. If a viewer needs background knowledge to follow along, most viewers leave. The skill is making complex things feel obvious.
- Acknowledging mistakes and confusion builds trust. Streamers who pretend to know everything feel inauthentic. Saying "I'm not sure, let me think through this" and working through uncertainty live is more valuable than projecting false confidence.
- Structured segments with clear payoffs keep retention high. Top educational streamers give the viewer a destination: "by the end of this I'm going to show you why X works." Viewers stay when they know where they are going.
- Chat-driven content: letting chat questions steer the content creates investment. When chat influences where the stream goes, viewers feel ownership and stay to see their contribution play out.

Key coaching focus areas for educational streamers:
- Is the teaching style engaging or is it dry lecture delivery?
- Are complex topics being made genuinely accessible with analogies or examples?
- Is uncertainty handled authentically rather than with false confidence?
- Is chat being used to shape the direction of the content?`,
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

  // Build category coaching context — all categories included so Claude can match
  // after it identifies the streamer type. The relevant section becomes the benchmark.
  const categoryGuideBlock = Object.entries(CATEGORY_COACHING_GUIDE)
    .map(([, guide]) => guide)
    .join("\n\n");

  const response = await withRetry(() => anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: `You are a Twitch growth coach who is also a seasoned streamer yourself. You speak the language — you know what dead air feels like, what it means to go live cold, when chat is sleeping, when someone's in the zone vs grinding silent. Your feedback sounds like a knowledgeable streaming friend giving real talk, not a corporate consultant writing a report.

You are direct and honest. Your job is not to make the streamer feel good — it is to make them better next stream. You use natural streaming culture language throughout: dead air, chat sleeping, no hype, clipping moments, energy diff, grinding silent, lurker mode, going off, stream pacing. This language makes feedback feel real and relatable, not like homework.

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

CATEGORY COACHING STANDARDS — use the section matching the streamer type you identify:
${categoryGuideBlock}

Adapt ALL feedback to the standards for their category. Every strength and improvement must be evaluated against what actually works for streamers in that specific category, not generic streaming advice.

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
- NEVER quote the transcript directly. Describe in your own words.
- KEEP IT SHORT. Every field has a strict word limit. Do not exceed it.
- Strengths: **2-3 word bold label** — one sentence on what worked. Max 20 words after the label.
- Improvements: **2-3 word bold label** — one sentence on the problem. One sentence fix. Max 25 words after the label.
- Bold labels must use natural streamer language — words the streaming community actually uses. Good examples: "Dead Air", "Chat Sleeping", "No Hype", "Grinding Silent", "Viewers Left Out", "No Hook", "Clipped That", "Energy Diff", "Going Off", "Lurker Mode", "No W For Chat", "Vibing Alone", "Stream Pacing". Bad examples: "No Viewer Arc", "Stream Invisibility", "Content Vacuum", "Audience Disconnect" — these sound like a marketing consultant, not a coach. Write like a fellow streamer giving real talk, not a corporate report.
- The overall tone of all feedback should feel like a knowledgeable streamer friend giving honest advice — direct, casual, uses streaming culture language naturally. Not academic, not corporate, not overly formal.
- Recommendation: 1-2 sentences max. The single most impactful change. No explanation, no buildup.
- Stream summary: 1-2 sentences max. What kind of stream, biggest takeaway. That's it.
- Best moment description: 2 sentences max.
- Goals: one sentence each. Concrete and measurable.
- No emojis. No padding. If it can be said in 10 words, don't use 20.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "overall_score": <integer 0-100>,
  "streamer_type": "<gaming | just_chatting | irl | variety | educational>",
  "stream_summary": "<1-2 sentences max: what kind of stream, single biggest takeaway>",
  "energy_trend": "<building | declining | consistent | volatile>",
  "viewer_retention_risk": "<low | medium | high>",
  "strengths": [
    "**Label** — one sentence, max 20 words.",
    "**Label** — one sentence, max 20 words.",
    "**Label** — one sentence, max 20 words."
  ],
  "improvements": [
    "**Label** — problem in one sentence. Fix: one sentence. Max 25 words total after label.",
    "**Label** — problem in one sentence. Fix: one sentence. Max 25 words total after label.",
    "**Label** — problem in one sentence. Fix: one sentence. Max 25 words total after label."
  ],
  "best_moment": {
    "time": "<MM:SS>",
    "description": "<2 sentences max: what happened and why it worked>"
  },
  "content_mix": [
    { "category": "<gameplay | chat interaction | commentary | educational | funny | hype>", "percentage": <integer 0-100> }
  ],
  "recommendation": "<1-2 sentences max. Most impactful change. No buildup.>",
  "next_stream_goals": [
    "<one sentence, concrete and measurable>",
    "<one sentence, concrete and measurable>",
    "<one sentence, concrete and measurable>"
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
