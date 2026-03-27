import { createClient, createAdminClient } from "@/lib/supabase/server";
import { downloadTwitchVodAudio } from "@/lib/twitch";
import { cutClip } from "@/lib/ffmpeg";
import { getUserUsage } from "@/lib/limits";
import { NextResponse } from "next/server";

/**
 * POST /api/clips/generate
 * Body: { vodId, peakIndex } — generates an mp4 clip from a detected peak.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check plan limits before generating clip
  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_generate_clip) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: "You've reached the 5 clip limit on the free plan. Upgrade to Pro for unlimited clips.",
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const { vodId, peakIndex } = await request.json();

  if (!vodId || peakIndex === undefined) {
    return NextResponse.json({ error: "Missing vodId or peakIndex" }, { status: 400 });
  }

  // Get the VOD with peak data
  const { data: vod } = await supabase
    .from("vods")
    .select("*")
    .eq("id", vodId)
    .eq("user_id", user.id)
    .single();

  if (!vod || !vod.peak_data) {
    return NextResponse.json({ error: "VOD not found or not analyzed" }, { status: 404 });
  }

  const peaks = vod.peak_data as Array<{
    title: string;
    start: number;
    end: number;
    score: number;
    category: string;
    reason: string;
    caption: string;
  }>;

  const peak = peaks[peakIndex];
  if (!peak) {
    return NextResponse.json({ error: "Peak not found" }, { status: 404 });
  }

  try {
    console.log(`[clip] Downloading VOD ${vod.twitch_vod_id} for clip "${peak.title}"`);

    // Download the video
    const videoBuffer = await downloadTwitchVodAudio(vod.twitch_vod_id);

    console.log(`[clip] Cutting clip: ${peak.start}s - ${peak.end}s`);

    // Cut the clip
    const clipBuffer = await cutClip(videoBuffer, peak.start, peak.end);

    console.log(`[clip] Clip generated: ${clipBuffer.length} bytes`);

    // Upload to Supabase Storage
    const admin = createAdminClient();

    // Ensure the clips bucket exists (ignore error if already exists)
    await admin.storage.createBucket("clips", {
      public: true,
      fileSizeLimit: 104857600,
    }).catch(() => {});
    console.log("[clip] Bucket check done");

    const fileName = `${user.id}/${vod.id}-peak${peakIndex}-${Date.now()}.mp4`;

    const { error: uploadError } = await admin.storage
      .from("clips")
      .upload(fileName, clipBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: urlData } = admin.storage
      .from("clips")
      .getPublicUrl(fileName);

    // Insert clip record
    const { error: insertError } = await supabase.from("clips").insert({
      user_id: user.id,
      vod_id: vodId,
      title: peak.title,
      description: peak.reason,
      start_time_seconds: Math.round(peak.start),
      end_time_seconds: Math.round(peak.end),
      video_url: urlData.publicUrl,
      caption_text: peak.caption,
      peak_score: peak.score,
      peak_category: peak.category,
      peak_reason: peak.reason,
      status: "ready",
    });

    if (insertError) {
      throw new Error(`Clip record insert failed: ${insertError.message}`);
    }

    console.log(`[clip] Clip saved: "${peak.title}"`);

    return NextResponse.json({
      success: true,
      title: peak.title,
      url: urlData.publicUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[clip] Generation failed:", message);
    return NextResponse.json(
      { error: "Clip generation failed", detail: message },
      { status: 500 }
    );
  }
}
