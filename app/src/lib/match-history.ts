/**
 * Match history.
 *
 * Every analysed stream as a ranked game: a win or a loss, the points it
 * moved, and where it left you. It is the screen ranked players already
 * scroll between games, and it answers the question a single report
 * cannot: am I actually climbing?
 *
 * Built entirely from what the pipeline already writes to every VOD
 * (rank_delta, rank_points_after), plus league payouts, so it needs no
 * table of its own and can never disagree with the rank badge.
 *
 * Order is analysis order, not stream date. The ladder moves when a
 * stream is analysed, so analysing last month's VOD today is today's
 * game, and that is where it belongs in the list.
 */

import { rankFromPoints, tierFloor, type Rank } from "@/lib/rank";
import type { LeagueResult } from "@/lib/league";

export type MatchResult = "win" | "loss" | "held" | "placement" | "unranked";
export type MatchTag = "promoted" | "demoted" | "division_up" | "division_down" | "shield";

export interface StreamMatch {
  kind: "stream";
  id: string;
  title: string | null;
  at: string;
  durationSeconds: number | null;
  result: MatchResult;
  /** Null for placements and unranked streams: there was no climb. */
  delta: number | null;
  rank: Rank | null;
  tag: MatchTag | null;
}

export interface LeagueMatch {
  kind: "league";
  id: string;
  leagueName: string;
  at: string;
  weekStart: string;
  position: number;
  size: number;
  delta: number;
  rank: Rank | null;
  tag: MatchTag | null;
}

export type Match = StreamMatch | LeagueMatch;

export interface MatchVodRow {
  id: string;
  title: string | null;
  analyzed_at: string | null;
  stream_date: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  rank_delta: number | null;
  rank_points_after: number | null;
}

/**
 * Newest first. Pass every ready VOD the user has, not a page of them:
 * the first ranked stream is the placement, and a missing delta on an
 * older backfilled row is recovered from the row before it, so both need
 * the full chain.
 */
export function buildMatchHistory(vods: MatchVodRow[], leagueResults: LeagueResult[] = []): Match[] {
  const chronological = vods
    .map((v) => ({ v, at: v.analyzed_at ?? v.stream_date ?? v.created_at ?? new Date(0).toISOString() }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const matches: Match[] = [];
  let lastPoints: number | null = null;
  // Whether the previous ranked stream lost points. The demotion shield
  // only fires when it did not, so it decides whether a loss that stopped
  // on a tier floor can have been the shield.
  let lastWasLoss = false;

  for (const { v, at } of chronological) {
    const base = { kind: "stream" as const, id: v.id, title: v.title, at, durationSeconds: v.duration_seconds };

    if (v.rank_points_after === null) {
      matches.push({ ...base, result: "unranked", delta: null, rank: null, tag: null });
      continue;
    }

    const after = v.rank_points_after;
    if (lastPoints === null) {
      matches.push({ ...base, result: "placement", delta: null, rank: rankFromPoints(after), tag: null });
      lastPoints = after;
      lastWasLoss = false;
      continue;
    }

    // Rows written before per-stream deltas were stored only have the
    // rating after; the step from the previous row is the same number.
    const delta = v.rank_delta ?? after - lastPoints;
    const before = after - delta;
    matches.push({
      ...base,
      result: delta > 0 ? "win" : delta < 0 ? "loss" : "held",
      delta,
      rank: rankFromPoints(after),
      tag: tagFor(before, after, delta, !lastWasLoss),
    });
    lastPoints = after;
    lastWasLoss = delta < 0;
  }

  for (const r of leagueResults) {
    if (r.bonus <= 0) continue;
    matches.push({
      kind: "league",
      id: `league-${r.leagueId}`,
      leagueName: r.leagueName,
      at: r.settledAt,
      weekStart: r.weekStart,
      position: r.position,
      size: r.size,
      delta: r.bonus,
      rank: r.pointsAfter !== null ? rankFromPoints(r.pointsAfter) : null,
      tag: r.pointsAfter !== null ? tagFor(r.pointsAfter - r.bonus, r.pointsAfter, r.bonus, false) : null,
    });
  }

  return matches.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function tagFor(before: number, after: number, delta: number, shieldPossible: boolean): MatchTag | null {
  const from = rankFromPoints(before);
  const to = rankFromPoints(after);
  if (from.tier !== to.tier) return after > before ? "promoted" : "demoted";
  if (from.division !== to.division) return after > before ? "division_up" : "division_down";
  // The shield is not stored per row, so it is read back: a loss that
  // stopped exactly on the tier floor, when the stream before it was not
  // a loss (the only time the shield can fire). Every loss that would have
  // crossed the floor ends on that one point, while a normal loss has to
  // hit it exactly, so when it does, the shield is by far the likelier
  // cause.
  if (shieldPossible && delta <= 0 && after > 0 && after === tierFloor(to.tier)) return "shield";
  return null;
}

export interface MatchSummary {
  wins: number;
  losses: number;
  /** Null until at least one game was won or lost. */
  winRate: number | null;
  net: number;
  /** Most recent first. */
  form: Array<"win" | "loss" | "held">;
  games: number;
}

/** Record over the last `window` ranked streams. League payouts are not games. */
export function summarizeMatches(matches: Match[], window = 20): MatchSummary {
  const games = matches
    .filter((m): m is StreamMatch => m.kind === "stream" && (m.result === "win" || m.result === "loss" || m.result === "held"))
    .slice(0, window);

  const wins = games.filter((g) => g.result === "win").length;
  const losses = games.filter((g) => g.result === "loss").length;
  return {
    wins,
    losses,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
    net: games.reduce((sum, g) => sum + (g.delta ?? 0), 0),
    form: games.slice(0, 10).map((g) => g.result as "win" | "loss" | "held"),
    games: games.length,
  };
}
