import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { scoreMatch, type CollabUserSummary } from "@/lib/collab-match";

/**
 * GET /api/collab/list
 *
 * Returns the list of opted-in streamers the caller can browse. Scoped:
 *   - caller must be authenticated
 *   - caller must themselves be opted in (no scraping the pool from outside)
 *   - excludes caller from the result
 *   - excludes anyone the caller already has a collab_interest with in either
 *     direction (pending, accepted, or passed — one-shot per pair)
 *
 * Sort: match score desc, opt_in_at desc as tie-breaker.
 * Cap: 60 results to keep payload small. Pagination is a v2 concern.
 */

type CoachReport = {
  overall_score?: number;
  streamer_type?: string;
};

interface ProfileRow {
  id: string;
  twitch_display_name: string | null;
  twitch_login: string | null;
  twitch_avatar_url: string | null;
  collab_opt_in_at: string | null;
  collab_preferences: { collab_types?: string[] } | null;
}

interface VodRow {
  user_id: string;
  stream_date: string;
  coach_report: CoachReport | null;
  game_category: string | null;
}

interface FollowerRow {
  user_id: string;
  follower_count: number;
  snapped_at: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Caller opt-in check — keeps the pool private to participants.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("id, collab_opt_in")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.collab_opt_in) {
    return NextResponse.json(
      { error: "Opt in to the Collab Finder in Settings to browse other streamers." },
      { status: 403 }
    );
  }

  // Use admin client for cross-user reads — we deliberately limit fields below.
  // Profiles RLS only lets users read their own row, so admin client is needed
  // to query other opted-in users. discord_handle is NEVER selected here.
  const admin = createAdminClient();

  const [
    { data: optedIn },
    { data: existingInterests },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, twitch_display_name, twitch_login, twitch_avatar_url, collab_opt_in_at, collab_preferences")
      .eq("collab_opt_in", true)
      .neq("id", user.id)
      .order("collab_opt_in_at", { ascending: false })
      .limit(200) as unknown as Promise<{ data: ProfileRow[] | null }>,
    admin
      .from("collab_interests")
      .select("sender_id, recipient_id")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),
  ]);

  if (!optedIn || optedIn.length === 0) {
    return NextResponse.json({ me: { hasReadyVod: true }, users: [] });
  }

  // Filter out users the caller has any prior interest with (one-shot per pair).
  const touched = new Set<string>();
  for (const row of (existingInterests ?? [])) {
    const other = row.sender_id === user.id ? row.recipient_id : row.sender_id;
    touched.add(other);
  }
  const candidates = optedIn.filter((p) => !touched.has(p.id));

  if (candidates.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const candidateIds = candidates.map((p) => p.id);

  // Pull last 5 VODs per candidate + caller for game category + latest score.
  // Single query with a window function would be ideal; Supabase JS client
  // doesn't support window functions directly so we pull a wider set and bucket.
  const [vodResult, followerResult] = await Promise.all([
    admin
      .from("vods")
      .select("user_id, stream_date, coach_report, game_category")
      .in("user_id", [...candidateIds, user.id])
      .eq("status", "ready")
      .not("coach_report", "is", null)
      .order("stream_date", { ascending: false })
      .limit(candidateIds.length * 10 + 10) as unknown as Promise<{ data: VodRow[] | null }>,
    admin
      .from("follower_snapshots")
      .select("user_id, follower_count, snapped_at")
      .in("user_id", [...candidateIds, user.id])
      .eq("platform", "twitch")
      .order("snapped_at", { ascending: false })
      .limit(candidateIds.length * 3 + 3) as unknown as Promise<{ data: FollowerRow[] | null }>,
  ]);

  const vodsByUser = new Map<string, VodRow[]>();
  for (const v of vodResult.data ?? []) {
    const list = vodsByUser.get(v.user_id) ?? [];
    if (list.length < 5) list.push(v);
    vodsByUser.set(v.user_id, list);
  }

  const latestFollower = new Map<string, number>();
  for (const f of followerResult.data ?? []) {
    if (!latestFollower.has(f.user_id)) latestFollower.set(f.user_id, f.follower_count);
  }

  function summarize(p: ProfileRow): CollabUserSummary {
    const vods = vodsByUser.get(p.id) ?? [];
    const latest = vods[0]?.coach_report ?? null;
    const types = (p.collab_preferences?.collab_types ?? []).filter((t): t is string => typeof t === "string");
    const seenCats = new Set<string>();
    const recent: string[] = [];
    for (const v of vods) {
      if (v.game_category && !seenCats.has(v.game_category)) {
        seenCats.add(v.game_category);
        recent.push(v.game_category);
        if (recent.length >= 3) break;
      }
    }
    return {
      user_id: p.id,
      display_name: p.twitch_display_name ?? "Streamer",
      twitch_login: p.twitch_login ?? "",
      avatar_url: p.twitch_avatar_url,
      latest_score: typeof latest?.overall_score === "number" ? latest.overall_score : null,
      streamer_type: typeof latest?.streamer_type === "string" ? latest.streamer_type : null,
      recent_game_categories: recent,
      follower_count: latestFollower.get(p.id) ?? null,
      collab_types: types,
      opt_in_at: p.collab_opt_in_at,
    };
  }

  // Caller's own summary — used as the reference for match scoring.
  const meVods = vodsByUser.get(user.id) ?? [];
  const meLatest = meVods[0]?.coach_report ?? null;
  const meCatsSeen = new Set<string>();
  const meCats: string[] = [];
  for (const v of meVods) {
    if (v.game_category && !meCatsSeen.has(v.game_category)) {
      meCatsSeen.add(v.game_category);
      meCats.push(v.game_category);
      if (meCats.length >= 3) break;
    }
  }
  const meSummary: CollabUserSummary = {
    user_id: user.id,
    display_name: "",
    twitch_login: "",
    avatar_url: null,
    latest_score: typeof meLatest?.overall_score === "number" ? meLatest.overall_score : null,
    streamer_type: typeof meLatest?.streamer_type === "string" ? meLatest.streamer_type : null,
    recent_game_categories: meCats,
    follower_count: latestFollower.get(user.id) ?? null,
    collab_types: [],
    opt_in_at: null,
  };

  // Only surface users with a real coach score — the opt-in gate already
  // requires it, but defense-in-depth filters out anyone who slipped through
  // due to a deleted VOD or migration edge case.
  const summaries = candidates
    .map(summarize)
    .filter((s) => s.latest_score !== null);

  const ranked = summaries
    .map((s) => ({ ...s, _matchScore: scoreMatch(meSummary, s) }))
    .sort((a, b) => {
      if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
      // Tie-breaker: more recently opted-in first
      const aT = a.opt_in_at ? new Date(a.opt_in_at).getTime() : 0;
      const bT = b.opt_in_at ? new Date(b.opt_in_at).getTime() : 0;
      return bT - aT;
    })
    .slice(0, 60)
    .map(({ _matchScore: _, ...rest }) => rest);

  return NextResponse.json({ users: ranked });
}
