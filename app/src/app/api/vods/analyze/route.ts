import { createClient } from "@/lib/supabase/server";
import { downloadTwitchVodAudio } from "@/lib/twitch";
import { transcribeFile } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { getUserUsage } from "@/lib/limits";
import { NextResponse } from "next/server";

/**
 * POST /api/vods/analyze
 * Body: { vodId: string }
 * Transcribes a VOD and detects peak moments using AI.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check plan limits before starting — fails fast before any expensive work
  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_analyze) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: "You've used your 1 free analysis this month. Upgrade to Pro for unlimited.",
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const { vodId } = await request.json();
  if (!vodId || typeof vodId !== "string") {
    return NextResponse.json({ error: "Missing or invalid vodId" }, { status: 400 });
  }

  // Atomic status claim — only proceeds if VOD is pending or failed.
  // Prevents race conditions where two requests both pass the limit check.
  const { data: claimedVod, error: claimError } = await supabase
    .from("vods")
    .update({ status: "transcribing" })
    .eq("id", vodId)
    .eq("user_id", user.id)
    .in("status", ["pending", "failed"])
    .select()
    .single();

  if (claimError || !claimedVod) {
    const { data: existing } = await supabase
      .from("vods")
      .select("status")
      .eq("id", vodId)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "VOD not found" }, { status: 404 });
    }
    if (existing.status === "ready") {
      return NextResponse.json({ error: "VOD already analyzed" }, { status: 409 });
    }
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 });
  }

  const vod = claimedVod;
  let cleanup: (() => Promise<void>) | null = null;

  try {
    // Download VOD to disk — streams segments to a temp file, no memory buffer
    const download = await downloadTwitchVodAudio(vod.twitch_vod_id);
    cleanup = download.cleanup;
    console.log("[analyze] VOD downloaded to disk:", download.filePath);

    // Step 1: Transcribe from file path — streams to Deepgram, no buffer
    const segments = await transcribeFile(download.filePath);

    if (segments.length === 0) {
      await supabase.from("vods").update({ status: "failed" }).eq("id", vodId);
      return NextResponse.json({ error: "No speech detected in video" }, { status: 422 });
    }

    console.log("[analyze] Transcription done:", segments.length, "segments");

    await supabase.from("vods").update({ status: "analyzing" }).eq("id", vodId);

    // Step 2: Detect peaks with Claude
    const peaks = await detectPeaks(segments, vod.title);
    console.log("[analyze] Peaks detected:", peaks.length);

    // Step 3: Generate coach report with Claude Sonnet
    const coachReport = await generateCoachReport(segments, vod.title, peaks);

    // Step 4: Save results
    await supabase
      .from("vods")
      .update({
        status: "ready",
        peak_data: peaks,
        coach_report: coachReport,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", vodId);

    return NextResponse.json({ peaks: peaks.length, segments: segments.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analysis failed:", message);
    await supabase.from("vods").update({ status: "failed" }).eq("id", vodId);
    return NextResponse.json({ error: "Analysis failed", detail: message }, { status: 500 });
  } finally {
    // Always clean up the temp file — even if analysis fails
    if (cleanup) await cleanup();
  }
}
