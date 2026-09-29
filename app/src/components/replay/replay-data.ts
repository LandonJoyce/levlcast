/**
 * Stream replay: a stream played back like a match replay.
 *
 * Two things are tracked minute by minute and drawn mirrored around the
 * timeline: how much the streamer was talking (YOU, above) and how much
 * chat was talking back (CHAT, below). Clips, dead air and the momentum
 * crash are marked on it, a caption says what's happening in plain words,
 * and it ends on the rank change, worked out by the real ladder maths.
 */

import { computeDelta, isPlacementDelta, rankFromPoints, TIERS, type DeltaResult } from "@/lib/rank";

export type Tone = "plain" | "gold" | "red";

export interface ReplayClip {
  minute: number;
  title: string;
  best?: boolean;
}

export interface ReplaySpan {
  start: number;
  minutes: number;
}

export interface ReplayCaption {
  minute: number;
  text: string;
  tone: Tone;
}

export interface ReplayData {
  title: string;
  when: string;
  minutes: number;
  /** Words per minute, for each minute of the stream. */
  pace: number[];
  /** Chat messages in each minute. */
  chat: number[];
  clips: ReplayClip[];
  deadAir: ReplaySpan[];
  crash?: ReplaySpan;
  /** What the replay says as it reaches each point, in order. */
  captions: ReplayCaption[];
  /** The line that stays up once it's over. */
  summary: string;
  score: number;
  /** Rank points before this stream, and the scores it's measured against (the example works its result out). */
  pointsBefore: number;
  recentScores: number[];
  /** A real stream's result, as the ladder recorded it. */
  recorded?: { pointsAfter: number; delta: number; placement: boolean };
  /** Minutes at the start before the stream really began (a starting-soon screen). No slab is built for them. */
  offline?: number;
  /** False when the VOD had no chat replay: the chat row isn't built. */
  hasChat: boolean;
  /** Only the example has chat lines to show. A real stream's chat text isn't kept, and none is made up. */
  illustrativeChat?: boolean;
  /** The past broadcast on Twitch, so any moment can be watched in place. Real streams only. */
  vodId?: string;
  /** When it was streamed, for the player's note on broadcasts Twitch has deleted. */
  streamDate?: string | null;
}

/** One message in the replay's chat box. No usernames: nobody here is real. */
export interface ChatLine {
  minute: number;
  text: string;
  tone: Tone;
  /** Picks the colour of the little marker, the way chat names vary. */
  hue: number;
}

export type AnchorKind = "clip" | "dead" | "crash" | "time" | "row";

/** A point in the replay's scene that gets a card or a label pinned to it. */
export interface SceneAnchor {
  id: string;
  kind: AnchorKind;
  /** Index into clips or deadAir for those kinds. */
  index: number;
  minute: number;
}

export function sceneAnchors(d: ReplayData): SceneAnchor[] {
  const out: SceneAnchor[] = [];
  d.clips.forEach((c, i) => out.push({ id: `clip-${i}`, kind: "clip", index: i, minute: c.minute }));
  d.deadAir.forEach((s, i) => out.push({ id: `dead-${i}`, kind: "dead", index: i, minute: s.start + s.minutes / 2 }));
  if (d.crash) out.push({ id: "crash", kind: "crash", index: 0, minute: d.crash.start + d.crash.minutes * 0.4 });
  for (let m = 30; m < d.minutes - 5; m += 30) out.push({ id: `time-${m}`, kind: "time", index: m, minute: m });
  // Row labels at the start: index 0 is the streamer, 1 is chat.
  out.push({ id: "row-you", kind: "row", index: 0, minute: 0 });
  if (d.hasChat) out.push({ id: "row-chat", kind: "row", index: 1, minute: 0 });
  return out;
}

