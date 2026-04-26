/**
 * GET /api/clips/[id]/export?layout=<StreamLayout>
 *
 * Downloads the clip from R2 to a temp file, runs FFmpeg to re-encode it as
 * 1080×1920 (9:16) vertical video in the chosen layout, then streams the
 * result back as a download. Pro-gated.
 *
 * maxDuration = 300s — Vercel keeps this alive while FFmpeg runs (~30-90s).
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { exportClipVertical, StreamLayout } from "@/lib/ffmpeg";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const VALID_LAYOUTS: StreamLayout[] = ["no_cam", "cam_br", "cam_bl", "cam_tr", "cam_tl"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usage = await getUserUsage(user.id, supabase);
  if (usage.plan !== "pro") {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const { id } = await params;
  const layout = (req.nextUrl.searchParams.get("layout") ?? "no_cam") as StreamLayout;
  if (!VALID_LAYOUTS.includes(layout)) {
    return NextResponse.json({ error: "Invalid layout" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clip } = await admin
    .from("clips")
    .select("id, title, video_url, status, caption_text")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!clip || !clip.video_url) {
    return NextResponse.json({ error: "Clip not found or not ready" }, { status: 404 });
  }

  // Prevent SSRF — only fetch from our R2 bucket
  const r2Base = process.env.R2_PUBLIC_URL;
  if (!r2Base || !(clip.video_url as string).startsWith(r2Base)) {
    return NextResponse.json({ error: "Invalid clip URL" }, { status: 400 });
  }

  // Download original clip to a temp file for FFmpeg
  const videoRes = await fetch(clip.video_url as string);
  if (!videoRes.ok || !videoRes.body) {
    return NextResponse.json({ error: "Failed to fetch clip for processing" }, { status: 502 });
  }

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-dl-"));
  const inputPath = join(tempDir, "input.mp4");

  try {
    const arrayBuffer = await videoRes.arrayBuffer();
    await writeFile(inputPath, Buffer.from(arrayBuffer));

    const captionText = (clip.caption_text as string | null) ?? undefined;
    const outputBuffer = await exportClipVertical(inputPath, layout, captionText);

    const safeName = ((clip.title as string) || "clip")
      .replace(/[^a-z0-9\-_ ]/gi, "")
      .slice(0, 80)
      .trim() || "clip";

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeName}-vertical.mp4"`,
        "Content-Length": String(outputBuffer.length),
        "Cache-Control": "private, no-cache",
      },
    });
  } finally {
    await unlink(inputPath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}
