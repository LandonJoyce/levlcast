/**
 * lib/chat-pulse.ts
 *
 * Turns raw Twitch chat replay into time-bucketed metrics suitable for
 * coaching analysis, clip-moment scoring, and timeline visualization.
 * The bucketed shape is what gets persisted (vods.chat_pulse) — raw
 * messages are too large and PII-heavy to keep around.
 *
 * Why these specific signals:
 *   - laughs:   Direct positive reaction. Critical for comedy/reaction content.
 *   - hype:     Energy alignment. Tells us whether the streamer hyped chat up.
 *   - sad:      Failure / cringe / sympathy. Different valence than laughs.
 *   - sub/bit:  Monetary signal. Strong indicator of value moments.
 *   - raid:     Audience injection event — explains a sudden volume spike.
 *
 * The pulse is the GROUND TRUTH for engagement that AI wrappers can't
 * see — they can guess from transcripts whether a joke landed, but only
 * we can confirm it landed because chat actually reacted.
 */

import type { ChatMessage } from "./twitch";

export interface ChatBucket {
  start: number;       // seconds, bucket start (inclusive)
  end: number;         // seconds, bucket end (exclusive)
  count: number;       // total messages
  uniqueChatters: number;
  laughCount: number;
  hypeCount: number;
  sadCount: number;
  subEvents: number;
  bitEvents: number;
  raidEvents: number;
  /** Net-positive sentiment proxy: (laughs+hype) - sad. Useful for coloring. */
  vibe: number;
  // ─── Surgical metrics (computed in a second pass) ──────────────────────────
  /**
   * Velocity — bucket count divided by stream-wide average bucket count.
   * v=1 is normal, v>1.5 is a real spike RELATIVE to this streamer's
   * typical bucket density. Normalizes for streamer size: a spike for a
   * 10-viewer stream looks the same as a spike for a 10,000-viewer stream.
   */
  velocity: number;
  /**
   * Diversity — unique chatters in bucket divided by total messages in
   * bucket. d=1 means every message is from a different person (community
   * moment). d~0.2 means a few people had a long conversation (NOT a
   * community win, even if message count is high). Used to filter out
   * "looks like a spike but it's just one person spamming" false positives.
   */
  diversity: number;
  /**
   * Hype ratio — fraction of messages that were emote-only / very short
   * reaction tokens (POG, KEKW, LUL, +1, F, W). On Twitch these are the
   * purest sentiment signal because text gets dampened by people typing
   * questions. High hypeRatio + high velocity = a clip-worthy moment.
   */
  hypeRatio: number;
  /**
   * Dominant signal label — coarse human-readable category for prompts and
   * UI. "laughs" / "hype" / "sad" / "neutral" / "monetary".
   */
  dominantSignal: "laughs" | "hype" | "sad" | "monetary" | "neutral";
}

const DEFAULT_BUCKET_SEC = 30;

/**
 * Minimum chat activity required for the pulse to be statistically
 * meaningful. Below this we don't draw a timeline (looks embarrassing
 * for new streamers) and we don't feed it into AI prompts (bad signal).
 *
 * Threshold rationale:
 *   - 50 total messages: enough to see at least 2-3 distinct activity windows
 *   - 0.3 msgs/min: roughly 1 message per 3min — below this every bucket is
 *     basically empty noise
 *   - 5 unique chatters: 1-2 viewers is a stream buddy, not an audience
 */
const MIN_VIABLE_TOTAL_MESSAGES = 50;
const MIN_VIABLE_MSGS_PER_MIN = 0.3;
const MIN_VIABLE_UNIQUE_CHATTERS = 5;

// Pattern bank — case-insensitive substring matches. Order doesn't matter
// because each message is checked against ALL banks (a message can be both
// hype AND a sub event etc.).
//
// Choices justified by Twitch chat reality:
//   - "kekw"/"omegalul"/"lul" are among the top ~10 emotes by usage in 2024+
//   - "pog" / "pogchamp" / "pogu" remain top reaction emotes
//   - "f"/"rip"/"sadge"/"monkas" cluster the failure-empathy emotes
//   - We match on bare strings AND emote-style tokens; both forms appear
const LAUGH_PATTERNS = [
  /\blol\b/i, /\blmao\b/i, /\brofl\b/i, /\blmfao\b/i,
  /\blul\b/i, /kekw/i, /omegalul/i, /4head/i, /kappa/i,
  /\bha+\b/i, /\bhaha+/i, /joke/i,
];

