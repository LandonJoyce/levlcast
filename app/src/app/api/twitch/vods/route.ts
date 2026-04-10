import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { fetchTwitchVods, getAppAccessToken, mapVodToRow } from "@/lib/twitch";
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

  // 2. Get profile to find their Twitch ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_id")
    .eq("id", user.id)
    .single();

  if (!profile?.twitch_id) {
    return NextResponse.json(
      { error: "Twitch account not linked" },
      { status: 400 }
    );
  }

  // 3. Get an app access token (client credentials — no user token needed)
  let appToken: string;
  try {
    appToken = await getAppAccessToken();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("App token failed:", message);
    return NextResponse.json(
      { error: "Failed to authenticate with Twitch" },
      { status: 502 }
    );
  }

  // 4. Fetch VODs from Twitch Helix API
  let twitchVods;
  try {
    twitchVods = await fetchTwitchVods(profile.twitch_id, appToken, 40);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Twitch VOD fetch failed:", message);
    return NextResponse.json(
      { error: "Failed to fetch VODs from Twitch", detail: message },
      { status: 502 }
    );
  }

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
