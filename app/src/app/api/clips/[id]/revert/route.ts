/**
 * POST /api/clips/[id]/revert
 *
 * Restores a clip to its auto-generated state — the version that existed
 * before the first edit. Reads the original_* snapshot columns populated by
 * the first edit and copies them back onto the live fields.
 *
 * Idempotent: calling on a never-edited clip is a no-op success.
 *
 * RESPONSES:
 *   200 { ok: true, reverted: boolean }
 *   401, 404
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`revert:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many revert attempts. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;

  const { data: clip } = await supabase
    .from("clips")
    .select(
      "id, user_id, original_video_url, original_source_video_url, original_start_time_seconds, original_end_time_seconds, original_caption_style"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  if (!clip.original_video_url) {
    // Never edited — already at original.
    return NextResponse.json({ ok: true, reverted: false });
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("clips")
    .update({
      video_url: clip.original_video_url,
      source_video_url: clip.original_source_video_url,
      start_time_seconds: clip.original_start_time_seconds,
      end_time_seconds: clip.original_end_time_seconds,
      caption_style: clip.original_caption_style ?? "bold",
      // Wipe edits — next save starts fresh.
      edited_captions: null,
      candidate_frames: null,
      thumbnail_url: null,
      edited_at: null,
    })
    .eq("id", id);
  if (updateError) {
    console.error(`[revert] DB update failed for clip=${id}:`, updateError);
    return NextResponse.json({ error: "Failed to revert" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reverted: true });
}
