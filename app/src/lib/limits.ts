/**
 * lib/limits.ts — subscription plan limits and usage enforcement.
 *
 * PLAN LIMITS:
 *   Free trial:     3 VOD analyses + 5 clips LIFETIME (one-time, per Twitch ID)
 *   Pro:            15 VOD analyses/month, 20 clips/month — $9.99/mo founding price
 *   Founding (20/20): grandfathered users who subscribed before the limit drop
 *
 * FREE TRIAL — BYPASS-PROOF:
 *   Free users do not get a monthly refresh. They get 3 analyses + 5 clips,
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
  analyses_lifetime: 3,
  clips_lifetime: 5,
};

export const PRO_LIMITS = {
  analyses_per_month: 15,
  clips_per_month: 20,
};

// Founding members subscribed before the Pro limit was dropped to 15/20 and
// keep the original 20/20 cap permanently as a thank-you for early support.
export const FOUNDING_LIMITS = {
  analyses_per_month: 20,
  clips_per_month: 20,
};

// Kept for backwards-compatible imports — semantically the *trial* limits now.
export const FREE_LIMITS = {
  analyses_per_month: FREE_TRIAL_LIMITS.analyses_lifetime,
  clips_per_month: FREE_TRIAL_LIMITS.clips_lifetime,
};

export interface UserUsage {
  plan: "free" | "pro";
  founding_member: boolean;
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
}

export async function getUserUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  // Get plan from profile — also check expiry so lapsed subscriptions auto-downgrade
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_expires_at, founding_member, twitch_id")
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
    return {
      plan: "free",
      founding_member: false,
      on_trial: true,
      analyses_used: analysesUsed,
      clips_used: clipsUsed,
      analyses_limit: limit.analyses_lifetime,
      clips_limit: limit.clips_lifetime,
      can_analyze: analysesUsed < limit.analyses_lifetime,
      can_generate_clip: clipsUsed < limit.clips_lifetime,
      period_label: "ever",
      analyses_this_month: analysesUsed,
      clips_this_month: clipsUsed,
    };
  }

  // ─── PRO / FOUNDING (monthly) ─────────────────────────────────────────
  const monthlyLimits = isFoundingMember ? FOUNDING_LIMITS : PRO_LIMITS;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // Primary: count from usage_logs — tamper-proof because only the admin
  // client (Inngest) writes to it. Deleting or re-syncing VODs has no effect.
  const [{ data: usageLog }, { count: inProgress }] = await Promise.all([
    supabase
      .from("usage_logs")
      .select("analyses_count")
      .eq("user_id", userId)
      .eq("month", month)
      .single(),
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["transcribing", "analyzing"]),
  ]);

  const completedThisMonth = usageLog?.analyses_count ?? 0;

  // Count clips generated this month — includes deleted ones so users can't
  // bypass the limit by deleting clips and regenerating them.
  const { count: clipsThisMonth } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["ready", "deleted"])
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  const analyses_used = completedThisMonth + (inProgress ?? 0);
  const clips_used = clipsThisMonth ?? 0;

  return {
    plan: "pro",
    founding_member: isFoundingMember,
    on_trial: false,
    analyses_used,
    clips_used,
    analyses_limit: monthlyLimits.analyses_per_month,
    clips_limit: monthlyLimits.clips_per_month,
    can_analyze: analyses_used < monthlyLimits.analyses_per_month,
    can_generate_clip: clips_used < monthlyLimits.clips_per_month,
    period_label: "this month",
    analyses_this_month: analyses_used,
    clips_this_month: clips_used,
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