const HYPE_PATTERNS = [
  /\bpog+\b/i, /pogchamp/i, /pogu/i, /poggies/i, /pogtasty/i,
  /letsgo/i, /let'?s\s+go/i, /\blesgooo+/i,
  /\bw\b/i, /\bdub\b/i, /\bgg\b/i, /\bggs\b/i, /\bclutch\b/i,
  /\bfire\b/i, /\bgoated\b/i, /\binsane\b/i, /\bclean\b/i,
  /\bpoggers\b/i, /\bhype\b/i, /\bcracked\b/i,
];

const SAD_PATTERNS = [
  /^f$/i, /\brip\b/i, /sadge/i, /monkas/i, /pepehands/i,
  /\bpain\b/i, /\bouch\b/i, /\bnoo+\b/i, /\bbruh\b/i, /\bweirdchamp/i,
  /\bthrow\b/i, /\bgriefed\b/i, /\bcringe\b/i, /\bcope\b/i,
];

// Sub / resub / gift-sub messages from Twitch IRC notices come through chat
// replay as "<user> subscribed at Tier 1!" / "subscribed with Prime" / etc.
const SUB_PATTERNS = [
  /\bsubscribed\b/i, /\bgifted\s+a/i, /\bgift\s+subs?\b/i, /\bjust\s+subbed\b/i,
  /\bresub\b/i, /\bprime\s+sub\b/i, /\bre-?subscribed\b/i,
];

// Cheers come through chat as "<text> cheer100 <text>" — substring match
// on "cheer" + digits is enough.
const BIT_PATTERN = /\bcheer\d+/i;

// Raid notices: "<channel> is raiding ..." or replay format "X raiders from Y"
const RAID_PATTERNS = [
  /\braiding\b/i, /\bjust\s+raided\b/i, /\braiders\s+from\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  for (const p of patterns) {
    if (p.test(text)) return true;
  }
  return false;
}

/**
 * Detect "emote-only" / pure-reaction messages — the ground-truth hype
 * signal on Twitch. These are short, mostly-token messages like "POG",
 * "KEKW LUL KEKW", "W", "+1", "F", "OMEGALUL OMEGALUL OMEGALUL".
 *
 * Heuristic: 1-4 words, every word ≤ 12 chars, AND at least one of:
 *   - all-uppercase (typical emote naming convention: KEKW, LUL, POG)
 *   - matches the laugh / hype / sad pattern banks
 *   - is a single-character "F" or "+1" / "-1" reaction
 * Excludes messages with sentence punctuation (?, .) which usually
 * indicates real text not pure reaction.
 */
function isEmoteOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (/[?.!]{2,}/.test(trimmed)) return false; // multiple ?? or ... = typed sentence
  const words = trimmed.split(/\s+/);
  if (words.length === 0 || words.length > 4) return false;
  if (words.some((w) => w.length > 12)) return false;

  for (const word of words) {
    const w = word.replace(/[!?.,]+$/, "");
    if (!w) return false;
    // Single-char reactions
    if (/^[Ff]$/.test(w) || /^[+\-]\d$/.test(w)) continue;
    // All-uppercase tokens like KEKW, LUL, POG
    if (/^[A-Z][A-Z0-9]+$/.test(w) && w.length >= 3) continue;
    // Hits one of our pattern banks
    if (
      matchesAny(w, LAUGH_PATTERNS) ||
      matchesAny(w, HYPE_PATTERNS) ||
      matchesAny(w, SAD_PATTERNS)
    ) continue;
    return false;
  }
  return true;
}

function pickDominantSignal(b: ChatBucket): ChatBucket["dominantSignal"] {
  // Monetary trumps everything because subs/bits/raids are explicit events
  if (b.subEvents + b.bitEvents + b.raidEvents > 0) {
    // Only flag as monetary if those events are at least 10% of the bucket;
    // otherwise it's a normal bucket that happens to contain one cheer.
    if ((b.subEvents + b.bitEvents + b.raidEvents) / Math.max(1, b.count) >= 0.1) {
      return "monetary";
    }
  }
  const laughs = b.laughCount;
  const hype = b.hypeCount;
  const sad = b.sadCount;
  const max = Math.max(laughs, hype, sad);
  // Need at least 3 reaction signals to dominate
  if (max < 3) return "neutral";
  if (max === laughs) return "laughs";
  if (max === hype) return "hype";
  return "sad";
}

/**
 * Bucket chat messages into fixed-duration windows. Empty buckets are
 * still emitted (count=0) so timeline visualizations have a continuous
 * x-axis without gaps.
 */
