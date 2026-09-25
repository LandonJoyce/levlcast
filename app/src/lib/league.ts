/**
 * Weekly leagues.
 *
 * The ladder is a race against your own recent form. A league is a race
 * against a handful of other streamers, which is what turns a progress bar
 * into a game: somebody is one place above you, and one good stream
 * passes them.
 *
 * ── THE RULES ──────────────────────────────────────────────────────────
 * - Every Monday (UTC) the streamers who analysed a stream in the last
 *   four weeks are sorted by rank and cut into groups of about eight, so a
 *   league is people near your level.
 * - The week is a race on rank points gained. Every analysed stream
 *   counts. Showing up more often helps, but one great stream (up to +70)
 *   still beats several average ones (+10 to +16 each).
 * - Whoever sits one place above you is your rival. First place's rival
 *   is whoever is chasing them.
 * - The following Monday the top three are paid 20 / 10 / 5 rank points.
 * - Someone who analyses mid-week without a group joins the nearest one
 *   on the spot, so nobody waits for Monday to play.
 *
 * ── WHY PLAYERS RANK ABOVE NON-PLAYERS ─────────────────────────────────
 * A streamer who streamed and lost 8 points sits above one who never
 * showed up at 0. The product's job is to get people streaming and
 * analysing, and a table where sitting out beats trying teaches the
 * opposite.
 *
 * ── WHY PRIZES SHRINK IN QUIET LEAGUES ─────────────────────────────────
 * A prize is paid for beating someone. If only one person in a group
 * played, they beat nobody, and paying +20 for it would print rank points
 * for whoever lands in a quiet group. So a league with N players pays at
 * most N - 1 prizes: nothing for a solo week, first place only when two
 * played.
 */

import type { createAdminClient } from "@/lib/supabase/server";
import { currentWeekStart } from "@/lib/limits";

type Admin = ReturnType<typeof createAdminClient>;

/** What a fresh Monday group aims for. */
export const LEAGUE_TARGET_SIZE = 8;
/** Mid-week joiners stop landing in a group once it reaches this. */
export const LEAGUE_MAX_SIZE = 12;
/** Who counts as active enough to be placed on Monday. */
export const ACTIVE_WINDOW_DAYS = 28;
/** Rank points paid to 1st, 2nd and 3rd. */
export const PRIZES = [20, 10, 5] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Pure rules ─────────────────────────────────────────────────────────

const NAME_FIRST = [
  "Night", "Static", "Neon", "Midnight", "Crimson", "Silent", "Electric", "Lucky",
  "Hidden", "Wild", "Frost", "Ember", "Velvet", "Hollow", "Rapid", "Golden",
];
const NAME_SECOND = [
  "Owls", "Wolves", "Foxes", "Ravens", "Comets", "Vipers", "Lanterns", "Sparks",
  "Hounds", "Falcons", "Rogues", "Tides", "Knights", "Moths", "Drifters", "Signals",
];

/**
 * A name for the index-th league of a week.
 *
 * Named rather than numbered because "The Night Owls" is a group you are
 * in and "League 3" is a bucket you were sorted into. The first word steps
 * by 5 through a list of 16, and 5 shares no factor with 16, so the first
 * sixteen leagues of any week never share a name.
 */
export function leagueName(weekStart: string, index: number): string {
  let hash = 0;
  for (const ch of weekStart) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const first = NAME_FIRST[(hash + index * 5) % NAME_FIRST.length];
  const second = NAME_SECOND[(hash * 7 + index * 3) % NAME_SECOND.length];
  return `The ${first} ${second}`;
}

export interface StandingInput {
  user_id: string;
  points_gained: number;
  streams_played: number;
  rank_points_at_join: number;
}

/**
 * League table order: players before non-players (see header), then
 * points gained, then streams played, then rank, then id so the order is
 * stable between page loads.
 */
export function orderStandings<T extends StandingInput>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const aPlayed = a.streams_played > 0 ? 1 : 0;
    const bPlayed = b.streams_played > 0 ? 1 : 0;
    if (aPlayed !== bPlayed) return bPlayed - aPlayed;
    if (a.points_gained !== b.points_gained) return b.points_gained - a.points_gained;
    if (a.streams_played !== b.streams_played) return b.streams_played - a.streams_played;
    if (a.rank_points_at_join !== b.rank_points_at_join) return b.rank_points_at_join - a.rank_points_at_join;
    return a.user_id < b.user_id ? -1 : 1;
  });
}

