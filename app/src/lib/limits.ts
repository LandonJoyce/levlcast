/**
 * lib/limits.ts — subscription plan limits and usage enforcement.
 *
 * PLAN LIMITS:
 *   Free trial:     2 VOD analyses + 5 clips LIFETIME (one-time, per Twitch ID)
 *   Pro:            15 VOD analyses/month, 20 clips/month — $14.99/mo (was $9.99 founding through 2026-06-03)
 *   Founding (20/20): grandfathered users who subscribed before the limit drop;
 *                    all $9.99 subscribers keep their original rate via Stripe.
 *
 * FREE TRIAL — BYPASS-PROOF:
 *   Free users do not get a monthly refresh. They get 2 analyses + 5 clips,
 *   ever. Counters live in the trial_records table keyed by twitch_id, not
 *   by profile.id, so deleting and re-creating a Supabase account with the
 *   same Twitch login does NOT reset the trial. RLS on trial_records blocks
 *   all client access — only the service-role admin client increments it
 *   from server-side success handlers (Inngest analyze + clip-success).
 *
 * HOW USAGE IS COUNTED:
 *   Pro / Founding (monthly):
 *     - Analyses: completed VODs (analyzed_at not null) + in-progress VODs
 *       (status = transcribing | analyzing). In-progress are counted to prevent
 *       a race condition where two simultaneous requests both pass the limit
 *       check before either finishes.
 *     - Clips: rows with status = "ready" or "deleted" created this calendar
 *       month. Failed/processing clips do not count.
 *   Free trial (lifetime):
 *     - Both counters read directly from trial_records.{analyses_used, clips_used}.
 *     - Increment from incrementTrialAnalysis() / incrementTrialClip() —
 *       admin-client only. NEVER call from client code.
 *
 * HOW PLAN IS DETERMINED:
 *   getUserUsage() reads the profile's plan field, then checks subscription_expires_at.
 *   If a Pro subscription has lapsed, it auto-downgrades the user to Free silently.
 *
 * USAGE:
 *   const usage = await getUserUsage(userId, supabase);
 *   if (!usage.can_analyze) return { error: "limit_reached" };
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";

export const FREE_TRIAL_LIMITS = {
  // Dropped from 3 to 2 on 2026-06-05. Rationale: with 3, free users had
  // enough data to self-coach across multiple reports and never hit the
  // moment where the cross-stream pitch lands. At 2, their second report
  // renders with LastStreamRecap and Score Trajectory both locked +
  // blurred in-place — the strongest conversion moment in the product.
  // Clips stay at 5 (essentially free on R2, no reason to gate).
  analyses_lifetime: 2,
  clips_lifetime: 5,
};

export const PRO_LIMITS = {
  analyses_per_month: 15,
  clips_per_month: 20,
  // Hour cap added 2026-05-18 to protect margin on heavy 8h-stream users.
  // Math at $14.99 price (post 2026-06-03): 20h × $0.25 blended (Deepgram +
  // Claude, post chunking fix) = $5 analysis cost + ~$2 fixed = $7. Leaves
  // ~$8 margin even at max usage. Average user (8-12h/mo) won't notice.
  // Grandfathered $9.99 subs still net ~$1-3 margin at the cap.
  hours_per_month: 20,
};

// Founding members subscribed before the Pro limit was dropped to 15/20 and
// keep the original 20/20 cap permanently as a thank-you for early support.
export const FOUNDING_LIMITS = {
  analyses_per_month: 20,
  clips_per_month: 20,
  // Small thanks-bonus on hours too: 5 more than standard Pro. Slight loss
  // at absolute max usage but founding LTV plays make up for it.
  hours_per_month: 25,
};

// Pro Plus tier — $29.99/mo. For power users who hit the Pro 20h cap.
// Hour cap dropped from 60h → 50h on 2026-05-28 to guarantee at least
// $5 margin per user even at worst-case blended cost ($0.50/hour).
// Math at max usage: 50h × $0.30 blended (post-chunking-fix) = $15 +
// 35 clips × ~$0.02 = $0.70 + $2 fixed = $17.70 against $29.99 revenue
// = ~$12 margin in the realistic case. Worst case ($0.50/hr): 50h × $0.50
// = $25 cost, $4.99 margin floor.
// Average user (~30h, 15 clips) costs ~$11 = healthy 60% margin.
// NOT eligible for partner discount codes (CHRYSTA20 etc.) — those apply
// to standard Pro only, set in the Stripe coupon's product scope.
export const PRO_PLUS_LIMITS = {
  analyses_per_month: 35,
  clips_per_month: 35,
  hours_per_month: 50,
};

// Kept for backwards-compatible imports — semantically the *trial* limits now.
export const FREE_LIMITS = {
  analyses_per_month: FREE_TRIAL_LIMITS.analyses_lifetime,
  clips_per_month: FREE_TRIAL_LIMITS.clips_lifetime,
};

export interface UserUsage {
  plan: "free" | "pro";
  founding_member: boolean;
  /** Pro Plus tier — $29.99/mo with 35/60/35 limits. Mutually beneficial with founding_member. */
  pro_plus: boolean;
  /** True for free users — they're on the lifetime trial, not a monthly free tier. */
  on_trial: boolean;
  /** Used count for the active period (this month for Pro, lifetime for trial). */
  analyses_used: number;
  clips_used: number;
  /** Limit for the active period. */
  analyses_limit: number;
  clips_limit: number;
  can_analyze: boolean;
  can_generate_clip: boolean;
  /** UI label for the period — "this month" (Pro) or "ever" (trial). */
  period_label: string;

  // BACKWARDS-COMPAT — same numeric value as analyses_used / clips_used.
  // Existing callers used these names; left in place to avoid a wide refactor.
  analyses_this_month: number;
  clips_this_month: number;

  // Hour-based cap (Pro / Founding only). Free trial uses count-only since
  // they get 2 analyses lifetime and the per-analysis 4h cap is enough.
  // hours_used = sum of duration_seconds (in hours) for completed-this-month
  // + currently-in-progress VODs. hours_limit = 0 for free users.
  hours_used: number;
  hours_limit: number;
  /** True iff the user has BOTH count AND hour budget left. Mirrors can_analyze. */
  can_analyze_count: boolean;
  can_analyze_hours: boolean;
  /** Reason can_analyze is false, when applicable. */
  block_reason: "count_cap" | "hours_cap" | null;
}

