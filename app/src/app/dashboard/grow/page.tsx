import { createClient } from "@/lib/supabase/server";
import { ArchetypeCard } from "@/components/dashboard/grow/archetype-card";
import { ConsistencyGrid } from "@/components/dashboard/grow/consistency-grid";
import { TacticsCarousel } from "@/components/dashboard/grow/tactics-carousel";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import Link from "next/link";

interface Peak {
  category: string;
  score: number;
  title: string;
  caption: string;
}

const CATEGORY_STYLE: Record<string, string> = {
  hype: "bg-purple-500/10 text-purple-400",
  funny: "bg-yellow-500/10 text-yellow-400",
  educational: "bg-blue-500/10 text-blue-400",
  emotional: "bg-red-500/10 text-red-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Funny",
  educational: "Educational",
  emotional: "Emotional",
};

function scoreColor(score: number) {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-muted";
}

export default async function GrowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: vods } = await supabase
    .from("vods")
    .select("id, title, stream_date, peak_data, coach_report")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .not("peak_data", "is", null)
    .order("stream_date", { ascending: false });

  const { data: topClips } = await supabase
    .from("clips")
    .select("id, title, video_url, peak_score, peak_category, caption_text")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .order("peak_score", { ascending: false })
    .limit(5);

  const categoryCounts: Record<string, number> = { hype: 0, funny: 0, educational: 0, emotional: 0 };
  const streamerTypeCounts: Record<string, number> = {};
  const coachScores: number[] = [];

  for (const vod of vods || []) {
    const peaks = (vod.peak_data as Peak[]) || [];
    for (const peak of peaks) {
      const cat = peak.category?.toLowerCase();
      if (cat && cat in categoryCounts) categoryCounts[cat]++;
    }
    const report = vod.coach_report as any;
    const streamerType = report?.streamer_type;
    if (streamerType) {
      streamerTypeCounts[streamerType] = (streamerTypeCounts[streamerType] ?? 0) + 1;
    }
    if (typeof report?.overall_score === "number") {
      coachScores.push(report.overall_score);
    }
  }

  const totalPeaks = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const dominantStreamerType = Object.entries(streamerTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dominantCategory = totalPeaks > 0
    ? Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const streamDates = new Set(
    (vods || []).map((v) => v.stream_date?.slice(0, 10)).filter(Boolean)
  );

  // Score trend: compare oldest 3 vs newest 3 (scores are in desc order by stream_date)
  const reversed = [...coachScores].reverse(); // oldest first
  let scoreTrend: "up" | "down" | "flat" | null = null;
  let avgScore: number | null = null;
  if (reversed.length >= 1) {
    avgScore = Math.round(reversed.reduce((a, b) => a + b, 0) / reversed.length);
  }
  if (reversed.length >= 4) {
    const early = reversed.slice(0, 3);
    const recent = reversed.slice(-3);
    const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const delta = recentAvg - earlyAvg;
    scoreTrend = delta >= 3 ? "up" : delta <= -3 ? "down" : "flat";
  }

  // Streams in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentStreamCount = [...streamDates].filter((d) => d >= thirtyDaysAgo).length;

  const hasData = totalPeaks > 0;

  return (
    <div>
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Growth strategy</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Growth Playbook</h1>
        <p className="text-sm text-muted">How to keep growing — every week, every stream.</p>
      </div>

      {!hasData ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <TrendingUp size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Analyze a VOD first</h2>
          <p className="text-sm text-muted max-w-sm mx-auto mb-6">Your Growth Playbook is built from real stream data.</p>
          <Link href="/dashboard/vods" className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-px text-sm">
            Go to VODs
          </Link>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Archetype — featured at top */}
          <ArchetypeCard
            dominantCategory={dominantCategory}
            dominantStreamerType={dominantStreamerType}
            categoryCounts={categoryCounts}
            totalPeaks={totalPeaks}
          />

          {/* Momentum — asymmetric: score wide, content + month narrow */}
          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
            {/* Score trend — wider */}
            <div className="bg-surface border border-border rounded-2xl px-5 py-5">
              <p className="text-[11px] text-muted/70 font-medium mb-3">Score Trend</p>
              {scoreTrend === "up" && (
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={20} className="text-green-400" />
                  <span className="text-xl font-extrabold text-green-400">Trending Up</span>
                </div>
              )}
              {scoreTrend === "down" && (
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={20} className="text-red-400" />
                  <span className="text-xl font-extrabold text-red-400">Slipping</span>
                </div>
              )}
              {scoreTrend === "flat" && (
                <div className="flex items-center gap-2 mb-1">
                  <Minus size={20} className="text-yellow-400" />
                  <span className="text-xl font-extrabold text-yellow-400">Steady</span>
                </div>
              )}
              {scoreTrend === null && avgScore !== null && (
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white leading-none">{avgScore}</span>
                  <span className="text-xs text-muted pb-1">avg score</span>
                </div>
              )}
              {avgScore !== null && scoreTrend !== null && (
                <p className="text-xs text-muted">Avg: {avgScore}</p>
              )}
            </div>

            {/* Right stack: content + month */}
            <div className="flex flex-col gap-3">
              <div className="bg-surface border border-border rounded-2xl px-5 py-4">
                <p className="text-[11px] text-muted/70 font-medium mb-2">Best Content</p>
                {dominantCategory ? (
                  <>
                    <span className={`inline-flex items-center text-lg font-extrabold capitalize px-2.5 py-0.5 rounded-full ${CATEGORY_STYLE[dominantCategory] || "text-white"}`}>
                      {CATEGORY_LABELS[dominantCategory] ?? dominantCategory}
                    </span>
                    <p className="text-xs text-muted mt-1">
                      {Math.round((categoryCounts[dominantCategory] / totalPeaks) * 100)}% of clip moments
                    </p>
                  </>
                ) : (
                  <span className="text-lg font-extrabold text-muted">—</span>
                )}
              </div>
              <div className="bg-surface border border-border rounded-2xl px-5 py-4">
                <p className="text-[11px] text-muted/70 font-medium mb-2">This Month</p>
                <div className="flex items-end gap-1.5">
                  <span className={`text-3xl font-extrabold leading-none ${recentStreamCount >= 12 ? "text-green-400" : recentStreamCount >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                    {recentStreamCount}
                  </span>
                  <span className="text-xs text-muted pb-0.5">streams · {recentStreamCount >= 20 ? "Excellent" : recentStreamCount >= 12 ? "Good pace" : recentStreamCount >= 6 ? "Needs work" : "Stream more"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consistency — full width above tactics */}
          <ConsistencyGrid streamDates={streamDates} />

          {/* Tactics */}
          <TacticsCarousel />

          {/* Top clips — full width */}
          {topClips && topClips.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="text-sm font-bold text-white">Your Best Clips</h2>
                  <p className="text-xs text-muted mt-0.5">Post these on TikTok, YouTube Shorts, and Kick first</p>
                </div>
                <Link href="/dashboard/clips" className="text-xs font-semibold text-accent-light hover:underline">See all →</Link>
              </div>
              <div className="divide-y divide-border">
                {topClips.map((clip, i) => (
                  <div key={clip.id} className="flex items-center gap-4 px-5 py-3">
                    <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${i === 0 ? "text-yellow-400" : "text-muted/40"}`}>
                      {i + 1}
                    </span>
                    <video preload="metadata" muted playsInline className="w-16 aspect-video rounded bg-black flex-shrink-0 object-cover"><source src={clip.video_url} type="video/mp4" /></video>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{clip.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_STYLE[clip.peak_category] || "bg-white/5 text-muted"}`}>
                          {clip.peak_category}
                        </span>
                        <span className="text-xs text-muted line-clamp-1">{clip.caption_text}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Sparkles size={11} className={scoreColor(clip.peak_score)} />
                      <span className={`text-sm font-bold ${scoreColor(clip.peak_score)}`}>{Math.round(clip.peak_score * 100)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border bg-white/[0.02]">
                <p className="text-xs text-muted leading-relaxed">
                  When someone finds your clip on TikTok and comes to Twitch, they expect that same version of you. Stream like your top clips every time.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
