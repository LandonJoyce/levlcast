/**
 * POST /api/clips/highlight-reel
 *
 * Generates a multi-cut highlight reel from the top peaks of a VOD.
 *
 * Behaviour:
 *   - Picks the top 3 peaks by score (capped to whatever's in peak_data).
 *   - Tightens each peak window to a maximum per-segment length so the final
 *     reel stays under ~60 seconds.
 *   - Downloads + cuts each peak in parallel using the existing cutClip path,
 *     then concatenates the captioned outputs with concatClipBuffers().
 *   - Stores as a single clip row of caption_style "reel". Counts as one
 *     clip toward the user's quota even though it includes multiple moments.
 *
 * RESPONSES:
 *   200 { clipId }                              — work started
 *   400                                          — missing/invalid input
 *   401                                          — not authenticated
 *   403 { error, upgrade: true }                 — clip quota exhausted
 *   404                                          — VOD or peaks not found
 *   409                                          — reel already being generated for this VOD
 */

import { waitUntil } from "@vercel/functions";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage, incrementTrialClip } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { downloadTwitchVodVideo, refreshTwitchToken, TwitchAuthError } from "@/lib/twitch";
import { cutClip, concatClipBuffers } from "@/lib/ffmpeg";
import { uploadToR2 } from "@/lib/r2";
import { NextResponse } from "next/server";

export const maxDuration = 300;

// Reel target: 3 segments, ~18s each = ~54s total. Within TikTok / Shorts
// optimal length and short enough to ship through Vercel's 300s function
// budget even with cold ffmpeg downloads.
const MAX_REEL_SEGMENTS = 3;
const MAX_SEGMENT_SECONDS = 20;
const MIN_SEGMENT_SECONDS = 8;

