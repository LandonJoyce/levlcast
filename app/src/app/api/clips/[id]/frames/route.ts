/**
 * POST /api/clips/[id]/frames
 *
 * Extracts 4 candidate hook-frame thumbnails from an existing clip's clean
 * source, uploads each to R2, and caches the URL list on the clip row's
 * `candidate_frames` column. Subsequent loads of the editor return the
 * cached list instead of re-extracting.
 *
 * RESPONSES:
 *   200 { frames: string[] }   — URLs of the 4 candidate thumbnails
 *   401                         — not authenticated
 *   404                         — clip not found / not owned / no source video
 *   500                         — ffmpeg / upload failure
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { extractFrame } from "@/lib/ffmpeg";
import { uploadToR2 } from "@/lib/r2";
import { NextResponse } from "next/server";
import { writeFile, mkdtemp, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const maxDuration = 120;

// Sample positions across the clip — early hook, build, payoff, ending.
// 4 options keeps the picker simple and the extract step under 30s total.
const FRAME_POSITIONS = [0.1, 0.35, 0.65, 0.9] as const;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: clip } = await supabase
    .from("clips")
    .select("id, user_id, source_video_url, video_url, start_time_seconds, end_time_seconds, candidate_frames")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  // Cached candidates? Return immediately.
  const cached = clip.candidate_frames as string[] | null;
  if (cached && cached.length === FRAME_POSITIONS.length) {
    return NextResponse.json({ frames: cached });
  }

  const sourceUrl = (clip.source_video_url as string | null) ?? (clip.video_url as string | null);
  if (!sourceUrl) {
    return NextResponse.json({ error: "Clip has no playable source" }, { status: 404 });
  }

  const duration = (clip.end_time_seconds as number) - (clip.start_time_seconds as number);
  if (!duration || duration < 1) {
    return NextResponse.json({ error: "Clip has invalid duration" }, { status: 400 });
  }

  // Pull the source MP4 to /tmp once; ffmpeg seeks within it for each frame.
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-frames-"));
  const sourcePath = join(tempDir, "src.mp4");
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.error(`[frames] Source fetch ${res.status} for clip=${id}`);
      return NextResponse.json({ error: "Could not load clip source" }, { status: 500 });
    }
    await writeFile(sourcePath, Buffer.from(await res.arrayBuffer()));

    const frames: string[] = [];
    for (let i = 0; i < FRAME_POSITIONS.length; i++) {
      const t = duration * FRAME_POSITIONS[i];
      const frameBuf = await extractFrame(sourcePath, t);
      const key = `${clip.user_id}/${clip.id}-frame${i}-${Date.now()}.jpg`;
      const url = await uploadToR2(key, frameBuf, "image/jpeg");
      frames.push(url);
    }

    const admin = createAdminClient();
    await admin.from("clips").update({ candidate_frames: frames }).eq("id", id);

    return NextResponse.json({ frames });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[frames] Failed for clip=${id}:`, message);
    return NextResponse.json({ error: "Frame extraction failed" }, { status: 500 });
  } finally {
    await unlink(sourcePath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}
