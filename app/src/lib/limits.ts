/**
 * Plan limits and usage checking for LevlCast subscription system.
 */

export const FREE_LIMITS = {
  analyses_per_month: 1,
  clips_total: 5,
};

export const PRO_LIMITS = {
  analyses_per_month: 10,
  clips_total: 999,
};

export interface UserUsage {
  plan: "free" | "pro";
  analyses_this_month: number;
  clips_total: number;
  can_analyze: boolean;
  can_generate_clip: boolean;
}

export async function getUserUsage(
  userId: string,
  supabase: any
): Promise<UserUsage> {
  // Get plan from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan: "free" | "pro" =
    profile?.plan === "pro" ? "pro" : "free";

  const limits = plan === "pro" ? PRO_LIMITS : FREE_LIMITS;

  // Count VODs analyzed this month by analyzed_at (set when analysis completes)
  // Using analyzed_at prevents bypass where old synced VODs are analyzed without counting
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { count: analysesThisMonth } = await supabase
    .from("vods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("analyzed_at", "is", null)
    .gte("analyzed_at", monthStart)
    .lt("analyzed_at", monthEnd);

  // Count total successfully generated clips (not failed/processing attempts)
  const { count: clipsTotal } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready");

  const analyses_this_month = analysesThisMonth ?? 0;
  const clips_total = clipsTotal ?? 0;

  return {
    plan,
    analyses_this_month,
    clips_total,
    can_analyze: analyses_this_month < limits.analyses_per_month,
    can_generate_clip: clips_total < limits.clips_total,
  };
}
