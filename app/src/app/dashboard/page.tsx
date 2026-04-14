import { createClient } from "@/lib/supabase/server";
import { BurnoutCard } from "@/components/dashboard/burnout-card";
import { MonetizationCard } from "@/components/dashboard/monetization-card";
import { CollabCard } from "@/components/dashboard/collab-card";
import { DigestCard } from "@/components/dashboard/digest-card";
import WelcomeModal from "@/components/dashboard/welcome-modal";
import { WeeklyReportModal } from "@/components/dashboard/weekly-report-modal";
import Link from "next/link";
import { Film, CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [vodsResult, clipsResult, peaksResult, profileResult, recentVodsResult, analyzedResult] = await Promise.all([
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "ready"),
    supabase.from("vods").select("peak_data").eq("user_id", user!.id).eq("status", "ready").not("peak_data", "is", null),
    supabase.from("profiles").select("twitch_display_name").eq("id", user!.id).single(),
    supabase.from("vods").select("id, title, coach_report, stream_date, peak_data, status").eq("user_id", user!.id).order("stream_date", { ascending: false }).limit(5),
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "ready"),
  ]);

  const totalVods = vodsResult.count || 0;
  const totalClips = clipsResult.count || 0;
  const totalAnalyzed = analyzedResult.count || 0;
  const totalPeaks = (peaksResult.data || []).reduce((sum, v) => sum + ((v.peak_data as any[])?.length || 0), 0);
  const displayName = profileResult.data?.twitch_display_name || "Streamer";
  const recentVods = recentVodsResult.data || [];
  const latestVod = recentVods[0] || null;
  const latestScore = latestVod ? (latestVod.coach_report as any)?.overall_score : null;
  const unclipped = Math.max(0, totalPeaks - totalClips);

  const isEmpty = totalVods === 0 && totalClips === 0;
  const needsOnboarding = !isEmpty && (totalAnalyzed === 0 || totalClips === 0);


  return (
    <div>
      {isEmpty && <WelcomeModal name={displayName} />}

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Hey, {displayName}</h1>
        <p className="text-sm text-muted">
          {isEmpty ? "Let's get your stream set up." : needsOnboarding ? "You're getting started — here's what to do next." : "Here's what's happening with your stream."}
        </p>
      </div>

      {isEmpty ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <Film size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No VODs yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-8">
            Sync your Twitch VODs to get started. LevlCast will analyze your streams and find the best moments automatically.
          </p>
          <Link href="/dashboard/vods" className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] active:scale-[0.97]">
            <Film size={16} /> Sync VODs
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* LEFT — main content */}
          <div className="space-y-5">

            {/* Onboarding checklist */}
            {needsOnboarding && (
              <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
                <h2 className="text-sm font-bold text-white mb-4">Getting Started</h2>
                <div className="space-y-3">
                  <OnboardingStep done={totalVods > 0} label="Sync your Twitch VODs" detail={totalVods > 0 ? `${totalVods} VOD${totalVods !== 1 ? "s" : ""} synced` : "Import your recent streams from Twitch"} href="/dashboard/vods" cta="Go to VODs" />
                  <OnboardingStep done={totalAnalyzed > 0} label="Analyze your first stream" detail={totalAnalyzed > 0 ? `${totalAnalyzed} stream${totalAnalyzed !== 1 ? "s" : ""} analyzed` : "Get a coach score and find your peak moments"} href="/dashboard/vods" cta="Pick a VOD" />
                  <OnboardingStep done={totalClips > 0} label="Generate your first clip" detail={totalClips > 0 ? `${totalClips} clip${totalClips !== 1 ? "s" : ""} generated` : "Turn your best moments into shareable clips"} href={latestVod ? `/dashboard/vods/${latestVod.id}` : "/dashboard/vods"} cta="Make a clip" />
                </div>
              </div>
            )}

            {/* Latest stream score */}
            {latestScore !== null && latestVod && (
              <Link
                href={`/dashboard/vods/${latestVod.id}`}
                className="block rounded-2xl border border-white/[0.06] bg-surface p-5 hover:border-white/10 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted font-medium mb-1">Latest stream</p>
                    <p className="text-base font-bold text-white truncate">{latestVod.title}</p>
                    <p className="text-xs text-muted mt-1">{new Date(latestVod.stream_date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
                  </div>
                  <div className="text-right ml-6 flex-shrink-0">
                    <p className={`text-5xl font-extrabold ${latestScore >= 70 ? "text-green-400" : latestScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{latestScore}</p>
                    <p className="text-[10px] text-muted mt-1">stream score</p>
                  </div>
                </div>
              </Link>
            )}

            {/* Recent streams */}
            {recentVods.filter(v => v.status === "ready").length > 1 && (
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                  <h2 className="text-sm font-bold text-white">Recent Streams</h2>
                  <Link href="/dashboard/vods" className="text-xs font-semibold text-accent-light hover:underline">See all →</Link>
                </div>
                <div className="divide-y divide-border">
                  {recentVods.filter(v => v.status === "ready").slice(0, 4).map((vod) => {
                    const score = (vod.coach_report as any)?.overall_score;
                    const peaks = (vod.peak_data as any[])?.length || 0;
                    const scoreColor = !score ? "text-muted" : score >= 70 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
                    return (
                      <Link key={vod.id} href={`/dashboard/vods/${vod.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/90 font-medium truncate">{vod.title}</p>
                          <p className="text-xs text-muted mt-0.5">
                            {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {peaks} peak{peaks !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {score !== undefined && (
                          <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                            <Sparkles size={11} className={scoreColor} />
                            <span className={`text-sm font-bold ${scoreColor}`}>{score}</span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monetization */}
            <MonetizationCard />
          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-5">

            {/* Weekly report modal — pops up when a new digest is available */}
            <WeeklyReportModal />

            {/* Digest card */}
            <DigestCard />

            {/* Burnout */}
            <BurnoutCard />

            {/* Quick stats */}
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-xs font-medium text-muted mb-4">Your numbers</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="VODs" value={totalVods} href="/dashboard/vods" />
                <StatBox label="Analyzed" value={totalAnalyzed} href="/dashboard/vods" />
                <StatBox label="Peak Moments" value={totalPeaks} href="/dashboard/clips" />
                <StatBox label="Clips Made" value={totalClips} href="/dashboard/clips" />
              </div>
              {unclipped > 0 && (
                <Link href="/dashboard/clips" className="mt-3 flex items-center justify-between text-xs font-semibold text-accent-light hover:underline">
                  <span>{unclipped} peak{unclipped !== 1 ? "s" : ""} ready to clip</span>
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {/* Collab finder */}
            <CollabCard />
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 surface-hover block">
      <p className="text-xl font-extrabold text-white">{value}</p>
      <p className="text-[11px] text-muted mt-0.5">{label}</p>
    </Link>
  );
}

function OnboardingStep({ done, label, detail, href, cta }: {
  done: boolean; label: string; detail: string; href: string; cta: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" /> : <Circle size={18} className="text-white/20 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? "text-white/50 line-through" : "text-white"}`}>{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      {!done && (
        <Link href={href} className="flex items-center gap-1 text-xs font-semibold text-accent-light hover:underline flex-shrink-0">
          {cta} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}
