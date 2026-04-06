/**
 * lib/limits.ts — subscription plan limits and usage enforcement.
 *
 * PLAN LIMITS:
 *   Free: 1 VOD analysis/month, 5 clips/month
 *   Pro:  20 VOD analyses/month, 20 clips/month
 *
 * HOW USAGE IS COUNTED:
 *   - Analyses: completed VODs (analyzed_at not null) + in-progress VODs
 *     (status = transcribing | analyzing). In-progress are counted to prevent
 *     a race condition where two simultaneous requests both pass the limit check
 *     before either analysis finishes.
 *   - Clips: rows with status = "ready" created this calendar month. Failed/stuck clips never count.
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

export const FREE_LIMITS = {
  analyses_per_month: 1,
  clips_per_month: 5,
};

export const PRO_LIMITS = {
  analyses_per_month: 20,
  clips_per_month: 20,
};

export interface UserUsage {
  plan: "free" | "pro";
  analyses_this_month: number;
  clips_this_month: number;
  can_analyze: boolean;
  can_generate_clip: boolean;
}

export async function getUserUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  // Get plan from profile — also check expiry so lapsed subscriptions auto-downgrade
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_expires_at")
    .eq("id", userId)
    .single();

  const isExpired =
    profile?.plan === "pro" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) < new Date();

  if (isExpired) {
    // Subscription lapsed — downgrade silently so the user can't abuse expired pro access
    await supabase
      .from("profiles")
      .update({ plan: "free", updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  const plan: "free" | "pro" =
    profile?.plan === "pro" && !isExpired ? "pro" : "free";

  const limits = plan === "pro" ? PRO_LIMITS : FREE_LIMITS;

  // Count VODs analyzed this month (completed) + any currently in-progress.
  // Including in-progress prevents a race where multiple simultaneous requests
  // all pass the limit check before any analysis completes.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [{ count: completedThisMonth }, { count: inProgress }] = await Promise.all([
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("analyzed_at", "is", null)
      .gte("analyzed_at", monthStart)
      .lt("analyzed_at", monthEnd),
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["transcribing", "analyzing"]),
  ]);

  // Count only successfully generated clips this month.
  // Failed and stuck clips do not count — users only pay for what they actually received.
  const { count: clipsThisMonth } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  const analyses_this_month = (completedThisMonth ?? 0) + (inProgress ?? 0);
  const clips_this_month = clipsThisMonth ?? 0;

  return {
    plan,
    analyses_this_month,
    clips_this_month,
    can_analyze: analyses_this_month < limits.analyses_per_month,
    can_generate_clip: clips_this_month < limits.clips_per_month,
  };
}
