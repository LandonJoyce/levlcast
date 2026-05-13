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
import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage, incrementTrialClip } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { downloadTwitchVodVideo, refreshTwitchToken, TwitchAuthError } from "@/lib/twitch";
import { cutClip } from "@/lib/ffmpeg";
import type { CaptionStyle } from "@/lib/captions";
import { uploadToR2 } from "@/lib/r2";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 10 clip generation requests per hour per user
  if (!rateLimit(`generate:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // Check plan limits before any expensive work
  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_generate_clip) {
    const limitMsg = usage.on_trial
      ? `You've used all ${usage.clips_limit} clips on your free trial. Subscribe to keep clipping.`
      : `You've reached your ${usage.clips_limit} clip limit for this month.`;
    return NextResponse.json(
      { error: "limit_reached", message: limitMsg, upgrade: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { vodId, peakIndex, startSeconds } = body;
  // captionStyle is kept on the clip row as the DEFAULT visual style the
  // editor will pre-select. The auto-generation no longer burns captions
  // (the editor does that on save), so this is purely metadata.
  const DEFAULT_CAPTION_STYLE: CaptionStyle = "bold";

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

  // Coerce string timestamps — older peak_data rows may store these as strings
  const rawStart = peak.start;
  const rawEnd = peak.end;
  peak.start = Number(peak.start);
  peak.end = Number(peak.end);

  console.log(`[clip] peak timestamps: raw=(${rawStart}, ${rawEnd}) coerced=(${peak.start}, ${peak.end}) duration=${peak.end - peak.start}`);

  if (!isFinite(peak.start) || !isFinite(peak.end) || peak.start < 0 || peak.end <= peak.start) {
    console.error(`[clip] Invalid timestamps rejected: start=${peak.start} end=${peak.end} rawStart=${JSON.stringify(rawStart)} rawEnd=${JSON.stringify(rawEnd)}`);
    return NextResponse.json({ error: "Peak has invalid timestamps" }, { status: 400 });
  }

  // Expand short peaks to a minimum 30s window centered on the moment.
  // The AI sometimes returns tight 1-3s windows — still a valid moment, just needs padding.
  const MIN_DURATION = 30;
  const peakDuration = peak.end - peak.start;
  if (peakDuration < MIN_DURATION) {
    const pad = (MIN_DURATION - peakDuration) / 2;
    peak.start = Math.max(0, peak.start - pad);
    peak.end = peak.end + pad;
    console.log(`[clip] Expanded short peak (${peakDuration}s) to ${peak.start}s–${peak.end}s`);
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
      caption_style: DEFAULT_CAPTION_STYLE,
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

    // Fetch the user's Twitch OAuth token — Twitch blocks anonymous GQL requests.
    // If the stored token is expired (401), auto-refresh using the refresh token
    // and retry once before giving up.
    const { data: profile } = await admin
      .from("profiles")
      .select("twitch_access_token, twitch_refresh_token")
      .eq("id", userId)
      .single();
    let twitchUserToken = profile?.twitch_access_token || undefined;

    console.log(`[clip] Stage 1/4: downloading segments from Twitch`);
    let download;
    try {
      download = await downloadTwitchVodVideo(twitchVodId, peak.start, peak.end, twitchUserToken);
    } catch (err) {
      if (err instanceof TwitchAuthError && profile?.twitch_refresh_token) {
        console.log(`[clip] Twitch token expired — refreshing and retrying`);
        const refreshed = await refreshTwitchToken(profile.twitch_refresh_token);
        twitchUserToken = refreshed.accessToken;
        await admin.from("profiles").update({
          twitch_access_token: refreshed.accessToken,
          twitch_refresh_token: refreshed.refreshToken,
        }).eq("id", userId);
        download = await downloadTwitchVodVideo(twitchVodId, peak.start, peak.end, twitchUserToken);
      } else if (err instanceof TwitchAuthError) {
        throw new Error("Your Twitch connection has expired. Please log out and log back in, then try again.");
      } else {
        throw err;
      }
    }

    // Auto-generation produces a CLEAN (uncaptioned) clip. Captions are
    // applied only when the user opens the editor and saves an edit. This
    // makes the editor the canonical place captions get burned and means
    // there's never a risk of a user's chosen caption style overlapping
    // the auto-burned default. video_url and source_video_url both point
    // at the same clean upload until the first edit, at which point the
    // editor produces a separate captioned video_url and a re-trimmed
    // source_video_url.
    let cleanSourceBuffer: Buffer;
    try {
      const adjustedStart = peak.start - download.segmentStartSeconds;
      const adjustedEnd = peak.end - download.segmentStartSeconds;
      console.log(`[clip] Stage 2/4: cutting clean ${adjustedStart.toFixed(2)}s–${adjustedEnd.toFixed(2)}s (segment offset: ${download.segmentStartSeconds.toFixed(2)}s)`);
      // No vodWords / vodWindow passed → cutClip skips the caption pass and
      // returns the clean stream-copy in both `captioned` and `cleanSource`.
      const result = await cutClip(download.filePath, adjustedStart, adjustedEnd, {});
      cleanSourceBuffer = result.cleanSource;
      console.log(`[clip] Stage 2/4: cut complete — ${(cleanSourceBuffer.length / 1024 / 1024).toFixed(1)}MB clean`);
    } finally {
      await download.cleanup();
    }

    const baseFileName = `${userId}/${vodId}-peak${peakIndex}-${Date.now()}`;
    console.log(`[clip] Stage 3/4: uploading clean clip to R2 — ${baseFileName}`);
    const cleanUrl = await uploadToR2(`${baseFileName}-clean.mp4`, cleanSourceBuffer!, "video/mp4");
    console.log(`[clip] Stage 3/4: upload complete → ${cleanUrl}`);

    console.log(`[clip] Stage 4/4: updating DB record`);
    const { error: updateError } = await admin.from("clips").update({
      // Both URLs initially point at the same clean upload. Editor saves
      // produce separate captioned video_url + trimmed clean source_video_url.
      video_url: cleanUrl,
      source_video_url: cleanUrl,
      status: "ready",
    }).eq("id", clipId);

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    // Free trial users get a lifetime clip counter — increment on success only.
    // (profile already fetched above; reuse to avoid a second roundtrip.)
    const { data: clipOwner } = await admin
      .from("profiles")
      .select("plan, subscription_expires_at, twitch_id")
      .eq("id", userId)
      .single();
    const ownerExpired = clipOwner?.plan === "pro" && clipOwner?.subscription_expires_at &&
      new Date(clipOwner.subscription_expires_at) < new Date();
    const ownerOnFree = !(clipOwner?.plan === "pro" && !ownerExpired);
    if (ownerOnFree && clipOwner?.twitch_id) {
      await incrementTrialClip(clipOwner.twitch_id as string);
    }

    console.log(`[clip] Done: "${peak.title}" — all 4 stages complete`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[clip] FAILED clip=${clipId} vod=${vodId} peak="${peak.title}" (${peak.start}s–${peak.end}s):`, message);
    if (stack) console.error(`[clip] Stack:`, stack);
    await admin.from("clips").update({
      status: "failed",
      failed_reason: message,
    }).eq("id", clipId);
  }
}
