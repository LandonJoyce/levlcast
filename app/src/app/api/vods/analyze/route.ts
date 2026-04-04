import { createClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { inngest } from "@/lib/inngest/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
