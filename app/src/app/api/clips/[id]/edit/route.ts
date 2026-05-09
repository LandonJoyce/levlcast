/**
 * POST /api/clips/[id]/edit
 *
 * Re-exports an existing clip with user-specified edits. Pulls the cached
 * clean-source MP4 from R2 (no Twitch redownload), trims to the new bounds,
 * burns user-edited captions, sets the chosen thumbnail, and replaces the
 * captioned video URL on the clip row.
 *
 * Re-edits do NOT cost a clip from the user's quota — they're refining what
 * they already paid for. Original bounds (start_time_seconds, end_time_seconds)
 * are NOT modified; the trim values represent offsets WITHIN the original cut.
 *
 * REQUEST BODY:
 *   {
 *     trimStart?: number,            // seconds from clip start; default 0
 *     trimEnd?: number,              // seconds from clip start; default original duration
 *     editedCaptions?: Array<{ start: number; end: number; text: string }>, // clip-relative
 *     captionStyle?: CaptionStyle,
 *     thumbnailUrl?: string,         // one of candidate_frames
 *   }
 *
 * RESPONSES:
 *   200 { ok: true, videoUrl }
 *   400, 401, 404, 500
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { cutClip } from "@/lib/ffmpeg";
import type { CaptionCard, CaptionStyle } from "@/lib/captions";
import { uploadToR2 } from "@/lib/r2";
import { NextResponse } from "next/server";
import { writeFile, mkdtemp, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const maxDuration = 300;

const VALID_STYLES: CaptionStyle[] = ["bold", "boxed", "minimal", "classic", "neon", "fire", "impact"];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: clip } = await supabase
    .from("clips")
    .select("id, user_id, source_video_url, video_url, start_time_seconds, end_time_seconds, caption_style, candidate_frames")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  if (!clip.source_video_url) {
    return NextResponse.json({ error: "Clip has no clean source — cannot re-edit" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const fullDuration = (clip.end_time_seconds as number) - (clip.start_time_seconds as number);

  const trimStart = clamp(Number(body.trimStart ?? 0), 0, fullDuration);
  const trimEnd = clamp(Number(body.trimEnd ?? fullDuration), trimStart + 1, fullDuration);
  if (trimEnd - trimStart < 2) {
    return NextResponse.json({ error: "Edited clip must be at least 2 seconds" }, { status: 400 });
  }

  const requestedStyle = typeof body.captionStyle === "string" ? body.captionStyle : null;
  const captionStyle: CaptionStyle = VALID_STYLES.includes(requestedStyle as CaptionStyle)
    ? (requestedStyle as CaptionStyle)
    : ((clip.caption_style as CaptionStyle) ?? "bold");

  const rawCards = Array.isArray(body.editedCaptions) ? (body.editedCaptions as Array<unknown>) : null;
  const editedCards: CaptionCard[] | undefined = rawCards
    ? rawCards
        .map((c) => {
          if (typeof c !== "object" || !c) return null;
          const obj = c as { start?: unknown; end?: unknown; text?: unknown };
          if (typeof obj.start !== "number" || typeof obj.end !== "number" || typeof obj.text !== "string") return null;
          return { start: obj.start, end: obj.end, text: obj.text.trim() };
        })
        .filter((c): c is CaptionCard => c !== null && c.text.length > 0)
        // Cards arrive in original-clip-relative time. Shift to new-clip-relative.
        .map((c) => ({ start: c.start - trimStart, end: c.end - trimStart, text: c.text }))
        // Drop cards that fall outside the trimmed window.
        .filter((c) => c.end > 0 && c.start < trimEnd - trimStart)
        // Clip card edges into the new window.
        .map((c) => ({
          start: Math.max(0, c.start),
          end: Math.min(trimEnd - trimStart, c.end),
          text: c.text,
        }))
        .filter((c) => c.end > c.start + 0.05)
    : undefined;

  const requestedThumb = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null;
  const candidateUrls = (clip.candidate_frames as string[] | null) ?? [];
  // Only allow setting a thumbnail that's in our cached candidate list — prevents
  // injecting arbitrary URLs into the clip record.
  const thumbnailUrl = requestedThumb && candidateUrls.includes(requestedThumb) ? requestedThumb : null;

  // Fetch clean source MP4 from R2 to /tmp.
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-edit-"));
  const sourcePath = join(tempDir, "src.mp4");

  try {
    const res = await fetch(clip.source_video_url as string);
    if (!res.ok) {
      console.error(`[edit] Source fetch ${res.status} for clip=${id}`);
      return NextResponse.json({ error: "Could not load clip source" }, { status: 500 });
    }
    await writeFile(sourcePath, Buffer.from(await res.arrayBuffer()));

    console.log(`[edit] Re-cutting clip=${id} ${trimStart.toFixed(2)}-${trimEnd.toFixed(2)}s, ${editedCards?.length ?? 0} cards, style=${captionStyle}`);

    const cut = await cutClip(sourcePath, trimStart, trimEnd, {
      editedCards,
      captionStyle,
    });

    const baseFileName = `${clip.user_id}/${clip.id}-edit-${Date.now()}`;
    const publicUrl = await uploadToR2(`${baseFileName}.mp4`, cut.captioned, "video/mp4");

    const admin = createAdminClient();
    const update: Record<string, unknown> = {
      video_url: publicUrl,
      caption_style: captionStyle,
    };
    if (editedCards) update.edited_captions = editedCards;
    if (thumbnailUrl) update.thumbnail_url = thumbnailUrl;

    const { error: updateError } = await admin
      .from("clips")
      .update(update)
      .eq("id", id);
    if (updateError) {
      console.error(`[edit] DB update failed for clip=${id}:`, updateError);
      return NextResponse.json({ error: "Failed to save edit" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, videoUrl: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[edit] Failed for clip=${id}:`, message);
    return NextResponse.json({ error: message || "Edit failed" }, { status: 500 });
  } finally {
    await unlink(sourcePath).catch(() => {});
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir);
    } catch {}
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
