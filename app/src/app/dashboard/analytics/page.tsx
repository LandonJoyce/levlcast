import { createClient } from "@/lib/supabase/server";
import { FollowerTrend } from "@/components/dashboard/follower-trend";
import { formatDuration } from "@/lib/utils";
import { Sparkles, TrendingUp, TrendingDown, Trophy, Zap, Clock, Flame, BarChart2 } from "lucide-react";
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

  // Progress arc — plain language summary of score movement
  let progressArc: string | null = null;
  if (coachScores.length >= 3) {
    const first = coachScores[0].score;
    const last = coachScores[coachScores.length - 1].score;
    const diff = last - first;
    if (diff >= 10) progressArc = `Up ${diff} points across your last ${coachScores.length} streams.`;
    else if (diff <= -10) progressArc = `Down ${Math.abs(diff)} points across your last ${coachScores.length} streams. Focus on consistency.`;
    else progressArc = `Holding steady around ${avgScore} across your last ${coachScores.length} streams.`;
  }

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

  // Content type score comparison — group by first word of title, compare avg scores
  const contentScores: Record<string, { scores: number[]; label: string }> = {};
  for (const vod of analyzedVods) {
    const score = (vod.coach_report as any)?.overall_score as number | undefined;
    if (!score || !vod.title) continue;
    const firstWord = vod.title.trim().split(/\s+/)[0];
    const key = firstWord.toLowerCase();
    const label = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
    if (!contentScores[key]) contentScores[key] = { scores: [], label };
    contentScores[key].scores.push(score);
  }
  const contentAvgs = Object.values(contentScores)
    .filter((c) => c.scores.length >= 2)
    .map((c) => ({ label: c.label, avg: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length), count: c.scores.length }))
    .sort((a, b) => b.avg - a.avg);
  const contentInsight = contentAvgs.length >= 2
    ? { best: contentAvgs[0], worst: contentAvgs[contentAvgs.length - 1] }
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
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Performance data</span>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Analytics</h1>
        <p className="text-sm text-muted">Your streaming story, by the numbers.</p>
      </div>

      {isEmpty ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <BarChart2 size={28} className="text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-white mb-1">No analytics yet</p>
          <p className="text-xs text-muted">Analyze a stream to see your score, insights, and trends.</p>
        </div>
      ) : (
        <>
          {/* Score + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mb-6">
            {/* Score hero */}
            <div className="p-px rounded-[22px] bg-gradient-to-b from-accent/30 to-accent/[0.06]">
            <div className="bg-surface rounded-[21px] px-6 py-7 flex flex-col justify-center h-full">
              <p className="text-xs text-muted/80 font-medium mb-3">
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
              {progressArc && (
                <p className="text-xs text-white/40 mt-2 leading-relaxed">{progressArc}</p>
              )}
            </div>
            </div>

            {/* Insights */}
            <div className="bg-surface border border-border rounded-2xl px-6 py-5">
              <p className="text-xs text-muted font-medium mb-4">
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

                {/* Content score comparison */}
                {contentInsight && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap size={15} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-0.5">What Works Best</p>
                      <p className="text-sm font-semibold text-white">
                        {contentInsight.best.label} scores higher
                      </p>
                      <p className="text-xs text-muted">
                        avg {contentInsight.best.avg} vs {contentInsight.worst.avg} for {contentInsight.worst.label}
                      </p>
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
                      <p className="text-xs text-muted mb-0.5">Clip Moments Per Stream</p>
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
            {/* Score area chart */}
            {coachScores.length > 0 && (() => {
              const W = 560;
              const H = 90;
              const TOP = 22;
              const PAD = 14;
              const n = coachScores.length;
              const slotW = (W - PAD * 2) / n;
              const dotColor = (s: number) => s >= 70 ? "#4ade80" : s >= 50 ? "#facc15" : "#f87171";

              const pts = coachScores.map((c, i) => ({
                x: PAD + (i + 0.5) * slotW,
                y: TOP + H - Math.max(4, (c.score / 100) * H),
                score: c.score,
                id: c.id,
                date: c.date,
                isLatest: i === n - 1,
              }));

              const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
              const areaPath = `${linePath} L${pts[n - 1].x.toFixed(1)},${(TOP + H).toFixed(1)} L${pts[0].x.toFixed(1)},${(TOP + H).toFixed(1)} Z`;
              const avgY = avgScore !== null ? TOP + H - (avgScore / 100) * H : null;

              return (
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white">Stream Quality Over Time</h2>
                    {scoreTrend !== null && scoreTrend !== 0 && (
                      <span className={`text-xs font-semibold flex items-center gap-1 ${scoreTrend > 0 ? "text-green-400" : "text-red-400"}`}>
                        {scoreTrend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {scoreTrend > 0 ? "+" : ""}{scoreTrend} from last stream
                      </span>
                    )}
                  </div>

                  <svg viewBox={`0 0 ${W} ${TOP + H + 20}`} width="100%" className="overflow-visible">
                    <defs>
                      <linearGradient id="score-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(99,102,241,0.25)" />
                        <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines at 25 / 50 / 75 */}
                    {[25, 50, 75].map((tick) => {
                      const gy = TOP + H - (tick / 100) * H;
                      return (
                        <g key={tick}>
                          <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                          <text x={PAD - 4} y={gy + 3.5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.2)">{tick}</text>
                        </g>
                      );
                    })}

                    {/* Avg dashed line */}
                    {avgY !== null && (
                      <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="4 3" />
                    )}

                    {/* Area fill */}
                    <path d={areaPath} fill="url(#score-area-fill)" />

                    {/* Trend line */}
                    <path d={linePath} fill="none" stroke="rgba(99,102,241,0.55)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                    {/* Clickable dot + label per stream */}
                    {pts.map((p) => (
                      <a key={`pt-${p.id}`} href={`/dashboard/vods/${p.id}`} style={{ cursor: "pointer" }}>
                        <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="600"
                          fill={dotColor(p.score)} fillOpacity={p.isLatest ? 1 : 0.5}>
                          {p.score}
                        </text>
                        <circle cx={p.x} cy={p.y} r={p.isLatest ? 6 : 5}
                          fill="transparent" stroke="none"
                        />
                        <circle cx={p.x} cy={p.y} r={p.isLatest ? 5 : 3.5}
                          fill={dotColor(p.score)} fillOpacity={p.isLatest ? 1 : 0.65}
                          stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"
                        />
                      </a>
                    ))}

                    {/* Date labels */}
                    {pts.map((p) => (
                      <text key={`date-${p.id}`} x={p.x} y={TOP + H + 16} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">
                        {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </text>
                    ))}
                  </svg>
                </div>
              );
            })()}

            {/* Category breakdown */}
            {sortedCategories.length > 0 && (
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-6">What Gets You Clipped</h2>
                <div className="space-y-3">
                  {sortedCategories.slice(0, 6).map(([cat, count]) => {
                    const label = CATEGORY_LABELS[cat] || cat;
                    const color = CATEGORY_COLORS[cat] || "#a78bfa";
                    const pct = Math.round((count / totalPeaks) * 100);
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white/80">{label}</span>
                          <span className="text-xs text-muted">{count} moments · {pct}%</span>
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
                          {" · "}{peaks.length} clip moment{peaks.length !== 1 ? "s" : ""}
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

