/**
 * Duels: a one-week 1v1 between two streamers.
 *
 * One streamer makes a challenge link and sends it to a friend. Whoever
 * accepts it becomes the opponent, and for the next seven days every
 * stream either of them analyzes counts: the side that gains more rank
 * points wins. Placements don't count (they're a starting rating, not a
 * climb). Nothing is paid out; the win goes on the head-to-head record,
 * which is the point. The link is the invite, so every challenge sent to
 * someone new brings them to LevlCast.
 *
 * Duels are scored lazily: the first read after a duel's week is over
 * works out the totals and writes the winner. No cron needed, and a duel
 * nobody looks at costs nothing.
 *
 * Tables are server-only (see migration 032), so everything here takes
 * the admin client and returns only public fields: Twitch name, avatar,
 * rank and points gained.
 */

import { randomBytes } from "crypto";
import type { createAdminClient } from "@/lib/supabase/server";
import { isPlacementDelta } from "@/lib/rank";
import { isSealed } from "@/lib/sealed";

type Admin = ReturnType<typeof createAdminClient>;

export const DUEL_DAYS = 7;
/** Open links plus running duels one streamer can have at once. */
export const MAX_ACTIVE_DUELS = 5;

export interface DuelPlayer {
  userId: string;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  rankPoints: number | null;
  /** Rank points gained in the duel so far, placements excluded. */
  points: number;
  streams: number;
  /** Your own analyzed-but-unopened streams, left out of your total. */
  sealed: number;
}

export interface DuelView {
  id: string;
  code: string;
  status: "open" | "active" | "finished";
  acceptedAt: string | null;
  endsAt: string | null;
  finishedAt: string | null;
  you: DuelPlayer;
  them: DuelPlayer | null;
  /** From your side. Null while it's running. */
  result: "win" | "loss" | "draw" | null;
  /** Your finished duels against this same streamer, this one included. */
  record: { wins: number; losses: number; draws: number };
}

interface DuelRow {
  id: string;
  code: string;
  challenger_id: string;
  opponent_id: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  ends_at: string | null;
  finished_at: string | null;
  challenger_points: number | null;
  opponent_points: number | null;
  winner_id: string | null;
}

interface ProfileRow {
  id: string;
  twitch_login: string | null;
  twitch_display_name: string | null;
  twitch_avatar_url: string | null;
  rank_points: number | null;
}

const DUEL_COLUMNS =
  "id, code, challenger_id, opponent_id, status, created_at, accepted_at, ends_at, finished_at, challenger_points, opponent_points, winner_id";

/** Eight characters, no look-alikes, so a code can be read out on stream. */
export function makeCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * One streamer's duel total between two times. The viewer's own sealed
 * streams are counted separately and left out, so a scoreboard never
 * gives away a result they haven't opened.
 */
async function pointsBetween(
  admin: Admin,
  userId: string,
  from: string,
  to: string,
  hideSealed: boolean
): Promise<{ points: number; streams: number; sealed: number }> {
  const { data } = await admin
    .from("vods")
    .select("rank_delta, rank_points_after, result_opened_at, status, analyzed_at")
    .eq("user_id", userId)
    .eq("status", "ready")
    .gte("analyzed_at", from)
    .lt("analyzed_at", to);
  let points = 0;
  let streams = 0;
  let sealed = 0;
  for (const v of data ?? []) {
    const delta = v.rank_delta as number | null;
    if (delta == null || isPlacementDelta(delta)) continue;
    if (hideSealed && isSealed(v)) {
      sealed++;
      continue;
    }
    points += delta;
    streams++;
  }
  return { points, streams, sealed };
}

/** Score a duel whose week is over, once. Returns the row as it now stands. */
async function settleIfDue(admin: Admin, row: DuelRow): Promise<DuelRow> {
  if (row.status !== "active" || !row.ends_at || !row.accepted_at || !row.opponent_id) return row;
  if (Date.parse(row.ends_at) > Date.now()) return row;
  const [a, b] = await Promise.all([
    pointsBetween(admin, row.challenger_id, row.accepted_at, row.ends_at, false),
    pointsBetween(admin, row.opponent_id, row.accepted_at, row.ends_at, false),
  ]);
  const winner = a.points === b.points ? null : a.points > b.points ? row.challenger_id : row.opponent_id;
  const finishedAt = new Date().toISOString();
  // Conditional on still being active, so two readers can't both settle it.
  await admin
    .from("duels")
    .update({
      status: "finished",
      finished_at: finishedAt,
      challenger_points: a.points,
      opponent_points: b.points,
      winner_id: winner,
    })
    .eq("id", row.id)
    .eq("status", "active");
  return {
    ...row,
    status: "finished",
    finished_at: finishedAt,
    challenger_points: a.points,
    opponent_points: b.points,
    winner_id: winner,
  };
}

