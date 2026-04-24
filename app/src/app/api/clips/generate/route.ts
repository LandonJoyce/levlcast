/**
 * POST /api/clips/generate
 *
 * Validates the request, creates a "processing" clip record, then fires an
 * Inngest background job to do the actual work (download → FFmpeg → upload).
 * Returns immediately — the clip appears on the dashboard when Inngest finishes.
 *
 * RESPONSES:
 *   200 { clipId }                              — job queued
 *   400 { error }                               — missing/invalid input
 *   401                                         — not authenticated
 *   403 { error, upgrade: true }                — clip limit hit
 *   404 { error }                               — VOD or peak not found
 *   409 { error }                               — clip already being generated
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { inngest } from "@/lib/inngest/client";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

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
  // Accept either peakIndex (normal flow) or startSeconds (regenerate from clip card)
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
    // Regenerate path: match peak by start time (±3s tolerance)
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

  // Validate peak timestamps — bad AI output could produce negatives or inverted times
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

  // Insert a "processing" record immediately so the UI shows the clip in progress.
  // Note: duration_seconds is a GENERATED column in Postgres (auto-computed from
  // end_time_seconds - start_time_seconds), so we must NOT include it here.
  // Postgres rejects any insert that writes to a generated column.
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

  // Fire background job — Inngest handles the download, FFmpeg, and upload.
  // Wrap in try/catch so a failed send doesn't leave the clip stuck in "processing".
  try {
    await inngest.send({
      name: "clip/generate",
      data: {
        clipId: clipRecord.id,
        vodId: vod.id,
        twitchVodId: vod.twitch_vod_id,
        userId: user.id,
        peakIndex: idx,
        peak,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to queue clip job";
    await admin.from("clips").update({
      status: "failed",
      failed_reason: `Could not queue clip generation: ${message}`,
    }).eq("id", clipRecord.id);
    return NextResponse.json({ error: "Failed to queue clip generation" }, { status: 500 });
  }

  return NextResponse.json({ clipId: clipRecord.id, queued: true });
}
