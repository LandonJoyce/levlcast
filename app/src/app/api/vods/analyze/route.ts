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

import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { currentWeekStart, getUserUsage } from "@/lib/limits";
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

  const payload = await request.json().catch(() => ({}));
  const usage = await getUserUsage(user.id, supabase);
  const admin = createAdminClient();
  const weekStart = currentWeekStart();

  // A free streamer who has used this week's reports can still analyze one
  // more stream, sealed until Monday (or until they go Pro). It doesn't
  // use a report, so it's limited to one a week.
  let sealedExtra = false;
  if (!usage.can_analyze && usage.on_trial) {
    const { count: extrasThisWeek } = await admin
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("sealed_extra_week", weekStart)
      .in("status", ["transcribing", "analyzing", "ready"]);
    const available = (extrasThisWeek ?? 0) === 0;
    if (available && payload?.sealedExtra === true) {
      sealedExtra = true;
    } else {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: available
            ? "You've used both free reports this week. You can still analyze one more, sealed until Monday."
            : "You've used both free reports and this week's sealed extra. They reset Monday, or Pro gives you 20 a month.",
          upgrade: true,
          on_trial: true,
          sealed_extra_available: available,
        },
        { status: 403 }
      );
    }
  }
  if (!usage.can_analyze && !sealedExtra) {
    let message: string;
    if (usage.on_trial) {
      message = `You've used both free analyses this week. They reset Monday, or Pro gives you 20 a month.`;
    } else if (usage.block_reason === "hours_cap") {
      message = `You've used ${usage.hours_used}h of your ${usage.hours_limit}h monthly analysis budget. Resets at the start of next month.`;
    } else {
      message = `You've used all ${usage.analyses_limit} analyses for this month.`;
    }
    return NextResponse.json(
      {
        error: "limit_reached",
        message,
        // `upgrade: true` for Free users (subscribe path) only. Paid users
        // hitting a count or hour cap get `upgrade: false` so mobile shows
        // an alert with the message instead of routing them to /subscribe
        // (which is meaningless when they already have Pro).
        upgrade: usage.on_trial,
        on_trial: usage.on_trial,
      },
      { status: 403 }
    );
  }

  const { vodId, startSeconds, endSeconds } = payload ?? {};
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

  // Look up the VOD's duration once and run both bounds checks against it.
  // We always check the lower bound (sub-5-min streams produce garbage reports);
  // founding members skip the upper bound only.
  const { data: vodMeta } = await supabase
    .from("vods")
    .select("duration_seconds")
    .eq("id", vodId)
    .eq("user_id", user.id)
    .single();

  // MIN duration — reject anything under 5 minutes. Twitch sometimes auto-saves
  // 0-15 second stubs when a stream aborts immediately. The AI pipeline has no
  // basis to score those and produces hallucinated low-confidence reports that
  // damage credibility and waste user analysis credits. Per
  // feedback_coach_credibility: wrong specifics destroy trust in the whole report.
  const MIN_ANALYZABLE_SECONDS = 300; // 5 minutes
  if (vodMeta?.duration_seconds != null && vodMeta.duration_seconds < MIN_ANALYZABLE_SECONDS) {
    return NextResponse.json(
      {
        error: "vod_too_short",
        message: "This stream is too short to analyze. We need at least 5 minutes of content for a coach report.",
      },
      { status: 400 }
    );
  }

  // MAX duration, for paid plans only; founding members exempt. Free has no
  // cap: a free report coaches the first 2 hours of any stream (the
  // pipeline cuts it, see coachedRange in lib/limits.ts). Pro coaches whole
  // streams up to 8 hours and Pro Plus up to 10, the same caps
  // analyze-by-url enforces.
  if (usage.plan === "pro" && !usage.founding_member) {
    const maxSeconds = usage.pro_plus ? 10 * 60 * 60 : 8 * 60 * 60;
    if (vodMeta?.duration_seconds && vodMeta.duration_seconds > maxSeconds) {
      return NextResponse.json(
        {
          error: "vod_too_long",
          message: usage.pro_plus
            ? "Pro Plus accounts can analyze streams up to 10 hours long."
            : "Pro caps per-stream at 8 hours. Upgrade to Pro Plus for streams up to 10.",
          upgrade: false,
        },
        { status: 403 }
      );
    }
  }

  // Atomic status claim — prevents duplicate jobs. Through the admin
  // client: the browser can't write a stream's status (migration 036).
  const claimedAt = Date.now();
  const { data: claimedVod, error: claimError } = await admin
    .from("vods")
    .update({ status: "transcribing", updated_at: new Date(claimedAt).toISOString() })
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

  // Mark (or clear) the sealed extra before the pipeline can read it. The
  // browser can't write this column, hence the admin client.
  await admin
    .from("vods")
    .update({ sealed_extra_week: sealedExtra ? weekStart : null })
    .eq("id", vodId)
    .eq("user_id", user.id);

  // Fire Inngest event — analysis runs in background, no timeout risk.
  // Idempotency key dedupes double-click / retry storms within 24h so the
  // same VOD can't get billed twice. The claim timestamp is included so a
  // legitimate manual retry of a previously-failed VOD generates a fresh
  // key (each claim flips status, so each claim is a distinct attempt) —
  // without this, retrying within 24h of a playback-token failure silently
  // no-ops because Inngest dedupes against the original send. Range
  // analyses use a range-specific key so partial-segment re-analyses don't
  // collide with the full one.
  const idempotencyId = hasRange
    ? `vod-analyze-${vodId}-${startSeconds}-${endSeconds}-${claimedAt}`
    : `vod-analyze-${vodId}-${claimedAt}`;
  await inngest.send({
    id: idempotencyId,
    name: "vod/analyze",
    data: {
      vodId,
      userId: user.id,
      ...(hasRange ? { startSeconds, endSeconds } : {}),
    },
  });

  return NextResponse.json({ queued: true });
}
