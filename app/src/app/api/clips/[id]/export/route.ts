/**
 * GET /api/clips/[id]/export?cam=<x,y,w,h>&camAt=<top|bottom>
 * GET /api/clips/[id]/export?layout=<StreamLayout>   (older clients)
 *
 * Downloads the clip from R2 to a temp file, runs FFmpeg to re-encode it as
 * 1080×1920 (9:16) vertical video, then streams the result back as a
 * download. Pro-gated.
 *
 * `cam` is the facecam's box in the 16:9 frame, as fractions of its width
 * and height, from the editor's facecam picker; leave it out for gameplay
 * only. `camAt` puts the facecam panel at the top or the bottom. The
 * captions are the clip's own: the ones the streamer edited, in their
 * style, or the transcript grouped the usual way.
 *
 * maxDuration = 300s — Vercel keeps this alive while FFmpeg runs (~30-90s).
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { cleanCamBox, exportClipVertical, presetLayout, type StreamLayout, type VerticalLayout } from "@/lib/ffmpeg";
import { groupWordsIntoCards, sliceWordsForClip, type CaptionCard, type CaptionWord, type CaptionStyle } from "@/lib/captions";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { NextRequest, NextResponse } from "next/server";

// Capped at 300s — Vercel Hobby's hard max. 9:16 vertical export with
// caption overlay typically runs 60-180s. Long clips on slow CDN can push
// over 5 min, in which case the export fails and the user retries.
export const maxDuration = 300;

const VALID_LAYOUTS: StreamLayout[] = ["no_cam", "cam_br", "cam_bl", "cam_tr", "cam_tl"];

/** The layout asked for: a facecam box (the editor), or one of the old corner presets. */
function layoutFrom(params: URLSearchParams): VerticalLayout | null {
  const camAt = params.get("camAt") === "bottom" ? "bottom" : "top";
  const camParam = params.get("cam");
  if (camParam !== null) {
    if (camParam === "" || camParam === "none") return { cam: null, camAt };
    const [x, y, w, h] = camParam.split(",").map(Number);
    const cam = cleanCamBox({ x, y, w, h });
    return cam ? { cam, camAt } : null;
  }
  const layout = (params.get("layout") ?? "no_cam") as StreamLayout;
  return VALID_LAYOUTS.includes(layout) ? presetLayout(layout) : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usage = await getUserUsage(user.id, supabase);
  if (usage.plan !== "pro") {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const { id } = await params;
  const layout = layoutFrom(req.nextUrl.searchParams);
  if (!layout) {
    return NextResponse.json({ error: "Invalid layout" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clip } = await admin
    .from("clips")
    .select("id, title, video_url, source_video_url, status, vod_id, start_time_seconds, end_time_seconds, caption_style, edited_captions")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!clip || !clip.video_url) {
    return NextResponse.json({ error: "Clip not found or not ready" }, { status: 404 });
  }

  // Prevent SSRF — only fetch from our R2 bucket
  const r2Base = process.env.R2_PUBLIC_URL;
  // Use the clean (no-caption) source for vertical export so we can re-burn
  // captions at the correct 1080px vertical scale without inheriting the
  // horizontally-sized captions from the web player clip.
  const sourceUrl = (clip.source_video_url as string | null) ?? (clip.video_url as string);
  if (!r2Base || !sourceUrl.startsWith(r2Base)) {
    return NextResponse.json({ error: "Invalid clip URL" }, { status: 400 });
  }

  // The clip's captions: what the streamer edited (already relative to the
  // clip's start, which is where the clean source starts), or the
  // transcript grouped into cards. Edits used to be ignored here, so a
  // fixed typo came back in every vertical export.
  const style = ((clip.caption_style as string | null) ?? "bold") as CaptionStyle;
  let captionData: Parameters<typeof exportClipVertical>[2] | undefined;
  const edited = clip.edited_captions as CaptionCard[] | null;
  if (Array.isArray(edited)) {
    captionData = { cards: edited, style };
  } else {
    try {
      const { data: vodData } = await admin
        .from("vods")
        .select("word_timestamps")
        .eq("id", clip.vod_id)
        .single();
      const vodWords = (vodData?.word_timestamps as CaptionWord[] | null) ?? null;
      if (vodWords && clip.start_time_seconds != null && clip.end_time_seconds != null) {
        const sliced = sliceWordsForClip(vodWords, clip.start_time_seconds as number, clip.end_time_seconds as number);
        captionData = { cards: groupWordsIntoCards(sliced), style };
      }
    } catch {
      // Caption data unavailable — export without captions
    }
  }

  // Download clean source clip to a temp file for FFmpeg
  const videoRes = await fetch(sourceUrl);
  if (!videoRes.ok || !videoRes.body) {
    return NextResponse.json({ error: "Failed to fetch clip for processing" }, { status: 502 });
  }

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-dl-"));
  const inputPath = join(tempDir, "input.mp4");

  try {
    const arrayBuffer = await videoRes.arrayBuffer();
    await writeFile(inputPath, Buffer.from(arrayBuffer));

    let outputBuffer: Buffer;
    try {
      outputBuffer = await exportClipVertical(inputPath, layout, captionData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[export] FFmpeg failed for clip ${id} cam=${JSON.stringify(layout)}:`, msg);
      return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
    }

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
