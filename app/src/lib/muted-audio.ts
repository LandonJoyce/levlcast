/**
 * Twitch mutes VOD audio when it detects copyrighted music. The muted
 * segments are still in the playlist, just digital silence, in blocks of a
 * few minutes. Nearly every VOD has some; a stream with music on the whole
 * time can be muted almost end to end.
 *
 * Left alone, that silence cost us twice: we paid to transcribe it, and
 * the coach read each muted block as the streamer going quiet (dead air),
 * which is wrong and drags their score. These helpers find the muted time
 * so the pipeline can skip it and the coach can be told about it.
 *
 * Pure functions, no imports, so they can be checked on their own.
 */

export interface TimeRange {
  start: number;
  end: number;
}

/** Fallback length for the last segment, which has no next start time. */
const LAST_SEGMENT_SECONDS = 10;

function segmentEnd(startTimes: number[], i: number): number {
  return i + 1 < startTimes.length ? startTimes[i + 1] : startTimes[i] + LAST_SEGMENT_SECONDS;
}

/** Consecutive muted segments merged into ranges, in VOD seconds. */
export function mutedRanges(startTimes: number[], muted: boolean[]): TimeRange[] {
  const ranges: TimeRange[] = [];
  for (let i = 0; i < startTimes.length; i++) {
    if (!muted[i]) continue;
    const start = startTimes[i];
    const end = segmentEnd(startTimes, i);
    const last = ranges[ranges.length - 1];
    if (last && Math.abs(last.end - start) < 0.5) last.end = end;
    else ranges.push({ start, end });
  }
  return ranges;
}

export interface AudibleStats {
  totalSeconds: number;
  mutedSeconds: number;
  audibleSeconds: number;
  /** Where the last unmuted audio ends. 0 when everything is muted. */
  audibleEnd: number;
}

export function audibleStats(startTimes: number[], muted: boolean[], durationSeconds?: number | null): AudibleStats {
  const listed = startTimes.length ? segmentEnd(startTimes, startTimes.length - 1) : 0;
  const totalSeconds = durationSeconds && durationSeconds > 0 ? durationSeconds : listed;
  let mutedSeconds = 0;
  let audibleEnd = 0;
  for (let i = 0; i < startTimes.length; i++) {
    const len = segmentEnd(startTimes, i) - startTimes[i];
    if (muted[i]) mutedSeconds += len;
    else audibleEnd = segmentEnd(startTimes, i);
  }
  mutedSeconds = Math.min(mutedSeconds, totalSeconds);
  return { totalSeconds, mutedSeconds, audibleSeconds: Math.max(0, totalSeconds - mutedSeconds), audibleEnd };
}

/**
 * Too little left to coach once the muted parts are gone: under 10 minutes
 * of audible stream, or under half of a short one.
 */
export function isMostlyMuted(stats: AudibleStats): boolean {
  if (stats.mutedSeconds <= 0) return false;
  return stats.audibleSeconds < Math.min(10 * 60, stats.totalSeconds * 0.5);
}

/**
 * Transcription chunks of at most `chunkSeconds`, leaving out muted
 * segments. A chunk never spans a muted block, so each one is continuous
 * audio and its first segment's start time is the right offset for every
 * timestamp in it.
 */
export function buildAudibleChunks(
  urls: string[],
  startTimes: number[],
  muted: boolean[],
  chunkSeconds: number
): Array<{ urls: string[]; timeOffset: number }> {
  const chunks: Array<{ urls: string[]; timeOffset: number }> = [];
  let current: string[] = [];
  let offset = 0;
  const close = () => {
    if (current.length) chunks.push({ urls: current, timeOffset: offset });
    current = [];
  };
  for (let i = 0; i < urls.length; i++) {
    if (muted[i]) {
      close();
      continue;
    }
    if (current.length === 0) offset = startTimes[i];
    current.push(urls[i]);
    if (segmentEnd(startTimes, i) - offset >= chunkSeconds) close();
  }
  close();
  return chunks;
}

/** Seconds of [start, end] that fall inside any of the ranges. */
export function overlapSeconds(start: number, end: number, ranges: TimeRange[]): number {
  let total = 0;
  for (const r of ranges) {
    const a = Math.max(start, r.start);
    const b = Math.min(end, r.end);
    if (b > a) total += b - a;
  }
  return total;
}

/** The parts of [start, end] outside every range, in order. */
export function audibleParts(start: number, end: number, ranges: TimeRange[]): TimeRange[] {
  const parts: TimeRange[] = [];
  let cursor = start;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    if (r.end <= cursor || r.start >= end) continue;
    if (r.start > cursor) parts.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
    if (cursor >= end) break;
  }
  if (cursor < end) parts.push({ start: cursor, end });
  return parts;
}

/** Minutes (0-based) that are at least half muted. */
export function mutedMinutes(ranges: TimeRange[], totalMinutes: number): Set<number> {
  const set = new Set<number>();
  for (let m = 0; m < totalMinutes; m++) {
    if (overlapSeconds(m * 60, (m + 1) * 60, ranges) >= 30) set.add(m);
  }
  return set;
}

function clock(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "3 min muted by Twitch at 12:30-15:30, 1:02:00-1:05:00" for the coach prompt. */
export function describeMuted(ranges: TimeRange[]): string | null {
  if (ranges.length === 0) return null;
  const total = ranges.reduce((n, r) => n + (r.end - r.start), 0);
  const shown = ranges.slice(0, 8).map((r) => `${clock(r.start)}-${clock(r.end)}`);
  const more = ranges.length > 8 ? ` and ${ranges.length - 8} more` : "";
  return `${Math.round(total / 60)} min muted by Twitch at ${shown.join(", ")}${more}`;
}

/** What the streamer reads when Twitch muted nearly the whole stream. */
export const MOSTLY_MUTED_MESSAGE =
  "Twitch muted almost all of this stream's audio, so there was nothing for us to hear. " +
  "Twitch does that when it picks up copyrighted music, and the muted parts are silent. " +
  "Pick a stream where music wasn't playing the whole time.";
