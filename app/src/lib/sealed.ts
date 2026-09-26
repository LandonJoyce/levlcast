/**
 * Sealed results.
 *
 * A finished report arrives sealed. The streamer calls it (win or loss),
 * opens it, and the result plays out. Until then no page shows anything
 * that gives it away: the rank reads as it stood before the stream, and
 * the stream is taken back out of league and duel numbers.
 *
 * A free streamer's extra stream (analyzed after both weekly reports are
 * used) is sealed and also locked: it can't be opened until the week it
 * was analyzed in is over, unless they go Pro.
 */

import { currentWeekStart } from "@/lib/limits";
import { isPlacementDelta } from "@/lib/rank";

export interface SealFields {
  status?: string | null;
  rank_delta?: number | null;
  rank_points_after?: number | null;
  result_opened_at?: string | null;
  result_call?: string | null;
  sealed_extra_week?: string | null;
}

/**
 * Still sealed: analyzed, not opened, and there's a rank result to reveal.
 * A report with no rank on it has nothing to reveal, so it's never sealed.
 */
export function isSealed(v: SealFields): boolean {
  return (v.status ?? "ready") === "ready" && !v.result_opened_at && v.rank_points_after != null;
}

/** A sealed extra stream that can't be opened yet. */
export function isLocked(v: SealFields, isPro: boolean, week = currentWeekStart()): boolean {
  if (!isSealed(v) || isPro || !v.sealed_extra_week) return false;
  return v.sealed_extra_week >= week;
}

/** When a locked stream opens: the Monday after the week it was analyzed in. */
export function lockOpensAt(sealedExtraWeek: string): string {
  const d = new Date(`${sealedExtraWeek}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

/** The first ranked result is a placement: there's a rank, not a win or loss. */
export function isPlacementResult(v: SealFields): boolean {
  return v.rank_delta != null && isPlacementDelta(v.rank_delta);
}

export type CallOutcome = "called" | "missed" | null;

/** Whether the streamer's call matched what happened. */
export function callOutcome(v: SealFields): CallOutcome {
  if (!v.result_call || v.rank_delta == null || isPlacementDelta(v.rank_delta)) return null;
  const won = v.rank_delta > 0;
  const lost = v.rank_delta < 0;
  if (!won && !lost) return null;
  return (v.result_call === "win") === won ? "called" : "missed";
}

/**
 * Rank points as they stood before any sealed stream, so the rank on
 * screen doesn't give a result away. Placements sealed from nothing show
 * as unranked.
 */
export function pointsBeforeSealed(points: number | null, sealed: SealFields[]): number | null {
  if (points == null) return null;
  let p = points;
  for (const v of sealed) {
    if (v.rank_delta == null) continue;
    if (isPlacementDelta(v.rank_delta)) return null;
    p -= v.rank_delta;
  }
  return p;
}

/** Rank points a set of sealed streams added to league or duel totals. */
export function sealedLeaguePoints(sealed: SealFields[]): number {
  return sealed.reduce((sum, v) => sum + (v.rank_delta != null && !isPlacementDelta(v.rank_delta) ? v.rank_delta : 0), 0);
}
