import { inngest } from "./client";
import { streamTwitchVodAudio } from "@/lib/twitch";
import { transcribePassThrough } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { createAdminClient } from "@/lib/supabase/server";

export const analyzeVod = inngest.createFunction(
  {
    id: "analyze-vod",
    retries: 1,
    timeouts: { finish: "2h" },
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

      // Step 4: Save results
      await step.run("save", async () => {
        await supabase.from("vods").update({
          status: "ready",
          peak_data: peaks,
          coach_report: coachReport,
          analyzed_at: new Date().toISOString(),
        }).eq("id", vodId);
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