export function replayResult(d: ReplayData): DeltaResult {
  if (!d.recorded) {
    return computeDelta({ score: d.score, recentScores: d.recentScores, points: d.pointsBefore, lastWasLoss: false });
  }
  // A real stream: the change the ladder actually recorded.
  const { pointsAfter, delta, placement } = d.recorded;
  const before = placement ? pointsAfter : pointsAfter - delta;
  const from = rankFromPoints(before);
  const to = rankFromPoints(pointsAfter);
  const tierAt = (name: string) => TIERS.findIndex((t) => t.name === name);
  const tierChange = tierAt(to.tier) > tierAt(from.tier) ? "up" : tierAt(to.tier) < tierAt(from.tier) ? "down" : null;
  const divisionChange = !tierChange && to.label !== from.label ? (pointsAfter > before ? "up" : "down") : null;
  return {
    delta: placement ? 0 : delta,
    points: pointsAfter,
    from,
    to,
    tierChange,
    divisionChange,
    shielded: false,
    reason: placement ? "Placement stream" : delta >= 0 ? "Points gained" : "Points lost",
  };
}

/** The columns of a vods row the replay is built from. */
export interface VodForReplay {
  title: string | null;
  stream_date: string | null;
  twitch_vod_id?: string | null;
  coach_report: Record<string, unknown> | null;
  peak_data: unknown;
  chat_pulse: unknown;
  rank_delta: number | null;
  rank_points_after: number | null;
}

const toMinute = (time: unknown): number | null => {
  if (typeof time !== "string") return null;
  const parts = time.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return secs / 60;
};

/** The first sentence of a coach's note, if it's short enough to be a caption. */
const firstSentence = (text: unknown): string | null => {
  if (typeof text !== "string") return null;
  const s = text.trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (s.length < 8 || s.length > 110) return null;
  return /[.!?]$/.test(s) ? s : `${s}.`;
};

