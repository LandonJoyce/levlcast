import { createClient } from "@/lib/supabase/server";
import { downloadTwitchVodAudio } from "@/lib/twitch";
import { transcribeBuffer } from "@/lib/deepgram";
import { detectPeaks } from "@/lib/analyze";
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

  const { vodId } = await request.json();
  if (!vodId) {
    return NextResponse.json({ error: "Missing vodId" }, { status: 400 });
  }

  // Get the VOD
  const { data: vod, error: vodError } = await supabase
    .from("vods")
    .select("*")
    .eq("id", vodId)
    .eq("user_id", user.id)
    .single();

  if (vodError || !vod) {
    return NextResponse.json({ error: "VOD not found" }, { status: 404 });
  }

  // Update status to transcribing
  await supabase
    .from("vods")
    .update({ status: "transcribing" })
    .eq("id", vodId);

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

    // Step 3: Save results
    await supabase
      .from("vods")
      .update({
        status: "ready",
        peak_data: peaks,
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
