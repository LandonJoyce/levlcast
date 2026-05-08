import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashSidebar from "@/components/dashboard/DashSidebar";
import DashTopbar from "@/components/dashboard/DashTopbar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { getUserUsage } from "@/lib/limits";

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
    .select("twitch_display_name, twitch_avatar_url, twitch_login, plan, subscription_expires_at")
    .eq("id", user.id)
    .single();

  // Counts for sidebar badges
  const [{ count: vodCount }, { count: clipCount }] = await Promise.all([
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

  return (
    <div className="dash">
      <div className="dash-shell">
        <DashSidebar
          user={userData}
          vodCount={vodCount ?? 0}
          clipCount={clipCount ?? 0}
          isPro={isPro}
        />
        <main className="main">
          <DashTopbar />
          <div className="content">
            {usage.on_trial && (
              <TrialBanner
                analysesUsed={usage.analyses_used}
                analysesLimit={usage.analyses_limit}
                clipsUsed={usage.clips_used}
                clipsLimit={usage.clips_limit}
              />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
