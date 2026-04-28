/**
 * POST /api/clips/generate
 *
 * Validates the request, creates a "processing" clip record, then runs the
 * actual work (download → FFmpeg → upload) in the background using waitUntil.
 * Returns immediately — no Inngest, no queue, no step retry backoff.
 *
 * RESPONSES:
 *   200 { clipId }                              — work started
 *   400 { error }                               — missing/invalid input
 *   401                                         — not authenticated
 *   403 { error, upgrade: true }                — clip limit hit
 *   404 { error }                               — VOD or peak not found
 *   409 { error }                               — clip already being generated
 */

import { waitUntil } from "@vercel/functions";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { downloadTwitchVodVideo } from "@/lib/twitch";
import { cutClip } from "@/lib/ffmpeg";
import type { CaptionWord } from "@/lib/captions";
import { uploadToR2 } from "@/lib/r2";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 10 clip generation requests per hour per user
  if (!rateLimit(`generate:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // Check plan limits before any expensive work
  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_generate_clip) {
    const limitMsg = usage.plan === "pro"
      ? "You've reached your 20 clip limit for this month."
      : "You've reached your 5 clip limit for this month. Upgrade to Pro for 20 clips per month.";
    return NextResponse.json(
      { error: "limit_reached", message: limitMsg, upgrade: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { vodId, peakIndex, startSeconds } = body;

  if (!vodId || typeof vodId !== "string" || (peakIndex === undefined && startSeconds === undefined)) {
    return NextResponse.json({ error: "Missing vodId or peakIndex/startSeconds" }, { status: 400 });
  }

  // Get VOD + verify ownership via RLS
  const { data: vod } = await supabase
    .from("vods")
    .select("id, twitch_vod_id, peak_data")
    .eq("id", vodId)
    .eq("user_id", user.id)
    .single();

  if (!vod || !vod.peak_data) {
    return NextResponse.json({ error: "VOD not found or not analyzed" }, { status: 404 });
  }

  const peaks = vod.peak_data as Array<{
    title: string; start: number; end: number;
    score: number; category: string; reason: string; caption: string;
  }>;

  let idx: number;
  let peak: typeof peaks[0] | undefined;

  if (startSeconds !== undefined) {
    const target = Number(startSeconds);
    idx = peaks.findIndex((p) => Math.abs(p.start - target) <= 3);
    peak = idx >= 0 ? peaks[idx] : undefined;
  } else {
    idx = Number(peakIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json({ error: "Invalid peakIndex" }, { status: 400 });
    }
    peak = peaks[idx];
  }

  if (!peak || idx < 0) return NextResponse.json({ error: "Peak not found" }, { status: 404 });

  if (typeof peak.start !== "number" || typeof peak.end !== "number" ||
      peak.start < 0 || peak.end <= peak.start || peak.end - peak.start < 2) {
    return NextResponse.json({ error: "Peak has invalid timestamps" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Guard against duplicate generation for the same peak
  const { data: existing } = await admin
    .from("clips")
    .select("id")
    .eq("user_id", user.id)
    .eq("vod_id", vodId)
    .eq("start_time_seconds", Math.round(peak.start))
    .eq("status", "processing")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Clip already being generated" }, { status: 409 });
  }

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
    console.error(`[clips/generate] Insert failed for user ${user.id} vod ${vodId}:`, insertError);
    return NextResponse.json({ error: "Failed to create clip record" }, { status: 500 });
  }

  // Run the actual work in the background — Vercel keeps this invocation alive
  // until the promise resolves (up to maxDuration = 300s). Response is returned
  // to the client immediately; the clip status updates in the DB when done.
  waitUntil(runClipGeneration({
    clipId: clipRecord.id,
    twitchVodId: vod.twitch_vod_id,
    userId: user.id,
    vodId: vod.id,
    peakIndex: idx,
    peak,
  }));

  return NextResponse.json({ clipId: clipRecord.id });
}

async function runClipGeneration({
  clipId,
  twitchVodId,
  userId,
  vodId,
  peakIndex,
  peak,
}: {
  clipId: string;
  twitchVodId: string;
  userId: string;
  vodId: string;
  peakIndex: number;
  peak: { title: string; start: number; end: number; score: number; category: string; reason: string; caption: string };
}) {
  const admin = createAdminClient();

  try {
    console.log(`[clip] Starting generation for "${peak.title}" (${peak.start}s–${peak.end}s)`);

    const download = await downloadTwitchVodVideo(twitchVodId, peak.start, peak.end);

    // Pull word-level timestamps so cutClip can burn TikTok-style captions.
    const { data: vodRow } = await admin
      .from("vods")
      .select("word_timestamps")
      .eq("id", vodId)
      .single();
    const vodWords = (vodRow?.word_timestamps as CaptionWord[] | null) ?? null;
    if (!vodWords) console.warn("[clip] No word_timestamps on VOD — captions will be skipped (VOD needs re-analysis)");

    let buffer: Buffer;
    try {
      const adjustedStart = peak.start - download.segmentStartSeconds;
      const adjustedEnd = peak.end - download.segmentStartSeconds;
      console.log(`[clip] Cutting ${adjustedStart}s–${adjustedEnd}s (offset: ${download.segmentStartSeconds}s)`);
      buffer = await cutClip(download.filePath, adjustedStart, adjustedEnd, {
        vodWords,
        vodWindow: { start: peak.start, end: peak.end },
      });
      console.log(`[clip] Cut complete: ${buffer.length} bytes`);
    } finally {
      await download.cleanup();
    }

    const fileName = `${userId}/${vodId}-peak${peakIndex}-${Date.now()}.mp4`;
    const publicUrl = await uploadToR2(fileName, buffer!, "video/mp4");

    const { error: updateError } = await admin.from("clips").update({
      video_url: publicUrl,
      status: "ready",
    }).eq("id", clipId);

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    console.log(`[clip] Done: "${peak.title}" → ${publicUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[clip] Failed for ${clipId}:`, message);
    await admin.from("clips").update({
      status: "failed",
      failed_reason: message,
    }).eq("id", clipId);
  }
}
