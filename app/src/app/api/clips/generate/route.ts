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
  const { vodId, peakIndex } = body;

  if (!vodId || typeof vodId !== "string" || peakIndex === undefined) {
    return NextResponse.json({ error: "Missing or invalid vodId or peakIndex" }, { status: 400 });
  }

  const idx = Number(peakIndex);
  if (!Number.isInteger(idx) || idx < 0) {
    return NextResponse.json({ error: "Invalid peakIndex" }, { status: 400 });
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

  const peak = peaks[idx];
  if (!peak) return NextResponse.json({ error: "Peak not found" }, { status: 404 });

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

  // Insert a "processing" record immediately so the UI shows the clip in progress
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

  // Fire background job — Inngest handles the download, FFmpeg, and upload
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

  return NextResponse.json({ clipId: clipRecord.id, queued: true });
}