export async function getUserUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  // Get plan from profile — also check expiry so lapsed subscriptions auto-downgrade
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_expires_at, founding_member, pro_plus, twitch_id")
    .eq("id", userId)
    .single();

  const isExpired =
    profile?.plan === "pro" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) < new Date();

  if (isExpired) {
    // Subscription lapsed — downgrade silently. The extra .eq("plan", "pro") makes this
    // a conditional update so concurrent requests can't race each other into inconsistent state.
    await supabase
      .from("profiles")
      .update({ plan: "free", updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("plan", "pro");
  }

  const plan: "free" | "pro" =
    profile?.plan === "pro" && !isExpired ? "pro" : "free";

  const isFoundingMember = profile?.founding_member === true;

  // ─── FREE TRIAL PATH ──────────────────────────────────────────────────
  // Read lifetime counters from trial_records keyed by twitch_id. Use the
  // admin client because RLS blocks all anon/auth access to trial_records
  // (intentionally — counters must not be reachable from the browser).
  if (plan === "free") {
    const twitchId = profile?.twitch_id as string | undefined;
    let analysesUsed = 0;
    let clipsUsed = 0;

    if (twitchId) {
      const admin = createAdminClient();
      const { data: trial } = await admin
        .from("trial_records")
        .select("analyses_used, clips_used")
        .eq("twitch_id", twitchId)
        .maybeSingle();
      analysesUsed = trial?.analyses_used ?? 0;
      clipsUsed = trial?.clips_used ?? 0;
    }

    const limit = FREE_TRIAL_LIMITS;
    const canAnalyzeCount = analysesUsed < limit.analyses_lifetime;
    return {
      plan: "free",
      founding_member: false,
      pro_plus: false,
      on_trial: true,
      analyses_used: analysesUsed,
      clips_used: clipsUsed,
      analyses_limit: limit.analyses_lifetime,
      clips_limit: limit.clips_lifetime,
      can_analyze: canAnalyzeCount,
      can_generate_clip: clipsUsed < limit.clips_lifetime,
      period_label: "ever",
      analyses_this_month: analysesUsed,
      clips_this_month: clipsUsed,
      // Free trial uses count-only — the per-analysis 4h cap already
      // bounds total hours to ~12 lifetime, no separate hour cap needed.
      hours_used: 0,
      hours_limit: 0,
      can_analyze_count: canAnalyzeCount,
      can_analyze_hours: true,
      block_reason: canAnalyzeCount ? null : "count_cap",
    };
  }

  // ─── PRO / FOUNDING / PRO PLUS (monthly) ──────────────────────────────
  // Priority: pro_plus wins (they're paying $29.99 for the higher tier),
  // then founding_member (grandfathered 20/20), else standard Pro.
  const isProPlus = profile?.pro_plus === true;
  const monthlyLimits = isProPlus
    ? PRO_PLUS_LIMITS
    : isFoundingMember
    ? FOUNDING_LIMITS
    : PRO_LIMITS;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // Primary: count from usage_logs — tamper-proof because only the admin
  // client (Inngest) writes to it. Deleting or re-syncing VODs has no effect.
  // Also pull duration_seconds for completed + in-progress VODs to compute
  // the monthly hour count (separate cap from raw analysis count).
  const [
    { data: usageLog },
    { data: completedVods },
    { data: inProgressVods },
  ] = await Promise.all([
    supabase
      .from("usage_logs")
      .select("analyses_count")
      .eq("user_id", userId)
      .eq("month", month)
      .single(),
    supabase
      .from("vods")
      .select("duration_seconds")
      .eq("user_id", userId)
      .eq("status", "ready")
      .gte("analyzed_at", monthStart)
      .lt("analyzed_at", monthEnd),
    supabase
      .from("vods")
      .select("duration_seconds")
      .eq("user_id", userId)
      .in("status", ["transcribing", "analyzing"]),
  ]);

  const completedThisMonth = usageLog?.analyses_count ?? 0;
  const inProgress = inProgressVods?.length ?? 0;

  // Hours used = sum of (duration_seconds) for completed-this-month + in-progress.
  // Same accounting model as the analyses count — in-progress counts so two
  // simultaneous long analyses can't both squeak past the cap.
  const completedSeconds = (completedVods ?? []).reduce(
    (sum, v) => sum + ((v.duration_seconds as number | null) ?? 0),
    0
  );
  const inProgressSeconds = (inProgressVods ?? []).reduce(
    (sum, v) => sum + ((v.duration_seconds as number | null) ?? 0),
    0
  );
  const hoursUsed = (completedSeconds + inProgressSeconds) / 3600;

  // Count clips generated this month — includes deleted ones so users can't
  // bypass the limit by deleting clips and regenerating them.
  const { count: clipsThisMonth } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["ready", "deleted"])
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  const analyses_used = completedThisMonth + inProgress;
  const clips_used = clipsThisMonth ?? 0;

  const canAnalyzeCount = analyses_used < monthlyLimits.analyses_per_month;
  const canAnalyzeHours = hoursUsed < monthlyLimits.hours_per_month;
  const canAnalyze = canAnalyzeCount && canAnalyzeHours;
  const blockReason: UserUsage["block_reason"] = canAnalyze
    ? null
    : !canAnalyzeCount ? "count_cap" : "hours_cap";

  return {
    plan: "pro",
    founding_member: isFoundingMember,
    pro_plus: isProPlus,
    on_trial: false,
    analyses_used,
    clips_used,
    analyses_limit: monthlyLimits.analyses_per_month,
    clips_limit: monthlyLimits.clips_per_month,
    can_analyze: canAnalyze,
    can_generate_clip: clips_used < monthlyLimits.clips_per_month,
    period_label: "this month",
    analyses_this_month: analyses_used,
    clips_this_month: clips_used,
    hours_used: Math.round(hoursUsed * 10) / 10, // round to 1 decimal for UI
    hours_limit: monthlyLimits.hours_per_month,
    can_analyze_count: canAnalyzeCount,
    can_analyze_hours: canAnalyzeHours,
    block_reason: blockReason,
  };
}