/** Rank points a finishing position is worth. See the header for the N - 1 rule. */
export function prizeFor(position: number, played: boolean, playerCount: number): number {
  if (!played) return 0;
  const places = Math.min(PRIZES.length, Math.max(0, playerCount - 1));
  return position <= places ? PRIZES[position - 1] : 0;
}

/**
 * Cut a rank-sorted list into groups as close to the target size as the
 * numbers allow. Sizes differ by at most one, so nobody lands in a group
 * of three because the division left a remainder.
 */
export function splitIntoGroups<T>(sorted: T[], target = LEAGUE_TARGET_SIZE): T[][] {
  if (sorted.length === 0) return [];
  const count = Math.max(1, Math.round(sorted.length / target));
  const base = Math.floor(sorted.length / count);
  let extra = sorted.length % count;
  const groups: T[][] = [];
  let i = 0;
  for (let g = 0; g < count; g++) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    groups.push(sorted.slice(i, i + size));
    i += size;
  }
  return groups;
}

/** The open group whose average rank is nearest, or null if all are full. */
export function pickLeagueForJoin(
  leagues: Array<{ id: string; size: number; avgPoints: number }>,
  points: number
): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const l of leagues) {
    if (l.size >= LEAGUE_MAX_SIZE) continue;
    const distance = Math.abs(l.avgPoints - points);
    if (!best || distance < best.distance) best = { id: l.id, distance };
  }
  return best?.id ?? null;
}

/** Monday (YYYY-MM-DD) a week before the given Monday. */
export function previousWeekStart(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
}

/** The instant a league week ends: the following Monday, 00:00 UTC. */
export function weekEndsAt(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) + 7 * DAY_MS).toISOString();
}

// ── Writes ─────────────────────────────────────────────────────────────

/**
 * Put a streamer in a league for this week if they are not in one yet.
 * Returns the league id, or null if a group could not be made.
 */
async function joinLeagueIfNeeded(
  admin: Admin,
  userId: string,
  points: number,
  weekStart: string
): Promise<string | null> {
  const { data: existing } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existing) return existing.league_id as string;

  const { data: seated } = await admin
    .from("league_members")
    .select("league_id, rank_points_at_join")
    .eq("week_start", weekStart);

  const byLeague = new Map<string, { size: number; total: number }>();
  for (const row of (seated ?? []) as Array<{ league_id: string; rank_points_at_join: number }>) {
    const entry = byLeague.get(row.league_id) ?? { size: 0, total: 0 };
    entry.size++;
    entry.total += row.rank_points_at_join;
    byLeague.set(row.league_id, entry);
  }

  let leagueId = pickLeagueForJoin(
    [...byLeague].map(([id, e]) => ({ id, size: e.size, avgPoints: e.total / e.size })),
    points
  );

  if (!leagueId) {
    const { count } = await admin
      .from("leagues")
      .select("id", { count: "exact", head: true })
      .eq("week_start", weekStart);
    const { data: created, error } = await admin
      .from("leagues")
      .insert({ week_start: weekStart, name: leagueName(weekStart, count ?? 0) })
      .select("id")
      .single();
    if (error || !created) return null;
    leagueId = created.id as string;
  }

  const { error } = await admin.from("league_members").insert({
    league_id: leagueId,
    user_id: userId,
    week_start: weekStart,
    rank_points_at_join: points,
  });
  if (error) {
    // Unique violation: the Monday job or a second analysis finishing in
    // the same instant already seated them. Their seat stands.
    if (error.code !== "23505") throw new Error(error.message);
    const { data: again } = await admin
      .from("league_members")
      .select("league_id")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();
    return (again?.league_id as string | undefined) ?? null;
  }
  return leagueId;
}

/**
 * Count one analysed stream toward this week's league.
 *
 * Called from the analysis pipeline right after the ladder moves. A
 * placement joins the league and counts as a stream played, but for zero
 * points: it is a starting rating, not a result, and letting a +700
 * placement win a league would hand the week to whoever signed up.
 */
export async function recordLeagueStream(
  admin: Admin,
  input: { userId: string; delta: number; pointsAfter: number; isPlacement: boolean }
): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("league_opt_out")
    .eq("id", input.userId)
    .single();
  if (profile?.league_opt_out) return;

  const weekStart = currentWeekStart();
  const leagueId = await joinLeagueIfNeeded(admin, input.userId, input.pointsAfter, weekStart);
  if (!leagueId) return;

  const { error } = await admin.rpc("league_record_stream", {
    p_user_id: input.userId,
    p_week_start: weekStart,
    p_delta: input.isPlacement ? 0 : input.delta,
  });
  if (error) throw new Error(error.message);
}

