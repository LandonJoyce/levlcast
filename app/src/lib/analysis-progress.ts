/**
 * How far along a stream's analysis is, for the progress bars on the stream
 * page, the dashboard and the Streams list.
 *
 * It follows how analyzeVod (lib/inngest/functions.ts) runs. The audio is
 * transcribed in 12-minute parts, four at a time, and after each round of
 * four the pipeline records how many parts are done (vods.progress,
 * migration 035). A round takes about a minute and a half. After the last
 * one, reading chat and writing the report take about four and a half
 * minutes with nothing to count, so that stretch is timed from when the
 * transcript finished. A 3-hour stream comes to around ten minutes, which
 * is what production shows.
 *
 * Rows with nothing recorded (before migration 035, or the first seconds of
 * a run) are timed from updated_at, which the pipeline bumps as it moves
 * between steps. Between recorded rounds the bar keeps moving on the clock,
 * and it never reaches the end until the report is actually in.
 *
 * No server imports: the bars tick in the browser with this.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** CHUNK_SECONDS and BATCH_CONCURRENCY in analyzeVod. */
const PART_SECONDS = 720;
const PARTS_AT_ONCE = 4;
const MINUTES_PER_ROUND = 1.5;
const WRITING_MINUTES = 4.5;
/**
 * Recorded progress this much older than the row's last change belongs to
 * an earlier run (a retry after a failure), not this one.
 */
const STALE_MINUTES = 20;

export interface AnalysisProgress {
  parts_done: number;
  parts_total: number;
  /** When parts_done last changed. */
  at: string;
}

export interface AnalysisInput {
  status: string;
  durationSeconds: number | null;
  /** The vods row's updated_at. */
  updatedAt: string | null;
  progress: AnalysisProgress | null;
}

export interface AnalysisEstimate {
  /** Share of the whole job done, 0 to 0.99. It only reaches the end when the report does. */
  fraction: number;
  /** The whole job's expected length, in minutes. */
  totalMinutes: number;
  /** Well past what the current step should take. */
  slow: boolean;
  phase: "transcribing" | "writing";
  /** How much of the stream is transcribed, in seconds, when the pipeline has said. */
  streamSecondsDone: number | null;
}

/**
 * Share of a step done after x of its usual length: follows x, then eases
 * off short of 1, so a step that overruns never reads as finished. The
 * free analyzer's bar uses it too.
 */
export function ease(x: number): number {
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
  let phase: AnalysisEstimate["phase"];
  let streamSecondsDone: number | null = null;

  if (recorded && recorded.parts_done >= partsTotal) {
    // Transcribed. Chat and the report from here, timed from the last round.
    const elapsed = minutesSince(recorded.at);
    done = transcribing + WRITING_MINUTES * ease(elapsed / WRITING_MINUTES);
    slow = elapsed > WRITING_MINUTES * 2 + 3;
    phase = "writing";
    streamSecondsDone = duration || null;
  } else if (recorded && input.status !== "analyzing") {
    const partsDone = Math.max(0, recorded.parts_done);
    const inFlight = Math.min(PARTS_AT_ONCE, partsTotal - partsDone);
    const elapsed = minutesSince(recorded.at);
    done = (transcribing * (partsDone + inFlight * ease(elapsed / MINUTES_PER_ROUND))) / partsTotal;
    // A round is a minute or two; a stuck one gets retried by Inngest.
    slow = elapsed > 8;
    phase = "transcribing";
    streamSecondsDone = duration > 0 ? Math.round((duration * partsDone) / partsTotal) : null;
  } else if (input.status === "analyzing") {
    const elapsed = minutesSince(input.updatedAt);
    done = transcribing + WRITING_MINUTES * ease(elapsed / WRITING_MINUTES);
    slow = elapsed > WRITING_MINUTES * 2 + 3;
    phase = "writing";
  } else {
    const elapsed = minutesSince(input.updatedAt);
    done = transcribing * ease(elapsed / transcribing);
    slow = elapsed > transcribing * 2 + 3;
    phase = "transcribing";
  }

  return { fraction: Math.min(0.99, Math.max(0, done / totalMinutes)), totalMinutes, slow, phase, streamSecondsDone };
}

/** About how long an analysis of this much stream takes, start to finish, in minutes. */
export function expectedMinutes(coachedSeconds: number): number {
  const parts = Math.max(1, Math.ceil(coachedSeconds / PART_SECONDS));
  return Math.ceil(Math.ceil(parts / PARTS_AT_ONCE) * MINUTES_PER_ROUND + WRITING_MINUTES);
}

/** "1h 36m", "3h" or "36m". */
export function streamLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Recorded progress for these rows, read on its own so that a database
 * without migration 035 costs the bars their precision and nothing else.
 */
export async function loadAnalysisProgress(
  client: SupabaseClient,
  vodIds: string[]
): Promise<Map<string, AnalysisProgress>> {
  const found = new Map<string, AnalysisProgress>();
  if (vodIds.length === 0) return found;
  try {
    const { data, error } = await client.from("vods").select("id, progress").in("id", vodIds);
    if (error || !data) return found;
    for (const row of data as { id: string; progress: AnalysisProgress | null }[]) {
      if (row.progress) found.set(row.id, row.progress);
    }
  } catch {
    // Same as no progress recorded.
  }
  return found;
}
