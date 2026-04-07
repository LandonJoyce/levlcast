/**
 * lib/inngest/functions.ts — background jobs for LevlCast.
 *
 * FUNCTIONS:
 *   analyzeVod       — VOD transcription + peak detection + coaching report
 *   generateClip     — clip extraction from a detected peak
 *   cleanupStuckVods — cron: mark stuck VODs as failed
 *   cleanupStuckClips— cron: mark stuck clips as failed
 *   computeBurnoutScores — cron (weekly): burnout detection for all active users
 */

import { inngest } from "./client";
import { streamTwitchVodAudio, downloadTwitchVodAudio } from "@/lib/twitch";
import { transcribePassThrough } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { cutClip } from "@/lib/ffmpeg";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { computeBurnout, burnoutLabel } from "@/lib/burnout";

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

        // Filter to selected time range — overlap check so utterances spanning
        // the boundary are included, not silently dropped
        const filtered = (startSeconds !== undefined && endSeconds !== undefined)
          ? segments.filter(s => s.start < endSeconds && s.end > startSeconds)
          : segments;

        if (filtered.length === 0) {
          throw new Error("No speech found in the selected time range — try a wider range");
        }

        const peaks = await detectPeaks(filtered, title);
        const coachReport = await generateCoachReport(filtered, title, peaks);
        if (!coachReport) {
          throw new Error("Failed to generate coaching report — AI returned invalid response");
        }
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

      // Send push notification — fire and forget, never block on this
      await step.run("notify", async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("expo_push_token")
          .eq("id", userId)
          .single();

        const score = (coachReport as any)?.overall_score;
        const priority = (coachReport as any)?.recommendation ?? "";
        const snippet = priority.length > 80 ? priority.slice(0, 77) + "..." : priority;

        await sendPush(profile?.expo_push_token, {
          title: score !== undefined ? `Stream graded: ${score}/100` : "Your stream report is ready",
          body: snippet || "Open LevlCast to see your coach report.",
          data: { vodId },
        });
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
    retries: 1,
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

// ─── Burnout Detection ─────────────────────────────────────────────────────
// Runs every Monday at 9:00 AM UTC. For each user with ≥6 analyzed VODs,
// computes a burnout score from coach reports + follower data. If the score
// is notable (>25), Claude generates a one-line insight + recommendation.
// Results are saved to burnout_snapshots and pushed to mobile if score > 45.

export const computeBurnoutScores = inngest.createFunction(
  { id: "compute-burnout-scores" },
  { cron: "0 9 * * 1" }, // every Monday 9am UTC
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get all users who have at least 6 analyzed VODs
    const users = await step.run("find-active-users", async () => {
      const { data } = await supabase
        .from("vods")
        .select("user_id")
        .eq("status", "ready")
        .not("coach_report", "is", null);

      if (!data) return [];

      // Count per user, keep those with ≥6
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      }
      return Object.entries(counts)
        .filter(([, count]) => count >= 6)
        .map(([userId]) => userId);
    });

    if (users.length === 0) return { processed: 0 };

    let processed = 0;

    for (const userId of users) {
      await step.run(`burnout-${userId.slice(0, 8)}`, async () => {
        // Fetch last 12 analyzed VODs
        const { data: vods } = await supabase
          .from("vods")
          .select("stream_date, duration_seconds, coach_report")
          .eq("user_id", userId)
          .eq("status", "ready")
          .not("coach_report", "is", null)
          .order("stream_date", { ascending: false })
          .limit(12);

        // Fetch last 28 days of follower snapshots
        const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
        const { data: followers } = await supabase
          .from("follower_snapshots")
          .select("follower_count, snapped_at")
          .eq("user_id", userId)
          .eq("platform", "twitch")
          .gte("snapped_at", cutoff)
          .order("snapped_at", { ascending: true });

        const signals = computeBurnout(vods || [], followers || []);
        if (!signals) return; // insufficient data

        // Generate insight with Claude if score is notable
        let insight: string | null = null;
        let recommendation: string | null = null;

        if (signals.composite > 25) {
          try {
            const Anthropic = (await import("@anthropic-ai/sdk")).default;
            const anthropic = new Anthropic();

            const scores = (vods || [])
              .slice(0, 6)
              .map((v: any) => (v.coach_report as any)?.overall_score)
              .filter(Boolean)
              .reverse();

            const energies = (vods || [])
              .slice(0, 6)
              .map((v: any) => (v.coach_report as any)?.energy_trend)
              .filter(Boolean)
              .reverse();

            const msg = await anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 200,
              messages: [{
                role: "user",
                content: `A streamer's burnout signals this week:
- Recent coach scores (oldest to newest): ${scores.join(", ")}
- Recent energy trends: ${energies.join(", ")}
- Burnout composite score: ${signals.composite}/100 (${burnoutLabel(signals.composite)})
- Session length trend: ${signals.sessionShortening > 50 ? "getting shorter" : "stable"}
- Stream frequency: ${signals.frequencyDrop > 50 ? "streaming less often" : "consistent"}

Generate two things:
1. "insight": One sentence describing what the data shows. Be specific with numbers. Caring tone, not alarmist.
2. "recommendation": One actionable sentence. What should they do this week?

Talk like a friend who manages their career, not a metrics dashboard.
JSON only: { "insight": "...", "recommendation": "..." }`,
              }],
            });

            const text = msg.content[0].type === "text" ? msg.content[0].text : "";
            const parsed = JSON.parse(text);
            insight = parsed.insight || null;
            recommendation = parsed.recommendation || null;
          } catch (err) {
            console.warn(`[burnout] Claude insight failed for ${userId}:`, err);
          }
        }

        // Save snapshot
        await supabase.from("burnout_snapshots").insert({
          user_id: userId,
          score: signals.composite,
          score_decline: signals.scoreTrend,
          energy_decline: signals.energyDecline,
          session_shortening: signals.sessionShortening,
          frequency_drop: signals.frequencyDrop,
          retention_risk: signals.retentionRisk,
          growth_stall: signals.growthStall,
          insight,
          recommendation,
        });

        // Push notification if warning or above
        if (signals.composite > 45) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("expo_push_token")
            .eq("id", userId)
            .single();

          await sendPush(profile?.expo_push_token, {
            title: "Streamer Health Check",
            body: insight || "I noticed some fatigue signals this week. Open LevlCast for details.",
            data: { type: "burnout" },
          });
        }

        processed++;
      });
    }

    return { processed };
  }
);