const asSentence = (title: string) => {
  const t = title.trim().replace(/[.!?]+$/, "");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A real stream's replay, from what its analysis stored. Null for reports
 * made before the analysis started saving words per minute.
 */
export function replayFromVod(v: VodForReplay): ReplayData | null {
  const r = (v.coach_report ?? {}) as Record<string, unknown>;
  const words = Array.isArray(r.words_by_minute) ? (r.words_by_minute as unknown[]).map((w) => Math.max(0, Number(w) || 0)) : null;
  if (!words || words.length < 5) return null;
  const D = words.length;
  const offline = Math.min(D - 1, Math.floor(Number(r.stream_start_seconds ?? 0) / 60));
  const muted = new Set<number>(Array.isArray(r.muted_minutes) ? (r.muted_minutes as unknown[]).map(Number) : []);

  // A muted minute has no words because Twitch muted it, not because the
  // streamer went quiet: it borrows the level of the minutes either side.
  const pace = words.slice();
  for (const m of muted) {
    if (m < 0 || m >= D) continue;
    let l = m - 1;
    while (l >= 0 && muted.has(l)) l--;
    let rr = m + 1;
    while (rr < D && muted.has(rr)) rr++;
    const a = l >= 0 ? words[l] : null;
    const b = rr < D ? words[rr] : null;
    pace[m] = a !== null && b !== null ? (a + b) / 2 : (a ?? b ?? 0);
  }

  // Dead air: two or more quiet minutes in a row, not muted, once the stream is on.
  const QUIET = 8;
  const deadAir: ReplaySpan[] = [];
  let run = -1;
  for (let m = offline; m <= D; m++) {
    const quiet = m < D && words[m] < QUIET && !muted.has(m);
    if (quiet && run < 0) run = m;
    if (!quiet && run >= 0) {
      if (m - run >= 2) deadAir.push({ start: run, minutes: m - run });
      run = -1;
    }
  }

  // Chat per minute, from the stored buckets.
  const chat = new Array<number>(D).fill(0);
  if (Array.isArray(v.chat_pulse)) {
    for (const b of v.chat_pulse as Array<{ start?: number; count?: number }>) {
      const m = Math.floor(Number(b.start) / 60);
      if (m >= 0 && m < D) chat[m] += Math.max(0, Number(b.count) || 0);
    }
  }
  const hasChat = chat.some((c) => c > 0);

  const peaks = (Array.isArray(v.peak_data) ? (v.peak_data as Array<{ start?: number; title?: string; score?: number }>) : [])
    .filter((p) => Number.isFinite(Number(p.start)) && Number(p.start) / 60 < D)
    .sort((a, b) => Number(a.start) - Number(b.start));
  const bestScore = Math.max(-Infinity, ...peaks.map((p) => Number(p.score) || 0));
  let bestTaken = false;
  const clips: ReplayClip[] = peaks.map((p) => {
    const best = !bestTaken && (Number(p.score) || 0) === bestScore;
    if (best) bestTaken = true;
    return { minute: Number(p.start) / 60, title: String(p.title ?? "").trim() || "A clip", best };
  });

  const crashRaw = r.momentum_crash as { time?: string; duration_min?: number } | undefined;
  const crashStart = toMinute(crashRaw?.time);
  const crash =
    crashStart !== null && crashStart < D && Number(crashRaw?.duration_min) > 0
      ? { start: crashStart, minutes: Number(crashRaw?.duration_min) }
      : undefined;

  // What the replay says, from the report's own facts and notes. Most
  // important first; anything within a couple of minutes of a caption
  // already kept is dropped, so none of them flash past unread.
  const candidates: Array<ReplayCaption & { rank: number }> = [];
  clips.forEach((c) =>
    candidates.push({
      minute: c.minute,
      text: c.best ? `Your best moment. ${asSentence(c.title)}` : `${asSentence(c.title)} Clipped.`,
      tone: "gold",
      rank: c.best ? 0 : 1,
    })
  );
  deadAir.forEach((s) =>
    candidates.push({ minute: s.start, text: `Dead air. ${plural(s.minutes, "minute")} of nobody talking.`, tone: "red", rank: 2 })
  );
  if (crash) candidates.push({ minute: crash.start, text: `Momentum crash. ${plural(Math.round(crash.minutes), "minute")} downhill.`, tone: "red", rank: 3 });
  let mutedRun = -1;
  for (let m = 0; m <= D; m++) {
    const on = m < D && muted.has(m);
    if (on && mutedRun < 0) mutedRun = m;
    if (!on && mutedRun >= 0) {
      if (m - mutedRun >= 3) candidates.push({ minute: mutedRun, text: `Twitch muted this part. ${plural(m - mutedRun, "minute")} with no audio.`, tone: "plain", rank: 4 });
      mutedRun = -1;
    }
  }
  const rewatch = Array.isArray(r.rewatch_moments) ? (r.rewatch_moments as Array<{ time?: string; kind?: string; note?: string }>) : [];
  for (const w of rewatch) {
    const minute = toMinute(w.time);
    const text = firstSentence(w.note);
    if (minute !== null && text) candidates.push({ minute, text, tone: w.kind === "worst" ? "red" : "gold", rank: 5 });
  }
  const missed = r.missed_clip as { time?: string; note?: string } | undefined;
  const missedAt = toMinute(missed?.time);
  const missedNote = firstSentence(missed?.note);
  if (missedAt !== null && missedNote) candidates.push({ minute: missedAt, text: `Missed clip. ${missedNote}`, tone: "plain", rank: 6 });
  const open = r.cold_open as { score?: string; note?: string } | undefined;
  const openLine = firstSentence(open?.note) ?? (open?.score === "strong" ? "Strong opening." : open?.score === "weak" ? "Slow start." : null);
  if (openLine) candidates.push({ minute: offline, text: openLine, tone: open?.score === "weak" ? "red" : "plain", rank: 7 });

  const kept: Array<ReplayCaption & { rank: number }> = [];
  for (const c of candidates.filter((c) => c.minute >= 0 && c.minute < D).sort((a, b) => a.rank - b.rank)) {
    if (kept.some((k) => Math.abs(k.minute - c.minute) < 2.5)) continue;
    kept.push(c);
  }
  const captions = kept.sort((a, b) => a.minute - b.minute).map(({ minute, text, tone }) => ({ minute, text, tone }));

  const deadMinutes = deadAir.reduce((s, d) => s + d.minutes, 0);
  const delta = typeof v.rank_delta === "number" ? v.rank_delta : null;
  const after = typeof v.rank_points_after === "number" ? v.rank_points_after : null;
  const placement = delta !== null && isPlacementDelta(delta);
  const rankBit = delta === null ? "" : placement ? ", and your placement" : `, ${delta >= 0 ? "+" : "−"}${Math.abs(delta)} rank points`;

  return {
    title: v.title ?? "Your stream",
    when: v.stream_date ? new Date(v.stream_date).toLocaleDateString("en-US", { weekday: "long" }) : "",
    minutes: D,
    pace,
    chat,
    clips,
    deadAir,
    crash,
    captions,
    summary: `${plural(clips.length, "clip")}, ${plural(deadMinutes, "minute")} of dead air${rankBit}.`,
    score: typeof r.overall_score === "number" ? r.overall_score : 0,
    pointsBefore: 0,
    recentScores: [],
    recorded: delta !== null && after !== null ? { pointsAfter: after, delta, placement } : undefined,
    offline,
    hasChat,
    vodId: v.twitch_vod_id ?? undefined,
    streamDate: v.stream_date,
  };
}

export function clockLabel(minute: number): string {
  const total = Math.max(0, Math.round(minute * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function shortClock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = Math.floor(minute % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HYPE = ["CLIP IT", "no way", "LETS GO", "he did it", "W", "clipped", "that was insane", "GG"];
const PLAIN = ["lol", "nice", "gg", "true", "o7", "real", "haha", "W"];
const QUIET = ["...", "zzz"];
const DEAD = ["hello?", "you there?", "afk?"];

/**
 * What the replay's chat box shows. A handful of lines, not a flood: the
 * replay runs a whole stream in seventeen seconds, and real chat at that
 * speed would just be a blur. It bunches up where chat really went off,
 * asks "hello?" in dead air, and ticks along otherwise.
 */
export function buildChat(d: ReplayData): ChatLine[] {
  const rand = mulberry32(99);
  const out: ChatLine[] = [];
  const maxChat = Math.max(1, ...d.chat);
  const pick = (pool: string[]) => pool[Math.floor(rand() * pool.length)];
  const inSpan = (m: number, s?: ReplaySpan) => !!s && m >= s.start && m < s.start + s.minutes;
  for (const c of d.clips) {
    const n = c.best ? 7 : 5;
    for (let k = 0; k < n; k++) out.push({ minute: c.minute + 0.05 + (k / n) * 1.6, text: pick(HYPE), tone: "gold", hue: rand() });
  }
  for (const s of d.deadAir) {
    out.push({ minute: s.start + s.minutes * 0.45, text: pick(DEAD), tone: "red", hue: rand() });
  }
  if (d.crash) out.push({ minute: d.crash.start + d.crash.minutes * 0.6, text: pick(QUIET), tone: "plain", hue: rand() });
  for (let m = 0; m < d.minutes; m++) {
    if (d.clips.some((c) => m >= Math.floor(c.minute) - 1 && m < c.minute + 3)) continue;
    if (d.deadAir.some((s) => inSpan(m, s)) || inSpan(m, d.crash)) continue;
    const level = d.chat[m] / maxChat;
    if (rand() < 0.05 + level * 0.12) out.push({ minute: m + rand(), text: pick(PLAIN), tone: "plain", hue: rand() });
  }
  return out.sort((x, y) => x.minute - y.minute);
}

/**
 * The example stream the demo replays: a ranked session with a slow start,
 * a clutch, a queue that goes quiet and turns into dead air, a best moment,
 * a second quiet patch, a strong late run, and winding down.
 */
function buildExample(): ReplayData {
  const minutes = 165;
  const rand = mulberry32(20260927);
  const keys: Array<[number, number]> = [
    [0, 58], [3, 76], [6, 108], [10, 126], [16, 139], [22, 148], [27, 156], [31, 178], [34, 152],
    [40, 142], [45, 132], [48, 98], [50, 60], [52, 10], [56, 10], [58, 82], [62, 116], [67, 136],
    [71, 160], [73, 186], [76, 154], [82, 138], [88, 128], [94, 122], [99, 100], [101, 12], [104, 12],
    [106, 94], [111, 132], [116, 150], [121, 160], [124, 180], [127, 162], [133, 156], [139, 150],
    [145, 134], [151, 118], [157, 102], [162, 86], [165, 68],
  ];
  const paceAt = (m: number) => {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1][0] <= m) i++;
    const [m0, v0] = keys[i];
    const [m1, v1] = keys[i + 1];
    const t = Math.min(1, Math.max(0, (m - m0) / (m1 - m0)));
    return v0 + (v1 - v0) * t * t * (3 - 2 * t);
  };
  const deadAir: ReplaySpan[] = [
    { start: 52, minutes: 4 },
    { start: 101, minutes: 3 },
  ];
  const inDead = (m: number) => deadAir.some((d) => m >= d.start && m < d.start + d.minutes);
  const clips: ReplayClip[] = [
    { minute: 31.3, title: "first clutch of the night" },
    { minute: 73.1, title: "1v3 on the last round", best: true },
    { minute: 124.4, title: "chat called the flank" },
  ];

  const pace: number[] = [];
  const chat: number[] = [];
  for (let m = 0; m < minutes; m++) {
    const wobble = (rand() - 0.5) * 16 + Math.sin(m * 0.9) * 5;
    pace.push(Math.round(Math.max(0, Math.min(205, inDead(m) ? 3 + rand() * 7 : paceAt(m + 0.5) + wobble))));
    let c = 6 + Math.max(0, (pace[m] - 40) / 150) * 26 + (rand() - 0.5) * 7;
    for (const clip of clips) c += Math.exp(-Math.pow((m - clip.minute - 0.8) / 2, 2)) * (clip.best ? 40 : 28);
    if (inDead(m)) c = 3 + rand() * 4;
    chat.push(Math.max(0, Math.round(c)));
  }

  return {
    title: "ranked till gold or till i cry",
    when: "Saturday",
    minutes,
    pace,
    chat,
    clips,
    deadAir,
    crash: { start: 45, minutes: 7 },
    captions: [
      { minute: 0, text: "Slow start. You're still getting set up.", tone: "plain" },
      { minute: 8, text: "Picking up, and chat's waking up with you.", tone: "plain" },
      { minute: 31.3, text: "First clutch of the night. Chat went off.", tone: "gold" },
      { minute: 36, text: "Riding the high. You're talking, chat's talking back.", tone: "plain" },
      { minute: 45, text: "The queue goes quiet, and so do you.", tone: "red" },
      { minute: 52, text: "Dead air. Four minutes of nobody talking.", tone: "red" },
      { minute: 56.2, text: "Back in a game. Chat's slow to come back.", tone: "plain" },
      { minute: 73.1, text: "Your best moment. 1v3 on the last round.", tone: "gold" },
      { minute: 80, text: "Chat stays loud for ten minutes after it.", tone: "plain" },
      { minute: 101, text: "Dead air again. Three minutes this time.", tone: "red" },
      { minute: 104.2, text: "You pick it back up faster this time.", tone: "plain" },
      { minute: 124.4, text: "Chat called the flank and you took it. Clipped.", tone: "gold" },
      { minute: 131, text: "Your strongest stretch of the night.", tone: "plain" },
      { minute: 150, text: "Winding down.", tone: "plain" },
    ],
    summary: "Three clips, seven minutes of dead air, and better than your last five.",
    score: 64,
    pointsBefore: 1166,
    recentScores: [57, 55, 60, 52, 58],
    hasChat: true,
    illustrativeChat: true,
  };
}

export const EXAMPLE_REPLAY: ReplayData = buildExample();
