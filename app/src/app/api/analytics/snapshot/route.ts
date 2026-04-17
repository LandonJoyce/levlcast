import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/analytics/snapshot
 * Fetches current Twitch follower count and stores a daily snapshot.
 * Called silently on analytics page load.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get profile with Twitch credentials
  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_id, twitch_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.twitch_id || !profile?.twitch_access_token) {
    return NextResponse.json({ error: "No Twitch credentials" }, { status: 400 });
  }

  // Check if we already snapped today
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("follower_snapshots")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", "twitch")
    .gte("snapped_at", `${today}T00:00:00Z`)
    .single();

  if (existing) {
    return NextResponse.json({ skipped: true });
  }

  // Fetch follower count from Twitch
  const res = await fetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${profile.twitch_id}`,
    {
      headers: {
        Authorization: `Bearer ${profile.twitch_access_token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID!,
      },
    }
  );

  if (!res.ok) {
    // Scope not granted — follower tracking requires reconnect
    return NextResponse.json({ error: "followers_scope_missing" }, { status: 403 });
  }

  let json: { total?: number };
  try {
    json = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid response from Twitch" }, { status: 502 });
  }
  const followerCount: number = json.total ?? 0;

  await supabase.from("follower_snapshots").insert({
    user_id: user.id,
    platform: "twitch",
    follower_count: followerCount,
  });

  return NextResponse.json({ follower_count: followerCount });
}
