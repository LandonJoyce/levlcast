/**
 * POST /api/vods/analyze
 *
 * Starts a VOD analysis job. Does NOT run the analysis itself —
 * it validates the request, then fires an Inngest background event.
 * The actual work (transcription + AI) happens in lib/inngest/functions.ts.
 *
 * REQUEST BODY:
 *   { vodId: string, startSeconds?: number, endSeconds?: number }
 *
 * RESPONSES:
 *   200 { ok: true }              — job queued successfully
 *   400 { error: "..." }          — missing/invalid input
 *   401                           — not authenticated
 *   403 { error: "limit_reached", upgrade: true } — plan limit hit
 *   409 { error: "already_analyzed" }             — VOD already done
 */

import { createClientFromRequest } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { inngest } from "@/lib/inngest/client";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 5 analyze requests per hour per user
  if (!rateLimit(`analyze:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_analyze) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: "You've used your 1 free analysis this month. Upgrade to Pro for 20 analyses per month.",
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const { vodId, startSeconds, endSeconds } = await request.json();
  if (!vodId || typeof vodId !== "string") {
    return NextResponse.json({ error: "Missing or invalid vodId" }, { status: 400 });
  }

  // Validate optional time range
  const hasRange = startSeconds !== undefined || endSeconds !== undefined;
  if (hasRange) {
    if (typeof startSeconds !== "number" || typeof endSeconds !== "number") {
      return NextResponse.json({ error: "startSeconds and endSeconds must be numbers" }, { status: 400 });
    }
    if (startSeconds < 0 || endSeconds < 0) {
      return NextResponse.json({ error: "Time values cannot be negative" }, { status: 400 });
    }
    if (endSeconds <= startSeconds) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }
    if (endSeconds - startSeconds < 60) {
      return NextResponse.json({ error: "Range must be at least 1 minute" }, { status: 400 });
    }
  }

  // Free users cannot analyze VODs longer than 2 hours, regardless of range selected.
  // Deepgram transcription costs scale with the full VOD duration — a range selection
  // doesn't reduce the audio we need to stream through Deepgram for accurate timestamps.
  if (usage.plan !== "pro") {
    const { data: vodMeta } = await supabase
      .from("vods")
      .select("duration_seconds")
      .eq("id", vodId)
      .eq("user_id", user.id)
      .single();

    const FREE_MAX_SECONDS = 7200; // 2 hours
    if (vodMeta?.duration_seconds && vodMeta.duration_seconds > FREE_MAX_SECONDS) {
      return NextResponse.json(
        {
          error: "vod_too_long",
          message: "Free accounts can only analyze streams up to 2 hours long. Upgrade to Pro to analyze longer streams.",
          upgrade: true,
        },
        { status: 403 }
      );
    }
  }

  // Atomic status claim — prevents duplicate jobs
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

    if (!existing) return NextResponse.json({ error: "VOD not found" }, { status: 404 });
    if (existing.status === "ready") return NextResponse.json({ error: "VOD already analyzed" }, { status: 409 });
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 });
  }

  // Fire Inngest event — analysis runs in background, no timeout risk
  await inngest.send({
    name: "vod/analyze",
    data: {
      vodId,
      userId: user.id,
      ...(hasRange ? { startSeconds, endSeconds } : {}),
    },
  });

  return NextResponse.json({ queued: true });
}
