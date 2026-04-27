/**
 * lib/inngest/functions.ts — background jobs for LevlCast.
 *
 * FUNCTIONS:
 *   analyzeVod           — VOD transcription + peak detection + coaching report
 *   generateClip         — clip extraction from a detected peak
 *   cleanupStuckVods     — cron: mark stuck VODs as failed
 *   cleanupStuckClips    — cron: mark stuck clips as failed
 *   computeBurnoutScores — cron (weekly): burnout detection for all active users
 *   sendActivationNudge  — cron (hourly): email users who signed up 24h ago but never analyzed
 */

import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { streamTwitchVodAudio, downloadTwitchVodVideo } from "@/lib/twitch";
import { transcribePassThrough } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport, PriorCoachSummary } from "@/lib/analyze";
import { cutClip } from "@/lib/ffmpeg";
import type { CaptionWord } from "@/lib/captions";
import { detectGame, keywordsForGame } from "@/lib/game-keywords";
import { uploadToR2 } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { computeBurnout, burnoutLabel } from "@/lib/burnout";
import { computeContentReport, categoryLabel } from "@/lib/monetization";
import { buildUserProfile, scoreMatch, findExternalStreamers } from "@/lib/collab";
import { sendActivationEmail, sendVodReadyEmail } from "@/lib/email";

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
      // Step 1: Stream audio directly to Deepgram — no disk writes, no disk space issues.
      // Word-level timestamps are persisted to vods.word_timestamps inside this step
      // (not returned) — keeping them out of inter-step state avoids Inngest's
      // ~4MB JSON cap, which 30k+ word entries would push against.
      //
      // Game category is detected from the VOD title and the corresponding
      // jargon list is boosted into Deepgram via the keywords param so terms
      // like "desync", "headshot", or "clutch" stop getting transcribed as
      // generic English ("this is decent", "head shot," etc.).
      const segments = await step.run("transcribe", async () => {
        const { data: vod } = await supabase
          .from("vods")
          .select("twitch_vod_id, title")
          .eq("id", vodId)
          .eq("user_id", userId)
          .single();

        if (!vod) throw new Error("VOD not found");
        await supabase.from("vods").update({ status: "transcribing" }).eq("id", vodId);

        const detection = detectGame(vod.title ?? "");
        const keywords = keywordsForGame(detection);
        console.log(
          `[analyze] Detected game="${detection.gameId ?? "(unknown)"}" category="${detection.category}" — boosting ${keywords.length} keywords`
        );

        const stream = streamTwitchVodAudio(vod.twitch_vod_id);
        const { segments, words } = await transcribePassThrough(stream, keywords);
        if (segments.length === 0) throw new Error("No speech detected in VOD — the video may be muted or silent");

        const update: Record<string, unknown> = { game_category: detection.category };
        if (words.length > 0) update.word_timestamps = words;
        await supabase.from("vods").update(update).eq("id", vodId);

        return segments;
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

        // Fetch the last 3 ready coach reports for this user (excluding this VOD)
        // so the AI can give longitudinal coaching, not just single-session feedback
        const { data: priorVods } = await supabase
          .from("vods")
          .select("coach_report, analyzed_at")
          .eq("user_id", userId)
          .eq("status", "ready")
          .neq("id", vodId)
          .not("coach_report", "is", null)
          .order("analyzed_at", { ascending: false })
          .limit(3);

        type VodRow = { coach_report: unknown; analyzed_at: string };
        const priorReports: PriorCoachSummary[] = (priorVods ?? [] as VodRow[])
          .filter((v: VodRow) => v.coach_report && v.analyzed_at)
          .map((v: VodRow) => {
            const r = v.coach_report as { overall_score?: number; recommendation?: string; improvements?: string[] };
            return {
              date: v.analyzed_at.slice(0, 10),
              score: r.overall_score ?? 0,
              recommendation: r.recommendation ?? "",
              top_improvement: (r.improvements?.[0] ?? "").replace(/\*\*[^*]+\*\*\s*[—–-]\s*/, ""),
            };
          });

        const peaks = await detectPeaks(filtered, title);
        const coachReport = await generateCoachReport(filtered, title, peaks, priorReports.length > 0 ? priorReports : undefined);
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

      // Send push notification — fire and forget, never block on this.
      // Prefers "your score improved by N" framing when this stream beat the
      // prior stream, since progress messaging pulls people back way more
      // reliably than a bare "your report is ready". Falls through to a
      // standard priority-recommendation snippet otherwise.
      await step.run("notify", async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("expo_push_token")
          .eq("id", userId)
          .single();

        const report = coachReport as { overall_score?: number; recommendation?: string };
        const score = report.overall_score;
        const priority = report.recommendation ?? "";
        const snippet = priority.length > 80 ? priority.slice(0, 77) + "..." : priority;

        // Look up the most recent prior ready stream (excluding this one) so
        // we can compute a delta. Null-safe — first-ever stream just uses the
        // default title.
        let priorScore: number | null = null;
        if (score !== undefined) {
          const { data: prior } = await supabase
            .from("vods")
            .select("coach_report")
            .eq("user_id", userId)
            .eq("status", "ready")
            .neq("id", vodId)
            .not("coach_report", "is", null)
            .order("analyzed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const priorReport = prior?.coach_report as { overall_score?: number } | null;
          priorScore = priorReport?.overall_score ?? null;
        }

        let title: string;
        if (score !== undefined && priorScore !== null && score > priorScore) {
          const delta = score - priorScore;
          title = `Your score climbed ${delta > 0 ? "+" : ""}${delta} — now ${score}/100`;
        } else if (score !== undefined && priorScore !== null && score < priorScore) {
          title = `New stream graded: ${score}/100`;
        } else if (score !== undefined) {
          title = `Stream graded: ${score}/100`;
        } else {
          title = "Your stream report is ready";
        }

        await sendPush(profile?.expo_push_token, {
          title,
          body: snippet || "Open LevlCast to see your coach report.",
          data: { vodId },
        });
      });

      // Send email notification — fire and forget, never block on this
      await step.run("email-notify", async () => {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) return;

        const { data: vod } = await supabase.from("vods").select("title").eq("id", vodId).single();
        const { data: profile } = await supabase.from("profiles").select("twitch_display_name").eq("id", userId).single();
        const report = coachReport as { overall_score?: number; recommendation?: string };
        const name = profile?.twitch_display_name ?? user.email.split("@")[0];

        await sendVodReadyEmail(
          user.email,
          name,
          vodId,
          vod?.title ?? "Stream",
          report.overall_score,
          report.recommendation ?? "",
        );
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

// Runs every 10 minutes — marks any clip stuck in "processing" for >30 min as failed.
// 30 min gives headroom beyond Inngest's 15m job limit + Vercel cold starts.
export const cleanupStuckClips = inngest.createFunction(
  { id: "cleanup-stuck-clips" },
  { cron: "*/10 * * * *" },
  async () => {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: stuck } = await supabase
      .from("clips")
      .select("id")
      .eq("status", "processing")
      .lt("created_at", cutoff);

    if (!stuck || stuck.length === 0) return { cleaned: 0 };

    await supabase
      .from("clips")
      .update({ status: "failed", failed_reason: "Clip generation stalled — Twitch's CDN may be slow for this VOD. Hit Regenerate to try again." })
      .in("id", stuck.map((c: { id: string }) => c.id));

    console.log(`[cleanup] Marked ${stuck.length} stuck clips as failed`);
    return { cleaned: stuck.length };
  }
);

export const generateClip = inngest.createFunction(
  {
    id: "generate-clip",
    retries: 0,
    timeouts: { finish: "15m" },
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
        // NonRetriableError bypasses Inngest's step-level retry backoff — CDN failures
        // are not improved by waiting, so fail immediately and let the catch block run.
        const download = await downloadTwitchVodVideo(twitchVodId, peak.start, peak.end)
          .catch((err) => { throw new NonRetriableError(err instanceof Error ? err.message : String(err)); });

        // Pull word-level timestamps so cutClip can burn TikTok-style captions.
        // Missing/empty words → cutClip falls back to a no-caption encode.
        const { data: vodRow } = await supabase
          .from("vods")
          .select("word_timestamps")
          .eq("id", vodId)
          .single();
        const vodWords = (vodRow?.word_timestamps as CaptionWord[] | null) ?? null;

        let buffer: Buffer;
        try {
          const adjustedStart = peak.start - download.segmentStartSeconds;
          const adjustedEnd = peak.end - download.segmentStartSeconds;
          console.log(`[clip] Cutting: adjusted ${adjustedStart}s - ${adjustedEnd}s (offset: ${download.segmentStartSeconds}s)`);
          buffer = await cutClip(download.filePath, adjustedStart, adjustedEnd, {
            vodWords,
            vodWindow: { start: peak.start, end: peak.end },
          }).catch((err) => { throw new NonRetriableError(err instanceof Error ? err.message : String(err)); });
          console.log(`[clip] Cut complete: ${buffer.length} bytes`);
        } finally {
          await download.cleanup();
        }

        const fileName = `${userId}/${vodId}-peak${peakIndex}-${Date.now()}.mp4`;

        const publicUrl = await uploadToR2(fileName, buffer!, "video/mp4")
          .catch((err) => { throw new NonRetriableError(err instanceof Error ? err.message : String(err)); });

        const { error: updateError } = await supabase.from("clips").update({
          video_url: publicUrl,
          status: "ready",
        }).eq("id", clipId);

        if (updateError) throw new NonRetriableError(`DB update failed: ${updateError.message}`);

        console.log(`[clip] Saved: "${peak.title}" → ${publicUrl}`);
      });

      return { clipId, title: peak.title };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[inngest] generate-clip failed for ${clipId}:`, message);
      await supabase.from("clips").update({ status: "failed", failed_reason: message }).eq("id", clipId);
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
      try {
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
      } catch (err) {
        console.error(`[burnout] Failed for user ${userId.slice(0, 8)}:`, err);
      }
    }

    return { processed };
  }
);

// ─── Content Performance Reports ──────────────────────────────────────────
// Runs every Monday at 9:15 AM UTC (after burnout scores at 9:00).
// For each user with ≥4 analyzed VODs, computes which content categories
// drive the most growth. Claude generates a one-line insight + recommendation.

export const computeContentReports = inngest.createFunction(
  { id: "compute-content-reports" },
  { cron: "15 9 * * 1" }, // every Monday 9:15am UTC
  async ({ step }) => {
    const supabase = createAdminClient();

    const users = await step.run("find-active-users", async () => {
      const { data } = await supabase
        .from("vods")
        .select("user_id")
        .eq("status", "ready")
        .not("peak_data", "is", null);

      if (!data) return [];

      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      }
      return Object.entries(counts)
        .filter(([, count]) => count >= 4)
        .map(([userId]) => userId);
    });

    if (users.length === 0) return { processed: 0 };

    let processed = 0;

    for (const userId of users) {
      try {
        await step.run(`content-${userId.slice(0, 8)}`, async () => {
          // Fetch last 20 analyzed VODs with peak data
          const { data: vods } = await supabase
            .from("vods")
            .select("stream_date, duration_seconds, peak_data, coach_report")
            .eq("user_id", userId)
            .eq("status", "ready")
            .not("peak_data", "is", null)
            .not("coach_report", "is", null)
            .order("stream_date", { ascending: false })
            .limit(20);

          // Fetch last 28 days of follower snapshots
          const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
          const { data: followers } = await supabase
            .from("follower_snapshots")
            .select("follower_count, snapped_at")
            .eq("user_id", userId)
            .eq("platform", "twitch")
            .gte("snapped_at", cutoff)
            .order("snapped_at", { ascending: true });

          const report = computeContentReport(vods || [], followers || []);
          if (!report || report.categories.length === 0) return;

          // Generate insight with Claude
          let insight: string | null = null;
          let recommendation: string | null = null;

          try {
            const Anthropic = (await import("@anthropic-ai/sdk")).default;
            const anthropic = new Anthropic();

            const breakdown = report.categories
              .map((c) => `${categoryLabel(c.category)}: ${c.vod_count} streams, avg score ${c.avg_score}, ${c.total_peaks} peaks, ~${c.follower_delta >= 0 ? "+" : ""}${c.follower_delta} followers, rated "${c.growth_rating}"`)
              .join("\n");

            const msg = await anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 200,
              messages: [{
                role: "user",
                content: `A streamer's content performance breakdown (last 4 weeks):
${breakdown}

Top category: ${report.top_category ? categoryLabel(report.top_category) : "N/A"}

Generate two things:
1. "insight": One sentence about which content is working best and why. Be specific with numbers. Tone: encouraging business manager.
2. "recommendation": One actionable sentence about their content mix this week.

JSON only: { "insight": "...", "recommendation": "..." }`,
              }],
            });

            const text = msg.content[0].type === "text" ? msg.content[0].text : "";
            const parsed = JSON.parse(text);
            insight = parsed.insight || null;
            recommendation = parsed.recommendation || null;
          } catch (err) {
            console.warn(`[content-report] Claude insight failed for ${userId}:`, err);
          }

          // Save report
          const now = new Date();
          const periodEnd = new Date(now);
          const periodStart = new Date(now);
          periodStart.setDate(periodStart.getDate() - 7);

          await supabase.from("content_reports").upsert(
            {
              user_id: userId,
              period_start: periodStart.toISOString().split("T")[0],
              period_end: periodEnd.toISOString().split("T")[0],
              category_breakdown: report.categories,
              top_category: report.top_category,
              insight,
              recommendation,
            },
            { onConflict: "user_id,period_start" }
          );

          processed++;
        });
      } catch (err) {
        console.error(`[content-report] Failed for user ${userId.slice(0, 8)}:`, err);
      }
    }

    return { processed };
  }
);

// ─── Collab Matching ──────────────────────────────────────────────────────
// Runs every Monday at 9:30 AM UTC (after burnout + content reports).
// For each user who has opted in to collab matching, computes the top 5
// best matches from other opted-in users based on content style, audience
// size, quality level, and complementary strengths.

export const computeCollabSuggestions = inngest.createFunction(
  { id: "compute-collab-suggestions" },
  { cron: "30 9 * * 1" }, // every Monday 9:30am UTC
  async ({ step }) => {
    const supabase = createAdminClient();

    const collabUsers = await step.run("find-collab-users", async () => {
      const { data } = await supabase
        .from("collab_profiles")
        .select("user_id, preferred_categories, min_followers, max_followers")
        .eq("enabled", true);

      return data || [];
    });

    if (collabUsers.length < 2) return { processed: 0, reason: "need at least 2 opted-in users" };

    const profiles = await step.run("build-profiles", async () => {
      const userIds = collabUsers.map((u: any) => u.user_id);

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, twitch_display_name, twitch_avatar_url")
        .in("id", userIds);

      const { data: vodRows } = await supabase
        .from("vods")
        .select("user_id, peak_data, coach_report")
        .in("user_id", userIds)
        .eq("status", "ready")
        .not("peak_data", "is", null)
        .not("coach_report", "is", null);

      const { data: followerRows } = await supabase
        .from("follower_snapshots")
        .select("user_id, follower_count")
        .in("user_id", userIds)
        .eq("platform", "twitch")
        .order("snapped_at", { ascending: false });

      const { data: burnoutRows } = await supabase
        .from("burnout_snapshots")
        .select("user_id, score")
        .in("user_id", userIds)
        .order("computed_at", { ascending: false });

      const latestFollowers: Record<string, number> = {};
      for (const row of followerRows || []) {
        if (!latestFollowers[row.user_id]) latestFollowers[row.user_id] = row.follower_count;
      }

      const latestBurnout: Record<string, number> = {};
      for (const row of burnoutRows || []) {
        if (!latestBurnout[row.user_id]) latestBurnout[row.user_id] = row.score;
      }

      const vodsByUser: Record<string, any[]> = {};
      for (const vod of vodRows || []) {
        if (!vodsByUser[vod.user_id]) vodsByUser[vod.user_id] = [];
        vodsByUser[vod.user_id].push(vod);
      }

      const result: Record<string, ReturnType<typeof buildUserProfile>> = {};
      for (const p of profileRows || []) {
        const vods = vodsByUser[p.id] || [];
        if (vods.length < 3) continue;
        result[p.id] = buildUserProfile(
          p.id,
          p.twitch_display_name || "Streamer",
          p.twitch_avatar_url,
          latestFollowers[p.id] || 0,
          vods,
          latestBurnout[p.id] || 0
        );
      }

      return result;
    });

    let processed = 0;

    for (const collabUser of collabUsers) {
      const userId = collabUser.user_id;
      const userProfile = profiles[userId];
      if (!userProfile) continue;

      try {
        await step.run(`match-${userId.slice(0, 8)}`, async () => {
        const preferences = {
          minFollowers: collabUser.min_followers || undefined,
          maxFollowers: collabUser.max_followers || undefined,
          preferredCategories: collabUser.preferred_categories || undefined,
        };

        // 1. Internal matches (other LevlCast users)
        const internalMatches: { matchUserId: string; score: number; reasons: string[] }[] = [];

        for (const [candidateId, candidateProfile] of Object.entries(profiles)) {
          if (candidateId === userId) continue;
          const match = scoreMatch(userProfile, candidateProfile, preferences);
          if (match) internalMatches.push(match);
        }

        internalMatches.sort((a, b) => b.score - a.score);

        for (const m of internalMatches.slice(0, 3)) {
          // Delete existing suggestion for this pair, then insert fresh
          await supabase.from("collab_suggestions")
            .delete()
            .eq("user_id", userId)
            .eq("match_user_id", m.matchUserId);

          await supabase.from("collab_suggestions").insert({
            user_id: userId,
            match_user_id: m.matchUserId,
            match_score: m.score,
            reasons: m.reasons,
            is_external: false,
            status: "new",
            computed_at: new Date().toISOString(),
          });
        }

        // 2. External matches (any Twitch streamer)
        // Get this user's twitch_id to exclude from results
        const { data: userRow } = await supabase
          .from("profiles")
          .select("twitch_id")
          .eq("id", userId)
          .single();

        // Exclude this user + all other LevlCast users from external results
        const { data: allTwitchIds } = await supabase
          .from("profiles")
          .select("twitch_id")
          .in("id", Object.keys(profiles));
        const excludeIds = (allTwitchIds || []).map((r: any) => r.twitch_id).filter(Boolean);
        if (userRow?.twitch_id) excludeIds.push(userRow.twitch_id);

        try {
          // Game names are not derived in the cron (requires per-user Claude call).
          // External matching via the on-demand /api/collab/refresh route handles this.
          const externalMatches = await findExternalStreamers(userProfile, [], excludeIds, 5);

          for (const em of externalMatches) {
            // Delete old suggestion for this external streamer if exists, then insert fresh
            await supabase.from("collab_suggestions")
              .delete()
              .eq("user_id", userId)
              .eq("twitch_id", em.streamer.twitchId);

            await supabase.from("collab_suggestions").insert({
              user_id: userId,
              match_user_id: null,
              twitch_id: em.streamer.twitchId,
              twitch_login: em.streamer.login,
              twitch_display_name: em.streamer.displayName,
              twitch_avatar_url: em.streamer.avatarUrl,
              follower_count: em.streamer.followerCount,
              is_external: true,
              match_score: em.score,
              reasons: em.reasons,
              status: "new",
              computed_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn(`[collab] External search failed for ${userId}:`, err);
        }

        processed++;
      });
      } catch (err) {
        console.error(`[collab] Failed for user ${userId.slice(0, 8)}:`, err);
      }
    }

    return { processed };
  }
);

// ─── Weekly Manager Digest ────────────────────────────────────────────────
// Runs every Monday at 9:45 AM UTC (after burnout, content, collab crons).
// Compiles a weekly summary for each active user with Claude-generated
// headline and action items. Sends push notification.

export const compileWeeklyDigest = inngest.createFunction(
  { id: "compile-weekly-digest" },
  { cron: "45 9 * * 1" },
  async ({ step }) => {
    const supabase = createAdminClient();

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const users = await step.run("find-active-users", async () => {
      const { data } = await supabase
        .from("vods")
        .select("user_id")
        .eq("status", "ready")
        .gte("stream_date", cutoff);

      if (!data) return [];
      return [...new Set(data.map((r: any) => r.user_id))];
    });

    if (users.length === 0) return { processed: 0 };

    let processed = 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekStartIso = weekStart.toISOString();

    for (const userId of users) {
      try {
        await step.run(`digest-${(userId as string).slice(0, 8)}`, async () => {
        const [vodsRes, clipsRes, followerRes, burnoutRes, contentRes, collabRes] = await Promise.all([
          supabase.from("vods")
            .select("duration_seconds, coach_report, peak_data")
            .eq("user_id", userId).eq("status", "ready")
            .gte("stream_date", weekStartIso),
          supabase.from("clips")
            .select("id")
            .eq("user_id", userId)
            .gte("created_at", weekStartIso),
          supabase.from("follower_snapshots")
            .select("follower_count, snapped_at")
            .eq("user_id", userId).eq("platform", "twitch")
            .gte("snapped_at", weekStartIso)
            .order("snapped_at", { ascending: true }),
          supabase.from("burnout_snapshots")
            .select("score, insight")
            .eq("user_id", userId)
            .order("computed_at", { ascending: false })
            .limit(1).maybeSingle(),
          supabase.from("content_reports")
            .select("top_category, insight")
            .eq("user_id", userId)
            .order("period_start", { ascending: false })
            .limit(1).maybeSingle(),
          supabase.from("collab_suggestions")
            .select("id")
            .eq("user_id", userId).eq("status", "new"),
        ]);

        const vods = vodsRes.data || [];
        if (vods.length === 0) return;

        const clips = clipsRes.data || [];
        const followers = followerRes.data || [];
        const burnout = burnoutRes.data;
        const content = contentRes.data;
        const collabCount = collabRes.data?.length || 0;

        const streamsCount = vods.length;
        const totalDurationMin = Math.round(vods.reduce((sum: number, v: any) => sum + (v.duration_seconds || 0), 0) / 60);
        const scores = vods.map((v: any) => (v.coach_report as any)?.overall_score).filter(Boolean) as number[];
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
        const bestScore = scores.length > 0 ? Math.max(...scores) : null;
        const peaksFound = vods.reduce((sum: number, v: any) => sum + ((v.peak_data as any[])?.length || 0), 0);
        const clipsGenerated = clips.length;

        let followerDelta = 0;
        if (followers.length >= 2) {
          followerDelta = followers[followers.length - 1].follower_count - followers[0].follower_count;
        }

        const healthSummary = burnout?.insight || (burnout?.score !== undefined
          ? (burnout.score <= 25 ? "You're in good shape this week." : burnout.score <= 45 ? "A few minor signals, nothing concerning." : "Some fatigue signals — check your Health card.")
          : null);

        const contentSummary = content?.insight || (content?.top_category
          ? `Your ${content.top_category} content performed best this week.`
          : null);

        const collabSummary = collabCount > 0
          ? `${collabCount} new collab match${collabCount > 1 ? "es" : ""} waiting for you.`
          : null;

        let headline = `${streamsCount} stream${streamsCount !== 1 ? "s" : ""} this week`;
        if (avgScore) headline += `, avg ${avgScore} score`;
        if (followerDelta !== 0) headline += `, ${followerDelta >= 0 ? "+" : ""}${followerDelta} followers`;

        let actionItems: string[] = [];

        try {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const anthropic = new Anthropic();

          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: `You are a streamer's personal manager writing their Monday morning digest.

This week's data:
- Streams: ${streamsCount}, total ${totalDurationMin} minutes
- Avg coach score: ${avgScore || "N/A"}, best: ${bestScore || "N/A"}
- Peaks found: ${peaksFound}, clips generated: ${clipsGenerated}
- Follower change: ${followerDelta >= 0 ? "+" : ""}${followerDelta}
- Health status: ${healthSummary || "No data yet"}
- Content insight: ${contentSummary || "No data yet"}
- Collab matches: ${collabCount}

Generate:
1. "headline": One punchy sentence summarizing the week. Encouraging but honest. No fluff.
2. "actions": Array of 2-3 short action items for this week. Specific, actionable, based on the data.

JSON only: { "headline": "...", "actions": ["...", "..."] }`,
            }],
          });

          const text = msg.content[0].type === "text" ? msg.content[0].text : "";
          const parsed = JSON.parse(text);
          if (parsed.headline) headline = parsed.headline;
          if (parsed.actions) actionItems = parsed.actions;
        } catch (err) {
          console.warn(`[digest] Claude failed for ${userId}:`, err);
          if (avgScore && avgScore < 70) actionItems.push("Review your latest coach report for quick wins.");
          if (peaksFound > 0 && clipsGenerated === 0) actionItems.push("You have peaks waiting — generate some clips.");
          if (collabCount > 0) actionItems.push("Check your new collab matches.");
        }

        await supabase.from("weekly_digests").upsert(
          {
            user_id: userId,
            week_start: weekStartStr,
            streams_count: streamsCount,
            total_duration_min: totalDurationMin,
            avg_score: avgScore,
            best_score: bestScore,
            peaks_found: peaksFound,
            clips_generated: clipsGenerated,
            follower_delta: followerDelta,
            headline,
            health_summary: healthSummary,
            content_summary: contentSummary,
            collab_summary: collabSummary,
            action_items: actionItems,
          },
          { onConflict: "user_id,week_start" }
        );

        const { data: profile } = await supabase
          .from("profiles")
          .select("expo_push_token")
          .eq("id", userId)
          .single();

        await sendPush(profile?.expo_push_token, {
          title: "Your Weekly Digest",
          body: headline,
          data: { type: "digest" },
        });

        processed++;
      });
      } catch (err) {
        console.error(`[digest] Failed for user ${(userId as string).slice(0, 8)}:`, err);
      }
    }

    return { processed };
  }
);

// ─── Streak Nudge ──────────────────────────────────────────────────────────
// Runs daily at 2pm UTC. Finds users whose most recent ready VOD was analyzed
// in the 4–5 day window — at risk but not yet broken. Fires exactly once per
// drought without needing a separate tracking column.

export const sendStreakNudge = inngest.createFunction(
  { id: "send-streak-nudge" },
  { cron: "0 14 * * *" }, // daily 2pm UTC
  async ({ step }) => {
    const supabase = createAdminClient();

    return await step.run("notify-at-risk-streaks", async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, expo_push_token, twitch_display_name")
        .not("expo_push_token", "is", null);

      if (!profiles?.length) return { sent: 0 };

      let sent = 0;

      for (const profile of profiles) {
        try {
          const { data: recentVods } = await supabase
            .from("vods")
            .select("status, analyzed_at")
            .eq("user_id", profile.id)
            .order("stream_date", { ascending: false })
            .limit(20);

          if (!recentVods?.length) continue;

          // Compute streak (consecutive ready VODs from most recent)
          let streak = 0;
          for (const v of recentVods) {
            if (v.status === "ready") streak++;
            else break;
          }
          if (streak < 2) continue;

          // Most recent ready VOD must be in the 4–5 day at-risk window
          const mostRecentReady = recentVods.find((v: { status: string; analyzed_at: string | null }) => v.status === "ready");
          if (!mostRecentReady?.analyzed_at) continue;
          const analyzedAt = mostRecentReady.analyzed_at;
          if (analyzedAt < fiveDaysAgo || analyzedAt >= fourDaysAgo) continue;

          await sendPush(profile.expo_push_token, {
            title: `Your ${streak}-stream streak is at risk`,
            body: "Analyze your next stream to keep it alive.",
          });

          sent++;
          console.log(`[streak-nudge] Sent to user ${profile.id.slice(0, 8)}, streak: ${streak}`);
        } catch (err) {
          console.error(`[streak-nudge] Failed for user ${profile.id.slice(0, 8)}:`, err);
        }
      }

      return { sent };
    });
  }
);

// ─── Activation Nudge ─────────────────────────────────────────────────────
// Runs every hour. Finds users who signed up 24–25 hours ago and have never
// analyzed a VOD, then sends a single activation email to bring them back.
// The 1-hour window ensures each user is caught exactly once without needing
// a separate "email sent" tracking column.

export const sendActivationNudge = inngest.createFunction(
  { id: "send-activation-nudge" },
  { cron: "0 * * * *" }, // every hour on the hour
  async () => {
    const supabase = createAdminClient();

    const now = new Date();
    const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, twitch_display_name")
      .gte("created_at", windowStart.toISOString())
      .lt("created_at", windowEnd.toISOString());

    if (!profiles || profiles.length === 0) return { sent: 0 };

    let sent = 0;

    for (const profile of profiles) {
      try {
        const { count } = await supabase
          .from("vods")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "ready");

        if ((count ?? 0) > 0) continue;

        const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
        if (!user?.email) continue;

        const name = profile.twitch_display_name || "Streamer";
        await sendActivationEmail(user.email, name);
        sent++;

        console.log(`[activation-nudge] Sent to ${user.email.slice(0, 4)}***`);
      } catch (err) {
        console.error(`[activation-nudge] Failed for user ${profile.id.slice(0, 8)}:`, err);
      }
    }

    return { sent };
  }
);