function player(p: ProfileRow | undefined, userId: string, totals: { points: number; streams: number; sealed: number }): DuelPlayer {
  return {
    userId,
    name: p?.twitch_display_name || p?.twitch_login || "Streamer",
    login: p?.twitch_login ?? null,
    avatarUrl: p?.twitch_avatar_url ?? null,
    rankPoints: p?.rank_points ?? null,
    ...totals,
  };
}

/**
 * Your duels: the running ones, the ones that ended in the last week, and
 * your open challenge link if you have one.
 */
export async function getDuelsForUser(
  admin: Admin,
  userId: string
): Promise<{ active: DuelView[]; recent: DuelView[]; openCode: string | null }> {
  const { data } = await admin
    .from("duels")
    .select(DUEL_COLUMNS)
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .in("status", ["open", "active", "finished"])
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = await Promise.all(((data ?? []) as DuelRow[]).map((r) => settleIfDue(admin, r)));
  const mine = rows.filter((r) => r.challenger_id === userId || r.opponent_id === userId);
  const openCode = mine.find((r) => r.status === "open" && r.challenger_id === userId)?.code ?? null;

  const weekAgo = Date.now() - DUEL_DAYS * 86_400_000;
  const shown = mine.filter(
    (r) => r.status === "active" || (r.status === "finished" && Date.parse(r.finished_at ?? r.ends_at ?? "") >= weekAgo)
  );

  const ids = new Set<string>();
  for (const r of shown) {
    ids.add(r.challenger_id);
    if (r.opponent_id) ids.add(r.opponent_id);
  }
  const { data: profiles } = ids.size
    ? await admin
        .from("profiles")
        .select("id, twitch_login, twitch_display_name, twitch_avatar_url, rank_points")
        .in("id", [...ids])
    : { data: [] as ProfileRow[] };
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));

  const views = await Promise.all(
    shown.map(async (r): Promise<DuelView> => {
      const youChallenged = r.challenger_id === userId;
      const themId = (youChallenged ? r.opponent_id : r.challenger_id) as string;
      let youTotals = { points: 0, streams: 0, sealed: 0 };
      let themTotals = { points: 0, streams: 0, sealed: 0 };
      if (r.status === "active" && r.accepted_at) {
        const until = new Date().toISOString();
        [youTotals, themTotals] = await Promise.all([
          pointsBetween(admin, userId, r.accepted_at, until, true),
          pointsBetween(admin, themId, r.accepted_at, until, false),
        ]);
      } else if (r.status === "finished") {
        const mineP = (youChallenged ? r.challenger_points : r.opponent_points) ?? 0;
        const theirs = (youChallenged ? r.opponent_points : r.challenger_points) ?? 0;
        youTotals = { points: mineP, streams: 0, sealed: 0 };
        themTotals = { points: theirs, streams: 0, sealed: 0 };
      }
      const pair = mine.filter(
        (x) =>
          x.status === "finished" &&
          ((x.challenger_id === userId && x.opponent_id === themId) || (x.opponent_id === userId && x.challenger_id === themId))
      );
      const record = {
        wins: pair.filter((x) => x.winner_id === userId).length,
        losses: pair.filter((x) => x.winner_id === themId).length,
        draws: pair.filter((x) => !x.winner_id).length,
      };
      return {
        id: r.id,
        code: r.code,
        status: r.status as DuelView["status"],
        acceptedAt: r.accepted_at,
        endsAt: r.ends_at,
        finishedAt: r.finished_at,
        you: player(byId.get(userId), userId, youTotals),
        them: player(byId.get(themId), themId, themTotals),
        result: r.status !== "finished" ? null : !r.winner_id ? "draw" : r.winner_id === userId ? "win" : "loss",
        record,
      };
    })
  );

  return {
    active: views.filter((v) => v.status === "active"),
    recent: views.filter((v) => v.status === "finished"),
    openCode,
  };
}

