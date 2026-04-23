import { createClient, createAdminClient } from "@/lib/supabase/server";
import { uploadToYouTube, refreshYouTubeToken } from "@/lib/youtube";
import { getUserUsage } from "@/lib/limits";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // YouTube Shorts posting is a Pro feature. Enforce server-side so the
  // paywall can't be bypassed by calling this endpoint directly.
  const usage = await getUserUsage(user.id, supabase);
  if (usage.plan !== "pro") {
    return NextResponse.json(
      { error: "YouTube posting is a Pro feature. Upgrade to post clips directly.", upgrade: true },
      { status: 403 }
    );
  }

  const { clipId } = await req.json();
  if (!clipId) return NextResponse.json({ error: "Missing clipId" }, { status: 400 });

  const admin = createAdminClient();

  // Get clip
  const { data: clip } = await admin.from("clips").select("*").eq("id", clipId).eq("user_id", user.id).single();
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  // Get YouTube connection
  const { data: conn } = await admin.from("social_connections").select("*").eq("user_id", user.id).eq("platform", "youtube").single();
  if (!conn) return NextResponse.json({ error: "YouTube not connected" }, { status: 400 });

  let accessToken = conn.access_token;

  // Refresh token if expired
  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    if (!conn.refresh_token) return NextResponse.json({ error: "Token expired, reconnect YouTube" }, { status: 400 });
    const refreshed = await refreshYouTubeToken(conn.refresh_token);
    if (!refreshed.access_token) return NextResponse.json({ error: "Failed to refresh token" }, { status: 400 });
    accessToken = refreshed.access_token;
    await admin.from("social_connections").update({
      access_token: refreshed.access_token,
      expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", conn.id);
  }

  try {
    const result = await uploadToYouTube({
      accessToken,
      videoUrl: clip.video_url,
      title: clip.title,
      description: clip.caption_text || "",
    });

    // Save post record
    await admin.from("social_posts").insert({
      user_id: user.id,
      clip_id: clipId,
      platform: "youtube",
      platform_video_id: result.videoId,
      platform_url: result.url,
    });

    return NextResponse.json({ success: true, url: result.url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
