/**
 * GET /api/collab — returns collab profile + suggestions (internal + external).
 * POST /api/collab — opt-in / update collab profile.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: collabProfile } = await supabase
    .from("collab_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: suggestions } = await supabase
    .from("collab_suggestions")
    .select("id, match_user_id, match_score, reasons, status, computed_at, is_external, twitch_id, twitch_login, twitch_display_name, twitch_avatar_url, follower_count")
    .eq("user_id", user.id)
    .neq("status", "dismissed")
    .order("match_score", { ascending: false })
    .limit(8);

  let enriched: any[] = [];
  if (suggestions && suggestions.length > 0) {
    // Enrich internal suggestions with profile data
    const internalIds = suggestions
      .filter((s) => !s.is_external && s.match_user_id)
      .map((s) => s.match_user_id);

    const profileMap: Record<string, any> = {};
    if (internalIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, twitch_display_name, twitch_avatar_url, twitch_login")
        .in("id", internalIds);

      for (const p of profiles || []) {
        profileMap[p.id] = p;
      }
    }

    enriched = suggestions.map((s) => {
      if (s.is_external) {
        return {
          ...s,
          display_name: s.twitch_display_name || "Streamer",
          avatar_url: s.twitch_avatar_url || null,
          twitch_login: s.twitch_login,
        };
      }
      return {
        ...s,
        display_name: profileMap[s.match_user_id]?.twitch_display_name || "Streamer",
        avatar_url: profileMap[s.match_user_id]?.twitch_avatar_url || null,
        twitch_login: profileMap[s.match_user_id]?.twitch_login || null,
      };
    });
  }

  return NextResponse.json({
    profile: collabProfile,
    suggestions: enriched,
  });
}

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { error } = await supabase.from("collab_profiles").upsert(
    {
      user_id: user.id,
      enabled: body.enabled ?? true,
      tagline: body.tagline ?? null,
      preferred_categories: body.preferred_categories ?? [],
      min_followers: body.min_followers ?? 0,
      max_followers: body.max_followers ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
