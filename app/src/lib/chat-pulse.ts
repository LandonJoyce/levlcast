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
}

const DEFAULT_BUCKET_SEC = 30;

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
    });
    userSetsPerBucket.push(new Set<string>());
  }

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
  }

  for (let i = 0; i < buckets.length; i++) {
    buckets[i].uniqueChatters = userSetsPerBucket[i].size;
    buckets[i].vibe = buckets[i].laughCount + buckets[i].hypeCount - buckets[i].sadCount;
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
  for (let i = 2; i < buckets.length - 2; i++) {
    const neighbors = [buckets[i - 2], buckets[i - 1], buckets[i + 1], buckets[i + 2]];
    const neighborAvg = neighbors.reduce((s, n) => s + n.count, 0) / neighbors.length;
    if (neighborAvg < 5) continue; // too quiet to be meaningful

    const here = buckets[i];
    if (here.count >= neighborAvg * SPIKE_THRESHOLD) {
      notable.push({
        type: "spike",
        bucket: here,
        note: `Chat surged to ${here.count} messages (avg ~${Math.round(neighborAvg)})`,
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
