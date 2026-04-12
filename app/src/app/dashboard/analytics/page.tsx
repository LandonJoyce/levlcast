import { createClient } from "@/lib/supabase/server";
import { FollowerTrend } from "@/components/dashboard/follower-trend";
import { formatDuration } from "@/lib/utils";
import { Sparkles, TrendingUp, TrendingDown, Trophy, Zap, Clock, Flame } from "lucide-react";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Comedy",
  educational: "Educational",
  emotional: "Emotional",
  clutch_play: "Clutch Plays",
  rage: "Rage",
  wholesome: "Wholesome",
};

const CATEGORY_COLORS: Record<string, string> = {
  hype: "#a855f7",
  funny: "#facc15",
  educational: "#3b82f6",
  emotional: "#ec4899",
  clutch_play: "#10b981",
  rage: "#ef4444",
  wholesome: "#a78bfa",
};

function mostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [vodsData, clipsResult, snapshotsResult] = await Promise.all([
    supabase.from("vods").select("id, title, duration_seconds, peak_data, coach_report, status, stream_date").eq("user_id", user!.id).order("stream_date", { ascending: false }),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "ready"),
    supabase.from("follower_snapshots").select("follower_count, snapped_at").eq("user_id", user!.id).eq("platform", "twitch").order("snapped_at", { ascending: true }).limit(30),
  ]);

  const vods = vodsData.data || [];
  const totalClips = clipsResult.count || 0;
  const snapshots = snapshotsResult.data || [];
  const analyzedVods = vods.filter((v) => v.status === "ready");

  let totalPeaks = 0;
  const categoryCount: Record<string, number> = {};
  for (const vod of analyzedVods) {
    const peaks = (vod.peak_data as Array<{ score: number; category: string }>) || [];
    totalPeaks += peaks.length;
    for (const p of peaks) {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    }
  }

  const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

  const coachScores = analyzedVods
    .filter((v) => v.coach_report && (v.coach_report as any).overall_score)
    .slice(0, 10)
    .reverse()
    .map((v) => ({
      id: v.id,
      title: v.title || "Stream",
      date: v.stream_date,
      score: (v.coach_report as any).overall_score as number,
      peaks: ((v.peak_data as any[]) || []).length,
      duration: v.duration_seconds || 0,
    }));

  const latestScore = coachScores.length > 0 ? coachScores[coachScores.length - 1].score : null;
  const avgScore = coachScores.length > 0 ? Math.round(coachScores.reduce((s, c) => s + c.score, 0) / coachScores.length) : null;
  const scoreTrend = coachScores.length >= 2 ? coachScores[coachScores.length - 1].score - coachScores[coachScores.length - 2].score : null;

  // ── Derived insights ──
  // Best stream
  let bestStream: { id: string; title: string; score: number; date: string } | null = null;
  for (const vod of analyzedVods) {
    const score = (vod.coach_report as any)?.overall_score as number | undefined;
    if (score && (!bestStream || score > bestStream.score)) {
      bestStream = { id: vod.id, title: vod.title || "Stream", score, date: vod.stream_date };
    }
  }

  // Best single peak moment
  let bestPeak: { title: string; score: number; vodTitle: string; vodId: string } | null = null;
  for (const vod of analyzedVods) {
    const peaks = (vod.peak_data as Array<{ title: string; score: number }>) || [];
    for (const peak of peaks) {
      if (!bestPeak || peak.score > bestPeak.score) {
        bestPeak = { title: peak.title, score: peak.score, vodTitle: vod.title || "Stream", vodId: vod.id };
      }
    }
  }

  // When do peaks happen — early / mid / late thirds
  const peakTiming = { early: 0, mid: 0, late: 0 };
  for (const vod of analyzedVods) {
    const dur = vod.duration_seconds || 1;
    const peaks = (vod.peak_data as Array<{ start: number }>) || [];
    for (const peak of peaks) {
      const pos = peak.start / dur;
      if (pos < 0.33) peakTiming.early++;
      else if (pos < 0.66) peakTiming.mid++;
      else peakTiming.late++;
    }
  }

  const peakTimingTotal = peakTiming.early + peakTiming.mid + peakTiming.late;
  const peakTimingLabel = peakTimingTotal > 0
    ? peakTiming.early >= peakTiming.mid && peakTiming.early >= peakTiming.late
      ? { zone: "first third", pct: Math.round((peakTiming.early / peakTimingTotal) * 100) }
      : peakTiming.mid >= peakTiming.late
      ? { zone: "middle", pct: Math.round((peakTiming.mid / peakTimingTotal) * 100) }
      : { zone: "final third", pct: Math.round((peakTiming.late / peakTimingTotal) * 100) }
    : null;

  // Stream length sweet spot — under 1hr vs over 1hr
  const shortStreams = analyzedVods.filter((v) => v.duration_seconds && v.duration_seconds < 3600);
  const longStreams = analyzedVods.filter((v) => v.duration_seconds && v.duration_seconds >= 3600);
  const avgOf = (arr: typeof analyzedVods) => {
    const scores = arr.map((v) => (v.coach_report as any)?.overall_score).filter(Boolean) as number[];
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };
  const shortAvg = avgOf(shortStreams);
  const longAvg = avgOf(longStreams);
  const sweetSpot = shortAvg !== null && longAvg !== null && shortStreams.length >= 2 && longStreams.length >= 2
    ? shortAvg > longAvg
      ? { label: "Under 1 hour", avg: shortAvg, comparison: `avg ${shortAvg} vs ${longAvg} for longer streams` }
      : longAvg > shortAvg
      ? { label: "Over 1 hour", avg: longAvg, comparison: `avg ${longAvg} vs ${shortAvg} for shorter streams` }
      : null
    : null;

  const isEmpty = vods.length === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Analytics</h1>
        <p className="text-sm text-muted">Your streaming story, by the numbers.</p>
      </div>

      {isEmpty ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm">Sync and analyze some VODs to see your analytics here.</p>
        </div>
      ) : (
        <>
          {/* Score + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mb-6">
            {/* Score hero */}
            <div className="bg-surface border border-border rounded-2xl px-6 py-6 flex flex-col justify-center">
              <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">
                Stream Score
              </p>
              <div className="flex items-end gap-3 mb-1.5">
                <p className={`text-6xl font-extrabold leading-none ${avgScore === null ? "" : avgScore >= 70 ? "text-green-400" : avgScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {avgScore !== null ? avgScore : "—"}
                </p>
                {scoreTrend !== null && scoreTrend !== 0 && (
                  <span className={`text-sm font-bold flex items-center gap-0.5 mb-1.5 ${scoreTrend > 0 ? "text-green-400" : "text-red-400"}`}>
                    {scoreTrend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {scoreTrend > 0 ? "+" : ""}{scoreTrend}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                avg across {coachScores.length} stream{coachScores.length !== 1 ? "s" : ""}
                {latestScore !== null && coachScores.length > 1 && ` · latest: ${latestScore}`}
              </p>
            </div>

            {/* Insights */}
            <div className="bg-surface border border-border rounded-2xl px-6 py-5">
              <p className="text-xs text-muted font-medium uppercase tracking-wide mb-4">
                Stream Insights
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Best stream */}
                {bestStream && (
                  <Link href={`/dashboard/vods/${bestStream.id}`} className="flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Trophy size={15} className="text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted mb-0.5">Best Stream</p>
                      <p className="text-sm font-semibold text-white truncate group-hover:text-accent-light transition-colors">
                        {bestStream.title}
                      </p>
                      <p className="text-xs text-muted">
                        Score: <span className={`font-bold ${bestStream.score >= 70 ? "text-green-400" : bestStream.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>{bestStream.score}</span>
                        {" · "}{new Date(bestStream.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </Link>
                )}

                {/* Peak timing */}
                {peakTimingLabel && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap size={15} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-0.5">When You Peak</p>
                      <p className="text-sm font-semibold text-white">
                        {peakTimingLabel.pct}% hit in the {peakTimingLabel.zone}
                      </p>
                      <p className="text-xs text-muted">of your stream</p>
                    </div>
                  </div>
                )}

                {/* Best moment */}
                {bestPeak && (
                  <Link href={`/dashboard/vods/${bestPeak.vodId}`} className="flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Flame size={15} className="text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted mb-0.5">Hottest Moment</p>
                      <p className="text-sm font-semibold text-white truncate group-hover:text-accent-light transition-colors">
                        {bestPeak.title}
                      </p>
                      <p className="text-xs text-muted">
                        Score: <span className="font-bold text-white">{Math.round(bestPeak.score * 100)}</span>
                        {" · "}{bestPeak.vodTitle}
                      </p>
                    </div>
                  </Link>
                )}

                {/* Sweet spot or fallback stat */}
                {sweetSpot ? (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock size={15} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-0.5">Sweet Spot Length</p>
                      <p className="text-sm font-semibold text-white">{sweetSpot.label}</p>
                      <p className="text-xs text-muted">{sweetSpot.comparison}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={15} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-0.5">Peaks Per Stream</p>
                      <p className="text-sm font-semibold text-white">
                        {analyzedVods.length > 0 ? (totalPeaks / analyzedVods.length).toFixed(1) : "0"}
                      </p>
                      <p className="text-xs text-muted">{totalPeaks} total across {analyzedVods.length} streams</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts row — score trend + category breakdown side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-6">
            {/* Score bar chart */}
            {coachScores.length > 0 && (
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-white">Stream Quality Over Time</h2>
                  {scoreTrend !== null && scoreTrend !== 0 && (
                    <span className={`text-xs font-semibold flex items-center gap-1 ${scoreTrend > 0 ? "text-green-400" : "text-red-400"}`}>
                      {scoreTrend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {scoreTrend > 0 ? "+" : ""}{scoreTrend} from last stream
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-3 h-32">
                  {coachScores.map((c, i) => {
                    const isLatest = i === coachScores.length - 1;
                    const barColor = c.score >= 70 ? "bg-green-400" : c.score >= 50 ? "bg-yellow-400" : "bg-red-400";
                    const height = Math.max(8, (c.score / 100) * 100);
                    return (
                      <Link key={c.id} href={`/dashboard/vods/${c.id}`} className="flex-1 group flex flex-col items-center gap-2">
                        <span className={`text-xs font-bold transition-opacity ${isLatest ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${c.score >= 70 ? "text-green-400" : c.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                          {c.score}
                        </span>
                        <div className="w-full flex items-end h-24">
                          <div
                            className={`w-full rounded-md ${barColor} ${isLatest ? "opacity-100" : "opacity-30 group-hover:opacity-60"} transition-opacity`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted truncate w-full text-center">
                          {new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {sortedCategories.length > 0 && (
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-6">What Peaks Your Stream</h2>
                <div className="space-y-3">
                  {sortedCategories.slice(0, 6).map(([cat, count]) => {
                    const label = CATEGORY_LABELS[cat] || cat;
                    const color = CATEGORY_COLORS[cat] || "#a78bfa";
                    const pct = Math.round((count / totalPeaks) * 100);
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white/80">{label}</span>
                          <span className="text-xs text-muted">{count} peaks · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Follower trend */}
          <div className="mb-6">
            <FollowerTrend snapshots={snapshots} needsReconnect={false} />
          </div>

          {/* Recent streams table */}
          {analyzedVods.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-bold text-white">Recent Streams</h2>
              </div>
              <div className="divide-y divide-border">
                {analyzedVods.slice(0, 10).map((vod) => {
                  const peaks = (vod.peak_data as Array<{ score: number; category: string }>) || [];
                  const coachScore = vod.coach_report ? (vod.coach_report as any).overall_score : null;
                  const scoreColor = coachScore === null ? "text-muted" : coachScore >= 70 ? "text-green-400" : coachScore >= 50 ? "text-yellow-400" : "text-red-400";
                  const topCat = peaks.length > 0 ? mostCommon(peaks.map(p => p.category)) : null;
                  return (
                    <Link
                      key={vod.id}
                      href={`/dashboard/vods/${vod.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="text-sm font-medium text-white/90 truncate">{vod.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" · "}{formatDuration(vod.duration_seconds)}
                          {" · "}{peaks.length} peak{peaks.length !== 1 ? "s" : ""}
                          {topCat && ` · ${CATEGORY_LABELS[topCat] || topCat}`}
                        </p>
                      </div>
                      {coachScore !== null && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Sparkles size={12} className={scoreColor} />
                          <span className={`text-sm font-bold ${scoreColor}`}>{coachScore}</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

