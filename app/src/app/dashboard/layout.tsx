import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppBar from "@/components/dashboard/AppBar";
import { getUserUsage } from "@/lib/limits";
import { buildUpgradePitch } from "@/lib/upgrade-pitch";
import { shoulders } from "../fonts";
import "./app.css";

/**
 * The signed-in pages: a bar across the top (AppBar) and one centred
 * column, the same shape as levlcast.com. It replaced a left sidebar and a
 * breadcrumb bar. app.css restyles the older page styles (globals.css,
 * `.dash`) onto the homepage's colours, type and white buttons.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { count: collabPendingCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("twitch_display_name, twitch_avatar_url, twitch_login, plan, subscription_expires_at, collab_opt_in")
      .eq("id", user.id)
      .single(),
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
  // Only matters on the free plan — Pro users never see the upgrade chip.
  const upgradePitch = usage.on_trial ? await buildUpgradePitch(user.id, supabase) : null;

  const trial = usage.on_trial
    ? {
        analysesLeft: Math.max(0, usage.analyses_limit - usage.analyses_used),
        clipsLeft: Math.max(0, usage.clips_limit - usage.clips_used),
      }
    : null;

  return (
    <div className={`dash dash-app ${shoulders.variable}`}>
      <AppBar
        user={userData}
        isPro={isPro}
        trial={trial}
        upgradeReason={upgradePitch?.reason ?? null}
        collabPendingCount={collabPendingCount ?? 0}
      />
      <main className="main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