export function bucketChat(
  messages: ChatMessage[],
  durationSeconds: number,
  bucketSec: number = DEFAULT_BUCKET_SEC
): ChatBucket[] {
  if (durationSeconds <= 0) return [];
  const bucketCount = Math.ceil(durationSeconds / bucketSec);
  const buckets: ChatBucket[] = [];
  const userSetsPerBucket: Set<string>[] = [];
  const emoteOnlyPerBucket: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      start: i * bucketSec,
      end: Math.min((i + 1) * bucketSec, durationSeconds),
      count: 0,
      uniqueChatters: 0,
      laughCount: 0,
      hypeCount: 0,
      sadCount: 0,
      subEvents: 0,
      bitEvents: 0,
      raidEvents: 0,
      vibe: 0,
      velocity: 0,
      diversity: 0,
      hypeRatio: 0,
      dominantSignal: "neutral",
    });
    userSetsPerBucket.push(new Set<string>());
    emoteOnlyPerBucket.push(0);
  }

  // Pass 1: per-bucket counts
  for (const msg of messages) {
    if (msg.time < 0 || msg.time >= durationSeconds) continue;
    const idx = Math.min(bucketCount - 1, Math.floor(msg.time / bucketSec));
    const b = buckets[idx];
    b.count++;
    userSetsPerBucket[idx].add(msg.user);

    const text = msg.text;
    if (matchesAny(text, LAUGH_PATTERNS)) b.laughCount++;
    if (matchesAny(text, HYPE_PATTERNS)) b.hypeCount++;
    if (matchesAny(text, SAD_PATTERNS)) b.sadCount++;
    if (matchesAny(text, SUB_PATTERNS)) b.subEvents++;
    if (BIT_PATTERN.test(text)) b.bitEvents++;
    if (matchesAny(text, RAID_PATTERNS)) b.raidEvents++;
    if (isEmoteOnly(text)) emoteOnlyPerBucket[idx]++;
  }

  // Pass 2: stream-wide aggregates needed for velocity normalization
  let totalCount = 0;
  let nonEmptyBuckets = 0;
  for (const b of buckets) {
    totalCount += b.count;
    if (b.count > 0) nonEmptyBuckets++;
  }
  // Use non-empty avg so a 4-hour stream with chat in just 2 hrs doesn't
  // get a deflated baseline that makes every active bucket look like a spike.
  const avgPerBucket = nonEmptyBuckets > 0 ? totalCount / nonEmptyBuckets : 0;

  // Pass 3: derived metrics + dominant signal
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    b.uniqueChatters = userSetsPerBucket[i].size;
    b.vibe = b.laughCount + b.hypeCount - b.sadCount;
    b.velocity = avgPerBucket > 0 ? b.count / avgPerBucket : 0;
    b.diversity = b.count > 0 ? b.uniqueChatters / b.count : 0;
    b.hypeRatio = b.count > 0 ? emoteOnlyPerBucket[i] / b.count : 0;
    b.dominantSignal = pickDominantSignal(b);
  }

  return buckets;
}

export interface ChatPulseSummary {
  totalMessages: number;
  totalUniqueChatters: number;
  avgPerBucket: number;
  peakBucket: ChatBucket | null;
  quietestBucket: ChatBucket | null;
  /** Buckets ranked by surprise factor — relative drops/spikes vs neighbors */
  notableMoments: Array<{
    type: "spike" | "drop" | "sub_burst" | "bit_burst" | "raid";
    bucket: ChatBucket;
    note: string;
  }>;
}

const SPIKE_THRESHOLD = 2.5;   // bucket has >2.5x neighbor average
const DROP_THRESHOLD = 0.3;    // bucket has <0.3x neighbor average

/**
 * Summarize a bucket array into headline stats + notable moments. Used
 * by the coach report prompt and the timeline UI's annotations.
 */
