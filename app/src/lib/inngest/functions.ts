import { inngest } from "./client";
import { downloadTwitchVodAudio } from "@/lib/twitch";
import { transcribeFile } from "@/lib/deepgram";
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
    const { vodId, userId } = event.data as { vodId: string; userId: string };
    const supabase = createAdminClient();

    try {
      // Step 1: Download audio + transcribe in one step — file must exist on disk
      // during transcription so both happen in the same execution context
      const segments = await step.run("download-and-transcribe", async () => {
        const { data: vod } = await supabase
          .from("vods")
          .select("twitch_vod_id")
          .eq("id", vodId)
          .eq("user_id", userId)
          .single();

        if (!vod) throw new Error("VOD not found");
        await supabase.from("vods").update({ status: "transcribing" }).eq("id", vodId);

        const download = await downloadTwitchVodAudio(vod.twitch_vod_id);
        try {
          const result = await transcribeFile(download.filePath);
          if (result.length === 0) throw new Error("No speech detected in VOD — the video may be muted or silent");
          return result;
        } finally {
          await download.cleanup();
        }
      });

      // Step 3: Detect peaks + coach report
      const { peaks, coachReport } = await step.run("analyze", async () => {
        await supabase.from("vods").update({ status: "analyzing" }).eq("id", vodId);

        const { data: vod } = await supabase.from("vods").select("title").eq("id", vodId).single();
        const title = vod?.title || "Stream";

        const peaks = await detectPeaks(segments, title);
        const coachReport = await generateCoachReport(segments, title, peaks);
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
