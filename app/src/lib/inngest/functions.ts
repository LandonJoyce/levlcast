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
 *   runWeeklyLeagues     — cron (Monday 00:05 UTC): pay out last week's leagues, seat this week's
 */

import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { getTwitchVodSegmentList, streamSegmentsToPassThrough, downloadTwitchVodVideo, fetchTwitchVods, fetchTwitchVodChat, getAppAccessToken, mapVodToRow, refreshTwitchToken, TwitchAuthError } from "@/lib/twitch";
import { audibleStats, buildAudibleChunks, isMostlyMuted, mutedRanges, MOSTLY_MUTED_MESSAGE, type TimeRange } from "@/lib/muted-audio";
import type { TranscriptSegment, CaptionWord } from "@/lib/deepgram";
import { bucketChat, formatPulseForPrompt, type ChatBucket } from "@/lib/chat-pulse";
import { transcribePassThrough } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport, PriorCoachSummary } from "@/lib/analyze";
import { cutClip } from "@/lib/ffmpeg";
import { detectGame, keywordsForGame } from "@/lib/game-keywords";
import { uploadToR2, listR2Objects, deleteR2Objects } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { computeBurnout, burnoutLabel } from "@/lib/burnout";
import { computeContentReport, categoryLabel } from "@/lib/monetization";
import { sendActivationEmail, sendVodReadyEmail, sendNewVodEmail, sendClipReadyEmail } from "@/lib/email";
import { sendWebPush } from "@/lib/web-push";
import { generateCoachingArc } from "@/lib/coaching-arc";
import { incrementTrialAnalysis, incrementTrialClip, FREE_WEEKLY_LIMITS, FOUNDING_LIMITS, PRO_LIMITS, currentWeekStart, touchStreak } from "@/lib/limits";
import { transcribePreviewWindow, buildPreviewReport } from "@/lib/public-preview";
import { computeDelta } from "@/lib/rank";
import { formWeeklyLeagues, recordLeagueStream, settleFinishedLeagues } from "@/lib/league";
import { fillOutreachQueue } from "@/lib/outreach";
import { redditSendMessage } from "@/lib/reddit";

