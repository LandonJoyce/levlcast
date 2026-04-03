import { createClient } from "@/lib/supabase/server";
import { downloadTwitchVodAudio } from "@/lib/twitch";
import { transcribeBuffer } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { getUserUsage } from "@/lib/limits";
import { NextResponse } from "next/server";
import { z } from "zod";

const analyzeSchema = z.object({
  vodId: z.string().uuid(),
});

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

  // Check plan limits before starting analysis
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

  const body = analyzeSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request", detail: body.error.flatten() }, { status: 400 });
  }
  const { vodId } = body.data;

  // Atomic check: only allow analyzing if status is 'pending' or 'failed'
  // This prevents re-analysis of already-ready VODs and race conditions from
  // simultaneous requests both passing the limit check
  const { data: claimedVod, error: claimError } = await supabase
    .from("vods")
    .update({ status: "transcribing" })
    .eq("id", vodId)
    .eq("user_id", user.id)
    .in("status", ["pending", "failed"])
    .select()
    .single();

  if (claimError || !claimedVod) {
    // Either VOD not found, doesn't belong to user, or already being/been analyzed
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

  try {
    // Download the actual video audio data
    const audioBuffer = await downloadTwitchVodAudio(vod.twitch_vod_id);
    console.log("[analyze] Audio downloaded for VOD:", vod.twitch_vod_id, "size:", audioBuffer.length);

    // Step 1: Transcribe with Deepgram
    const segments = await transcribeBuffer(audioBuffer);

    if (segments.length === 0) {
      await supabase.from("vods").update({ status: "failed" }).eq("id", vodId);
      return NextResponse.json(
        { error: "No speech detected in video" },
        { status: 422 }
      );
    }

    console.log("[analyze] Transcription done:", segments.length, "segments");

    // Update status to analyzing
    await supabase
      .from("vods")
      .update({ status: "analyzing" })
      .eq("id", vodId);

    // Step 2: Detect peaks with Claude
    const peaks = await detectPeaks(segments, vod.title);

    console.log("[analyze] Peaks detected:", peaks.length);

    // Step 3: Generate coach report
    const coachReport = await generateCoachReport(segments, vod.title, peaks);

    // Step 4: Save results — set analyzed_at to now so monthly limit counts correctly
    await supabase
      .from("vods")
      .update({
        status: "ready",
        peak_data: peaks,
        coach_report: coachReport,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", vodId);

    return NextResponse.json({
      peaks: peaks.length,
      segments: segments.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analysis failed:", message);

    await supabase.from("vods").update({ status: "failed" }).eq("id", vodId);

    return NextResponse.json(
      { error: "Analysis failed", detail: message },
      { status: 500 }
    );
  }
}
