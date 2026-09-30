import { rankFromPoints, tierFloor, type Rank } from './rank';
import { callOutcome, isSealed, type CallOutcome } from './sealed';

/**
 * Match history (the site's lib/match-history.ts, streams only): every
 * analyzed stream as a ranked game, in the order it was analyzed.
 */

export type MatchResult = 'win' | 'loss' | 'held' | 'placement' | 'unranked';
export type MatchTag = 'promoted' | 'demoted' | 'division_up' | 'division_down' | 'shield';

export interface Match {
  id: string;
  title: string | null;
  at: string;
  durationSeconds: number | null;
  result: MatchResult;
  delta: number | null;
  rank: Rank | null;
  tag: MatchTag | null;
  sealed: boolean;
  call: CallOutcome;
}

export interface MatchVodRow {
  id: string;
  title: string | null;
  analyzed_at: string | null;
  stream_date: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  rank_delta: number | null;
  rank_points_after: number | null;
  result_opened_at?: string | null;
  result_call?: string | null;
}

/** Newest first. Pass every ready stream: the first ranked one is the placement. */
export function buildMatchHistory(vods: MatchVodRow[]): Match[] {
  const chronological = vods
    .map((v) => ({ v, at: v.analyzed_at ?? v.stream_date ?? v.created_at ?? new Date(0).toISOString() }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const out: Match[] = [];
  let lastPoints: number | null = null;
  let lastWasLoss = false;

  for (const { v, at } of chronological) {
    const base = {
      id: v.id,
      title: v.title,
      at,
      durationSeconds: v.duration_seconds,
      sealed: isSealed({ ...v, status: 'ready' }),
      call: callOutcome(v),
    };
    if (v.rank_points_after === null || v.rank_points_after === undefined) {
      out.push({ ...base, result: 'unranked', delta: null, rank: null, tag: null });
      continue;
    }
    const after = v.rank_points_after;
    if (lastPoints === null) {
      out.push({ ...base, result: 'placement', delta: null, rank: rankFromPoints(after), tag: null });
      lastPoints = after;
      lastWasLoss = false;
      continue;
    }
    const delta = v.rank_delta ?? after - lastPoints;
    out.push({
      ...base,
      result: delta > 0 ? 'win' : delta < 0 ? 'loss' : 'held',
      delta,
      rank: rankFromPoints(after),
      tag: tagFor(after - delta, after, delta, !lastWasLoss),
    });
    lastPoints = after;
    lastWasLoss = delta < 0;
  }
  return out.reverse();
}

function tagFor(before: number, after: number, delta: number, shieldPossible: boolean): MatchTag | null {
  const from = rankFromPoints(before);
  const to = rankFromPoints(after);
  if (from.tier !== to.tier) return after > before ? 'promoted' : 'demoted';
  if (from.division !== to.division) return after > before ? 'division_up' : 'division_down';
  if (shieldPossible && delta <= 0 && after > 0 && after === tierFloor(to.tier)) return 'shield';
  return null;
}

export interface MatchSummary {
  wins: number;
  losses: number;
  winRate: number | null;
  net: number;
  /** Most recent first. */
  form: Array<'win' | 'loss' | 'held'>;
  games: number;
}

/** Record over the last `window` opened, ranked streams. */
export function summarizeMatches(matches: Match[], window = 20): MatchSummary {
  const games = matches
    .filter((m) => !m.sealed && (m.result === 'win' || m.result === 'loss' || m.result === 'held'))
    .slice(0, window);
  const wins = games.filter((g) => g.result === 'win').length;
  const losses = games.filter((g) => g.result === 'loss').length;
  return {
    wins,
    losses,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
    net: games.reduce((sum, g) => sum + (g.delta ?? 0), 0),
    form: games.slice(0, 10).map((g) => g.result as 'win' | 'loss' | 'held'),
    games: games.length,
  };
}