/**
 * Increment the trial analyses counter for a Twitch user.
 *
 * MUST be called from the server (Inngest analyze success handler) using the
 * admin client. RLS blocks anon/auth callers entirely.
 *
 * Idempotency: callers should ensure they invoke this once per analyzed VOD.
 * The Inngest function already has at-most-once semantics for the success
 * branch via the atomic vod status update.
 */
export async function incrementTrialAnalysis(twitchId: string): Promise<void> {
  if (!twitchId) return;
  const admin = createAdminClient();
  // Upsert + increment via SQL function. Plain JS upsert can't atomically
  // increment, so we use rpc. If the rpc isn't deployed yet, fall back to
  // a read-then-write (still safe under low concurrency since only Inngest
  // increments analyses).
  const { error } = await admin.rpc("trial_record_increment", {
    p_twitch_id: twitchId,
    p_analyses: 1,
    p_clips: 0,
  });
  if (error) {
    console.warn("[limits] trial_record_increment rpc failed, falling back to read-modify-write:", error.message);
    const { data: existing } = await admin
      .from("trial_records")
      .select("analyses_used, clips_used")
      .eq("twitch_id", twitchId)
      .maybeSingle();
    await admin
      .from("trial_records")
      .upsert({
        twitch_id: twitchId,
        analyses_used: (existing?.analyses_used ?? 0) + 1,
        clips_used: existing?.clips_used ?? 0,
        last_used_at: new Date().toISOString(),
      });
  }
}

/**
 * Increment the trial clips counter for a Twitch user.
 *
 * Called from the clip-success handler (or before generation in the route to
 * prevent burst exploits). One increment per clip — highlight reels count
 * as a single clip even though they stitch multiple moments.
 */
export async function incrementTrialClip(twitchId: string): Promise<void> {
  if (!twitchId) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("trial_record_increment", {
    p_twitch_id: twitchId,
    p_analyses: 0,
    p_clips: 1,
  });
  if (error) {
    console.warn("[limits] trial_record_increment rpc failed, falling back to read-modify-write:", error.message);
    const { data: existing } = await admin
      .from("trial_records")
      .select("analyses_used, clips_used")
      .eq("twitch_id", twitchId)
      .maybeSingle();
    await admin
      .from("trial_records")
      .upsert({
        twitch_id: twitchId,
        analyses_used: existing?.analyses_used ?? 0,
        clips_used: (existing?.clips_used ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      });
  }
}

/**
 * Resolve a user's twitch_id from their auth user id. Used by callers that
 * have only the userId on hand (e.g. Inngest functions starting from event data).
 */
export async function getTwitchIdForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("twitch_id")
    .eq("id", userId)
    .single();
  return (data?.twitch_id as string | undefined) ?? null;
}
