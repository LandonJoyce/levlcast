import { createClient } from "@/lib/supabase/server";
import { BurnoutCard } from "@/components/dashboard/burnout-card";
import { MonetizationCard } from "@/components/dashboard/monetization-card";
import { CollabCard } from "@/components/dashboard/collab-card";
import { DigestCard } from "@/components/dashboard/digest-card";
import WelcomeModal from "@/components/dashboard/welcome-modal";
import Link from "next/link";
import { Film, Zap, Scissors, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [vodsResult, clipsResult, peaksResult, profileResult, latestVodResult] = await Promise.all([
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "ready"),
    supabase.from("vods").select("peak_data").eq("user_id", user!.id).eq("status", "ready").not("peak_data", "is", null),
    supabase.from("profiles").select("twitch_display_name").eq("id", user!.id).single(),
    supabase.from("vods").select("id, title, coach_report, stream_date").eq("user_id", user!.id).eq("status", "ready").order("stream_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const totalVods = vodsResult.count || 0;
  const totalClips = clipsResult.count || 0;
  const totalPeaks = (peaksResult.data || []).reduce((sum, v) => sum + ((v.peak_data as any[])?.length || 0), 0);
  const displayName = profileResult.data?.twitch_display_name || "Streamer";
  const latestVod = latestVodResult.data;
  const latestScore = latestVod ? (latestVod.coach_report as any)?.overall_score : null;
  const unclipped = Math.max(0, totalPeaks - totalClips);

  const isEmpty = totalVods === 0 && totalClips === 0;

  return (
    <div>
      {isEmpty && <WelcomeModal name={displayName} />}

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Hey, {displayName}
        </h1>
        <p className="text-sm text-muted">
          Here's what's happening with your stream.
        </p>
      </div>

      {isEmpty ? (
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
          {/* Latest stream score — hero card */}
          {latestScore !== null && latestVod && (
            <Link
              href={`/dashboard/vods/${latestVod.id}`}
              className="block mb-6 rounded-2xl border border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-transparent p-5 hover:border-white/10 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted uppercase tracking-wide font-semibold mb-1">Latest Stream</p>
                  <p className="text-sm text-white/80 truncate">{latestVod.title}</p>
                </div>
                <div className="text-right ml-4">
                  <p className={`text-3xl font-extrabold ${latestScore >= 70 ? "text-green-400" : latestScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {latestScore}
                  </p>
                  <p className="text-[10px] text-muted uppercase">score</p>
                </div>
              </div>
            </Link>
          )}

          {/* Weekly Digest */}
          <div className="mb-5">
            <DigestCard />
          </div>

          {/* Streamer Health + Content Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <BurnoutCard />
            <MonetizationCard />
          </div>

          {/* Collab Finder */}
          <div className="mb-6">
            <CollabCard />
          </div>

          {/* Compact activity row */}
          <div className="flex items-center gap-6 px-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Film size={13} className="text-white/30" />
              {totalVods} VOD{totalVods !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={13} className="text-white/30" />
              {totalPeaks} peak{totalPeaks !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Scissors size={13} className="text-white/30" />
              {totalClips} clip{totalClips !== 1 ? "s" : ""}
            </span>
            {unclipped > 0 && (
              <Link
                href="/dashboard/clips"
                className="flex items-center gap-1.5 text-accent-light hover:underline ml-auto"
              >
                <TrendingUp size={13} />
                {unclipped} peak{unclipped !== 1 ? "s" : ""} ready to clip
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
