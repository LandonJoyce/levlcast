import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/collab/interest/inbox
 * Returns the caller's pending incoming interests with the sender's
 * public-facing fields (display name, avatar, latest score, recent games,
 * follower count). Discord handle is NEVER returned here — that reveal
 * only happens after an accept.
 */

interface CoachReport {
  overall_score?: number;
  streamer_type?: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS lets the recipient read their own rows directly.
  const { data: interests } = await supabase
    .from("collab_interests")
    .select("id, sender_id, intro_text, status, created_at")
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!interests || interests.length === 0) {
    return NextResponse.json({ interests: [] });
  }

  // Hydrate sender public fields with the admin client (cross-user reads).
  const admin = createAdminClient();
  const senderIds = Array.from(new Set(interests.map((i) => i.sender_id)));

  const [profilesRes, vodsRes, followerRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, twitch_display_name, twitch_login, twitch_avatar_url")
      .in("id", senderIds),
    admin
      .from("vods")
      .select("user_id, coach_report, stream_date, game_category")
      .in("user_id", senderIds)
      .eq("status", "ready")
      .not("coach_report", "is", null)
      .order("stream_date", { ascending: false }),
    admin
      .from("follower_snapshots")
      .select("user_id, follower_count, snapped_at")
      .in("user_id", senderIds)
      .eq("platform", "twitch")
      .order("snapped_at", { ascending: false }),
  ]);

  const profileById = new Map<string, { display_name: string; twitch_login: string; avatar_url: string | null }>();
  for (const p of profilesRes.data ?? []) {
    profileById.set(p.id as string, {
      display_name: (p.twitch_display_name as string | null) ?? "Streamer",
      twitch_login: (p.twitch_login as string | null) ?? "",
      avatar_url: (p.twitch_avatar_url as string | null) ?? null,
    });
  }

  const vodsByUser = new Map<string, Array<{ coach_report: CoachReport | null; game_category: string | null }>>();
  for (const v of vodsRes.data ?? []) {
    const uid = v.user_id as string;
    const list = vodsByUser.get(uid) ?? [];
    if (list.length < 5) list.push({ coach_report: v.coach_report as CoachReport | null, game_category: v.game_category as string | null });
    vodsByUser.set(uid, list);
  }

  const followerById = new Map<string, number>();
  for (const f of followerRes.data ?? []) {
    if (!followerById.has(f.user_id as string)) followerById.set(f.user_id as string, f.follower_count as number);
  }

  const hydrated = interests.map((i) => {
    const p = profileById.get(i.sender_id);
    const vods = vodsByUser.get(i.sender_id) ?? [];
    const latest = vods[0]?.coach_report ?? null;
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const v of vods) {
      if (v.game_category && !seen.has(v.game_category)) {
        seen.add(v.game_category);
        cats.push(v.game_category);
        if (cats.length >= 3) break;
      }
    }
    return {
      id: i.id,
      sender_id: i.sender_id,
      intro_text: i.intro_text,
      created_at: i.created_at,
      sender: {
        display_name: p?.display_name ?? "Streamer",
        twitch_login: p?.twitch_login ?? "",
        avatar_url: p?.avatar_url ?? null,
        latest_score: typeof latest?.overall_score === "number" ? latest.overall_score : null,
        streamer_type: typeof latest?.streamer_type === "string" ? latest.streamer_type : null,
        recent_game_categories: cats,
        follower_count: followerById.get(i.sender_id) ?? null,
      },
    };
  });

  return NextResponse.json({ interests: hydrated });
}