/**
 * Monday: seat everyone active in the last four weeks who is not already
 * in a group this week. Safe to re-run; anyone already seated is skipped.
 */
export async function formWeeklyLeagues(
  admin: Admin,
  weekStart = currentWeekStart()
): Promise<{ leagues: number; members: number }> {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY_MS).toISOString();

  const [{ data: recent }, { data: profiles }, { data: seated }, { count: existing }] = await Promise.all([
    admin.from("vods").select("user_id").eq("status", "ready").gte("analyzed_at", cutoff),
    admin
      .from("profiles")
      .select("id, rank_points")
      .not("rank_points", "is", null)
      .eq("league_opt_out", false),
    admin.from("league_members").select("user_id").eq("week_start", weekStart),
    admin.from("leagues").select("id", { count: "exact", head: true }).eq("week_start", weekStart),
  ]);

  const active = new Set(((recent ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
  const already = new Set(((seated ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));

  const pool = ((profiles ?? []) as Array<{ id: string; rank_points: number }>)
    .filter((p) => active.has(p.id) && !already.has(p.id))
    .sort((a, b) => b.rank_points - a.rank_points);

  let leagues = 0;
  let members = 0;
  for (const [i, group] of splitIntoGroups(pool).entries()) {
    const { data: league, error } = await admin
      .from("leagues")
      .insert({ week_start: weekStart, name: leagueName(weekStart, (existing ?? 0) + i) })
      .select("id")
      .single();
    if (error || !league) throw new Error(error?.message ?? "league insert failed");

    const { error: seatError } = await admin.from("league_members").upsert(
      group.map((p) => ({
        league_id: league.id,
        user_id: p.id,
        week_start: weekStart,
        rank_points_at_join: p.rank_points,
      })),
      { onConflict: "user_id,week_start", ignoreDuplicates: true }
    );
    if (seatError) throw new Error(seatError.message);

    leagues++;
    members += group.length;
  }
  return { leagues, members };
}

/**
 * Monday: close every league from an earlier week, write final places and
 * pay the top three. Safe to re-run: settle_league_member() claims each
 * row before paying, so nobody is paid twice.
 */
export async function settleFinishedLeagues(
  admin: Admin,
  weekStart = currentWeekStart()
): Promise<{ settled: number; paid: number }> {
  const { data: open } = await admin
    .from("leagues")
    .select("id")
    .is("settled_at", null)
    .lt("week_start", weekStart);

  let settled = 0;
  let paid = 0;
  for (const league of (open ?? []) as Array<{ id: string }>) {
    const { data: rows } = await admin
      .from("league_members")
      .select("user_id, points_gained, streams_played, rank_points_at_join")
      .eq("league_id", league.id);

    const ordered = orderStandings((rows ?? []) as StandingInput[]);
    const players = ordered.filter((m) => m.streams_played > 0).length;

    for (const [i, member] of ordered.entries()) {
      const bonus = prizeFor(i + 1, member.streams_played > 0, players);
      const { data: after, error } = await admin.rpc("settle_league_member", {
        p_league_id: league.id,
        p_user_id: member.user_id,
        p_position: i + 1,
        p_bonus: bonus,
      });
      if (error) throw new Error(error.message);
      if (bonus > 0 && after !== null) paid++;
    }

    await admin.from("leagues").update({ settled_at: new Date().toISOString() }).eq("id", league.id);
    settled++;
  }
  return { settled, paid };
}

// ── Reads ──────────────────────────────────────────────────────────────

export interface LeagueStanding extends StandingInput {
  position: number;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  rankPoints: number | null;
  /** What this position would pay if the week ended now. */
  prize: number;
  isYou: boolean;
}

export interface LeagueView {
  leagueId: string;
  name: string;
  weekStart: string;
  endsAt: string;
  standings: LeagueStanding[];
  you: LeagueStanding;
  /** One place above you, or the runner-up if you lead. */
  rival: LeagueStanding | null;
  playerCount: number;
}

/**
 * The league a streamer is in this week, with the full table.
 *
 * Reads through the admin client because league tables are closed to the
 * browser. Only public fields leave this function: Twitch name, avatar,
 * rank and weekly points. Never a coach score.
 */
export async function getLeagueView(
  admin: Admin,
  userId: string,
  weekStart = currentWeekStart()
): Promise<LeagueView | null> {
  const { data: mine } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!mine) return null;

  const [{ data: league }, { data: rows }] = await Promise.all([
    admin.from("leagues").select("id, name, week_start").eq("id", mine.league_id).single(),
    admin
      .from("league_members")
      .select("user_id, points_gained, streams_played, rank_points_at_join")
      .eq("league_id", mine.league_id),
  ]);
  if (!league || !rows?.length) return null;

  const members = rows as StandingInput[];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, twitch_login, twitch_display_name, twitch_avatar_url, rank_points")
    .in("id", members.map((m) => m.user_id));

  const profileById = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      twitch_login: string | null;
      twitch_display_name: string | null;
      twitch_avatar_url: string | null;
      rank_points: number | null;
    }>).map((p) => [p.id, p])
  );

  const ordered = orderStandings(members);
  const playerCount = ordered.filter((m) => m.streams_played > 0).length;

  const standings: LeagueStanding[] = ordered.map((m, i) => {
    const p = profileById.get(m.user_id);
    return {
      ...m,
      position: i + 1,
      name: p?.twitch_display_name || p?.twitch_login || "Streamer",
      login: p?.twitch_login ?? null,
      avatarUrl: p?.twitch_avatar_url ?? null,
      rankPoints: p?.rank_points ?? null,
      prize: prizeFor(i + 1, m.streams_played > 0, playerCount),
      isYou: m.user_id === userId,
    };
  });

  const you = standings.find((s) => s.isYou);
  if (!you) return null;
  const rival =
    you.position === 1 ? standings[1] ?? null : standings[you.position - 2] ?? null;

  return {
    leagueId: league.id as string,
    name: league.name as string,
    weekStart: league.week_start as string,
    endsAt: weekEndsAt(league.week_start as string),
    standings,
    you,
    rival,
    playerCount,
  };
}

