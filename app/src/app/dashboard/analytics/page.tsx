import { createClient } from "@/lib/supabase/server";
import { FollowerTrend } from "@/components/dashboard/follower-trend";
import { formatDuration } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart2, ChevronRight } from "lucide-react";
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

function scoreHex(n: number) { return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171"; }
function scoreCls(n: number) { return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400"; }

function mostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Arc Gauge (matches coach report card) ──────────────────────────────────
function ArcGauge({ score, size = 180 }: { score: number; size?: number }) {
  const hex = scoreHex(score);
  const cls = scoreCls(score);
  const R = 70, cx = 80, cy = 90;
  const startAngle = -200, sweep = 220;
  const polar = (a: number, r = R) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const progEnd = polar(startAngle + (score / 100) * sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  const progLarge = (score / 100) * sweep > 180 ? 1 : 0;
  const numSize = Math.round(size * 0.26);
  const suffixSize = Math.round(size * 0.1);

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size * 0.72 }}>
      <svg width={size} height={size * 0.72} viewBox="0 0 160 120" className="absolute inset-0">
        <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
        {score > 0 && (
          <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${progLarge} 1 ${progEnd.x} ${progEnd.y}`} fill="none" stroke={hex} strokeWidth="6" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${hex})` }} />
        )}
        {[25, 50, 75].map((v) => {
          const a = startAngle + (v / 100) * sweep;
          const inner = polar(a, R - 10);
          const outer = polar(a, R - 4);
          return <line key={v} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />;
        })}
      </svg>
      <div className="flex items-baseline gap-1" style={{ marginTop: size * 0.08 }}>
        <span className={`font-black tabular-nums leading-none ${cls}`} style={{ fontSize: numSize }}>{score}</span>
        <span className="font-bold text-white/20" style={{ fontSize: suffixSize }}>/100</span>
      </div>
    </div>
  );
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
    if (diff >= 10) progressArc = `Up ${diff} points across your last ${coachScores.length} streams — you're leveling up.`;
    else if (diff <= -10) progressArc = `Down ${Math.abs(diff)} points across your last ${coachScores.length} streams. Focus on consistency.`;
    else progressArc = `Holding steady around ${avgScore} across your last ${coachScores.length} streams.`;
  }

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
      ? { label: "Under 1 hour", avg: shortAvg, other: longAvg, otherLabel: "Over 1hr" }
      : longAvg > shortAvg
      ? { label: "Over 1 hour", avg: longAvg, other: shortAvg, otherLabel: "Under 1hr" }
      : null
    : null;

  const isEmpty = vods.length === 0;
  const avgHex = avgScore !== null ? scoreHex(avgScore) : "#8b5cf6";

  const headline = avgScore === null
    ? "Your numbers, coming soon."
    : avgScore >= 75 ? "You're dialed in."
    : avgScore >= 60 ? "You're finding your rhythm."
    : avgScore >= 45 ? "Early signal — there's a formula here."
    : "There's a lot of room to unlock.";

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">
          Performance data
        </span>
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
        <div className="space-y-5">

          {/* ── HERO PULSE ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl relative overflow-hidden"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${avgHex}15 0%, rgba(10,9,20,0) 70%), rgba(10,9,20,0.98)`,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px" style={{ background: `linear-gradient(90deg, transparent, ${avgHex}60, transparent)` }} />

            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-center px-6 py-7">
              {avgScore !== null ? (
                <div className="flex justify-center sm:justify-start">
                  <ArcGauge score={avgScore} size={190} />
                </div>
              ) : null}

              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-2">Average Performance</p>
                <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight leading-tight">{headline}</h2>
                <p className="text-sm text-white/55 leading-relaxed mb-4">
                  {progressArc || (avgScore !== null
                    ? `Avg of ${avgScore} across ${coachScores.length} stream${coachScores.length !== 1 ? "s" : ""}.`
                    : "Analyze a stream to see your score.")}
                </p>

                <div className="flex flex-wrap gap-2">
                  {scoreTrend !== null && scoreTrend !== 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                      style={{
                        background: scoreTrend > 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                        borderColor: scoreTrend > 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
                        color: scoreTrend > 0 ? "#4ade80" : "#f87171",
                      }}
                    >
                      {scoreTrend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {scoreTrend > 0 ? `+${scoreTrend}` : scoreTrend} vs last
                    </span>
                  )}
                  {latestScore !== null && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                      Latest <span className={scoreCls(latestScore)}>{latestScore}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                    {coachScores.length} stream{coachScores.length !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                    {totalPeaks} clip moments
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                    {totalClips} clips generated
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── STREAM QUALITY OVER TIME ──────────────────────────────── */}
          {coachScores.length > 0 && (() => {
            const W = 640;
            const H = 140;
            const TOP = 28;
            const PAD = 32;
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

            const curvePath = pts.map((p, i) => {
              if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              const prev = pts[i - 1];
              const cpx = (prev.x + p.x) / 2;
              return `C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(" ");
            const areaPath = `${curvePath} L${pts[n - 1].x.toFixed(1)},${(TOP + H).toFixed(1)} L${pts[0].x.toFixed(1)},${(TOP + H).toFixed(1)} Z`;
            const avgY = avgScore !== null ? TOP + H - (avgScore / 100) * H : null;
            const bandHex = avgHex;

            return (
              <div
                className="rounded-2xl relative overflow-hidden"
                style={{
                  background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${bandHex}10 0%, rgba(10,9,20,0) 65%), rgba(10,9,20,0.98)`,
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px" style={{ background: `linear-gradient(90deg, transparent, ${bandHex}50, transparent)` }} />

                <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Stream Quality</p>
                    <h2 className="text-sm font-bold text-white">Coach score over time</h2>
                  </div>
                  {scoreTrend !== null && scoreTrend !== 0 && (
                    <span className={`text-xs font-semibold flex items-center gap-1 ${scoreTrend > 0 ? "text-green-400" : "text-red-400"}`}>
                      {scoreTrend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {scoreTrend > 0 ? "+" : ""}{scoreTrend} from last
                    </span>
                  )}
                </div>

                <div className="px-6 py-6">
                  <svg viewBox={`0 0 ${W} ${TOP + H + 28}`} width="100%" className="overflow-visible">
                    <defs>
                      <linearGradient id="score-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(168,85,247,0.22)" />
                        <stop offset="60%" stopColor="rgba(168,85,247,0.05)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                      </linearGradient>
                      <linearGradient id="score-line-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(168,85,247,0.45)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0.9)" />
                      </linearGradient>
                      <filter id="dot-glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {[25, 50, 75].map((tick) => {
                      const gy = TOP + H - (tick / 100) * H;
                      return (
                        <g key={tick}>
                          <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                          <text x={PAD - 8} y={gy + 3.5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.18)">{tick}</text>
                        </g>
                      );
                    })}

                    {avgY !== null && (
                      <g>
                        <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={W - PAD + 4} y={avgY + 3.5} fontSize="9" fill="rgba(255,255,255,0.28)">avg</text>
                      </g>
                    )}

                    <path d={areaPath} fill="url(#score-area-fill)" />
                    <path d={curvePath} fill="none" stroke="url(#score-line-grad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                    {pts.map((p) => (
                      <a key={`pt-${p.id}`} href={`/dashboard/vods/${p.id}`} style={{ cursor: "pointer" }}>
                        <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="11" fontWeight="700"
                          fill={dotColor(p.score)} fillOpacity={p.isLatest ? 1 : 0.65}>
                          {p.score}
                        </text>
                        <circle cx={p.x} cy={p.y} r={p.isLatest ? 9 : 6.5} fill={dotGlow(p.score)} fillOpacity={0.15} />
                        <circle cx={p.x} cy={p.y} r={p.isLatest ? 5 : 3.5}
                          fill={dotColor(p.score)} fillOpacity={p.isLatest ? 1 : 0.75}
                          stroke={p.isLatest ? dotGlow(p.score) : "rgba(0,0,0,0.3)"}
                          strokeWidth={p.isLatest ? 2 : 1.5}
                          filter={p.isLatest ? "url(#dot-glow)" : undefined}
                        />
                        <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                      </a>
                    ))}

                    {pts.map((p) => (
                      <text key={`date-${p.id}`} x={p.x} y={TOP + H + 20} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">
                        {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </text>
                    ))}
                  </svg>

                  {progressArc && (
                    <p className="text-xs text-white/40 italic mt-3 leading-relaxed">{progressArc}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── BEST STREAM + HOTTEST MOMENT (featured violet) ─────────── */}
          {(bestStream || bestPeak) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bestStream && (
                <Link
                  href={`/dashboard/vods/${bestStream.id}`}
                  className="rounded-2xl px-5 py-5 relative overflow-hidden group transition-all hover:-translate-y-px"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(109,40,217,0.05) 60%, rgba(10,9,20,0) 100%)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    boxShadow: "0 0 30px rgba(139,92,246,0.06) inset",
                  }}
                >
                  <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.6), transparent)" }} />
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">Best Stream</p>
                    <ChevronRight size={14} className="text-violet-400/40 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-4xl font-black tabular-nums leading-none ${scoreCls(bestStream.score)}`}>{bestStream.score}</span>
                    <span className="text-sm font-bold text-white/20">/100</span>
                  </div>
                  <p className="text-sm font-semibold text-white/90 truncate mb-1 group-hover:text-white transition-colors">{bestStream.title}</p>
                  <p className="text-xs text-white/40">{new Date(bestStream.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </Link>
              )}

              {bestPeak && (
                <Link
                  href={`/dashboard/vods/${bestPeak.vodId}`}
                  className="rounded-2xl px-5 py-5 relative overflow-hidden group transition-all hover:-translate-y-px"
                  style={{
                    background: "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(185,28,28,0.04) 60%, rgba(10,9,20,0) 100%)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    boxShadow: "0 0 30px rgba(239,68,68,0.05) inset",
                  }}
                >
                  <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.6), transparent)" }} />
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-400">Hottest Moment</p>
                    <ChevronRight size={14} className="text-red-400/40 group-hover:text-red-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black tabular-nums leading-none text-red-400">{Math.round(bestPeak.score * 100)}</span>
                    <span className="text-sm font-bold text-white/20">/100</span>
                  </div>
                  <p className="text-sm font-semibold text-white/90 truncate mb-1 group-hover:text-white transition-colors">{bestPeak.title}</p>
                  <p className="text-xs text-white/40 truncate">From: {bestPeak.vodTitle}</p>
                </Link>
              )}
            </div>
          )}

          {/* ── CATEGORY BREAKDOWN — violet hero + bars ────────────────── */}
          {sortedCategories.length > 0 && (() => {
            const dominantCat = sortedCategories[0][0];
            const dominantLabel = CATEGORY_LABELS[dominantCat] || dominantCat;
            const dominantColor = CATEGORY_COLORS[dominantCat] || "#8b5cf6";
            const dominantCount = sortedCategories[0][1];
            const dominantPct = Math.round((dominantCount / totalPeaks) * 100);

            return (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">What Gets You Clipped</p>
                  <h2 className="text-sm font-bold text-white">Content mix across your clip moments</h2>
                </div>

                {/* Dominant archetype hero */}
                <div
                  className="px-6 py-6 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${dominantColor}18 0%, ${dominantColor}06 60%, rgba(10,9,20,0) 100%)`,
                  }}
                >
                  <div className="absolute top-0 left-0 w-32 h-px" style={{ background: `linear-gradient(90deg, ${dominantColor}80, transparent)` }} />
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1" style={{ color: dominantColor }}>#1 Archetype</p>
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-none mb-1" style={{ color: dominantColor }}>{dominantLabel}</h3>
                      <p className="text-xs text-white/45">{dominantCount} of {totalPeaks} moments — {dominantPct}% of what your audience clips</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl sm:text-6xl font-black tabular-nums leading-none" style={{ color: dominantColor }}>{dominantPct}</span>
                      <span className="text-lg font-bold text-white/25">%</span>
                    </div>
                  </div>
                </div>

                {/* Full breakdown bars */}
                <div className="px-6 py-5 space-y-3">
                  {sortedCategories.slice(0, 8).map(([cat, count], i) => {
                    const label = CATEGORY_LABELS[cat] || cat;
                    const pct = Math.round((count / totalPeaks) * 100);
                    const color = CATEGORY_COLORS[cat] || "#8b5cf6";
                    const isDominant = i === 0;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={`text-xs font-semibold w-24 flex-shrink-0 ${isDominant ? "text-white" : "text-white/55"}`}>
                          {label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${color}aa, ${color})`,
                              boxShadow: isDominant ? `0 0 10px ${color}55` : undefined,
                              opacity: isDominant ? 1 : 0.6,
                            }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-14 text-right tabular-nums flex-shrink-0 ${isDominant ? "text-white" : "text-white/40"}`}>
                          {count} · {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── CONTENT TYPE + SWEET SPOT (two-column info) ───────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contentInsight && (
              <div
                className="rounded-2xl px-5 py-5 relative overflow-hidden"
                style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "2px solid rgba(139,92,246,0.5)" }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-3">What Works Best</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black tabular-nums leading-none text-white">{contentInsight.best.label}</span>
                </div>
                <p className="text-xs text-white/45 mb-4">scored an average of <span className="text-white/80 font-bold">{contentInsight.best.avg}</span> across {contentInsight.best.count} streams</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-12 text-white/60 font-semibold">{contentInsight.best.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${contentInsight.best.avg}%`, background: "linear-gradient(90deg, #8b5cf6aa, #8b5cf6)" }} />
                    </div>
                    <span className="text-[11px] font-bold text-white w-6 text-right tabular-nums">{contentInsight.best.avg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-12 text-white/40 font-semibold">{contentInsight.worst.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${contentInsight.worst.avg}%`, background: "rgba(255,255,255,0.2)" }} />
                    </div>
                    <span className="text-[11px] font-bold text-white/40 w-6 text-right tabular-nums">{contentInsight.worst.avg}</span>
                  </div>
                </div>
              </div>
            )}

            {sweetSpot ? (
              <div
                className="rounded-2xl px-5 py-5 relative overflow-hidden"
                style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "2px solid rgba(59,130,246,0.5)" }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 mb-3">Sweet Spot Length</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black tabular-nums leading-none text-white">{sweetSpot.label}</span>
                </div>
                <p className="text-xs text-white/45 mb-4">avg score <span className="text-white/80 font-bold">{sweetSpot.avg}</span> — noticeably better than {sweetSpot.otherLabel}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-16 text-white/60 font-semibold">{sweetSpot.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${sweetSpot.avg}%`, background: "linear-gradient(90deg, #3b82f6aa, #3b82f6)" }} />
                    </div>
                    <span className="text-[11px] font-bold text-white w-6 text-right tabular-nums">{sweetSpot.avg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-16 text-white/40 font-semibold">{sweetSpot.otherLabel}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${sweetSpot.other}%`, background: "rgba(255,255,255,0.2)" }} />
                    </div>
                    <span className="text-[11px] font-bold text-white/40 w-6 text-right tabular-nums">{sweetSpot.other}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl px-5 py-5 relative overflow-hidden"
                style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "2px solid rgba(59,130,246,0.5)" }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 mb-3">Clip Moments Per Stream</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-black tabular-nums leading-none text-white">
                    {analyzedVods.length > 0 ? (totalPeaks / analyzedVods.length).toFixed(1) : "0"}
                  </span>
                  <span className="text-sm font-bold text-white/25">/ stream</span>
                </div>
                <p className="text-xs text-white/45">{totalPeaks} total across {analyzedVods.length} streams</p>
              </div>
            )}
          </div>

          {/* ── FOLLOWER TREND ─────────────────────────────────────────── */}
          <FollowerTrend snapshots={snapshots} needsReconnect={false} />

          {/* ── RECENT STREAMS TABLE ───────────────────────────────────── */}
          {analyzedVods.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Recent Streams</p>
                <h2 className="text-sm font-bold text-white">Your last {Math.min(analyzedVods.length, 10)} analyzed streams</h2>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {analyzedVods.slice(0, 10).map((vod) => {
                  const peaks = (vod.peak_data as Array<{ score: number; category: string }>) || [];
                  const coachScore = vod.coach_report ? (vod.coach_report as any).overall_score as number : null;
                  const rowHex = coachScore === null ? "#4b5563" : scoreHex(coachScore);
                  const scoreTextColor = coachScore === null ? "text-white/40" : scoreCls(coachScore);
                  const topCat = peaks.length > 0 ? mostCommon(peaks.map((p) => p.category)) : null;
                  const catColor = topCat ? CATEGORY_COLORS[topCat] : null;

                  return (
                    <Link
                      key={vod.id}
                      href={`/dashboard/vods/${vod.id}`}
                      className="flex items-stretch group hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-[3px] flex-shrink-0" style={{ background: rowHex, opacity: 0.8 }} />

                      <div className="flex items-center gap-4 px-5 py-4 flex-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white/90 truncate group-hover:text-white transition-colors">{vod.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-white/40">
                              {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {" · "}{formatDuration(vod.duration_seconds)}
                              {" · "}{peaks.length} moment{peaks.length !== 1 ? "s" : ""}
                            </span>
                            {topCat && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{
                                  color: catColor || "rgba(255,255,255,0.5)",
                                  backgroundColor: catColor ? `${catColor}18` : "rgba(255,255,255,0.05)",
                                }}
                              >
                                {CATEGORY_LABELS[topCat] || topCat}
                              </span>
                            )}
                          </div>
                        </div>

                        {coachScore !== null && (
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.05] overflow-hidden hidden sm:block">
                              <div className="h-full rounded-full" style={{ width: `${coachScore}%`, background: rowHex, boxShadow: `0 0 6px ${rowHex}55` }} />
                            </div>
                            <span className={`text-2xl font-black tabular-nums leading-none ${scoreTextColor}`}>{coachScore}</span>
                            <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
