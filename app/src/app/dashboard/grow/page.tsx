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
  emotional: "bg-pink-500/10 text-pink-400",
  clutch_play: "bg-emerald-500/10 text-emerald-400",
  clutch: "bg-emerald-500/10 text-emerald-400",
  rage: "bg-red-500/10 text-red-400",
  wholesome: "bg-violet-500/10 text-violet-400",
  hot_take: "bg-orange-500/10 text-orange-400",
  story: "bg-cyan-500/10 text-cyan-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Comedy",
  educational: "Educational",
  emotional: "Emotional",
  clutch_play: "Clutch",
  clutch: "Clutch",
  rage: "Rage",
  wholesome: "Wholesome",
  hot_take: "Hot Take",
  story: "Story",
};

const CATEGORY_COLORS: Record<string, string> = {
  hype: "#a855f7",
  funny: "#facc15",
  educational: "#3b82f6",
  emotional: "#ec4899",
  clutch_play: "#10b981",
  clutch: "#10b981",
  rage: "#ef4444",
  wholesome: "#a78bfa",
  hot_take: "#f97316",
  story: "#06b6d4",
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

  const dominantCatColor = dominantCategory ? CATEGORY_COLORS[dominantCategory] : "#8b5cf6";
  const dominantCatLabel = dominantCategory ? (CATEGORY_LABELS[dominantCategory] ?? dominantCategory) : null;
  const dominantCatPct = dominantCategory && totalPeaks > 0
    ? Math.round((categoryCounts[dominantCategory] / totalPeaks) * 100)
    : null;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">
          Growth strategy
        </span>
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

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            {/* Score Trend */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
              <p className="text-[11px] text-white/45 font-medium mb-2">Score Trend</p>
              {scoreTrend === "up" && (
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-green-400 flex-shrink-0" />
                  <span className="text-lg font-extrabold text-green-400 leading-tight">Trending Up</span>
                </div>
              )}
              {scoreTrend === "down" && (
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={18} className="text-red-400 flex-shrink-0" />
                  <span className="text-lg font-extrabold text-red-400 leading-tight">Slipping</span>
                </div>
              )}
              {scoreTrend === "flat" && (
                <div className="flex items-center gap-2 mb-1">
                  <Minus size={18} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-lg font-extrabold text-yellow-400 leading-tight">Steady</span>
                </div>
              )}
              {scoreTrend === null && avgScore !== null && (
                <p className="text-3xl font-extrabold leading-none mb-1 text-white">{avgScore}</p>
              )}
              {avgScore !== null && (
                <p className="text-[11px] text-white/40">
                  {scoreTrend !== null ? `avg ${avgScore}` : "avg score"}
                </p>
              )}
            </div>

            {/* Best Content */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
              <p className="text-[11px] text-white/45 font-medium mb-2">Best Content</p>
              {dominantCatLabel ? (
                <>
                  <p
                    className="text-2xl font-extrabold leading-tight mb-1 capitalize"
                    style={{ color: dominantCatColor }}
                  >
                    {dominantCatLabel}
                  </p>
                  {dominantCatPct !== null && (
                    <p className="text-[11px] text-white/40">{dominantCatPct}% of clip moments</p>
                  )}
                </>
              ) : (
                <p className="text-2xl font-extrabold leading-tight text-white/30">—</p>
              )}
            </div>

            {/* Consistency */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
              <p className="text-[11px] text-white/45 font-medium mb-2">Consistency</p>
              <p className={`text-3xl font-extrabold leading-none mb-1 ${recentStreamCount >= 12 ? "text-green-400" : recentStreamCount >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                {recentStreamCount}
              </p>
              <p className="text-[11px] text-white/40">
                streams this month
                {" · "}
                {recentStreamCount >= 20 ? "Excellent" : recentStreamCount >= 12 ? "Good pace" : recentStreamCount >= 6 ? "Needs work" : "Stream more"}
              </p>
            </div>
          </div>

          {/* Archetype — featured full width */}
          <ArchetypeCard
            dominantCategory={dominantCategory}
            dominantStreamerType={dominantStreamerType}
            categoryCounts={categoryCounts}
            totalPeaks={totalPeaks}
          />

          {/* Consistency grid */}
          <ConsistencyGrid streamDates={streamDates} />

          {/* Tactics */}
          <TacticsCarousel />

          {/* Top Clips */}
          {topClips && topClips.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-sm font-bold text-white">Your Best Clips</h2>
                  <p className="text-xs text-white/40 mt-0.5">Post these on TikTok, YouTube Shorts, and Kick first</p>
                </div>
                <Link href="/dashboard/clips" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                  See all →
                </Link>
              </div>

              {/* Clip rows */}
              <div className="divide-y divide-white/[0.04]">
                {topClips.map((clip, i) => {
                  const isTop = i === 0;
                  const catLabel = CATEGORY_LABELS[clip.peak_category] || clip.peak_category;
                  return (
                    <div
                      key={clip.id}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isTop ? "border border-yellow-500/15 bg-yellow-500/[0.03]" : "hover:bg-white/[0.02]"}`}
                    >
                      {/* Rank */}
                      <span className={`text-sm font-bold w-5 text-center flex-shrink-0 ${isTop ? "text-yellow-400" : "text-white/25"}`}>
                        {i + 1}
                      </span>

                      {/* Thumbnail */}
                      <video
                        preload="metadata"
                        muted
                        playsInline
                        className="w-16 aspect-video rounded-lg bg-black flex-shrink-0 object-cover"
                      >
                        <source src={clip.video_url} type="video/mp4" />
                      </video>

                      {/* Title + category */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isTop ? "text-white" : "text-white/80"}`}>
                          {clip.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_STYLE[clip.peak_category] || "bg-white/5 text-white/40"}`}>
                            {catLabel}
                          </span>
                          {clip.caption_text && (
                            <span className="text-xs text-white/35 truncate line-clamp-1">{clip.caption_text}</span>
                          )}
                        </div>
                      </div>

                      {/* Virality score */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Sparkles size={11} className={scoreColor(clip.peak_score)} />
                        <span className={`text-sm font-bold ${scoreColor(clip.peak_score)}`}>
                          {Math.round(clip.peak_score * 100)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer tip */}
              <div className="px-5 py-3.5 border-t border-white/[0.05] bg-white/[0.015]">
                <p className="text-xs text-white/35 leading-relaxed">
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