/**
 * Who a stream moved you past, given the table after it.
 *
 * Rebuilds the table as it stood before this stream by taking the stream
 * back out of your tally, then returns everyone who was above you then and
 * is below you now. Only meaningful for your most recent stream, since the
 * table after it must not include anything later.
 */
export function passedByStream(view: LeagueView, leagueDelta: number): string[] {
  const before = orderStandings(
    view.standings.map((s) =>
      s.isYou
        ? { ...s, points_gained: s.points_gained - leagueDelta, streams_played: Math.max(0, s.streams_played - 1) }
        : s
    )
  );
  const positionBefore = before.findIndex((s) => s.isYou) + 1;
  if (positionBefore <= view.you.position) return [];
  return before
    .slice(view.you.position - 1, positionBefore - 1)
    .filter((s) => !s.isYou)
    .map((s) => s.name);
}

export interface LeagueResult {
  leagueId: string;
  leagueName: string;
  weekStart: string;
  settledAt: string;
  position: number;
  size: number;
  bonus: number;
  pointsAfter: number | null;
}

/**
 * Settled weeks for one streamer, newest first. Pass onlyPaid to get just
 * the weeks that paid a bonus, which is what match history shows as rows.
 */
export async function getLeagueResults(
  admin: Admin,
  userId: string,
  options: { onlyPaid?: boolean; limit?: number } = {}
): Promise<LeagueResult[]> {
  let query = admin
    .from("league_members")
    .select("league_id, week_start, final_position, bonus_points, rank_points_after")
    .eq("user_id", userId)
    .not("final_position", "is", null)
    .order("week_start", { ascending: false })
    .limit(options.limit ?? 52);
  if (options.onlyPaid) query = query.gt("bonus_points", 0);

  const { data: rows } = await query;
  const results = (rows ?? []) as Array<{
    league_id: string;
    week_start: string;
    final_position: number;
    bonus_points: number | null;
    rank_points_after: number | null;
  }>;
  if (results.length === 0) return [];

  const ids = results.map((r) => r.league_id);
  const [{ data: leagues }, { data: seats }] = await Promise.all([
    admin.from("leagues").select("id, name, settled_at").in("id", ids),
    admin.from("league_members").select("league_id").in("league_id", ids),
  ]);

  const leagueById = new Map(
    ((leagues ?? []) as Array<{ id: string; name: string; settled_at: string | null }>).map((l) => [l.id, l])
  );
  const sizeById = new Map<string, number>();
  for (const s of (seats ?? []) as Array<{ league_id: string }>) {
    sizeById.set(s.league_id, (sizeById.get(s.league_id) ?? 0) + 1);
  }

  return results.map((r) => {
    const league = leagueById.get(r.league_id);
    return {
      leagueId: r.league_id,
      leagueName: league?.name ?? "League",
      weekStart: r.week_start,
      settledAt: league?.settled_at ?? weekEndsAt(r.week_start),
      position: r.final_position,
      size: sizeById.get(r.league_id) ?? 1,
      bonus: r.bonus_points ?? 0,
      pointsAfter: r.rank_points_after,
    };
  });
}
