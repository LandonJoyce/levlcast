/**
 * How far along a report is (the site's lib/analysis-progress.ts). The
 * audio is transcribed in 12-minute parts, four at a time, about a minute
 * and a half a round, then chat and the report take about four and a half
 * minutes. The pipeline records finished parts in vods.progress; without
 * that the bar is timed from updated_at. It never reaches the end until
 * the report is actually in.
 */

/** A free report coaches the first 2 hours of a stream. */
export const FREE_COACHED_SECONDS = 2 * 60 * 60;

const PART_SECONDS = 720;
const PARTS_AT_ONCE = 4;
const MINUTES_PER_ROUND = 1.5;
const WRITING_MINUTES = 4.5;
const STALE_MINUTES = 20;

export interface AnalysisProgress {
  parts_done: number;
  parts_total: number;
  at: string;
}

export interface AnalysisInput {
  status: string;
  durationSeconds: number | null;
  updatedAt: string | null;
  progress: AnalysisProgress | null;
}

export interface AnalysisEstimate {
  fraction: number;
  totalMinutes: number;
  slow: boolean;
  phase: 'transcribing' | 'writing';
}

function ease(x: number): number {
  if (x <= 0.85) return Math.max(0, x);
  return 0.85 + 0.13 * (1 - Math.exp(-(x - 0.85) * 2.5));
}

export function estimateAnalysis(input: AnalysisInput, now: number): AnalysisEstimate {
  const minutesSince = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
  };
  const updated = input.updatedAt ? Date.parse(input.updatedAt) : NaN;
  const p = input.progress;
  const recorded =
    p &&
    p.parts_total > 0 &&
    Number.isFinite(Date.parse(p.at)) &&
    !(Number.isFinite(updated) && Date.parse(p.at) < updated - STALE_MINUTES * 60000)
      ? p
      : null;

  const duration = input.durationSeconds ?? 0;
  const partsTotal = recorded ? recorded.parts_total : Math.max(1, Math.ceil(duration / PART_SECONDS));
  const transcribing = Math.ceil(partsTotal / PARTS_AT_ONCE) * MINUTES_PER_ROUND;
  const totalMinutes = transcribing + WRITING_MINUTES;

  let done: number;
  let slow: boolean;
  let phase: AnalysisEstimate['phase'];

  if (recorded && recorded.parts_done >= partsTotal) {
    const elapsed = minutesSince(recorded.at);
    done = transcribing + WRITING_MINUTES * ease(elapsed / WRITING_MINUTES);
    slow = elapsed > WRITING_MINUTES * 2 + 3;
    phase = 'writing';
  } else if (recorded && input.status !== 'analyzing') {
    const partsDone = Math.max(0, recorded.parts_done);
    const inFlight = Math.min(PARTS_AT_ONCE, partsTotal - partsDone);
    const elapsed = minutesSince(recorded.at);
    done = (transcribing * (partsDone + inFlight * ease(elapsed / MINUTES_PER_ROUND))) / partsTotal;
    slow = elapsed > 8;
    phase = 'transcribing';
  } else if (input.status === 'analyzing') {
    const elapsed = minutesSince(input.updatedAt);
    done = transcribing + WRITING_MINUTES * ease(elapsed / WRITING_MINUTES);
    slow = elapsed > WRITING_MINUTES * 2 + 3;
    phase = 'writing';
  } else {
    const elapsed = minutesSince(input.updatedAt);
    done = transcribing * ease(elapsed / transcribing);
    slow = elapsed > transcribing * 2 + 3;
    phase = 'transcribing';
  }

  return { fraction: Math.min(0.99, Math.max(0, done / totalMinutes)), totalMinutes, slow, phase };
}

/** What the report covers: the first 2 hours on free, the whole stream on Pro. */
export function coachedSeconds(durationSeconds: number | null, isPro: boolean): number | null {
  if (isPro || !durationSeconds) return durationSeconds;
  return Math.min(durationSeconds, FREE_COACHED_SECONDS);
}