type Peak = {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason: string;
  caption: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Reels are heavier than single clips — limit more aggressively.
  if (!rateLimit(`reel:${user.id}`, 4, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many highlight reel requests. Try again later." }, { status: 429 });
  }

  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_generate_clip) {
    const message = usage.on_trial
      ? `You've used all ${usage.clips_limit} clips on your free trial. Subscribe to keep clipping.`
      : `You've reached your ${usage.clips_limit} clip limit for this month.`;
    return NextResponse.json(
      { error: "limit_reached", message, upgrade: true },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const vodId = typeof body.vodId === "string" ? body.vodId : null;
  if (!vodId) {
    return NextResponse.json({ error: "Missing vodId" }, { status: 400 });
  }

  const { data: vod } = await supabase
    .from("vods")
    .select("id, twitch_vod_id, title, peak_data")
    .eq("id", vodId)
    .eq("user_id", user.id)
    .single();
  if (!vod || !vod.peak_data) {
    return NextResponse.json({ error: "VOD not found or not analyzed" }, { status: 404 });
  }

  const peaks = (vod.peak_data as Peak[]).map((p) => ({
    ...p,
    start: Number(p.start),
    end: Number(p.end),
  })).filter((p) => isFinite(p.start) && isFinite(p.end) && p.end > p.start);

  if (peaks.length < 2) {
    return NextResponse.json(
      { error: "not_enough_moments", message: "This stream only had one strong moment, so a highlight reel isn't available. Generate the single clip instead." },
      { status: 400 }
    );
  }

  // Top picks by score, then chronological so the reel feels like the stream.
  const selected = [...peaks]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_REEL_SEGMENTS)
    .sort((a, b) => a.start - b.start);

  const tightened = selected.map((p) => tightenSegment(p));

  const admin = createAdminClient();

  // Guard: only one in-progress reel per VOD at a time.
  const { data: existing } = await admin
    .from("clips")
    .select("id")
    .eq("user_id", user.id)
    .eq("vod_id", vodId)
    .eq("status", "processing")
    .eq("caption_style", "reel")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Highlight reel already being generated" }, { status: 409 });
  }

  // Use the chronologically-first segment's start as the clip row's
  // start_time_seconds so list views still sort it sensibly. The duration
  // column is GENERATED so we don't set it directly — end_time matches
  // start + total reel length.
  const firstStart = tightened[0].start;
  const totalDuration = tightened.reduce((acc, s) => acc + (s.end - s.start), 0);
  const reelTitle = `Highlight Reel: ${(vod.title as string | null) ?? "Stream"}`.slice(0, 200);
  const reelCaption = "Top moments stitched into one short.";

  const { data: clipRecord, error: insertError } = await admin
    .from("clips")
    .insert({
      user_id: user.id,
      vod_id: vodId,
      title: reelTitle,
      description: `Highlight reel of ${tightened.length} moments`,
      start_time_seconds: Math.round(firstStart),
      end_time_seconds: Math.round(firstStart + totalDuration),
      caption_text: reelCaption,
      caption_style: "reel",
      peak_score: selected[0].score,
      peak_category: "highlight_reel",
      peak_reason: "Multi-cut highlight reel",
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError || !clipRecord) {
    console.error(`[reel] Insert failed for user ${user.id} vod ${vodId}:`, insertError);
    return NextResponse.json({ error: "Failed to create clip record" }, { status: 500 });
  }

  waitUntil(runHighlightReel({
    clipId: clipRecord.id,
    twitchVodId: vod.twitch_vod_id as string,
    userId: user.id,
    vodId: vod.id,
    segments: tightened,
  }));

  return NextResponse.json({ clipId: clipRecord.id });
}

/**
 * Tighten a peak's window to MAX_SEGMENT_SECONDS by trimming evenly from both
 * ends so the moment stays centred. If the original window is shorter than
 * MIN_SEGMENT_SECONDS we expand symmetrically — short windows often come from
 * single-utterance peaks that need a beat of context.
 */
function tightenSegment(p: Peak): Peak {
  const dur = p.end - p.start;
  if (dur > MAX_SEGMENT_SECONDS) {
    const trim = (dur - MAX_SEGMENT_SECONDS) / 2;
    return { ...p, start: p.start + trim, end: p.end - trim };
  }
  if (dur < MIN_SEGMENT_SECONDS) {
    const pad = (MIN_SEGMENT_SECONDS - dur) / 2;
    return { ...p, start: Math.max(0, p.start - pad), end: p.end + pad };
  }
  return p;
}

async function runHighlightReel({
  clipId,
  twitchVodId,
  userId,
  vodId,
  segments,
}: {
  clipId: string;
  twitchVodId: string;
  userId: string;
  vodId: string;
  segments: Peak[];
}) {
  const admin = createAdminClient();

  try {
    console.log(`[reel] Starting reel for vod=${vodId} (${segments.length} segments)`);

    // Resolve Twitch auth once — refresh on demand if the stored token is dead.
    const { data: profile } = await admin
      .from("profiles")
      .select("twitch_access_token, twitch_refresh_token")
      .eq("id", userId)
      .single();

    let twitchUserToken = profile?.twitch_access_token || undefined;
    const refreshTokenOnce = async () => {
      if (!profile?.twitch_refresh_token) {
        throw new Error("Your Twitch connection has expired. Log out and log back in, then try again.");
      }
      const refreshed = await refreshTwitchToken(profile.twitch_refresh_token);
      twitchUserToken = refreshed.accessToken;
      await admin.from("profiles").update({
        twitch_access_token: refreshed.accessToken,
        twitch_refresh_token: refreshed.refreshToken,
      }).eq("id", userId);
    };

    // Fetch shared VOD word timestamps for caption alignment.
    const { data: vodData } = await admin
      .from("vods")
      .select("word_timestamps")
      .eq("id", vodId)
      .single();
    const vodWords = (vodData?.word_timestamps as import("@/lib/captions").CaptionWord[] | null) ?? null;

    // Process each segment sequentially. Parallel downloads sound nice but
    // hit Twitch's per-IP rate limits and Deepgram-style throttling, and the
    // ffmpeg passes are CPU-bound on a single Vercel function — sequential
    // is more reliable inside a 300s budget for 3 short segments.
    const captionedBuffers: Buffer[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      console.log(`[reel] Segment ${i + 1}/${segments.length}: ${seg.start}s-${seg.end}s "${seg.title}"`);

      let download;
      try {
        download = await downloadTwitchVodVideo(twitchVodId, seg.start, seg.end, twitchUserToken);
      } catch (err) {
        if (err instanceof TwitchAuthError) {
          await refreshTokenOnce();
          download = await downloadTwitchVodVideo(twitchVodId, seg.start, seg.end, twitchUserToken);
        } else {
          throw err;
        }
      }

      try {
        const adjustedStart = seg.start - download.segmentStartSeconds;
        const adjustedEnd = seg.end - download.segmentStartSeconds;
        const result = await cutClip(download.filePath, adjustedStart, adjustedEnd, {
          vodWords,
          vodWindow: { start: seg.start, end: seg.end },
          captionStyle: "bold",
        });
        captionedBuffers.push(result.captioned);
      } finally {
        await download.cleanup();
      }
    }

    console.log(`[reel] Concatenating ${captionedBuffers.length} captioned segments`);
    const reelBuffer = await concatClipBuffers(captionedBuffers);

    const baseFileName = `${userId}/${vodId}-reel-${Date.now()}`;
    const publicUrl = await uploadToR2(`${baseFileName}.mp4`, reelBuffer, "video/mp4");
    console.log(`[reel] Uploaded → ${publicUrl}`);

    const { error: updateError } = await admin.from("clips").update({
      video_url: publicUrl,
      source_video_url: publicUrl,
      status: "ready",
    }).eq("id", clipId);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    // Trial users get the lifetime counter bumped on success.
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

    console.log(`[reel] Done: clip=${clipId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[reel] FAILED clip=${clipId} vod=${vodId}:`, message);
    if (stack) console.error(`[reel] Stack:`, stack);
    await admin.from("clips").update({
      status: "failed",
      failed_reason: message,
    }).eq("id", clipId);
  }
}
