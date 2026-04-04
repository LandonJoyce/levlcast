/**
 * POST /api/clips/generate
 *
 * Generates a video clip from a specific peak moment in an analyzed VOD.
 * This is a long-running route (~30-60s) — it downloads audio, runs FFmpeg,
 * and uploads the result to Supabase Storage.
 *
 * REQUEST BODY:
 *   { vodId: string, peakIndex: number }
 *   peakIndex is the index into the vod's peak_data array (0-based).
 *
 * RESPONSES:
 *   200 { clipId: string, storageUrl: string } — clip ready
 *   400 { error: "..." }          — missing/invalid input
 *   401                           — not authenticated
 *   403 { error: "limit_reached", upgrade: true } — clip limit hit
 *   404 { error: "not_found" }    — VOD or peak not found
 *   409 { error: "already_exists" }              — clip already generated
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { downloadTwitchVodAudio } from "@/lib/twitch";
import { cutClip } from "@/lib/ffmpeg";
import { getUserUsage } from "@/lib/limits";
import { NextResponse } from "next/server";

/**
 * POST /api/clips/generate
 * Body: { vodId, peakIndex } — generates an mp4 clip from a detected peak.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check plan limits before any expensive work
  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_generate_clip) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: "You've reached the 5 clip limit on the free plan. Upgrade to Pro for unlimited clips.",
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { vodId, peakIndex } = body;

  if (!vodId || typeof vodId !== "string" || peakIndex === undefined) {
    return NextResponse.json({ error: "Missing or invalid vodId or peakIndex" }, { status: 400 });
  }

  const idx = Number(peakIndex);
  if (!Number.isInteger(idx) || idx < 0) {
    return NextResponse.json({ error: "Invalid peakIndex" }, { status: 400 });
  }

  // Get VOD with peak data — RLS ensures this user owns it
  const { data: vod } = await supabase
    .from("vods")
    .select("*")
    .eq("id", vodId)
    .eq("user_id", user.id)
    .single();

  if (!vod || !vod.peak_data) {
    return NextResponse.json({ error: "VOD not found or not analyzed" }, { status: 404 });
  }

  const peaks = vod.peak_data as Array<{
    title: string;
    start: number;
    end: number;
    score: number;
    category: string;
    reason: string;
    caption: string;
  }>;

  const peak = peaks[idx];
  if (!peak) {
    return NextResponse.json({ error: "Peak not found" }, { status: 404 });
  }

  const admin = createAdminClient();

  // Race condition guard — check if this peak is already being generated.
  // Insert a "processing" record first; if one already exists, reject the duplicate.
  const { data: existing } = await admin
    .from("clips")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("vod_id", vodId)
    .eq("start_time_seconds", Math.round(peak.start))
    .eq("status", "processing")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Clip already being generated" }, { status: 409 });
  }

  // Insert a processing record now — this is the source of truth for the clip
  const { data: clipRecord, error: insertError } = await admin
    .from("clips")
    .insert({
      user_id: user.id,
      vod_id: vodId,
      title: peak.title,
      description: peak.reason,
      start_time_seconds: Math.round(peak.start),
      end_time_seconds: Math.round(peak.end),
      caption_text: peak.caption,
      peak_score: peak.score,
      peak_category: peak.category,
      peak_reason: peak.reason,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError || !clipRecord) {
    return NextResponse.json({ error: "Failed to create clip record" }, { status: 500 });
  }

  const clipId = clipRecord.id;
  let cleanup: (() => Promise<void>) | null = null;

  try {
    console.log(`[clip] Downloading VOD ${vod.twitch_vod_id} for clip "${peak.title}"`);

    const download = await downloadTwitchVodAudio(vod.twitch_vod_id);
    cleanup = download.cleanup;

    console.log(`[clip] Cutting clip: ${peak.start}s - ${peak.end}s`);
    const clipBuffer = await cutClip(download.filePath, peak.start, peak.end);
    console.log(`[clip] Clip generated: ${clipBuffer.length} bytes`);

    await admin.storage.createBucket("clips", {
      public: true,
      fileSizeLimit: 104857600,
    }).catch(() => {});

    const fileName = `${user.id}/${vod.id}-peak${idx}-${Date.now()}.mp4`;

    const { error: uploadError } = await admin.storage
      .from("clips")
      .upload(fileName, clipBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = admin.storage.from("clips").getPublicUrl(fileName);

    await admin.from("clips").update({
      video_url: urlData.publicUrl,
      status: "ready",
    }).eq("id", clipId);

    console.log(`[clip] Clip saved: "${peak.title}"`);

    return NextResponse.json({ success: true, title: peak.title, url: urlData.publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[clip] Generation failed:", message);

    // Mark clip as failed so it doesn't stay "processing" forever
    await admin.from("clips").update({ status: "failed" }).eq("id", clipId);

    return NextResponse.json({ error: "Clip generation failed", detail: message }, { status: 500 });
  } finally {
    if (cleanup) await cleanup();
  }
}
