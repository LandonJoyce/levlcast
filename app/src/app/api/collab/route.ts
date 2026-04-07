/**
 * GET /api/collab — returns collab profile + suggestions for the current user.
 * POST /api/collab — opt-in / update collab profile.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch collab profile
  const { data: collabProfile } = await supabase
    .from("collab_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Fetch suggestions with matched user info
  const { data: suggestions } = await supabase
    .from("collab_suggestions")
    .select("id, match_user_id, match_score, reasons, status, computed_at")
    .eq("user_id", user.id)
    .neq("status", "dismissed")
    .order("match_score", { ascending: false })
    .limit(5);

  // Enrich suggestions with display name + avatar
  let enriched: any[] = [];
  if (suggestions && suggestions.length > 0) {
    const matchIds = suggestions.map((s) => s.match_user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, twitch_display_name, twitch_avatar_url, twitch_login")
      .in("id", matchIds);

    const profileMap: Record<string, any> = {};
    for (const p of profiles || []) {
      profileMap[p.id] = p;
    }

    enriched = suggestions.map((s) => ({
      ...s,
      display_name: profileMap[s.match_user_id]?.twitch_display_name || "Streamer",
      avatar_url: profileMap[s.match_user_id]?.twitch_avatar_url || null,
      twitch_login: profileMap[s.match_user_id]?.twitch_login || null,
    }));
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
