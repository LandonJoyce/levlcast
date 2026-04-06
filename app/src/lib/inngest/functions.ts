/**
 * lib/inngest/functions.ts — background VOD analysis job.
 *
 * This file defines the analyzeVod Inngest function, which is the core
 * background job that runs whenever a user submits a VOD for analysis.
 *
 * PIPELINE (runs in the background, not in the HTTP request):
 *   1. Stream audio from Twitch → pipe directly to Deepgram (no disk writes)
 *   2. Deepgram returns a timestamped transcript
 *   3. Claude (Haiku) detects peak moments in the transcript
 *   4. Claude (Sonnet) generates a full coaching report
 *   5. Save peaks + report to the vods table, set status = "ready"
 *
 * STATUS UPDATES:
 *   The VOD status is updated at each step so the dashboard can show progress:
 *     pending → transcribing → analyzing → ready (or failed)
 *
 * WHY INNGEST:
 *   This pipeline takes 2-5 minutes per VOD. Inngest lets it run as a
 *   durable background job with automatic retries, timeouts, and step logging —
 *   without blocking the HTTP response or hitting Vercel's 60s function limit.
 *
 * HOW IT'S TRIGGERED:
 *   POST /api/vods/analyze sends an Inngest event ("vod/analyze") with
 *   { vodId, userId, startSeconds?, endSeconds? } as the payload.
 */

import { inngest } from "./client";
import { streamTwitchVodAudio, downloadTwitchVodAudio } from "@/lib/twitch";
import { transcribePassThrough } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { cutClip } from "@/lib/ffmpeg";
import { createAdminClient } from "@/lib/supabase/server";

