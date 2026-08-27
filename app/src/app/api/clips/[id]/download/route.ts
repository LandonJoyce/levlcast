import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/clips/[id]/download
 *
 * Streams a clip's video file with Content-Disposition: attachment so the
 * browser triggers a download. Required because the raw R2 public URL is
 * cross-origin — browsers ignore the HTML `download` attribute on
 * cross-origin links, so a direct <a href=…> just plays the video in-tab
 * instead of downloading it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: clip } = await admin
    .from("clips")
    .select("id, title, video_url, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!clip || !clip.video_url) {
    return NextResponse.json({ error: "Clip not found or not ready" }, { status: 404 });
  }

  // Validate the URL is actually from our R2 bucket before fetching (prevent SSRF)
  const r2Base = process.env.R2_PUBLIC_URL;
  if (!r2Base || !clip.video_url.startsWith(r2Base)) {
    return NextResponse.json({ error: "Invalid clip URL" }, { status: 400 });
  }

  const videoRes = await fetch(clip.video_url);
  if (!videoRes.ok || !videoRes.body) {
    return NextResponse.json({ error: "Video fetch failed" }, { status: 502 });
  }

  const safeName = (clip.title || "clip").replace(/[^a-z0-9\-_ ]/gi, "").slice(0, 80).trim() || "clip";

  return new Response(videoRes.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${safeName}.mp4"`,
      "Content-Length": videoRes.headers.get("content-length") ?? "",
      "Cache-Control": "private, no-cache",
    },
  });
}