export const analyzeVod = inngest.createFunction(
  {
    id: "analyze-vod",
    retries: 1,
    timeouts: { finish: "3h" },
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
      // Step 1a: Resolve segment URLs + timing — fast (no audio download), just M3U8 fetch.
      // Segment list is stored in Inngest step state (~1-2MB for 8hr VODs, under the 4MB cap).
      // Game keywords and category are detected here so chunk steps can use them without
      // re-reading the VOD title from the DB each time.
      const segmentSetup = await step.run("get-vod-segments", async () => {
        console.log(`[analyze] Stage 1/4: fetching segment list for vod=${vodId} user=${userId}`);
        const { data: vod } = await supabase
          .from("vods")
          .select("twitch_vod_id, title, duration_seconds, status")
          .eq("id", vodId)
          .eq("user_id", userId)
          .single();

        if (!vod) throw new Error("VOD not found");

        // Dedupe guard: if the VOD is already analyzed (status=ready), exit
        // early. Pairs with the event idempotency key set at send-sites —
        // catches the case where the event slipped past Inngest dedup
        // (e.g. >24h apart) or where a race let two events through.
        // Prevents double-billing Claude on the same VOD.
        if (vod.status === "ready") {
          console.log(`[analyze] skip — vod ${vodId} is already 'ready', dedupe guard`);
          throw new NonRetriableError(`VOD ${vodId} already analyzed (status=ready)`);
        }
        console.log(`[analyze] VOD: "${vod.title}" twitch_id=${vod.twitch_vod_id} duration=${vod.duration_seconds}s`);

        // Min-duration guard (defense in depth — the route also checks this).
        // Twitch sometimes auto-saves 0-15s stubs for aborted streams; analysis
        // produces hallucinated reports on those. Refuse early so the credit
        // increment at step 4 never fires for a too-short VOD.
        const MIN_ANALYZABLE_SECONDS = 5 * 60;
        if ((vod.duration_seconds as number | null) != null && (vod.duration_seconds as number) < MIN_ANALYZABLE_SECONDS) {
          await supabase
            .from("vods")
            .update({
              status: "failed",
              failed_reason: `Stream too short to analyze (${vod.duration_seconds}s). Needs at least 5 minutes of content.`,
            })
            .eq("id", vodId);
          throw new NonRetriableError(`VOD ${vodId} too short to analyze (${vod.duration_seconds}s)`);
        }

        await supabase.from("vods").update({ status: "transcribing" }).eq("id", vodId);

        const detection = detectGame(vod.title ?? "");
        const keywords = keywordsForGame(detection);
        console.log(`[analyze] game="${detection.gameId ?? "(unknown)"}" category="${detection.category}" — ${keywords.length} keywords`);

        await supabase.from("vods").update({ game_category: detection.category }).eq("id", vodId);

        const list = await getTwitchVodSegmentList(vod.twitch_vod_id);
        return {
          urls: list.urls,
          startTimes: list.startTimes,
          // Init segment for fMP4 VODs. Null for legacy MPEG-TS streams.
          // Passed through chunk-step state so each parallel chunk can
          // prepend it to its own Deepgram POST. Step state is JSON, so
          // we keep it base64-encoded.
          initSegmentBase64: list.initSegmentBase64 ?? null,
          // Which segments Twitch muted (copyrighted music). Silent audio.
          muted: list.muted ?? null,
          keywords,
          gameCategory: detection.category,
          duration_seconds: vod.duration_seconds as number | null,
        };
      });

      // Transcription chunk size. Tuned for Vercel Hobby's 300s per-invocation
      // cap — each chunk does (segment download + Deepgram processing) and must
      // finish well under 300s including worst-case slow Twitch CDN. At 12 min
      // per chunk: Deepgram typically returns in 30-60s, segments download in
      // 20-60s, so the step lands around 60-120s with comfortable headroom.
      // Was 1200s (20 min) on Vercel Pro, dropped to 720s (12 min) on 2026-06-19
      // after a 2h 55m Storm VOD failed with "Could not find step" — Inngest's
      // hint that a step ran too long and its state got lost.
      const CHUNK_SECONDS = 720;

      // Twitch mutes VOD audio in blocks when it hears copyrighted music, and
      // the muted segments are silence. Nearly every VOD has a few minutes of
      // it; a stream with music on the whole time is muted almost end to end.
      // Muted segments are left out of transcription (no point paying to
      // transcribe silence), chunks never span them so timestamps stay exact,
      // and the coach is told which stretches were muted so it doesn't call
      // them dead air. Step state from before this existed has no flags.
      const mutedFlags: boolean[] = segmentSetup.muted ?? segmentSetup.urls.map(() => false);
      const muted = mutedRanges(segmentSetup.startTimes, mutedFlags);
      const muteStats = audibleStats(segmentSetup.startTimes, mutedFlags, segmentSetup.duration_seconds);
      if (muted.length > 0) {
        console.log(
          `[analyze] Twitch muted ${Math.round(muteStats.mutedSeconds / 60)} of ${Math.round(muteStats.totalSeconds / 60)} min in ${muted.length} blocks`
        );
      }
      // Too little left to coach. Stop before transcribing hours of silence.
      if (isMostlyMuted(muteStats)) {
        throw new NonRetriableError(MOSTLY_MUTED_MESSAGE);
      }

      const chunks = buildAudibleChunks(segmentSetup.urls, segmentSetup.startTimes, mutedFlags, CHUNK_SECONDS);
      console.log(`[analyze] ${chunks.length} transcription chunks for ${segmentSetup.urls.length} segments (${mutedFlags.filter(Boolean).length} muted, skipped)`);

      // Step 1b+: Transcribe chunks in parallel batches. Each chunk is its
      // own Inngest step so Inngest persists results across retries.
      //
      // BATCH_CONCURRENCY caps in-flight chunks. Going full-parallel on a
      // long VOD would slam Twitch CDN with hundreds of simultaneous segment
      // fetches AND spawn N Deepgram streaming sessions at once, both of
      // which can rate-limit. 4 at a time balances speedup (≈4x faster than
      // sequential) against staying well under any plausible per-IP cap.
      //
      // Inside each batch, Promise.all schedules the step.run() calls in
      // parallel. Inngest invokes them as separate function invocations so
      // each gets its own Vercel maxDuration budget and cold-start lifecycle.
      const BATCH_CONCURRENCY = 4;
      const allChunkSegments: TranscriptSegment[][] = new Array(chunks.length);
      const allChunkWords: CaptionWord[][] = new Array(chunks.length);

      // Decode init segment once per analysis. Each parallel chunk reuses
      // the same Buffer reference (PassThrough does not mutate inputs).
      // Null for MPEG-TS VODs which don't have an init segment.
      const initSegment = segmentSetup.initSegmentBase64
        ? Buffer.from(segmentSetup.initSegmentBase64, "base64")
        : null;

      for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_CONCURRENCY) {
        const batch = chunks
          .slice(batchStart, batchStart + BATCH_CONCURRENCY)
          .map((chunk, offset) => ({ chunk, index: batchStart + offset }));

        const results = await Promise.all(
          batch.map(({ chunk, index }) =>
            step.run(`transcribe-part-${index}`, async () => {
              console.log(`[analyze] Chunk ${index + 1}/${chunks.length}: ${chunk.urls.length} segments offset=${Math.round(chunk.timeOffset)}s${initSegment ? " (fMP4)" : ""}`);
              const stream = streamSegmentsToPassThrough(chunk.urls, initSegment);
              const { segments, words } = await transcribePassThrough(stream, segmentSetup.keywords);
              return {
                segments: segments.map((s) => ({ ...s, start: s.start + chunk.timeOffset, end: s.end + chunk.timeOffset })),
                words: words.map((w) => ({ ...w, start: w.start + chunk.timeOffset, end: w.end + chunk.timeOffset })),
              };
            })
          )
        );

        // Place results back into their original chunk slots so timestamps
        // and ordering stay correct regardless of completion order.
        results.forEach((result, i) => {
          const index = batch[i].index;
          allChunkSegments[index] = result.segments;
          allChunkWords[index] = result.words;
        });
      }

      const allWords = allChunkWords.flat();
      const segments = ((): TranscriptSegment[] => {
        const merged = allChunkSegments.flat();
        console.log(`[analyze] Transcription complete: ${merged.length} segments, ${allWords.length} words across ${chunks.length} chunks`);
        if (merged.length === 0) {
          throw new Error("We couldn't hear any talking in this stream. If your mic was muted, that's why.");
        }

        // Coverage: if the talking stops early in the audio we could hear,
        // either the mic went off or Twitch sent the audio short. Measured
        // against the end of the last unmuted audio, not the VOD length, so
        // a stream whose last hour Twitch muted isn't mistaken for this.
        const vodDuration = segmentSetup.duration_seconds ?? 0;
        const audibleEnd = muteStats.audibleEnd > 0 ? Math.min(muteStats.audibleEnd, vodDuration || muteStats.audibleEnd) : vodDuration;
        const lastWordEnd = allWords.length > 0 ? allWords[allWords.length - 1].end : 0;
        if (audibleEnd > 120 && lastWordEnd > 0 && lastWordEnd < audibleEnd * 0.5) {
          const heard = Math.max(1, Math.round(lastWordEnd / 60));
          throw new Error(
            `We could only hear you talking in the first ${heard} ${heard === 1 ? "minute" : "minutes"} of this stream. ` +
            `If you were AFK or your sound was off after that, there's nothing to coach in this one, so pick another stream. ` +
            `If you were talking the whole time, try again in a few minutes.`
          );
        }
        if (audibleEnd > 0 && lastWordEnd > 0 && lastWordEnd < audibleEnd * 0.85) {
          console.warn(
            `[analyze] Transcript ends at ${Math.round(lastWordEnd)}s but audible audio runs to ${Math.round(audibleEnd)}s ` +
            `(${Math.round((lastWordEnd / audibleEnd) * 100)}% coverage). Captions for late moments may be absent`
          );
        }
        return merged;
      })();

      // Persist word timestamps for caption rendering
      if (allWords.length > 0) {
        await supabase.from("vods").update({ word_timestamps: allWords }).eq("id", vodId);
      }

      // Step 1.5: Fetch & bucket Twitch chat replay. Best-effort — chat is
      // platform-integration ground truth that AI wrappers can't access,
      // but it's not load-bearing: a chat-fetch failure just means this
      // VOD's pulse is empty and downstream coaching falls back to
      // audio-only signals. Wrapped in its own step so the network +
      // bucketing time doesn't eat into the analyze step's 5min window.
      await step.run("fetch-chat-pulse", async () => {
        try {
          const { data: vodForChat } = await supabase
            .from("vods")
            .select("twitch_vod_id, duration_seconds")
            .eq("id", vodId)
            .single();
          if (!vodForChat?.twitch_vod_id) return { skipped: "no_vod_id" };
          const duration = (vodForChat.duration_seconds as number | null) ?? 0;
          if (duration < 60) return { skipped: "too_short" };

          const messages = await fetchTwitchVodChat(vodForChat.twitch_vod_id);
          // Save buckets unconditionally — empty buckets (0 messages, e.g. on
          // very old VODs Twitch no longer serves chat replay for) let the UI
          // render the AudienceSnapshot card with \"Quiet stream\" copy
          // instead of falling through to nothing rendered at all.
          const buckets = bucketChat(messages, duration, 30);
          await supabase.from("vods").update({ chat_pulse: buckets }).eq("id", vodId);
          console.log(`[analyze] Saved chat pulse: ${messages.length} messages → ${buckets.length} buckets`);
          return { messages: messages.length, buckets: buckets.length };
        } catch (err) {
          // NEVER throw from here — chat is best-effort. Log and move on.
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[analyze] Chat pulse fetch failed (continuing without):`, msg);
          return { error: msg };
        }
      });

      // Steps 2 & 3 used to be a single "analyze" step that ran both Claude
      // calls back-to-back. For long VODs that combined latency exceeded
      // Vercel's 5-minute per-invocation ceiling and the function got killed
      // (FUNCTION_INVOCATION_TIMEOUT). Splitting into two steps gives each
      // Claude call its own 5-minute window and lets Inngest persist peak
      // results so retries don't re-run detection.

      // Filter once — used by both steps. Closure capture is fine; the array
      // is small (utterance-level, not word-level) so cross-step state cost
      // is negligible.
      const filtered = (startSeconds !== undefined && endSeconds !== undefined)
        ? segments.filter(s => s.start < endSeconds && s.end > startSeconds)
        : segments;
      if (filtered.length === 0) {
        throw new Error("No speech found in the selected time range. Try a wider range.");
      }

      const peaks = await step.run("detect-peaks", async () => {
        console.log(`[analyze] Stage 2/4: detecting peaks from ${filtered.length} segments`);
        await supabase.from("vods").update({ status: "analyzing" }).eq("id", vodId);
        const { data: vod } = await supabase.from("vods").select("title, chat_pulse").eq("id", vodId).single();
        const title = vod?.title || "Stream";
        const pulseText = formatPulseForPrompt(vod?.chat_pulse as ChatBucket[] | null | undefined);
        return await detectPeaks(filtered, title, pulseText || undefined);
      });

      const coachReport = await step.run("generate-coach-report", async () => {
        const { data: vod } = await supabase.from("vods").select("title, chat_pulse").eq("id", vodId).single();
        const title = vod?.title || "Stream";
        const chatBuckets = (vod?.chat_pulse as ChatBucket[] | null | undefined) ?? undefined;
        const pulseText = formatPulseForPrompt(chatBuckets);

        // Last 3 prior reports — only VODs streamed BEFORE this one so coaching
        // advice never references streams that hadn't happened yet at stream time
        const { data: priorVods } = await supabase
          .from("vods")
          .select("coach_report, stream_date, peak_data")
          .eq("user_id", userId)
          .eq("status", "ready")
          .neq("id", vodId)
          .not("coach_report", "is", null)
          .lt("stream_date", vod?.stream_date ?? new Date().toISOString())
          .order("stream_date", { ascending: false })
          .limit(3);

        type VodRow = { coach_report: unknown; stream_date: string; peak_data: unknown };
        const priorReports: PriorCoachSummary[] = (priorVods ?? [] as VodRow[])
          .filter((v: VodRow) => v.coach_report && v.stream_date)
          .map((v: VodRow) => {
            const r = v.coach_report as {
              overall_score?: number;
              recommendation?: string;
              improvements?: string[];
              score_breakdown?: { energy?: number; engagement?: number; consistency?: number; content?: number };
              cold_open?: { score?: "strong" | "average" | "weak" };
              closing?: { score?: "strong" | "average" | "weak" };
              anti_patterns?: Array<{ type?: string }>;
            };
            const peaks = Array.isArray(v.peak_data) ? (v.peak_data as unknown[]) : [];
            return {
              date: v.stream_date.slice(0, 10),
              score: r.overall_score ?? 0,
              recommendation: r.recommendation ?? "",
              top_improvement: (r.improvements?.[0] ?? "").replace(/\*\*[^*]+\*\*\s*[—–-]\s*/, ""),
              subscores: r.score_breakdown,
              cold_open_score: r.cold_open?.score,
              closing_score: r.closing?.score,
              peak_count: peaks.length,
              anti_pattern_types: (r.anti_patterns ?? []).map((a) => a.type).filter((x): x is string => !!x),
            };
          });

        console.log(`[analyze] Stage 3/4: generating coach report (${peaks.length} peaks, ${priorReports.length} prior reports)`);
        const report = await generateCoachReport(filtered, title, peaks, priorReports.length > 0 ? priorReports : undefined, pulseText || undefined, chatBuckets, undefined, muted);
        if (!report) {
          throw new Error("Failed to generate coaching report. AI returned invalid response.");
        }
        console.log(`[analyze] Coach report generated: score=${report.overall_score}`);
        return report;
      });

      // Step 4: Save results + record usage
      await step.run("save", async () => {
        console.log(`[analyze] Stage 4/4: saving results for vod=${vodId}`);
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_expires_at, founding_member, twitch_id")
          .eq("id", userId)
          .single();

        const isExpired = profile?.plan === "pro" && profile?.subscription_expires_at &&
          new Date(profile.subscription_expires_at) < new Date();
        const plan: "free" | "pro" = profile?.plan === "pro" && !isExpired ? "pro" : "free";
        const isFounding = profile?.founding_member === true;

        // Double-check limit before recording success. This catches anyone who
        // bypassed the API-level check (deleted their analyzed VOD, raced two
        // requests, etc.). Free users hit a weekly cap; Pro/founding hit a
        // monthly one. Both read from the same tamper-proof tables the
        // user-facing limits.ts uses.
        if (plan === "free") {
          const twitchId = profile?.twitch_id as string | undefined;
          let analysesUsed = 0;
          if (twitchId) {
            const { data: trial } = await supabase
              .from("trial_records")
              .select("analyses_this_week, week_start")
              .eq("twitch_id", twitchId)
              .maybeSingle();
            // Must match limits.ts exactly: a stored week that is not the
            // current one reads as zero. Reading the lifetime column here
            // instead would keep every existing free user blocked forever
            // no matter what the weekly allowance says.
            const sameWeek = ((trial?.week_start as string | null) ?? null) === currentWeekStart();
            analysesUsed = sameWeek ? trial?.analyses_this_week ?? 0 : 0;
          }
          if (analysesUsed >= FREE_WEEKLY_LIMITS.analyses_per_week) {
            await supabase.from("vods").update({
              status: "failed",
              failed_reason: `You've used both free analyses this week. They reset Monday, or go Pro for 15 a month.`,
            }).eq("id", vodId);
            console.warn(`[inngest] analyze-vod blocked at save — user ${userId} free weekly cap ${analysesUsed}/${FREE_WEEKLY_LIMITS.analyses_per_week}`);
            return;
          }

          // Free users move on the ladder too. This used to run only in the
          // Pro branch below, which meant rank — the whole reason to come
          // back — only ever moved for people who were already paying. The
          // hook cannot be the reward for converting; it has to be what
          // makes converting feel worth it.
          const rank = await applyRankForAnalysis(
            supabase,
            userId,
            vodId,
            (coachReport as { overall_score?: number } | null)?.overall_score ?? null
          );

          await supabase.from("vods").update({
            status: "ready",
            peak_data: peaks,
            coach_report: coachReport,
            analyzed_at: now.toISOString(),
            ...(rank
              ? {
                  rank_delta: rank.delta,
                  rank_points_after: rank.points,
                  rank_tier_change: rank.tierChange,
                }
              : {}),
          }).eq("id", vodId);

          if (twitchId) {
            await incrementTrialAnalysis(twitchId);
          }
          await touchStreak(userId);
        } else {
          // Pro / founding — monthly counter
          const { data: usageLog } = await supabase
            .from("usage_logs")
            .select("analyses_count")
            .eq("user_id", userId)
            .eq("month", month)
            .single();
          const monthlyLimit = isFounding ? FOUNDING_LIMITS.analyses_per_month : PRO_LIMITS.analyses_per_month;
          const alreadyUsed = usageLog?.analyses_count ?? 0;
          if (alreadyUsed >= monthlyLimit) {
            await supabase.from("vods").update({
              status: "failed",
              failed_reason: `Monthly analysis limit reached (${monthlyLimit}/month).`,
            }).eq("id", vodId);
            console.warn(`[inngest] analyze-vod blocked at save — user ${userId} already used ${alreadyUsed}/${monthlyLimit}`);
            return;
          }

          // Move the ladder. This is what the user actually sees, so it
          // happens in the same write as the report rather than in a job
          // that could lag behind it or fail separately.
          const rank = await applyRankForAnalysis(
            supabase,
            userId,
            vodId,
            (coachReport as { overall_score?: number } | null)?.overall_score ?? null
          );

          await Promise.all([
            supabase.from("vods").update({
              status: "ready",
              peak_data: peaks,
              coach_report: coachReport,
              analyzed_at: now.toISOString(),
              ...(rank
                ? {
                    rank_delta: rank.delta,
                    rank_points_after: rank.points,
                    rank_tier_change: rank.tierChange,
                  }
                : {}),
            }).eq("id", vodId),
            supabase.from("usage_logs").upsert(
              { user_id: userId, month, analyses_count: alreadyUsed + 1 },
              { onConflict: "user_id,month" }
            ),
          ]);
          await touchStreak(userId);
        }
      });

      // Auto-generate the best clip immediately after analysis — clip is ready
      // when the VOD is ready. Uses bold (default) style; user can change style
      // from the VOD page and regenerate.
      const autoClipData = await step.run("auto-generate-clip", async () => {
        if (peaks.length === 0) return null;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

        // Mirror getUserUsage clip quota check — free users use the lifetime
        // trial counter, Pro/founding use the monthly clips count.
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_expires_at, founding_member, twitch_id")
          .eq("id", userId)
          .single();

        const isExpired = profile?.plan === "pro" && profile?.subscription_expires_at &&
          new Date(profile.subscription_expires_at) < new Date();
        const plan = profile?.plan === "pro" && !isExpired ? "pro" : "free";

        if (plan === "free") {
          const twitchId = profile?.twitch_id as string | undefined;
          let clipsUsed = 0;
          if (twitchId) {
            const { data: trial } = await supabase
              .from("trial_records")
              .select("clips_this_week, week_start")
              .eq("twitch_id", twitchId)
              .maybeSingle();
            const sameWeek = ((trial?.week_start as string | null) ?? null) === currentWeekStart();
            clipsUsed = sameWeek ? trial?.clips_this_week ?? 0 : 0;
          }
          if (clipsUsed >= FREE_WEEKLY_LIMITS.clips_per_week) {
            console.log(`[analyze] Auto-generate skipped — free weekly clip cap (${clipsUsed}/${FREE_WEEKLY_LIMITS.clips_per_week})`);
            return null;
          }
        } else {
          const clipLimit = profile?.founding_member === true
            ? FOUNDING_LIMITS.clips_per_month
            : PRO_LIMITS.clips_per_month;
          const { count: clipsThisMonth } = await supabase
            .from("clips")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("status", ["ready", "deleted"])
            .gte("created_at", monthStart)
            .lt("created_at", monthEnd);
          if ((clipsThisMonth ?? 0) >= clipLimit) {
            console.log(`[analyze] Auto-generate skipped — clip limit reached (${clipsThisMonth}/${clipLimit})`);
            return null;
          }
        }

        const topPeak = peaks[0];

        // Expand short peaks to a minimum 30s window (mirrors API route logic)
        let start = Number(topPeak.start);
        let end = Number(topPeak.end);
        const peakDuration = end - start;
        if (peakDuration < 30) {
          const pad = (30 - peakDuration) / 2;
          start = Math.max(0, start - pad);
          end = end + pad;
        }
        const peakForClip = { ...topPeak, start, end };

        const { data: vodRow } = await supabase
          .from("vods")
          .select("twitch_vod_id")
          .eq("id", vodId)
          .single();

        if (!vodRow?.twitch_vod_id) return null;

        // Guard against duplicate (e.g. Inngest retry after a partial run)
        const { data: existing } = await supabase
          .from("clips")
          .select("id")
          .eq("user_id", userId)
          .eq("vod_id", vodId)
          .eq("start_time_seconds", Math.round(start))
          .in("status", ["processing", "ready"])
          .maybeSingle();

        if (existing) {
          console.log(`[analyze] Auto-generate skipped — clip already exists for this peak`);
          return null;
        }

        const { data: clipRecord, error: insertError } = await supabase
          .from("clips")
          .insert({
            user_id: userId,
            vod_id: vodId,
            title: topPeak.title,
            description: topPeak.reason,
            start_time_seconds: Math.round(start),
            end_time_seconds: Math.round(end),
            caption_text: topPeak.caption,
            caption_style: "bold",
            peak_score: topPeak.score,
            peak_category: topPeak.category,
            peak_reason: topPeak.reason,
            status: "processing",
          })
          .select("id")
          .single();

        if (insertError || !clipRecord) {
          console.error(`[analyze] Auto-generate insert failed:`, insertError?.message);
          return null;
        }

        console.log(`[analyze] Auto-generate: queued clip ${clipRecord.id} for "${topPeak.title}"`);
        return { clipId: clipRecord.id, twitchVodId: vodRow.twitch_vod_id as string, peak: peakForClip };
      });

      if (autoClipData) {
        await step.sendEvent("fire-clip-gen", {
          name: "clip/generate",
          data: {
            clipId: autoClipData.clipId,
            vodId,
            twitchVodId: autoClipData.twitchVodId,
            userId,
            peakIndex: 0,
            peak: autoClipData.peak,
          },
        });
      }

      // Send push notification — fire and forget, never block on this.
      // Prefers "your score improved by N" framing when this stream beat the
      // prior stream, since progress messaging pulls people back way more
      // reliably than a bare "your report is ready". Falls through to a
      // standard priority-recommendation snippet otherwise.
      await step.run("notify", async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("expo_push_token, web_push_subscription")
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
          title = `Your score climbed ${delta > 0 ? "+" : ""}${delta}, now ${score}/100`;
        } else if (score !== undefined && priorScore !== null && score < priorScore) {
          title = `New stream graded: ${score}/100`;
        } else if (score !== undefined) {
          title = `Stream graded: ${score}/100`;
        } else {
          title = "Your stream report is ready";
        }

        const pushPayload = {
          title,
          body: snippet || "Open LevlCast to see your coach report.",
          data: { vodId },
        };

        await sendPush(profile?.expo_push_token, pushPayload);

        if (profile?.web_push_subscription) {
          try {
            await sendWebPush(profile.web_push_subscription as any, pushPayload);
          } catch (err) {
            // 410 = subscription expired — clear it so we don't retry next time
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("410") || msg.includes("expired") || msg.includes("unsubscribed")) {
              await supabase.from("profiles").update({ web_push_subscription: null }).eq("id", userId);
            }
            console.warn(`[notify] web push failed for ${userId.slice(0, 8)}:`, msg);
          }
        }
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

      // Coaching arc — generates after every analysis, cached by vod ID so it
      // never re-runs for the same stream. Needs 3+ analyzed VODs to produce output.
      await step.run("generate-coaching-arc", async () => {
        try {
          const { data: existing } = await supabase
            .from("profiles")
            .select("coaching_arc")
            .eq("id", userId)
            .single();

          const cached = existing?.coaching_arc as { generated_for_vod_id?: string } | null;
          if (cached?.generated_for_vod_id === vodId) return;

          const arc = await generateCoachingArc(userId, vodId, supabase);
          if (arc) {
            await supabase.from("profiles").update({ coaching_arc: arc }).eq("id", userId);
            console.log(`[analyze] Coaching arc saved (${arc.score_history.length} streams)`);
          }
        } catch (err) {
          // Never block the main analysis result on arc generation
          console.warn("[analyze] Coaching arc generation failed (non-fatal):", err instanceof Error ? err.message : String(err));
        }
      });

      return { peaks: peaks.length, segments: segments.length };
    } catch (err) {
      // Mark the VOD as failed so the user can see it and retry —
      // without this, the VOD would be stuck in "transcribing" or "analyzing" forever.
      //
      // Node's undici wraps network errors as `TypeError: fetch failed` with
      // the real reason on `err.cause`. Without unwrapping we'd surface a
      // useless "fetch failed" to the user. Same trick for nested AggregateErrors.
      const unwrap = (e: unknown): string => {
        if (!(e instanceof Error)) return String(e);
        const top = e.message;
        const cause = (e as { cause?: unknown }).cause;
        if (cause instanceof Error && cause.message && cause.message !== top) {
          return `${top}: ${cause.message}`;
        }
        if (cause && typeof cause === "object" && "message" in cause && typeof (cause as { message: string }).message === "string") {
          return `${top}: ${(cause as { message: string }).message}`;
        }
        return top;
      };
      const message = unwrap(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(`[analyze] FAILED vod=${vodId} user=${userId}:`, message);
      if (stack) console.error(`[analyze] Stack:`, stack);

      // Cap failed_reason at 800 chars — long enough for context, short
      // enough that the failed-card UI doesn't blow out the layout.
      const truncated = message.length > 800 ? `${message.slice(0, 797)}...` : message;
      await supabase.from("vods").update({
        status: "failed",
        failed_reason: truncated,
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
    const cutoff = new Date(Date.now() - 150 * 60 * 1000).toISOString();

    const { data: stuck } = await supabase
      .from("vods")
      .select("id")
      .in("status", ["transcribing", "analyzing"])
      .lt("updated_at", cutoff);

    if (!stuck || stuck.length === 0) return { cleaned: 0 };

    await supabase
      .from("vods")
      .update({ status: "failed", failed_reason: "Analysis timed out. Please try again." })
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
      .update({ status: "failed", failed_reason: "Clip generation stalled. Twitch CDN may be slow for this VOD. Hit Regenerate to try again." })
      .in("id", stuck.map((c: { id: string }) => c.id));

    console.log(`[cleanup] Marked ${stuck.length} stuck clips as failed`);
    return { cleaned: stuck.length };
  }
);

/**
 * Daily R2 orphan cleanup. Each clip edit uploads new captioned + clean
 * mp4s to R2; the previous versions stay in the bucket forever until
 * something deletes them. Same problem for the candidate frame jpegs that
 * get rotated when a user re-trims.
 *
 * The cron walks the clips table user-by-user, lists every R2 object under
 * that user's prefix, builds a set of "in-use" URLs from the live clip
 * rows, and deletes any object older than 24 hours that isn't referenced.
 *
 * Why 24h: a clip generation pipeline can take a few minutes. The 24h grace
 * window means we never race with an in-flight upload, while still
 * cleaning up before storage costs become a concern.
 *
 * Conservative on errors — a partial failure logs and continues so one
 * malformed user doesn't block cleanup for everyone else.
 */
export const cleanupOrphanedR2Objects = inngest.createFunction(
  { id: "cleanup-orphaned-r2-objects" },
  { cron: "0 5 * * *" }, // daily 5am UTC
  async ({ step }) => {
    const supabase = createAdminClient();
    const r2Base = process.env.R2_PUBLIC_URL;
    if (!r2Base) {
      console.warn("[r2-cleanup] R2_PUBLIC_URL not set, skipping");
      return { skipped: true };
    }

    // Anything uploaded in the last 24h is left alone. This is the safety
    // window that prevents racing with a clip-generation pipeline that's
    // still mid-upload (cutClip + uploadToR2 can take ~3-5min).
    const safeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: profiles } = await step.run("list-users-with-clips", async () => {
      return await supabase
        .from("profiles")
        .select("id")
        .eq("plan", "pro")
        .or("plan.eq.pro")
        .order("id");
    }) as { data: Array<{ id: string }> | null };

    // Even free / trial users have R2 objects (their generated clips). Pull
    // all distinct user ids that have any clip row instead of relying on
    // the plan filter above.
    const { data: clipUsers } = await supabase
      .from("clips")
      .select("user_id")
      .order("user_id");
    const userIds = new Set<string>([
      ...(profiles ?? []).map((p) => p.id),
      ...((clipUsers ?? []) as Array<{ user_id: string }>).map((c) => c.user_id),
    ]);

    let totalDeleted = 0;
    let totalKept = 0;
    let usersScanned = 0;

    for (const userId of userIds) {
      try {
        // Build the in-use URL set for this user from every clip row
        // (including deleted/failed — their stored URLs may still be in R2).
        const { data: userClips } = await supabase
          .from("clips")
          .select("video_url, source_video_url, thumbnail_url, candidate_frames, original_video_url, original_source_video_url")
          .eq("user_id", userId);

        const inUse = new Set<string>();
        for (const c of (userClips ?? []) as Array<{
          video_url: string | null;
          source_video_url: string | null;
          thumbnail_url: string | null;
          candidate_frames: string[] | null;
          original_video_url: string | null;
          original_source_video_url: string | null;
        }>) {
          if (c.video_url) inUse.add(c.video_url);
          if (c.source_video_url) inUse.add(c.source_video_url);
          if (c.thumbnail_url) inUse.add(c.thumbnail_url);
          if (c.original_video_url) inUse.add(c.original_video_url);
          if (c.original_source_video_url) inUse.add(c.original_source_video_url);
          if (Array.isArray(c.candidate_frames)) {
            for (const f of c.candidate_frames) if (typeof f === "string") inUse.add(f);
          }
        }

        const objects = await listR2Objects(`${userId}/`);
        const orphanKeys: string[] = [];
        for (const obj of objects) {
          if (!obj.Key) continue;
          if (obj.LastModified && obj.LastModified > safeCutoff) {
            // Inside the 24h grace window — skip even if not yet referenced
            // (probably an in-flight upload or just-finished generation).
            continue;
          }
          const url = `${r2Base}/${obj.Key}`;
          if (inUse.has(url)) {
            totalKept += 1;
            continue;
          }
          orphanKeys.push(obj.Key);
        }

        if (orphanKeys.length > 0) {
          const deleted = await deleteR2Objects(orphanKeys);
          totalDeleted += deleted;
          console.log(`[r2-cleanup] user=${userId} deleted=${deleted}/${orphanKeys.length} kept=${objects.length - orphanKeys.length}`);
        }
        usersScanned += 1;
      } catch (err) {
        console.error(`[r2-cleanup] user=${userId} failed:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log(`[r2-cleanup] Done. users=${usersScanned} deleted=${totalDeleted} kept=${totalKept}`);
    return { usersScanned, deleted: totalDeleted, kept: totalKept };
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
      // Returns { ok: true } on success, { ok: false, reason } when FFmpeg fails so the
      // function can fall back to the next best peak without the whole job failing.
      const uploadResult = await step.run("generate-and-upload", async () => {
        console.log(`[clip] Downloading segments for "${peak.title}" (${peak.start}s - ${peak.end}s)`);

        const { data: profile } = await supabase
          .from("profiles")
          .select("twitch_access_token, twitch_refresh_token")
          .eq("id", userId)
          .single();
        let twitchUserToken = profile?.twitch_access_token || undefined;

        // NonRetriableError bypasses Inngest's step-level retry backoff — CDN failures
        // are not improved by waiting, so fail immediately and let the catch block run.
        let download;
        try {
          download = await downloadTwitchVodVideo(twitchVodId, peak.start, peak.end, twitchUserToken);
        } catch (err) {
          if (err instanceof TwitchAuthError && profile?.twitch_refresh_token) {
            console.log(`[clip] Twitch token expired — refreshing and retrying`);
            const refreshed = await refreshTwitchToken(profile.twitch_refresh_token);
            twitchUserToken = refreshed.accessToken;
            await supabase.from("profiles").update({
              twitch_access_token: refreshed.accessToken,
              twitch_refresh_token: refreshed.refreshToken,
            }).eq("id", userId);
            download = await downloadTwitchVodVideo(twitchVodId, peak.start, peak.end, twitchUserToken)
              .catch((e) => { throw new NonRetriableError(e instanceof Error ? e.message : String(e)); });
          } else if (err instanceof TwitchAuthError) {
            throw new NonRetriableError("Twitch connection expired and refresh token missing. User must log out and back in.");
          } else {
            throw new NonRetriableError(err instanceof Error ? err.message : String(err));
          }
        }

        // Auto-generation produces a CLEAN clip (no captions burned). The
        // editor adds captions on save, which keeps that pipeline as the
        // single canonical place captions get rendered. No more risk of
        // a user's chosen style overlapping a default-burned set.
        let cutResult: { captioned: Buffer; cleanSource: Buffer } | null = null;
        let cutFailReason: string | null = null;
        try {
          const adjustedStart = peak.start - download.segmentStartSeconds;
          const adjustedEnd = peak.end - download.segmentStartSeconds;
          console.log(`[clip] Cutting clean: adjusted ${adjustedStart}s - ${adjustedEnd}s (offset: ${download.segmentStartSeconds}s)`);
          // No vodWords / vodWindow → cutClip skips the caption pass.
          cutResult = await cutClip(download.filePath, adjustedStart, adjustedEnd, {});
          console.log(`[clip] Cut complete: ${cutResult.cleanSource.length} bytes clean`);
        } catch (err) {
          cutFailReason = err instanceof Error ? err.message : String(err);
          console.error(`[clip] cutClip failed for peak ${peakIndex}:`, cutFailReason);
        } finally {
          await download.cleanup();
        }

        if (cutFailReason !== null || !cutResult) {
          return { ok: false as const, reason: cutFailReason ?? "cutClip returned null" };
        }

        const baseFileName = `${userId}/${vodId}-peak${peakIndex}-${Date.now()}`;

        const cleanUrl = await uploadToR2(`${baseFileName}-clean.mp4`, cutResult.cleanSource, "video/mp4")
          .catch((err) => { throw new NonRetriableError(err instanceof Error ? err.message : String(err)); });

        const { error: updateError } = await supabase.from("clips").update({
          // Both URLs point at the clean upload until the user edits.
          video_url: cleanUrl,
          source_video_url: cleanUrl,
          status: "ready",
        }).eq("id", clipId);

        if (updateError) throw new NonRetriableError(`DB update failed: ${updateError.message}`);

        // Trial users get a lifetime clip counter — increment on success only.
        // Failed clips don't count (the user gets to retry without burning the quota).
        const { data: clipOwner } = await supabase
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

        console.log(`[clip] Saved: "${peak.title}" → ${cleanUrl}`);
        return { ok: true as const };
      });

      // FFmpeg failed for this peak — mark it failed and try the next best peak.
      // Only retry up to peakIndex 2 so we don't chain indefinitely on a corrupted VOD.
      if (!uploadResult.ok) {
        await supabase.from("clips").update({
          status: "failed",
          failed_reason: uploadResult.reason,
        }).eq("id", clipId);

        if (peakIndex < 3) {
          const nextClipData = await step.run("queue-next-peak", async () => {
            const { data: vodData } = await supabase
              .from("vods")
              .select("peak_data")
              .eq("id", vodId)
              .single();
            const allPeaks = (vodData?.peak_data as any[]) ?? [];
            const nextIdx = peakIndex + 1;

            if (nextIdx >= allPeaks.length) {
              console.log(`[clip] Peak ${peakIndex} failed, no more peaks for vod=${vodId}`);
              return null;
            }

            const nextPeak = allPeaks[nextIdx];
            let start = Number(nextPeak.start);
            let end = Number(nextPeak.end);
            const dur = end - start;
            if (dur < 30) {
              const pad = (30 - dur) / 2;
              start = Math.max(0, start - pad);
              end = end + pad;
            }
            const expanded = { ...nextPeak, start, end };

            // Guard duplicate
            const { data: existing } = await supabase
              .from("clips")
              .select("id")
              .eq("user_id", userId)
              .eq("vod_id", vodId)
              .eq("start_time_seconds", Math.round(start))
              .in("status", ["processing", "ready"])
              .maybeSingle();

            if (existing) {
              console.log(`[clip] Next peak ${nextIdx} already has a clip`);
              return null;
            }

            const { data: newClip } = await supabase
              .from("clips")
              .insert({
                user_id: userId,
                vod_id: vodId,
                title: nextPeak.title,
                description: nextPeak.reason,
                start_time_seconds: Math.round(start),
                end_time_seconds: Math.round(end),
                caption_text: nextPeak.caption,
                caption_style: "bold",
                peak_score: nextPeak.score,
                peak_category: nextPeak.category,
                peak_reason: nextPeak.reason,
                status: "processing",
              })
              .select("id")
              .single();

            if (!newClip) return null;
            console.log(`[clip] Falling back to peak ${nextIdx}: "${nextPeak.title}" (${newClip.id})`);
            return { clipId: newClip.id, peak: expanded, peakIndex: nextIdx };
          });

          if (nextClipData) {
            await step.sendEvent("fallback-clip-gen", {
              name: "clip/generate",
              data: {
                clipId: nextClipData.clipId,
                vodId,
                twitchVodId,
                userId,
                peakIndex: nextClipData.peakIndex,
                peak: nextClipData.peak,
              },
            });
          }
        }

        return { clipId, fallback: true };
      }

      // Notify user — fire and forget
      await step.run("notify-clip-ready", async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("expo_push_token, web_push_subscription, plan, subscription_expires_at, twitch_display_name")
          .eq("id", userId)
          .single();

        const pushPayload = {
          title: "Your clip is ready",
          body: peak.title,
          data: { vodId },
        };

        await sendPush(profile?.expo_push_token, pushPayload);

        if (profile?.web_push_subscription) {
          try {
            await sendWebPush(profile.web_push_subscription as any, pushPayload);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("410") || msg.includes("expired") || msg.includes("unsubscribed")) {
              await supabase.from("profiles").update({ web_push_subscription: null }).eq("id", userId);
            }
          }
        }

        // Conversion email for free users — "your clip is ready + here's what Pro unlocks"
        const isExpired = profile?.plan === "pro" && profile?.subscription_expires_at &&
          new Date(profile.subscription_expires_at) < new Date();
        const isFree = profile?.plan !== "pro" || isExpired;

        if (isFree) {
          try {
            const { data: { user } } = await supabase.auth.admin.getUserById(userId);
            if (user?.email) {
              const { data: vodData } = await supabase
                .from("vods")
                .select("coach_report")
                .eq("id", vodId)
                .single();
              const score = (vodData?.coach_report as any)?.overall_score as number | undefined;
              const name = profile?.twitch_display_name ?? user.email.split("@")[0];
              await sendClipReadyEmail(user.email, name, vodId, peak.title, score);
            }
          } catch (err) {
            console.warn("[clip] clip-ready email failed:", err instanceof Error ? err.message : String(err));
          }
        }
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

Talk like a friend who manages their career, not a metrics dashboard. No em dashes. Short sentences. Use contractions.
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

No em dashes. Short sentences. Use contractions.
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

// (Collab algorithmic matching removed 2026-05-21 with collab finder v2.
// New design uses live opt-in users + user-initiated interest sends, so no
// precomputed cache. See migration 025_collab_finder_v2.sql.)


// ─── Weekly Manager Digest ────────────────────────────────────────────────
// Runs every Monday at 9:45 AM UTC (after burnout + content crons).
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
          supabase.from("collab_interests")
            .select("id")
            .eq("recipient_id", userId).eq("status", "pending"),
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
          ? (burnout.score <= 25 ? "You're in good shape this week." : burnout.score <= 45 ? "A few minor signals, nothing concerning." : "Some fatigue signals. Check your Health card.")
          : null);

        const contentSummary = content?.insight || (content?.top_category
          ? `Your ${content.top_category} content performed best this week.`
          : null);

        const collabSummary = collabCount > 0
          ? `${collabCount} new collab interest${collabCount > 1 ? "s" : ""} waiting in your inbox.`
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
- Collab interests pending: ${collabCount}

Generate:
1. "headline": One punchy sentence summarizing the week. Encouraging but honest. No fluff.
2. "actions": Array of 2-3 short action items for this week. Specific, actionable, based on the data.

No em dashes. Short sentences. Use contractions.
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
          if (peaksFound > 0 && clipsGenerated === 0) actionItems.push("You have peaks waiting. Generate some clips.");
          if (collabCount > 0) actionItems.push("Check your new collab interests.");
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

// ─── Weekly Leagues ────────────────────────────────────────────────────────
// Monday 00:05 UTC, five minutes after the week turns. Last week is closed
// and paid first, then this week's groups are seated, so a bonus is already
// on someone's rank when the rank-sorted groups are cut. Both steps are safe
// to re-run; see lib/league.ts.

export const runWeeklyLeagues = inngest.createFunction(
  { id: "run-weekly-leagues" },
  { cron: "5 0 * * 1" }, // every Monday 00:05 UTC
  async ({ step }) => {
    const supabase = createAdminClient();
    const settled = await step.run("settle-last-week", () => settleFinishedLeagues(supabase));
    const formed = await step.run("form-this-week", () => formWeeklyLeagues(supabase));
    console.log(`[leagues] settled ${settled.settled} (${settled.paid} paid), formed ${formed.leagues} with ${formed.members} streamers`);
    return { settled, formed };
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

// ─── Auto-Sync VODs ────────────────────────────────────────────────────────
// Runs every 6 hours. For users with a connected Twitch ID who have already
// analyzed at least one VOD, fetch their latest VODs from Twitch, insert any
// new ones, and email a "your latest stream is ready to analyze" nudge.
//
// This is the single biggest retention lever — without it, users who stream
// on Sat/Sun never come back unless they manually remember to open the app
// and click Sync. Once they have any analysis, they've shown intent; auto-
// pulling new streams + nudging closes the loop.

export const autoSyncTwitchVods = inngest.createFunction(
  { id: "auto-sync-twitch-vods" },
  { cron: "0 */6 * * *" }, // every 6 hours on the hour
  async ({ step }) => {
    const supabase = createAdminClient();

    return await step.run("sync-active-users", async () => {
      // Active = has at least one ready VOD (signaled real intent)
      const { data: activeUserIds } = await supabase
        .from("vods")
        .select("user_id")
        .eq("status", "ready");

      if (!activeUserIds?.length) return { synced: 0, emailed: 0 };

      const uniqueUserIds = Array.from(new Set(activeUserIds.map((r: { user_id: string }) => r.user_id)));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, twitch_id, twitch_display_name")
        .in("id", uniqueUserIds)
        .not("twitch_id", "is", null);

      if (!profiles?.length) return { synced: 0, emailed: 0 };

      let appToken: string;
      try {
        appToken = await getAppAccessToken();
      } catch (err) {
        console.error("[auto-sync] App token failed:", err);
        return { synced: 0, emailed: 0, error: "twitch_auth_failed" };
      }

      let totalSynced = 0;
      let totalEmailed = 0;

      for (const profile of profiles) {
        try {
          // Daily follower snapshot — runs regardless of new VODs
          try {
            const today = new Date().toISOString().slice(0, 10);
            const { data: existingSnap } = await supabase
              .from("follower_snapshots")
              .select("id")
              .eq("user_id", profile.id)
              .eq("platform", "twitch")
              .gte("snapped_at", `${today}T00:00:00Z`)
              .maybeSingle();

            if (!existingSnap) {
              const followerRes = await fetch(
                `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${profile.twitch_id}`,
                { headers: { Authorization: `Bearer ${appToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID! } }
              );
              if (followerRes.ok) {
                const followerJson = await followerRes.json() as { total?: number };
                await supabase.from("follower_snapshots").insert({
                  user_id: profile.id,
                  platform: "twitch",
                  follower_count: followerJson.total ?? 0,
                });
              }
            }
          } catch {
            // non-fatal — never block VOD sync on snapshot failure
          }

          const twitchVods = await fetchTwitchVods(profile.twitch_id!, appToken, 10);
          if (twitchVods.length === 0) continue;

          const twitchIds = twitchVods.map((v) => v.id);
          const { data: existing } = await supabase
            .from("vods")
            .select("twitch_vod_id")
            .eq("user_id", profile.id)
            .in("twitch_vod_id", twitchIds);
          const existingIds = new Set(existing?.map((e: { twitch_vod_id: string }) => e.twitch_vod_id) || []);

          const newVods = twitchVods.filter((v) => !existingIds.has(v.id));
          if (newVods.length === 0) continue;

          const rows = newVods
            .map((v) => mapVodToRow(v, profile.id))
            .filter((r): r is NonNullable<typeof r> => r !== null);
          if (rows.length === 0) continue;
          const { error: insertError } = await supabase.from("vods").insert(rows);
          if (insertError) {
            console.error(`[auto-sync] Insert failed for ${profile.id.slice(0, 8)}:`, insertError.message);
            continue;
          }
          totalSynced += rows.length;

          // Find their email + count of prior analyzed VODs for the email tone
          const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
          if (!user?.email) continue;

          const { count: priorAnalysisCount } = await supabase
            .from("vods")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.id)
            .eq("status", "ready");

          const name = profile.twitch_display_name || "Streamer";
          await sendNewVodEmail(
            user.email,
            name,
            newVods[0].title,
            newVods.length,
            (priorAnalysisCount ?? 0) > 0
          );
          totalEmailed++;

          console.log(`[auto-sync] ${profile.id.slice(0, 8)}: synced ${newVods.length}, emailed`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[auto-sync] Failed for ${profile.id.slice(0, 8)}:`, msg);
        }
      }

      return { synced: totalSynced, emailed: totalEmailed, users: profiles.length };
    });
  }
);

/**
 * Public VOD preview — the no-account funnel entry point (/analyze).
 *
 * Runs the same transcription, peak detection and coach report as
 * `analyzeVod`, but over only the opening PREVIEW_SECONDS of a VOD and
 * against `public_previews` rather than `vods`. A preview has no owner,
 * so it never touches plan limits, never appears in a dashboard, and
 * never counts as one of anyone's analyses.
 *
 * Split into two steps on purpose: if Deepgram flakes, the retry re-runs
 * transcription without re-invoking (and re-billing) Claude.
 *
 * Global concurrency is capped so a burst of strangers pasting links can
 * never starve paying users' analyses of Inngest capacity.
 */
export const analyzePublicPreview = inngest.createFunction(
  {
    id: "analyze-public-preview",
    retries: 1,
    timeouts: { finish: "30m" },
    concurrency: {
      // Global, not per-user — previews are anonymous. Two at a time keeps
      // paid analyses first in line while still feeling instant at our
      // current traffic.
      limit: 2,
    },
  },
  { event: "public/preview" },
  async ({ event, step }) => {
    const { previewId, twitchVodId, title } = event.data as {
      previewId: string;
      twitchVodId: string;
      title: string;
    };
    const supabase = createAdminClient();

    // Dedupe guard. Mirrors analyzeVod: if this row already finished, a
    // duplicate event must not re-bill Deepgram and Claude.
    const { data: existing } = await supabase
      .from("public_previews")
      .select("status, duration_seconds")
      .eq("id", previewId)
      .single();

    if (!existing) {
      throw new NonRetriableError(`Preview ${previewId} not found`);
    }
    if (existing.status === "ready") {
      console.log(`[preview] skip — ${previewId} already ready`);
      return { skipped: true };
    }

    try {
      const transcribed = await step.run("preview-transcribe", async () => {
        await supabase
          .from("public_previews")
          .update({ status: "transcribing" })
          .eq("id", previewId);

        const result = await transcribePreviewWindow(twitchVodId, title);
        console.log(
          `[preview] ${previewId}: ${result.segments.length} segments over ${result.analyzedSeconds}s`
        );
        return result;
      });

      const report = await step.run("preview-report", async () => {
        await supabase
          .from("public_previews")
          .update({ status: "analyzing", game_category: transcribed.gameCategory })
          .eq("id", previewId);

        return await buildPreviewReport(
          transcribed.segments,
          title,
          {
            analyzedSeconds: transcribed.analyzedSeconds,
            totalSeconds: (existing.duration_seconds as number | null) ?? transcribed.analyzedSeconds,
          },
          // Absent in step state saved before this existed.
          (transcribed as { muted?: TimeRange[] }).muted ?? []
        );
      });

      await step.run("preview-save", async () => {
        // A null coach report means the transcript had nothing usable in
        // it. Treat that as a failure the visitor can act on rather than
        // rendering an empty report page.
        if (!report.coachReport) {
          await supabase
            .from("public_previews")
            .update({
              status: "failed",
              failed_reason:
                "We couldn't hear enough talking in the first few minutes to coach this one. Try a VOD where you're on mic from the start.",
            })
            .eq("id", previewId);
          return;
        }

        await supabase
          .from("public_previews")
          .update({
            status: "ready",
            coach_report: report.coachReport,
            peak_data: report.peaks,
            analyzed_seconds: transcribed.analyzedSeconds,
            game_category: transcribed.gameCategory,
            analyzed_at: new Date().toISOString(),
          })
          .eq("id", previewId);
      });

      return { previewId, ok: true };
    } catch (err) {
      // Always leave the row in a terminal state. A preview stuck on
      // "transcribing" forever is a visitor staring at a spinner, which
      // is worse than a clear error with a retry button.
      const message = err instanceof Error ? err.message : "Analysis failed.";
      await supabase
        .from("public_previews")
        .update({ status: "failed", failed_reason: message })
        .eq("id", previewId);
      throw err;
    }
  }
);

/**
 * Move a user's rank after an analysis completes.
 *
 * Reads their last five scores, computes the delta, writes the new rating
 * back to the profile, and hands the caller what changed so the VOD row
 * can record it. Returns null when there is no score to grade, which
 * leaves the ladder untouched rather than guessing.
 *
 * Deliberately best-effort: a rank write must never fail an analysis. The
 * report is the thing the user paid for; the rank is the thing that makes
 * them come back. Losing the second is bad, losing the first is worse.
 */
async function applyRankForAnalysis(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  vodId: string,
  score: number | null
): Promise<{ delta: number; points: number; tierChange: "up" | "down" | null } | null> {
  if (score === null || !Number.isFinite(score)) return null;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("rank_points, rank_last_was_loss")
      .eq("id", userId)
      .single();

    // Prior scores only — this VOD has not been marked ready yet, so it
    // cannot contaminate its own comparison.
    const { data: history } = await supabase
      .from("vods")
      .select("coach_report")
      .eq("user_id", userId)
      .eq("status", "ready")
      .neq("id", vodId)
      .order("analyzed_at", { ascending: false })
      .limit(5);

    const rows = (history ?? []) as Array<{ coach_report: { overall_score?: number } | null }>;
    const recentScores = rows
      .map((row) => row.coach_report?.overall_score)
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s));

    const result = computeDelta({
      score,
      recentScores,
      points: (profile?.rank_points as number | null) ?? 0,
      lastWasLoss: Boolean(profile?.rank_last_was_loss),
    });

    await supabase
      .from("profiles")
      .update({
        rank_points: result.points,
        rank_last_was_loss: result.delta < 0,
      })
      .eq("id", userId);

    console.log(
      `[rank] ${userId}: ${result.from.label} -> ${result.to.label} (${result.delta >= 0 ? "+" : ""}${result.delta})`
    );

    // This week's league. Its own try, so a league problem can never undo
    // the rank change the report is about to show.
    try {
      await recordLeagueStream(supabase, {
        userId,
        delta: result.delta,
        pointsAfter: result.points,
        isPlacement: recentScores.length === 0,
      });
    } catch (err) {
      console.warn("[league] skipped:", err instanceof Error ? err.message : err);
    }

    return { delta: result.delta, points: result.points, tierChange: result.tierChange };
  } catch (err) {
    console.warn("[rank] skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Rescue signups who never got a first report.
 *
 * Seven of the ten accounts created in September never saw a single
 * analysis. Some had no eligible VOD under the old rule, some had a job
 * that died mid-flight, and one had a perfectly analyzable 63-minute VOD
 * sitting untouched because the signup hook simply did not fire.
 *
 * Nothing in the product noticed. A user who never gets a report cannot
 * be converted, cannot be emailed anything useful, and has no reason to
 * come back — so this is worth more than any amount of new traffic.
 *
 * Runs hourly over accounts younger than seven days, and queues ONE
 * analysis for anyone sitting on synced VODs with nothing to show. The
 * free trial's two-analysis allowance is still enforced downstream, so
 * this can never spend more than the user was already entitled to.
 */
export const rescueUnactivatedSignups = inngest.createFunction(
  { id: "rescue-unactivated-signups", retries: 1 },
  { cron: "20 * * * *" },
  async ({ step }) => {
    return await step.run("rescue", async () => {
      const supabase = createAdminClient();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recent } = await supabase
        .from("profiles")
        .select("id, twitch_login")
        .gte("created_at", weekAgo);

      if (!recent || recent.length === 0) return { checked: 0, queued: 0 };

      let queued = 0;

      for (const profile of recent) {
        const userId = profile.id as string;

        // Already has a report? Nothing to rescue.
        const { count: readyCount } = await supabase
          .from("vods")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "ready");
        if ((readyCount ?? 0) > 0) continue;

        // Anything already moving? Don't stack a second job on top.
        const { count: busyCount } = await supabase
          .from("vods")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("status", ["transcribing", "analyzing"]);
        if ((busyCount ?? 0) > 0) continue;

        // Pick the shortest pending VOD over the minimum: cheapest to run
        // and fastest to put something in front of them.
        const { data: candidates } = await supabase
          .from("vods")
          .select("id, duration_seconds")
          .eq("user_id", userId)
          .eq("status", "pending")
          .gte("duration_seconds", 10 * 60)
          .order("duration_seconds", { ascending: true })
          .limit(1);

        const candidate = candidates?.[0];
        if (!candidate) continue;

        const { data: claimed } = await supabase
          .from("vods")
          .update({ status: "transcribing" })
          .eq("id", candidate.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (!claimed) continue;

        await inngest.send({
          id: `vod-analyze-${candidate.id}`,
          name: "vod/analyze",
          data: { vodId: candidate.id, userId },
        });

        queued++;
        console.log(
          `[rescue] queued first analysis for ${profile.twitch_login} (vod ${candidate.id})`
        );
      }

      return { checked: recent.length, queued };
    });
  }
);

/**
 * Outreach harvest — fills the queue, sends nothing.
 *
 * Hourly. Ten streamer subs do not turn over fast enough for most runs to
 * find anything new, and that is fine: the dedup table means a repeat pass
 * over the same posts costs one mirror request and stops there, before any
 * Claude call. Only genuinely new people reach the drafting step, so the
 * cost of running often is close to zero and the queue is never stale when
 * the page is opened.
 */
export const outreachHarvest = inngest.createFunction(
  { id: "outreach-harvest", retries: 1 },
  { cron: "0 * * * *" },
  async ({ step }) => {
    return await step.run("harvest", async () => {
      // There is deliberately no env gate here any more. This function
      // cannot send anything — it writes rows to our own table and stops.
      // The brake that matters lives on outreachDispatch, which needs
      // OUTREACH_AUTOSEND, and on the dashboard, where a person clicks.
      // Gating the draft step as well only ever produced a silent no-op
      // that looked identical to a working feature with no leads.
      //
      // The real cost of running hourly is Claude calls, so that is what
      // is bounded: stop drafting once enough messages are waiting. At a
      // send rate of a handful a day there is no point paying to write
      // the hundredth draft nobody will reach.
      const QUEUE_CEILING = 12;

      try {
        const { count: waiting } = await createAdminClient()
          .from("outreach_contacts")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued");

        if ((waiting ?? 0) >= QUEUE_CEILING) {
          console.log(`[outreach] harvest idle — ${waiting} already queued`);
          return { skipped: true, reason: "queue full", queued: waiting };
        }

        // Both numbers are Claude calls, so both are money. The second is
        // the one that actually bounds a run: without it, a pass where the
        // model skips every lead kept drafting and cost three times a
        // successful pass while queueing nothing.
        const room = QUEUE_CEILING - (waiting ?? 0);
        const result = await fillOutreachQueue(Math.min(3, room), 4);
        console.log(`[outreach] harvest queued=${result.queued} skipped=${result.skipped} claude_calls=${result.attempts}`);
        return result;
      } catch (err) {
        // Reddit refusing us is expected, not a fault. Without an OAuth app
        // it blocks datacenter IPs outright, and throwing here painted the
        // Inngest dashboard red every six hours for a condition no retry
        // can fix. A failure that fires on a timer and can never succeed
        // trains you to ignore failures, which is how the real one gets
        // missed. Logged and returned instead.
        const message = err instanceof Error ? err.message : "harvest failed";
        console.warn(`[outreach] harvest stood down: ${message}`);
        return { skipped: true, reason: message };
      }
    });
  }
);

/**
 * Outreach dispatch — sends ONE queued message per run, every two hours.
 *
 * The pacing is the point. A burst of messages from one account is what
 * gets flagged, and a domain ban would cost the whole channel permanently,
 * not just this tool. One message every two hours with a hard daily
 * ceiling looks like a person working through their inbox, because at that
 * rate it effectively is one.
 *
 * Two independent brakes, because the expensive failure here is sending
 * too much rather than too little:
 *  - OUTREACH_AUTOSEND must be exactly "true". Unset it and everything
 *    stops immediately with no deploy required.
 *  - DAILY_CAP is counted from rows actually marked sent, so a restart,
 *    a retry or a double-fired cron cannot lift the ceiling.
 */
export const outreachDispatch = inngest.createFunction(
  {
    id: "outreach-dispatch",
    retries: 0, // a retry would risk a duplicate message to a real person
    concurrency: { limit: 1 },
  },
  { cron: "0 */2 * * *" },
  async ({ step }) => {
    return await step.run("send-one", async () => {
      if (process.env.OUTREACH_AUTOSEND !== "true") {
        console.log("[outreach] dispatch skipped — OUTREACH_AUTOSEND is not 'true'");
        return { skipped: true };
      }

      const supabase = createAdminClient();
      const DAILY_CAP = 8;

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: sentToday, error: countErr } = await supabase
        .from("outreach_contacts")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", dayAgo);

      if (countErr) {
        // Cannot prove we are under the cap, so do not send. Failing closed
        // costs one message; failing open costs the account.
        console.warn("[outreach] cap check failed, standing down:", countErr.message);
        return { skipped: true, reason: "cap check failed" };
      }
      if ((sentToday ?? 0) >= DAILY_CAP) {
        console.log(`[outreach] daily cap reached (${sentToday}/${DAILY_CAP})`);
        return { skipped: true, reason: "daily cap" };
      }

      const { data: next } = await supabase
        .from("outreach_contacts")
        .select("id, reddit_username, message_subject, message_body")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!next || !next.message_subject || !next.message_body) {
        return { skipped: true, reason: "queue empty" };
      }

      // Claim the row BEFORE sending. If the send throws, the row is left
      // as 'sending' and never retried, which is the safe direction: a
      // message that may have gone out must not go out twice.
      const { data: claimed } = await supabase
        .from("outreach_contacts")
        .update({ status: "sending" })
        .eq("id", next.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (!claimed) return { skipped: true, reason: "lost the claim" };

      try {
        await redditSendMessage(
          String(next.reddit_username),
          String(next.message_subject),
          String(next.message_body)
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : "send failed";
        await supabase
          .from("outreach_contacts")
          .update({ status: "failed", fail_reason: reason })
          .eq("id", next.id);
        console.warn(`[outreach] send failed for ${next.reddit_username}: ${reason}`);
        return { sent: 0, failed: 1 };
      }

      await supabase
        .from("outreach_contacts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", next.id);

      console.log(`[outreach] sent to ${next.reddit_username} (${(sentToday ?? 0) + 1}/${DAILY_CAP} today)`);
      return { sent: 1, failed: 0 };
    });
  }
);
