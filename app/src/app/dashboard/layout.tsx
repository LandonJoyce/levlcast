import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashSidebar from "@/components/dashboard/DashSidebar";
import DashTopbar from "@/components/dashboard/DashTopbar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { TrialDiscountBanner } from "@/components/dashboard/trial-discount-banner";
import { getUserUsage } from "@/lib/limits";
import { buildUpgradePitch } from "@/lib/upgrade-pitch";
import { computeTrialDiscountStatus, TRIAL_DISCOUNT_DURATION_MONTHS } from "@/lib/trial-discount";

/**
 * Dashboard layout — new dash-shell (sidebar + topbar + content grid).
 * Fetches user profile, plan, and badge counts for the sidebar.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_display_name, twitch_avatar_url, twitch_login, plan, subscription_expires_at, collab_opt_in, trial_discount_started_at")
    .eq("id", user.id)
    .single();

  // Counts for sidebar badges
  const [{ count: vodCount }, { count: clipCount }, { count: collabPendingCount }] = await Promise.all([
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready"),
    supabase
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready"),
    supabase
      .from("collab_interests")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("status", "pending"),
  ]);

  const userData = {
    display_name: profile?.twitch_display_name || "Streamer",
    avatar_url: profile?.twitch_avatar_url || "",
    login: profile?.twitch_login || "",
  };

  // Pro = profile.plan is "pro" AND subscription has NOT explicitly expired.
  // null subscription_expires_at means "no expiry" (e.g. iOS RevenueCat) → still Pro.
  const isPro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date());

  const usage = await getUserUsage(user.id, supabase);

  // Personalize the upgrade pitch using the user's actual reports.
  // Only matters for trial users — Pro users never see the banner. We
  // still compute it cheaply so a user who just bumped against the cap
  // sees their real numbers in the modal, not a generic teaser.
  const upgradePitch = usage.on_trial
    ? await buildUpgradePitch(user.id, supabase)
    : null;

  // 72-hour discount window opens after the user's first analysis. Only
  // surface on the dashboard while they're still on trial — once they
  // upgrade, the banner has no purpose. Pro users never see it.
  const trialDiscount = usage.on_trial
    ? computeTrialDiscountStatus(profile?.trial_discount_started_at ?? null)
    : null;

  return (
    <div className="dash">
      <div className="dash-shell">
        <DashSidebar
          user={userData}
          vodCount={vodCount ?? 0}
          clipCount={clipCount ?? 0}
          collabPendingCount={collabPendingCount ?? 0}
          isPro={isPro}
          showCollabs
        />
        <main className="main">
          <DashTopbar />
          <div className="content">
            {trialDiscount?.isActive && trialDiscount.expiresAt && upgradePitch && (
              <TrialDiscountBanner
                expiresAtIso={trialDiscount.expiresAt}
                discountedMonthly={trialDiscount.discountedMonthly}
                standardMonthly={trialDiscount.standardMonthly}
                durationMonths={TRIAL_DISCOUNT_DURATION_MONTHS}
                personalizedReason={upgradePitch.reason}
              />
            )}
            {usage.on_trial && upgradePitch && (
              <TrialBanner
                analysesUsed={usage.analyses_used}
                analysesLimit={usage.analyses_limit}
                clipsUsed={usage.clips_used}
                clipsLimit={usage.clips_limit}
                personalizedReason={upgradePitch.reason}
                trialDiscount={
                  trialDiscount?.isActive && trialDiscount.expiresAt
                    ? {
                        expiresAtIso: trialDiscount.expiresAt,
                        discountedMonthly: trialDiscount.discountedMonthly,
                        standardMonthly: trialDiscount.standardMonthly,
                        durationMonths: TRIAL_DISCOUNT_DURATION_MONTHS,
                      }
                    : null
                }
              />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
