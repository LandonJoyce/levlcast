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

  // Count total successfully generated clips (not failed/processing attempts)
  const { count: clipsTotal } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready");

  const analyses_this_month = (completedThisMonth ?? 0) + (inProgress ?? 0);
  const clips_total = clipsTotal ?? 0;

  return {
    plan,
    analyses_this_month,
    clips_total,
    can_analyze: analyses_this_month < limits.analyses_per_month,
    can_generate_clip: clips_total < limits.clips_total,
  };
}
