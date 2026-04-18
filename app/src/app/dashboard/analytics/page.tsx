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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Analytics</h1>
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
          {/* Score + Insights — score narrower, insights wider */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 mb-6">
            {/* Score hero */}
            <div className="bg-surface border border-border rounded-2xl px-6 py-7 flex flex-col justify-center">
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

          {/* Charts row — score trend + category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
            {/* Score area chart */}
            {coachScores.length > 0 && (() => {
              const W = 560;
              const H = 120;
              const TOP = 24;
              const PAD = 28;
              const n = coachScores.length;
              const slotW = (W - PAD * 2) / Math.max(n - 1, 1);
              const dotColor = (s: number) => s >= 70 ? "#4ade80" : s >= 50 ? "#facc15" : "#f87171";
              const dotGlow = (s: number) => s >= 70 ? "rgba(74,222,128,0.6)" : s >= 50 ? "rgba(250,204,21,0.5)" : "rgba(248,113,113,0.5)";

              const pts = coachScores.map((c, i) => ({
                x: PAD + i * slotW,
                y: TOP + H - Math.max(8, (c.score / 100) * H),
                score: c.score,
                id: c.id,
                date: c.date,
                title: c.title,
                isLatest: i === n - 1,
              }));

              // Smooth curve using cubic bezier
              const curvePath = pts.map((p, i) => {
                if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                const prev = pts[i - 1];
                const cpx = (prev.x + p.x) / 2;
                return `C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              }).join(" ");
              const areaPath = `${curvePath} L${pts[n - 1].x.toFixed(1)},${(TOP + H).toFixed(1)} L${pts[0].x.toFixed(1)},${(TOP + H).toFixed(1)} Z`;
              const avgY = avgScore !== null ? TOP + H - (avgScore / 100) * H : null;

              return (
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-bold text-white">Stream Quality Over Time</h2>
                    {scoreTrend !== null && scoreTrend !== 0 && (
                      <span className={`text-xs font-semibold flex items-center gap-1 ${scoreTrend > 0 ? "text-green-400" : "text-red-400"}`}>
                        {scoreTrend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {scoreTrend > 0 ? "+" : ""}{scoreTrend} from last stream
                      </span>
                    )}
                  </div>

                  <svg viewBox={`0 0 ${W} ${TOP + H + 24}`} width="100%" className="overflow-visible">
                    <defs>
                      <linearGradient id="score-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(168,85,247,0.2)" />
                        <stop offset="50%" stopColor="rgba(168,85,247,0.06)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                      </linearGradient>
                      <linearGradient id="score-line-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(168,85,247,0.4)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0.8)" />
                      </linearGradient>
                      <filter id="dot-glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Grid lines at 25 / 50 / 75 */}
                    {[25, 50, 75].map((tick) => {
                      const gy = TOP + H - (tick / 100) * H;
                      return (
                        <g key={tick}>
                          <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                          <text x={PAD - 6} y={gy + 3.5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.15)">{tick}</text>
                        </g>
                      );
                    })}

                    {/* Avg dashed line with label */}
                    {avgY !== null && (
                      <g>
                        <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={W - PAD + 4} y={avgY + 3.5} fontSize="8" fill="rgba(255,255,255,0.2)">avg</text>
                      </g>
                    )}

                    {/* Area fill */}
                    <path d={areaPath} fill="url(#score-area-fill)" />

                    {/* Smooth trend line */}
                    <path d={curvePath} fill="none" stroke="url(#score-line-grad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                    {/* Clickable dots with glow */}
                    {pts.map((p) => (
                      <a key={`pt-${p.id}`} href={`/dashboard/vods/${p.id}`} style={{ cursor: "pointer" }}>
                        {/* Score label */}
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="700"
                          fill={dotColor(p.score)} fillOpacity={p.isLatest ? 1 : 0.6}>
                          {p.score}
                        </text>
                        {/* Glow ring */}
                        <circle cx={p.x} cy={p.y} r={p.isLatest ? 8 : 6}
                          fill={dotGlow(p.score)} fillOpacity={0.15}
                        />
                        {/* Dot */}
                        <circle cx={p.x} cy={p.y} r={p.isLatest ? 5 : 3.5}
                          fill={dotColor(p.score)} fillOpacity={p.isLatest ? 1 : 0.7}
                          stroke={p.isLatest ? dotGlow(p.score) : "rgba(0,0,0,0.3)"}
                          strokeWidth={p.isLatest ? 2 : 1.5}
                          filter={p.isLatest ? "url(#dot-glow)" : undefined}
                        />
                        {/* Larger hit area for clicking */}
                        <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                      </a>
                    ))}

                    {/* Date labels */}
                    {pts.map((p) => (
                      <text key={`date-${p.id}`} x={p.x} y={TOP + H + 18} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.25)">
                        {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </text>
                    ))}
                  </svg>
                </div>
              );
            })()}

            {/* Category breakdown */}
            {sortedCategories.length > 0 && (() => {
              const GLOW: Record<string, { text: string; shadow: string; border: string; bg: string }> = {
                hype:        { text: "text-purple-300", shadow: "0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.2)", border: "border-purple-500/40", bg: "bg-purple-500/10" },
                funny:       { text: "text-yellow-300", shadow: "0 0 20px rgba(250,204,21,0.5), 0 0 40px rgba(250,204,21,0.2)",  border: "border-yellow-500/40", bg: "bg-yellow-500/10" },
                educational: { text: "text-blue-300",   shadow: "0 0 20px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.2)",   border: "border-blue-500/40",   bg: "bg-blue-500/10" },
                emotional:   { text: "text-red-300",    shadow: "0 0 20px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.2)",     border: "border-red-500/40",    bg: "bg-red-500/10" },
                clutch_play: { text: "text-emerald-300",shadow: "0 0 20px rgba(16,185,129,0.5), 0 0 40px rgba(16,185,129,0.2)",   border: "border-emerald-500/40", bg: "bg-emerald-500/10" },
                rage:        { text: "text-red-300",    shadow: "0 0 20px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.2)",     border: "border-red-500/40",    bg: "bg-red-500/10" },
                wholesome:   { text: "text-violet-300", shadow: "0 0 20px rgba(167,139,250,0.5), 0 0 40px rgba(167,139,250,0.2)", border: "border-violet-500/40", bg: "bg-violet-500/10" },
              };
              return (
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h2 className="text-sm font-bold text-white mb-5">What Gets You Clipped</h2>
                  <div className="flex flex-wrap gap-2">
                    {sortedCategories.slice(0, 6).map(([cat, count], i) => {
                      const label = CATEGORY_LABELS[cat] || cat;
                      const pct = Math.round((count / totalPeaks) * 100);
                      const glow = GLOW[cat];
                      const isDominant = i === 0;
                      return (
                        <div
                          key={cat}
                          className={`px-3.5 py-2 rounded-xl border transition-all ${
                            isDominant && glow
                              ? `${glow.bg} ${glow.border} ${glow.text}`
                              : "bg-white/[0.03] border-white/[0.06] text-muted"
                          }`}
                          style={isDominant && glow ? { boxShadow: glow.shadow } : undefined}
                        >
                          <span className={`text-sm font-bold ${isDominant && glow ? glow.text : "text-white/50"}`}>
                            {label}
                          </span>
                          <span className={`text-xs ml-1.5 ${isDominant ? "text-white/50" : "text-white/20"}`}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted mt-3">{totalPeaks} clip moments total</p>
                </div>
              );
            })()}
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