export const analyzeVod = inngest.createFunction(
  {
    id: "analyze-vod",
    retries: 1,
    timeouts: { finish: "2h" },
    concurrency: {
      limit: 1, // one VOD analysis at a time per user — prevents resource overload
      key: "event.data.userId",
    },
  },
  { event: "vod/analyze" },
  async ({ event, step }) => {
    const { vodId, userId, startSeconds, endSeconds } = event.data as {
      vodId: string;
      userId: string;
      startSeconds?: number;
      endSeconds?: number;
    };
    const supabase = createAdminClient();

    try {
      // Step 1: Stream audio directly to Deepgram — no disk writes, no disk space issues
      const segments = await step.run("transcribe", async () => {
        const { data: vod } = await supabase
          .from("vods")
          .select("twitch_vod_id")
          .eq("id", vodId)
          .eq("user_id", userId)
          .single();

        if (!vod) throw new Error("VOD not found");
        await supabase.from("vods").update({ status: "transcribing" }).eq("id", vodId);

        const stream = streamTwitchVodAudio(vod.twitch_vod_id);
        const result = await transcribePassThrough(stream);
        if (result.length === 0) throw new Error("No speech detected in VOD — the video may be muted or silent");
        return result;
      });

      // Step 2: Detect peaks + coach report (filtered to selected range if provided)
      const { peaks, coachReport } = await step.run("analyze", async () => {
        await supabase.from("vods").update({ status: "analyzing" }).eq("id", vodId);

        const { data: vod } = await supabase.from("vods").select("title").eq("id", vodId).single();
        const title = vod?.title || "Stream";

        // Filter to selected time range — if no range specified, use all segments
        const filtered = (startSeconds !== undefined && endSeconds !== undefined)
          ? segments.filter(s => s.start >= startSeconds && s.end <= endSeconds)
          : segments;

        if (filtered.length === 0) {
          throw new Error("No speech found in the selected time range — try a wider range");
        }

        const peaks = await detectPeaks(filtered, title);
        const coachReport = await generateCoachReport(filtered, title, peaks);
        return { peaks, coachReport };
      });

      // Step 4: Save results + record usage
      await step.run("save", async () => {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        // Double-check limit before recording success.
        // This catches anyone who bypassed the API-level check (e.g. deleted
        // their analyzed VOD to reset the count, then triggered a new job).
        const { data: usageLog } = await supabase
          .from("usage_logs")
          .select("analyses_count")
          .eq("user_id", userId)
          .eq("month", month)
          .single();

        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", userId)
          .single();

        const plan = profile?.plan === "pro" ? "pro" : "free";
        const limit = plan === "pro" ? 20 : 1;
        const alreadyUsed = usageLog?.analyses_count ?? 0;

        if (alreadyUsed >= limit) {
          // Limit exceeded — mark as failed so the user sees it, but don't charge usage
          await supabase.from("vods").update({
            status: "failed",
            failed_reason: "Monthly analysis limit reached. Upgrade to Pro for more analyses.",
          }).eq("id", vodId);
          console.warn(`[inngest] analyze-vod blocked at save — user ${userId} already used ${alreadyUsed}/${limit} analyses`);
          return;
        }

        // Save results and increment usage counter atomically
        await Promise.all([
          supabase.from("vods").update({
            status: "ready",
            peak_data: peaks,
            coach_report: coachReport,
            analyzed_at: now.toISOString(),
          }).eq("id", vodId),
          supabase.from("usage_logs").upsert(
            { user_id: userId, month, analyses_count: alreadyUsed + 1 },
            { onConflict: "user_id,month" }
          ),
        ]);
      });

      return { peaks: peaks.length, segments: segments.length };
    } catch (err) {
      // Mark the VOD as failed so the user can see it and retry —
      // without this, the VOD would be stuck in "transcribing" or "analyzing" forever.
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[inngest] analyze-vod failed for ${vodId}:`, message);

      await supabase.from("vods").update({
        status: "failed",
        failed_reason: message,
      }).eq("id", vodId);

      // Re-throw so Inngest marks the run as failed and triggers retry logic
      throw err;
    }
  }
);

// Runs every 15 minutes — marks any VOD stuck in "transcribing" or "analyzing"
// for >90 minutes as failed so users see a clear error instead of an infinite spinner.
export const cleanupStuckVods = inngest.createFunction(
  { id: "cleanup-stuck-vods" },
  { cron: "*/15 * * * *" },
  async () => {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    const { data: stuck } = await supabase
      .from("vods")
      .select("id")
      .in("status", ["transcribing", "analyzing"])
      .lt("updated_at", cutoff);

    if (!stuck || stuck.length === 0) return { cleaned: 0 };

    await supabase
      .from("vods")
      .update({ status: "failed", failed_reason: "Analysis timed out — please try again" })
      .in("id", stuck.map((v: { id: string }) => v.id));

    console.log(`[cleanup] Marked ${stuck.length} stuck VODs as failed`);
    return { cleaned: stuck.length };
  }
);

// Runs every 5 minutes — marks any clip stuck in "processing" for >5 min as failed
// so users see a clear error instead of an infinite spinner.
export const cleanupStuckClips = inngest.createFunction(
  { id: "cleanup-stuck-clips" },
  { cron: "*/5 * * * *" },
  async () => {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: stuck } = await supabase
      .from("clips")
      .select("id")
      .eq("status", "processing")
      .lt("created_at", cutoff);

    if (!stuck || stuck.length === 0) return { cleaned: 0 };

    await supabase
      .from("clips")
      .update({ status: "failed" })
      .in("id", stuck.map((c: { id: string }) => c.id));

    console.log(`[cleanup] Marked ${stuck.length} stuck clips as failed`);
    return { cleaned: stuck.length };
  }
);

export const generateClip = inngest.createFunction(
  {
    id: "generate-clip",
    retries: 0,
    timeouts: { finish: "5m" },
    concurrency: {
      limit: 1, // one clip at a time per user — prevents memory overload
      key: "event.data.userId",
    },
  },
  { event: "clip/generate" },
  async ({ event, step }) => {
    const { clipId, vodId, twitchVodId, userId, peakIndex, peak } = event.data as {
      clipId: string;
      vodId: string;
      twitchVodId: string;
      userId: string;
      peakIndex: number;
      peak: {
        title: string;
        start: number;
        end: number;
        score: number;
        category: string;
        reason: string;
        caption: string;
      };
    };

    const supabase = createAdminClient();

    try {
      // Single step: download → cut → upload → save.
      // Do NOT split into multiple steps — passing a video buffer between Inngest steps
      // serializes it as JSON, which blows past Inngest's step state size limit and
      // causes silent failures where the clip appears "completed" but stays processing.
      await step.run("generate-and-upload", async () => {
        console.log(`[clip] Downloading segments for "${peak.title}" (${peak.start}s - ${peak.end}s)`);
        const download = await downloadTwitchVodAudio(twitchVodId, peak.start, peak.end);

        let buffer: Buffer;
        try {
          const adjustedStart = peak.start - download.segmentStartSeconds;
          const adjustedEnd = peak.end - download.segmentStartSeconds;
          console.log(`[clip] Cutting: adjusted ${adjustedStart}s - ${adjustedEnd}s (offset: ${download.segmentStartSeconds}s)`);
          buffer = await cutClip(download.filePath, adjustedStart, adjustedEnd);
          console.log(`[clip] Cut complete: ${buffer.length} bytes`);
        } finally {
          await download.cleanup();
        }

        await supabase.storage.createBucket("clips", {
          public: true,
          fileSizeLimit: 104857600,
        }).catch(() => {});

        const fileName = `${userId}/${vodId}-peak${peakIndex}-${Date.now()}.mp4`;

        const { error: uploadError } = await supabase.storage
          .from("clips")
          .upload(fileName, buffer!, { contentType: "video/mp4", upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from("clips").getPublicUrl(fileName);

        const { error: updateError } = await supabase.from("clips").update({
          video_url: urlData.publicUrl,
          status: "ready",
        }).eq("id", clipId);

        if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

        console.log(`[clip] Saved: "${peak.title}" → ${urlData.publicUrl}`);
      });

      return { clipId, title: peak.title };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[inngest] generate-clip failed for ${clipId}:`, message);
      await supabase.from("clips").update({ status: "failed" }).eq("id", clipId);
      throw err;
    }
  }
);
