/**
 * GET /api/collab — returns collab profile + suggestions (internal + external).
 * POST /api/collab — opt-in / update collab profile.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
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

      enriched = suggestions
        .map((s) => {
          if (s.is_external) {
            return {
              ...s,
              display_name: s.twitch_display_name || "Streamer",
              avatar_url: s.twitch_avatar_url || null,
              twitch_login: s.twitch_login,
            };
          }
          const profile = profileMap[s.match_user_id];
          return {
            ...s,
            display_name: profile?.twitch_display_name || null,
            avatar_url: profile?.twitch_avatar_url || null,
            twitch_login: profile?.twitch_login || null,
          };
        })
        // Hide internal matches with no Twitch login — can't message them
        .filter((s) => s.twitch_login);
    }

    return NextResponse.json({
      profile: collabProfile || null,
      suggestions: enriched,
    });
  } catch (err) {
    console.error("[api/collab] GET error:", err);
    return NextResponse.json({ profile: null, suggestions: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // --- Input validation ---
    const tagline = typeof body.tagline === "string" ? body.tagline.slice(0, 200) : null;

    let preferredCategories: string[] = [];
    if (Array.isArray(body.preferred_categories)) {
      const VALID_CATEGORIES = ["hype", "funny", "educational", "emotional", "clutch_play", "rage", "wholesome"];
      preferredCategories = body.preferred_categories
        .filter((c: unknown) => typeof c === "string" && VALID_CATEGORIES.includes(c))
        .slice(0, 5);
    }

    const minFollowers = typeof body.min_followers === "number" && body.min_followers >= 0
      ? Math.floor(body.min_followers)
      : 0;

    const maxFollowers = typeof body.max_followers === "number" && body.max_followers > 0
      ? Math.floor(body.max_followers)
      : null;

    const { error } = await supabase.from("collab_profiles").upsert(
      {
        user_id: user.id,
        enabled: body.enabled === true,
        tagline,
        preferred_categories: preferredCategories,
        min_followers: minFollowers,
        max_followers: maxFollowers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[api/collab] Upsert failed:", error.message);
      return NextResponse.json({ error: "Failed to save collab profile" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/collab] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
