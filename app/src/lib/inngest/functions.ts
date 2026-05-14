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
import { getTwitchVodSegmentList, streamSegmentsToPassThrough, downloadTwitchVodVideo, fetchTwitchVods, fetchTwitchVodChat, getAppAccessToken, mapVodToRow, refreshTwitchToken, TwitchAuthError } from "@/lib/twitch";
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
import { buildUserProfile, scoreMatch, findExternalStreamers } from "@/lib/collab";
import { sendActivationEmail, sendVodReadyEmail, sendNewVodEmail, sendClipReadyEmail } from "@/lib/email";
import { sendWebPush } from "@/lib/web-push";
import { generateCoachingArc } from "@/lib/coaching-arc";
import { incrementTrialAnalysis, incrementTrialClip, FREE_TRIAL_LIMITS, FOUNDING_LIMITS, PRO_LIMITS } from "@/lib/limits";

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
          .select("twitch_vod_id, title, duration_seconds")
          .eq("id", vodId)
          .eq("user_id", userId)
          .single();

        if (!vod) throw new Error("VOD not found");
        console.log(`[analyze] VOD: "${vod.title}" twitch_id=${vod.twitch_vod_id} duration=${vod.duration_seconds}s`);
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
          keywords,
          gameCategory: detection.category,
          duration_seconds: vod.duration_seconds as number | null,
        };
      });

      // Split into 15-minute chunks so each Inngest step completes well within
      // Vercel's 10-minute function invocation limit. A single-chunk VOD (<15 min)
      // behaves identically to the old single-step approach.
      const CHUNK_SECONDS = 1200;
      const chunks: Array<{ urls: string[]; timeOffset: number }> = [];
      {
        let chunkUrls: string[] = [];
        let chunkStartIdx = 0;
        for (let i = 0; i < segmentSetup.urls.length; i++) {
          chunkUrls.push(segmentSetup.urls[i]);
          const nextStart = i + 1 < segmentSetup.startTimes.length
            ? segmentSetup.startTimes[i + 1]
            : segmentSetup.startTimes[i] + 10;
          const chunkDuration = nextStart - segmentSetup.startTimes[chunkStartIdx];
          if (chunkDuration >= CHUNK_SECONDS || i === segmentSetup.urls.length - 1) {
            chunks.push({ urls: [...chunkUrls], timeOffset: segmentSetup.startTimes[chunkStartIdx] });
            chunkStartIdx = i + 1;
            chunkUrls = [];
          }
        }
      }
      console.log(`[analyze] ${chunks.length} transcription chunks for ${segmentSetup.urls.length} segments`);

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
            step.run(`transcribe-chunk-${index}`, async () => {
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
        if (merged.length === 0) throw new Error("No speech detected in VOD. The video may be muted or silent.");

        // Validate coverage — if the last word ends suspiciously early the audio
        // stream was likely truncated, which would shift all subsequent caption timestamps.
        const vodDuration = segmentSetup.duration_seconds ?? 0;
        const lastWordEnd = allWords.length > 0 ? allWords[allWords.length - 1].end : 0;
        if (vodDuration > 120 && lastWordEnd > 0 && lastWordEnd < vodDuration * 0.5) {
          throw new Error(
            `Transcript covers only ${Math.round(lastWordEnd)}s of a ${Math.round(vodDuration)}s VOD — ` +
            `audio stream may have been truncated. Please retry; if it persists, the VOD source is incomplete.`
          );
        }
        if (vodDuration > 0 && lastWordEnd > 0 && lastWordEnd < vodDuration * 0.85) {
          console.warn(
            `[analyze] Transcript ends at ${Math.round(lastWordEnd)}s but VOD is ${Math.round(vodDuration)}s ` +
            `(${Math.round((lastWordEnd / vodDuration) * 100)}% coverage). Captions for late moments may be absent`
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
        const pulseText = formatPulseForPrompt(vod?.chat_pulse as ChatBucket[] | null | undefined);

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
        const report = await generateCoachReport(filtered, title, peaks, priorReports.length > 0 ? priorReports : undefined, pulseText || undefined);
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
        // requests, etc.). Free users hit the lifetime trial cap; Pro/founding
        // hit a monthly cap. Both are read from the same tamper-proof tables
        // the user-facing limits.ts uses.
        if (plan === "free") {
          const twitchId = profile?.twitch_id as string | undefined;
          let analysesUsed = 0;
          if (twitchId) {
            const { data: trial } = await supabase
              .from("trial_records")
              .select("analyses_used")
              .eq("twitch_id", twitchId)
              .maybeSingle();
            analysesUsed = trial?.analyses_used ?? 0;
          }
          if (analysesUsed >= FREE_TRIAL_LIMITS.analyses_lifetime) {
            await supabase.from("vods").update({
              status: "failed",
              failed_reason: `You've used all ${FREE_TRIAL_LIMITS.analyses_lifetime} free analyses. Subscribe to keep analyzing streams.`,
            }).eq("id", vodId);
            console.warn(`[inngest] analyze-vod blocked at save — user ${userId} on free trial already used ${analysesUsed}/${FREE_TRIAL_LIMITS.analyses_lifetime}`);
            return;
          }

          await supabase.from("vods").update({
            status: "ready",
            peak_data: peaks,
            coach_report: coachReport,
            analyzed_at: now.toISOString(),
          }).eq("id", vodId);

          if (twitchId) {
            await incrementTrialAnalysis(twitchId);
          }
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
              .select("clips_used")
              .eq("twitch_id", twitchId)
              .maybeSingle();
            clipsUsed = trial?.clips_used ?? 0;
          }
          if (clipsUsed >= FREE_TRIAL_LIMITS.clips_lifetime) {
            console.log(`[analyze] Auto-generate skipped — trial clip limit reached (${clipsUsed}/${FREE_TRIAL_LIMITS.clips_lifetime})`);
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
          ? (burnout.score <= 25 ? "You're in good shape this week." : burnout.score <= 45 ? "A few minor signals, nothing concerning." : "Some fatigue signals. Check your Health card.")
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

          const rows = newVods.map((v) => mapVodToRow(v, profile.id));
          const { error: insertError } = await supabase.from("vods").insert(rows);
          if (insertError) {
            console.error(`[auto-sync] Insert failed for ${profile.id.slice(0, 8)}:`, insertError.message);
            continue;
          }
          totalSynced += newVods.length;

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
