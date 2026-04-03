import { inngest } from "./client";
import { getTwitchVodAudioUrl } from "@/lib/twitch";
import { transcribeFromUrl } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { createAdminClient } from "@/lib/supabase/server";

export const analyzeVod = inngest.createFunction(
  {
    id: "analyze-vod",
    retries: 1,
    timeouts: { finish: "30m" },
  },
  { event: "vod/analyze" },
  async ({ event, step }) => {
    const { vodId, userId } = event.data as { vodId: string; userId: string };
    const supabase = createAdminClient();

    // Step 1: Get Twitch audio URL (no download)
    const audioUrl = await step.run("get-audio-url", async () => {
      const { data: vod } = await supabase
        .from("vods")
        .select("twitch_vod_id")
        .eq("id", vodId)
        .eq("user_id", userId)
        .single();

      if (!vod) throw new Error("VOD not found");
      return getTwitchVodAudioUrl(vod.twitch_vod_id);
    });

    // Step 2: Transcribe via Deepgram URL (no file download)
    const segments = await step.run("transcribe", async () => {
      await supabase.from("vods").update({ status: "transcribing" }).eq("id", vodId);
      const result = await transcribeFromUrl(audioUrl);
      if (result.length === 0) throw new Error("No speech detected in video");
      return result;
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
  }
);
