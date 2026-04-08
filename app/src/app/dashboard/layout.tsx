import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

/**
 * Dashboard layout — sidebar on desktop, bottom tabs on mobile.
 * Fetches the user profile for the nav display.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_display_name, twitch_avatar_url, twitch_login")
    .eq("id", user.id)
    .single();

  const userData = {
    display_name: profile?.twitch_display_name || "Streamer",
    avatar_url: profile?.twitch_avatar_url || "",
    login: profile?.twitch_login || "",
  };

  return (
    <div className="min-h-screen bg-bg relative">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 dashboard-glow pointer-events-none z-0" />
      {/* Desktop sidebar */}
      <div className="hidden lg:block relative z-[1]">
        <Sidebar user={userData} />
      </div>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border safe-top">
        <div className="h-14 flex items-center justify-between px-5">
          <Link href="/" className="text-lg font-extrabold text-gradient">
            LevlCast
          </Link>
          {userData.avatar_url ? (
            <img
              src={userData.avatar_url}
              alt={userData.display_name}
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent-light">
              {userData.display_name?.[0] || "?"}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="lg:pl-[240px] pt-14 lg:pt-0 pb-20 lg:pb-0 relative z-[1]">
        <div className="max-w-[1100px] mx-auto px-5 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <MobileNav />
    </div>
  );
}
