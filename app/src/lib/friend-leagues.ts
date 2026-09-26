/**
 * Friend leagues: a private weekly table for a group of streamers who
 * already know each other, usually a Discord crew.
 *
 * One streamer names the league and shares its link; anyone who opens it
 * can join. Each week (Monday to Monday, UTC, same as the public leagues)
 * the table ranks members on rank points gained from the streams they
 * analyze. Placements don't count. Nothing is paid out: the public league
 * is the one with prizes, this one is about beating your friends.
 *
 * Points are read from the members' streams rather than tallied, since
 * there's no prize to protect. The viewer's own sealed streams are left
 * out of their row until they open them.
 *
 * Server-only tables (see migration 032): admin client in, public fields
 * out (Twitch name, avatar, rank, weekly points).
 */

import type { createAdminClient } from "@/lib/supabase/server";
import { currentWeekStart } from "@/lib/limits";
import { isPlacementDelta } from "@/lib/rank";
import { isSealed } from "@/lib/sealed";
import { makeCode } from "@/lib/duels";

type Admin = ReturnType<typeof createAdminClient>;

export const MAX_FRIEND_LEAGUES = 3;
export const MAX_FRIEND_LEAGUE_SIZE = 20;

export interface FriendStanding {
  userId: string;
  position: number;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  rankPoints: number | null;
  points: number;
  streams: number;
  isYou: boolean;
}

export interface FriendLeagueView {
  id: string;
  code: string;
  name: string;
  isOwner: boolean;
  weekStart: string;
  standings: FriendStanding[];
  you: FriendStanding | null;
  /** Your streams this week that are still sealed, left out of your row. */
  sealed: number;
}

type MemberRow = { league_id: string; user_id: string; joined_at: string };
type LeagueRow = { id: string; code: string; name: string; owner_id: string; created_at: string };
type VodRow = {
  user_id: string;
  rank_delta: number | null;
  rank_points_after: number | null;
  result_opened_at: string | null;
  status: string;
  analyzed_at: string | null;
};

interface ProfileRow {
  id: string;
  twitch_login: string | null;
  twitch_display_name: string | null;
  twitch_avatar_url: string | null;
  rank_points: number | null;
}

/** Every friend league you're in, with this week's table. */
export async function getFriendLeagues(admin: Admin, userId: string): Promise<FriendLeagueView[]> {
  const { data: membershipData } = await admin.from("friend_league_members").select("league_id").eq("user_id", userId);
  const memberships = (membershipData ?? []) as Array<{ league_id: string }>;
  const leagueIds = [...new Set(memberships.map((m) => m.league_id))];
  if (leagueIds.length === 0) return [];

  const [{ data: leagueData }, { data: memberData }] = await Promise.all([
    admin.from("friend_leagues").select("id, code, name, owner_id, created_at").in("id", leagueIds),
    admin.from("friend_league_members").select("league_id, user_id, joined_at").in("league_id", leagueIds),
  ]);
  const leagues = (leagueData ?? []) as LeagueRow[];
  const members = (memberData ?? []) as MemberRow[];
  const memberIds = [...new Set(members.map((m) => m.user_id))];

  const weekStart = currentWeekStart();
  const since = `${weekStart}T00:00:00.000Z`;
  const [{ data: profiles }, { data: vodData }] = await Promise.all([
    admin.from("profiles").select("id, twitch_login, twitch_display_name, twitch_avatar_url, rank_points").in("id", memberIds),
    admin
      .from("vods")
      .select("user_id, rank_delta, rank_points_after, result_opened_at, status, analyzed_at")
      .in("user_id", memberIds)
      .eq("status", "ready")
      .gte("analyzed_at", since),
  ]);
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const vods = (vodData ?? []) as VodRow[];

  // This week's totals per member. Your own sealed streams stay out.
  const totals = new Map<string, { points: number; streams: number }>();
  let sealed = 0;
  for (const v of vods) {
    if (String(v.analyzed_at ?? "") < since) continue;
    const delta = v.rank_delta as number | null;
    if (delta == null || isPlacementDelta(delta)) continue;
    const uid = v.user_id as string;
    if (uid === userId && isSealed(v)) {
      sealed++;
      continue;
    }
    const t = totals.get(uid) ?? { points: 0, streams: 0 };
    t.points += delta;
    t.streams++;
    totals.set(uid, t);
  }

  return leagues
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((league) => {
      const ids = members.filter((m) => m.league_id === league.id).map((m) => m.user_id);
      const rows = ids
        .map((id) => {
          const p = byId.get(id);
          const t = totals.get(id) ?? { points: 0, streams: 0 };
          return {
            userId: id,
            name: p?.twitch_display_name || p?.twitch_login || "Streamer",
            login: p?.twitch_login ?? null,
            avatarUrl: p?.twitch_avatar_url ?? null,
            rankPoints: p?.rank_points ?? null,
            points: t.points,
            streams: t.streams,
            isYou: id === userId,
          };
        })
        .sort((a, b) => b.points - a.points || b.streams - a.streams || (b.rankPoints ?? 0) - (a.rankPoints ?? 0) || a.name.localeCompare(b.name));
      const standings = rows.map((r, i) => ({ ...r, position: i + 1 }));
      return {
        id: league.id,
        code: league.code,
        name: league.name,
        isOwner: league.owner_id === userId,
        weekStart,
        standings,
        you: standings.find((s) => s.isYou) ?? null,
        sealed,
      };
    });
}