export function summarizePulse(buckets: ChatBucket[], allMessages: ChatMessage[]): ChatPulseSummary {
  if (buckets.length === 0 || allMessages.length === 0) {
    return {
      totalMessages: 0,
      totalUniqueChatters: 0,
      avgPerBucket: 0,
      peakBucket: null,
      quietestBucket: null,
      notableMoments: [],
    };
  }

  const totalMessages = allMessages.length;
  const uniqueUsers = new Set(allMessages.map((m) => m.user));

  let peak = buckets[0];
  let quietest = buckets[0];
  let sum = 0;
  for (const b of buckets) {
    sum += b.count;
    if (b.count > peak.count) peak = b;
    if (b.count < quietest.count) quietest = b;
  }
  const avg = sum / buckets.length;

  const notable: ChatPulseSummary["notableMoments"] = [];

  // Sub / bit / raid bursts always make the cut — these are concrete events.
  for (const b of buckets) {
    if (b.subEvents >= 3) {
      notable.push({ type: "sub_burst", bucket: b, note: `${b.subEvents} sub events in this window` });
    }
    if (b.bitEvents >= 2) {
      notable.push({ type: "bit_burst", bucket: b, note: `${b.bitEvents} bit cheers in this window` });
    }
    if (b.raidEvents >= 1) {
      notable.push({ type: "raid", bucket: b, note: `Raid arrived` });
    }
  }

  // Spike / drop detection — compare against rolling neighbor average so a
  // single quiet stretch in an otherwise-quiet stream doesn't keep flagging.
  // Diversity gate: a "spike" with diversity < 0.4 is one-or-two-people
  // spamming, NOT a community moment, so we don't mark those as spikes.
  for (let i = 2; i < buckets.length - 2; i++) {
    const neighbors = [buckets[i - 2], buckets[i - 1], buckets[i + 1], buckets[i + 2]];
    const neighborAvg = neighbors.reduce((s, n) => s + n.count, 0) / neighbors.length;
    if (neighborAvg < 5) continue; // too quiet to be meaningful

    const here = buckets[i];
    if (here.count >= neighborAvg * SPIKE_THRESHOLD) {
      const isCommunityMoment = here.diversity >= 0.4;
      notable.push({
        type: "spike",
        bucket: here,
        note: isCommunityMoment
          ? `Community surge — ${here.count} messages from ${here.uniqueChatters} chatters (avg ~${Math.round(neighborAvg)})`
          : `Spike — ${here.count} messages but only ${here.uniqueChatters} chatters (likely 1-2 people, not a community moment)`,
      });
    } else if (here.count < neighborAvg * DROP_THRESHOLD) {
      notable.push({
        type: "drop",
        bucket: here,
        note: `Chat fell to ${here.count} messages (avg ~${Math.round(neighborAvg)})`,
      });
    }
  }

  // Cap notable moments — too many drowns the rest of the report
  notable.sort((a, b) => Math.abs(b.bucket.count - avg) - Math.abs(a.bucket.count - avg));
  const trimmed = notable.slice(0, 8);

  return {
    totalMessages,
    totalUniqueChatters: uniqueUsers.size,
    avgPerBucket: avg,
    peakBucket: peak,
    quietestBucket: quietest,
    notableMoments: trimmed,
  };
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Render a compact prompt-friendly summary of a chat pulse for Claude.
 * Used by both peak detection and coach report generation when chat
 * data is available — gives the model real engagement ground truth
 * instead of asking it to guess.
 *
 * Returns "" when buckets are absent or empty so callers can splat
 * directly into prompt strings without conditionals.
 */
/**
 * Compact "audience" stats for small streamers — shown in place of the
 * full timeline when chat activity is below threshold. Doesn't pretend
 * the signal is meaningful; just summarizes what was there.
 */
export interface AudienceSnapshot {
  totalMessages: number;
  uniqueChatters: number;
  firstMessageAtSec: number | null;
  subEvents: number;
  bitEvents: number;
  raidEvents: number;
}

export function buildAudienceSnapshot(buckets: ChatBucket[]): AudienceSnapshot {
  let totalMessages = 0;
  let subEvents = 0;
  let bitEvents = 0;
  let raidEvents = 0;
  let firstAt: number | null = null;

  for (const b of buckets) {
    if (b.count > 0 && firstAt === null) firstAt = b.start;
    totalMessages += b.count;
    subEvents += b.subEvents;
    bitEvents += b.bitEvents;
    raidEvents += b.raidEvents;
  }

  // We don't have the message-level user list at this point (only bucket
  // counts), so unique chatters is approximated from the bucket totals.
  // The actual unique-user dedupe happened during bucketChat — but each
  // bucket's uniqueChatters is local. Sum them as an upper bound; the
  // real count is somewhere between max(uniqueChatters) and the sum.
  // For UI purposes we use the sum capped sensibly.
  const uniqueLowerBound = buckets.reduce((m, b) => Math.max(m, b.uniqueChatters), 0);

  return {
    totalMessages,
    uniqueChatters: uniqueLowerBound,
    firstMessageAtSec: firstAt,
    subEvents,
    bitEvents,
    raidEvents,
  };
}

/**
 * Is there enough chat activity to render the full pulse timeline + feed
 * the AI prompts? Below this we degrade gracefully — show the simpler
 * Audience Snapshot UI and keep the analysis transcript-only so we don't
 * make Claude lean on bad signal.
 */
export function isPulseViable(buckets: ChatBucket[] | null | undefined): boolean {
  if (!buckets || buckets.length === 0) return false;

  const totalMessages = buckets.reduce((s, b) => s + b.count, 0);
  if (totalMessages < MIN_VIABLE_TOTAL_MESSAGES) return false;

  const totalMinutes = (buckets[buckets.length - 1].end - buckets[0].start) / 60;
  if (totalMinutes <= 0) return false;
  const msgsPerMin = totalMessages / totalMinutes;
  if (msgsPerMin < MIN_VIABLE_MSGS_PER_MIN) return false;

  const peakUnique = buckets.reduce((m, b) => Math.max(m, b.uniqueChatters), 0);
  if (peakUnique < MIN_VIABLE_UNIQUE_CHATTERS) return false;

  return true;
}

/**
 * Outliers-first prompt formatter. Instead of dumping the whole pulse on
 * Claude (which lets it wander), we hand-pick the moments that pass our
 * statistical bars — high-velocity community moments, sudden vibe shifts,
 * monetary events — and explicitly tell Claude these are the timestamps
 * worth coaching about. This turns the model from a summarizer into a
 * Director pointing at specific successes and failures.
 */
export function formatPulseForPrompt(buckets: ChatBucket[] | null | undefined): string {
  if (!buckets || buckets.length === 0) return "";
  if (!isPulseViable(buckets)) return "";

  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return "";

  const totalLaugh = buckets.reduce((s, b) => s + b.laughCount, 0);
  const totalHype = buckets.reduce((s, b) => s + b.hypeCount, 0);
  const totalSad = buckets.reduce((s, b) => s + b.sadCount, 0);
  const totalSub = buckets.reduce((s, b) => s + b.subEvents, 0);
  const totalBit = buckets.reduce((s, b) => s + b.bitEvents, 0);
  const totalRaid = buckets.reduce((s, b) => s + b.raidEvents, 0);

  const bucketSec = buckets[0].end - buckets[0].start;
  const totalMin = Math.round((buckets[buckets.length - 1].end - buckets[0].start) / 60);

  // ── COMMUNITY MOMENTS — high velocity AND high diversity ──────────────
  // Real spikes where many different people reacted, not 1-2 spamming.
  const communityMoments = buckets
    .filter((b) => b.velocity >= 1.6 && b.diversity >= 0.5 && b.count >= 5)
    .sort((a, b) => b.velocity * b.diversity - a.velocity * a.diversity)
    .slice(0, 5);

  // ── PURE HYPE MOMENTS — high emote ratio + decent volume ─────────────
  // The "this is going viral" signal — most people typed pure reactions.
  const hypeMoments = buckets
    .filter((b) => b.hypeRatio >= 0.45 && b.count >= 5 && b.velocity >= 1.2)
    .filter((b) => !communityMoments.includes(b))
    .sort((a, b) => b.hypeRatio - a.hypeRatio)
    .slice(0, 3);

  // ── VIBE SHIFTS — sentiment delta from previous bucket ───────────────
  // Where the room turned. Positive → negative or vice versa.
  const vibeShifts: Array<{ bucket: ChatBucket; delta: number; from: string; to: string }> = [];
  for (let i = 1; i < buckets.length; i++) {
    const prev = buckets[i - 1];
    const here = buckets[i];
    if (prev.count < 3 || here.count < 3) continue;
    const delta = here.vibe - prev.vibe;
    if (Math.abs(delta) < 5) continue;
    if (prev.dominantSignal === here.dominantSignal) continue;
    vibeShifts.push({
      bucket: here,
      delta,
      from: prev.dominantSignal,
      to: here.dominantSignal,
    });
  }
  vibeShifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topShifts = vibeShifts.slice(0, 3);

  // ── MONETARY EVENTS — always interesting ─────────────────────────────
  const monetary = buckets
    .filter((b) => b.subEvents + b.bitEvents + b.raidEvents > 0)
    .slice(0, 5);

  // ── DROPS — where chat went quiet relative to baseline ───────────────
  const drops = buckets
    .filter((b) => b.velocity > 0 && b.velocity < 0.4 && b.start > 60)
    .sort((a, b) => a.velocity - b.velocity)
    .slice(0, 3);

  const lines: string[] = [];
  lines.push("━━━ CHAT PULSE — REAL VIEWER REACTION DATA ━━━");
  lines.push(`${total} messages across ${totalMin}min (${buckets.length} × ${bucketSec}s buckets)`);
  if (totalLaugh + totalHype + totalSad > 0) {
    lines.push(`Reactions: laughs=${totalLaugh}  hype=${totalHype}  sad/cringe=${totalSad}`);
  }
  if (totalSub + totalBit + totalRaid > 0) {
    lines.push(`Events: subs=${totalSub}  bits=${totalBit}  raids=${totalRaid}`);
  }
  lines.push("");

  if (communityMoments.length > 0) {
    lines.push("COMMUNITY MOMENTS — many different chatters reacted at once (this is the gold):");
    for (const b of communityMoments) {
      const tags = labelBucket(b);
      lines.push(`  ${fmtTime(b.start)}-${fmtTime(b.end)}: ${b.count} msgs from ${b.uniqueChatters} chatters (velocity ${b.velocity.toFixed(1)}x, diversity ${b.diversity.toFixed(2)})${tags}`);
    }
    lines.push("");
  }

  if (hypeMoments.length > 0) {
    lines.push("PURE HYPE MOMENTS — chat went into emote-only mode (POG / KEKW / W spam):");
    for (const b of hypeMoments) {
      lines.push(`  ${fmtTime(b.start)}-${fmtTime(b.end)}: ${b.count} msgs, ${Math.round(b.hypeRatio * 100)}% pure-reaction (velocity ${b.velocity.toFixed(1)}x)`);
    }
    lines.push("");
  }

  if (topShifts.length > 0) {
    lines.push("VIBE SHIFTS — chat's mood pivoted here:");
    for (const s of topShifts) {
      lines.push(`  ${fmtTime(s.bucket.start)}: ${s.from} → ${s.to} (delta ${s.delta > 0 ? "+" : ""}${s.delta})`);
    }
    lines.push("");
  }

  if (monetary.length > 0) {
    lines.push("MONETARY / EVENT MOMENTS:");
    for (const b of monetary) {
      const evts = [];
      if (b.subEvents > 0) evts.push(`${b.subEvents} sub${b.subEvents !== 1 ? "s" : ""}`);
      if (b.bitEvents > 0) evts.push(`${b.bitEvents} bit cheer${b.bitEvents !== 1 ? "s" : ""}`);
      if (b.raidEvents > 0) evts.push(`raid arrival`);
      lines.push(`  ${fmtTime(b.start)}: ${evts.join(", ")}`);
    }
    lines.push("");
  }

  if (drops.length > 0) {
    lines.push("CHAT DROPS — viewers went quiet (something stopped landing):");
    for (const b of drops) {
      lines.push(`  ${fmtTime(b.start)}-${fmtTime(b.end)}: only ${b.count} msgs (velocity ${b.velocity.toFixed(2)}x of baseline)`);
    }
    lines.push("");
  }

  if (
    communityMoments.length === 0 &&
    hypeMoments.length === 0 &&
    topShifts.length === 0 &&
    monetary.length === 0 &&
    drops.length === 0
  ) {
    // Pulse was viable but nothing notable — Claude shouldn't lean on it
    // for specific citations; falls back to general engagement summary.
    lines.push("(No statistically notable chat moments — chat was steady throughout.)");
    lines.push("");
  }

  lines.push("DIRECTOR INSTRUCTION: When you cite chat behavior in strengths, improvements, or anti_patterns, use the SPECIFIC timestamps above. Tell the streamer exactly what they did at those moments to trigger (or fail to trigger) the community reaction. A moment with high audio energy but a chat DROP did NOT land — say so. A moment with low audio but a community surge IS a clip-worthy beat.");
  lines.push("━━━");

  return lines.join("\n");
}

function labelBucket(b: ChatBucket): string {
  const tags: string[] = [];
  if (b.laughCount >= 3) tags.push(`${b.laughCount} laughs`);
  if (b.hypeCount >= 3) tags.push(`${b.hypeCount} hype`);
  if (b.sadCount >= 3) tags.push(`${b.sadCount} sad`);
  if (b.subEvents > 0) tags.push(`${b.subEvents} subs`);
  if (b.bitEvents > 0) tags.push(`${b.bitEvents} bits`);
  if (b.raidEvents > 0) tags.push("raid");
  return tags.length > 0 ? ` [${tags.join(", ")}]` : "";
}