/** Your open challenge link, made if you don't have one. */
export async function getOrCreateChallenge(admin: Admin, userId: string): Promise<{ code: string } | { error: string }> {
  const { data: existing } = await admin
    .from("duels")
    .select("code, status")
    .eq("challenger_id", userId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  if (existing?.code) return { code: existing.code as string };

  const { count } = await admin
    .from("duels")
    .select("id", { count: "exact", head: true })
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .eq("status", "active");
  if ((count ?? 0) >= MAX_ACTIVE_DUELS) return { error: `You can run ${MAX_ACTIVE_DUELS} duels at once. Finish one first.` };

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    const { error } = await admin.from("duels").insert({ code, challenger_id: userId, status: "open" });
    if (!error) return { code };
  }
  return { error: "Couldn't make a link. Try again." };
}

/** Take the challenge behind a link. */
export async function acceptChallenge(
  admin: Admin,
  code: string,
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const { data: row } = await admin.from("duels").select(DUEL_COLUMNS).eq("code", code).maybeSingle();
  const duel = row as DuelRow | null;
  if (!duel || duel.status === "cancelled") return { error: "That challenge link doesn't work anymore." };
  if (duel.challenger_id === userId) return { error: "That's your own challenge. Send it to a friend." };
  if (duel.status !== "open") return { error: "Someone already took this challenge." };

  const { count: running } = await admin
    .from("duels")
    .select("id", { count: "exact", head: true })
    .or(
      `and(challenger_id.eq.${userId},opponent_id.eq.${duel.challenger_id}),and(challenger_id.eq.${duel.challenger_id},opponent_id.eq.${userId})`
    )
    .eq("status", "active");
  if ((running ?? 0) > 0) return { error: "You're already dueling this streamer. Finish that one first." };

  const now = new Date();
  const ends = new Date(now.getTime() + DUEL_DAYS * 86_400_000);
  const { data: updated } = await admin
    .from("duels")
    .update({ opponent_id: userId, status: "active", accepted_at: now.toISOString(), ends_at: ends.toISOString() })
    .eq("id", duel.id)
    .eq("status", "open")
    .select("id");
  if (!updated || updated.length === 0) return { error: "Someone already took this challenge." };
  return { ok: true };
}

/** Withdraw your open challenge link. */
export async function cancelChallenge(admin: Admin, code: string, userId: string): Promise<void> {
  await admin.from("duels").update({ status: "cancelled" }).eq("code", code).eq("challenger_id", userId).eq("status", "open");
}

/** What the invite page shows: who's challenging, and where the duel stands. */
export interface DuelInvite {
  code: string;
  status: "open" | "active" | "finished" | "cancelled";
  challenger: { id: string; name: string; login: string | null; avatarUrl: string | null; rankPoints: number | null };
  opponent: { id: string; name: string } | null;
  endsAt: string | null;
  winnerName: string | null;
  points: { challenger: number | null; opponent: number | null };
}

export async function getDuelInvite(admin: Admin, code: string): Promise<DuelInvite | null> {
  const { data: row } = await admin.from("duels").select(DUEL_COLUMNS).eq("code", code).maybeSingle();
  if (!row) return null;
  const duel = await settleIfDue(admin, row as DuelRow);
  const ids = [duel.challenger_id, duel.opponent_id].filter(Boolean) as string[];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, twitch_login, twitch_display_name, twitch_avatar_url, rank_points")
    .in("id", ids);
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const c = byId.get(duel.challenger_id);
  const o = duel.opponent_id ? byId.get(duel.opponent_id) : undefined;
  const nameOf = (p?: ProfileRow) => p?.twitch_display_name || p?.twitch_login || "Streamer";
  return {
    code: duel.code,
    status: duel.status as DuelInvite["status"],
    challenger: {
      id: duel.challenger_id,
      name: nameOf(c),
      login: c?.twitch_login ?? null,
      avatarUrl: c?.twitch_avatar_url ?? null,
      rankPoints: c?.rank_points ?? null,
    },
    opponent: duel.opponent_id ? { id: duel.opponent_id, name: nameOf(o) } : null,
    endsAt: duel.ends_at,
    winnerName: duel.winner_id ? nameOf(byId.get(duel.winner_id)) : null,
    points: { challenger: duel.challenger_points, opponent: duel.opponent_points },
  };
}