async function membershipCount(admin: Admin, userId: string): Promise<number> {
  const { count } = await admin.from("friend_league_members").select("league_id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

/** Start a friend league. You're its first member. */
export async function createFriendLeague(
  admin: Admin,
  userId: string,
  rawName: string
): Promise<{ code: string } | { error: string }> {
  const name = rawName.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) return { error: "Give it a name." };
  if ((await membershipCount(admin, userId)) >= MAX_FRIEND_LEAGUES) {
    return { error: `You can be in ${MAX_FRIEND_LEAGUES} friend leagues at once.` };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    const { data: league, error } = await admin
      .from("friend_leagues")
      .insert({ code, name, owner_id: userId })
      .select("id")
      .single();
    if (error || !league) continue;
    await admin.from("friend_league_members").insert({ league_id: league.id, user_id: userId });
    return { code };
  }
  return { error: "Couldn't start it. Try again." };
}

/** Join the league behind an invite link. */
export async function joinFriendLeague(admin: Admin, code: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const { data: league } = await admin.from("friend_leagues").select("id").eq("code", code).maybeSingle();
  if (!league) return { error: "That invite link doesn't work anymore." };
  const { data: already } = await admin
    .from("friend_league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (already) return { ok: true };
  if ((await membershipCount(admin, userId)) >= MAX_FRIEND_LEAGUES) {
    return { error: `You can be in ${MAX_FRIEND_LEAGUES} friend leagues at once. Leave one first.` };
  }
  const { count } = await admin.from("friend_league_members").select("user_id", { count: "exact", head: true }).eq("league_id", league.id);
  if ((count ?? 0) >= MAX_FRIEND_LEAGUE_SIZE) return { error: `This league is full (${MAX_FRIEND_LEAGUE_SIZE} streamers).` };
  const { error } = await admin.from("friend_league_members").insert({ league_id: league.id, user_id: userId });
  if (error) return { error: "Couldn't join. Try again." };
  return { ok: true };
}

/**
 * Leave a league. If the owner leaves, the longest-standing member takes
 * it over; if nobody's left, it's deleted.
 */
export async function leaveFriendLeague(admin: Admin, leagueId: string, userId: string): Promise<void> {
  await admin.from("friend_league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
  const { data: league } = await admin.from("friend_leagues").select("owner_id").eq("id", leagueId).maybeSingle();
  if (!league || league.owner_id !== userId) return;
  const { data: next } = await admin
    .from("friend_league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (next) await admin.from("friend_leagues").update({ owner_id: next.user_id }).eq("id", leagueId);
  else await admin.from("friend_leagues").delete().eq("id", leagueId);
}

/** What the invite page shows. */
export interface FriendLeagueInvite {
  code: string;
  name: string;
  ownerName: string;
  memberCount: number;
  members: Array<{ id: string; name: string; avatarUrl: string | null; rankPoints: number | null }>;
}

export async function getFriendLeagueInvite(admin: Admin, code: string): Promise<FriendLeagueInvite | null> {
  const { data: league } = await admin.from("friend_leagues").select("id, code, name, owner_id").eq("code", code).maybeSingle();
  if (!league) return null;
  const { data: memberRows } = await admin.from("friend_league_members").select("user_id, joined_at").eq("league_id", league.id);
  const ids = ((memberRows ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, twitch_login, twitch_display_name, twitch_avatar_url, rank_points").in("id", ids)
    : { data: [] as ProfileRow[] };
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const nameOf = (p?: ProfileRow) => p?.twitch_display_name || p?.twitch_login || "Streamer";
  return {
    code: league.code as string,
    name: league.name as string,
    ownerName: nameOf(byId.get(league.owner_id as string)),
    memberCount: ids.length,
    members: ids.slice(0, 12).map((id) => ({
      id,
      name: nameOf(byId.get(id)),
      avatarUrl: byId.get(id)?.twitch_avatar_url ?? null,
      rankPoints: byId.get(id)?.rank_points ?? null,
    })),
  };
}
