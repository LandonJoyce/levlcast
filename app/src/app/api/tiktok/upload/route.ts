import { createClient, createAdminClient } from "@/lib/supabase/server";
import { uploadToTikTok, refreshTikTokToken } from "@/lib/tiktok";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const uploadSchema = z.object({
  clipId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = uploadSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { clipId } = body.data;

  const admin = createAdminClient();

  const { data: clip } = await admin.from("clips").select("*").eq("id", clipId).eq("user_id", user.id).single();
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const { data: conn } = await admin.from("social_connections").select("*").eq("user_id", user.id).eq("platform", "tiktok").single();
  if (!conn) return NextResponse.json({ error: "TikTok not connected" }, { status: 400 });

  let accessToken = conn.access_token;

  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    if (!conn.refresh_token) return NextResponse.json({ error: "Token expired, reconnect TikTok" }, { status: 400 });
    const refreshed = await refreshTikTokToken(conn.refresh_token);
    if (!refreshed.access_token) return NextResponse.json({ error: "Failed to refresh token" }, { status: 400 });
    accessToken = refreshed.access_token;
    await admin.from("social_connections").update({
      access_token: refreshed.access_token,
      expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", conn.id);
  }

  try {
    const result = await uploadToTikTok({
      accessToken,
      videoUrl: clip.video_url,
      title: clip.title,
    });

    await admin.from("social_posts").insert({
      user_id: user.id,
      clip_id: clipId,
      platform: "tiktok",
      platform_video_id: result.publishId,
      platform_url: null,
    });

    return NextResponse.json({ success: true, publishId: result.publishId });
  } catch (e: any) {
    console.error("[tiktok/upload] Upload failed:", e?.message ?? e);
    return NextResponse.json(
      { error: "Failed to upload to TikTok. Please try again." },
      { status: 500 }
    );
  }
}
