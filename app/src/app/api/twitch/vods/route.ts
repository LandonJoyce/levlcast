import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { fetchTwitchVods, getAppAccessToken, mapVodToRow, refreshTwitchToken } from "@/lib/twitch";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * POST /api/twitch/vods
 * Syncs the authenticated user's Twitch VODs into Supabase.
 * Uses a Twitch App Access Token (client credentials) since VODs are public.
 * Skips VODs that already exist (by twitch_vod_id).
 */
export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);

  // 1. Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 10 sync requests per hour per user
  if (!rateLimit(`sync:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // 2. Get profile + the user's stored Twitch tokens
  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_id, twitch_access_token, twitch_refresh_token")
    .eq("id", user.id)
    .single();

  if (!profile?.twitch_id) {
    return NextResponse.json(
      { error: "Twitch account not linked" },
      { status: 400 }
    );
  }

  // Try the user's OAuth token first, fall back to app token. User tokens
  // have the streamer's identity attached, which lets Twitch return mature-
  // flagged content that anonymous app tokens get age-gated out of —
  // Storm's recent VODs were missing because his channel is marked 18+
  // and Helix returns an empty list for app tokens against those channels.
  // Falls back to app token if user token is missing/expired and refresh
  // also fails.
  const admin = createAdminClient();

  let twitchVods: Awaited<ReturnType<typeof fetchTwitchVods>> = [];
  let lastError: string | null = null;
  let usedToken: "user" | "user-refreshed" | "app" | "none" = "none";

  // Attempt 1: stored user token.
  if (profile.twitch_access_token) {
    try {
      twitchVods = await fetchTwitchVods(profile.twitch_id, profile.twitch_access_token, 40);
      usedToken = "user";
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[twitch/vods] user token failed for user=${user.id}, will try refresh:`, lastError);
    }
  }

  // Attempt 2: refresh and retry user token (only if refresh token available).
  if (twitchVods.length === 0 && usedToken !== "user" && profile.twitch_refresh_token) {
    try {
      const refreshed = await refreshTwitchToken(profile.twitch_refresh_token);
      await admin.from("profiles").update({
        twitch_access_token: refreshed.accessToken,
        twitch_refresh_token: refreshed.refreshToken,
      }).eq("id", user.id);
      twitchVods = await fetchTwitchVods(profile.twitch_id, refreshed.accessToken, 40);
      usedToken = "user-refreshed";
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[twitch/vods] user-refreshed token also failed for user=${user.id}:`, lastError);
    }
  }

  // Attempt 3: app token. Last resort — won't see age-gated channels.
  if (twitchVods.length === 0 && usedToken === "none") {
    try {
      const appToken = await getAppAccessToken();
      twitchVods = await fetchTwitchVods(profile.twitch_id, appToken, 40);
      usedToken = "app";
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[twitch/vods] all token paths failed for user=${user.id}:`, lastError);
      return NextResponse.json(
        { error: "Failed to fetch VODs from Twitch", detail: lastError },
        { status: 502 }
      );
    }
  }

  console.log(`[twitch/vods] user=${user.id} fetched ${twitchVods.length} via ${usedToken}`);

  if (twitchVods.length === 0) {
    return NextResponse.json({ synced: 0, total: 0 });
  }

  // 5. Check which VODs we already have
  const twitchIds = twitchVods.map((v) => v.id);
  const { data: existing } = await supabase
    .from("vods")
    .select("twitch_vod_id")
    .eq("user_id", user.id)
    .in("twitch_vod_id", twitchIds);

  const existingIds = new Set(existing?.map((e) => e.twitch_vod_id) || []);

  // 6. Insert only new VODs
  const newVods = twitchVods
    .filter((v) => !existingIds.has(v.id))
    .map((v) => mapVodToRow(v, user.id));

  if (newVods.length === 0) {
    return NextResponse.json({
      synced: 0,
      total: twitchVods.length,
      message: "All VODs already synced",
    });
  }

  const { error: insertError } = await supabase.from("vods").insert(newVods);

  if (insertError) {
    console.error("VOD insert error:", insertError.message);
    return NextResponse.json(
      { error: "Failed to save VODs", detail: insertError.message },
      { status: 500 }
    );
  }

  // Push notification — let the streamer know new streams are ready to analyze
  try {
    const adminSupabase = await createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", user.id)
      .single();

    const count = newVods.length;
    await sendPush(profile?.expo_push_token, {
      title: count === 1 ? "New stream detected" : `${count} new streams detected`,
      body: "Analyze it on LevlCast to get your coach report.",
      data: { screen: "vods" },
    });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    synced: newVods.length,
    total: twitchVods.length,
  });
}
