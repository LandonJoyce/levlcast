import { isPlacementDelta } from './rank';

/**
 * Sealed results (the site's lib/sealed.ts). A finished report arrives
 * sealed: the streamer calls it, win or loss, then opens it. Until then
 * nothing on screen gives it away, not even the rank.
 */

export interface SealFields {
  status?: string | null;
  rank_delta?: number | null;
  rank_points_after?: number | null;
  result_opened_at?: string | null;
  result_call?: string | null;
  sealed_extra_week?: string | null;
}

/** Monday of this week, UTC, as YYYY-MM-DD. Matches the server's weeks. */
export function currentWeekStart(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function isSealed(v: SealFields): boolean {
  return (v.status ?? 'ready') === 'ready' && !v.result_opened_at && v.rank_points_after != null;
}

/** A free streamer's extra stream that can't be opened until Monday. */
export function isLocked(v: SealFields, isPro: boolean): boolean {
  if (!isSealed(v) || isPro || !v.sealed_extra_week) return false;
  return v.sealed_extra_week >= currentWeekStart();
}

export function lockOpensAt(sealedExtraWeek: string): string {
  const d = new Date(`${sealedExtraWeek}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

export function isPlacementResult(v: SealFields): boolean {
  return v.rank_delta != null && isPlacementDelta(v.rank_delta);
}

export type CallOutcome = 'called' | 'missed' | null;

export function callOutcome(v: SealFields): CallOutcome {
  if (!v.result_call || v.rank_delta == null || isPlacementDelta(v.rank_delta)) return null;
  const won = v.rank_delta > 0;
  const lost = v.rank_delta < 0;
  if (!won && !lost) return null;
  return (v.result_call === 'win') === won ? 'called' : 'missed';
}

/** Rank points as they stood before any sealed stream. */
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

/** A paid plan that hasn't lapsed. */
export function hasPaidPlan(profile: { plan?: string | null; subscription_expires_at?: string | null } | null | undefined): boolean {
  if (profile?.plan !== 'pro') return false;
  const expires = profile.subscription_expires_at ? Date.parse(profile.subscription_expires_at) : NaN;
  return !(Number.isFinite(expires) && expires < Date.now());
}
