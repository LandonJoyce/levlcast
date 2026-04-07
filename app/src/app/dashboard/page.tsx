import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { BurnoutCard } from "@/components/dashboard/burnout-card";
import { MonetizationCard } from "@/components/dashboard/monetization-card";
import { CollabCard } from "@/components/dashboard/collab-card";
import WelcomeModal from "@/components/dashboard/welcome-modal";
import Link from "next/link";
import { Film, Scissors, BarChart3 } from "lucide-react";

/**
 * Main dashboard — overview of stats, recent activity, and quick actions.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [vodsResult, clipsResult, peaksResult, profileResult] = await Promise.all([
    supabase.from("vods").select("id, peak_data", { count: "exact" }).eq("user_id", user!.id),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("vods").select("peak_data").eq("user_id", user!.id).eq("status", "ready").not("peak_data", "is", null),
    supabase.from("profiles").select("twitch_display_name").eq("id", user!.id).single(),
  ]);

  const totalVods = vodsResult.count || 0;
  const totalClips = clipsResult.count || 0;
  const totalPeaks = (peaksResult.data || []).reduce((sum, v) => sum + ((v.peak_data as any[])?.length || 0), 0);
  const displayName = profileResult.data?.twitch_display_name || "Streamer";

  // Check if user has any content yet
  const isEmpty = totalVods === 0 && totalClips === 0;

  return (
    <div>
      {isEmpty && <WelcomeModal name={displayName} />}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-muted">
          Your stream growth at a glance.
        </p>
      </div>

      {isEmpty ? (
        /* Empty state — guide user to sync VODs */
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <Film size={24} className="text-accent-light" />
          </div>
          <h2 className="text-xl font-bold mb-2">No VODs yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-8">
            Sync your Twitch VODs to get started. LevlCast will analyze your
            streams and find the best moments automatically.
          </p>
          <Link
            href="/dashboard/vods"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-6 py-3 rounded-xl transition-opacity"
          >
            <Film size={16} />
            Sync VODs
          </Link>
        </div>
      ) : (
        <>
          {/* Streamer Health + Content Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BurnoutCard />
            <MonetizationCard />
          </div>

          {/* Collab Finder */}
          <div className="mb-6">
            <CollabCard />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total VODs"
              value={totalVods.toString()}
              detail="Synced from Twitch"
            />
            <StatCard
              label="Clips Generated"
              value={totalClips.toString()}
              detail="Ready to post"
            />
            <StatCard
              label="Peaks Detected"
              value={totalPeaks.toString()}
              detail="Across analyzed VODs"
            />
            <StatCard
              label="Ready to Clip"
              value={(totalPeaks - totalClips).toString()}
              detail="Ungenerated peaks"
              accent
            />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/vods"
              className="bg-surface border border-border rounded-2xl p-6 hover:border-white/10 transition-colors group"
            >
              <Film
                size={20}
                className="text-muted group-hover:text-accent-light transition-colors mb-3"
              />
              <h3 className="font-bold mb-1">VODs</h3>
              <p className="text-xs text-muted">
                Sync and analyze your Twitch streams.
              </p>
            </Link>
            <Link
              href="/dashboard/clips"
              className="bg-surface border border-border rounded-2xl p-6 hover:border-white/10 transition-colors group"
            >
              <Scissors
                size={20}
                className="text-muted group-hover:text-accent-light transition-colors mb-3"
              />
              <h3 className="font-bold mb-1">Clips</h3>
              <p className="text-xs text-muted">
                View and manage your generated clips.
              </p>
            </Link>
            <Link
              href="/dashboard/analytics"
              className="bg-surface border border-border rounded-2xl p-6 hover:border-white/10 transition-colors group"
            >
              <BarChart3
                size={20}
                className="text-muted group-hover:text-accent-light transition-colors mb-3"
              />
              <h3 className="font-bold mb-1">Analytics</h3>
              <p className="text-xs text-muted">
                Track your growth across platforms.
              </p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
