import { createClient } from "@/lib/supabase/server";
import { ArchetypeCard } from "@/components/dashboard/grow/archetype-card";
import { ConsistencyGrid } from "@/components/dashboard/grow/consistency-grid";
import { TacticsCarousel } from "@/components/dashboard/grow/tactics-carousel";
import { TrendingUp, TrendingDown, Minus, ChevronRight, Play } from "lucide-react";
import Link from "next/link";

interface Peak {
  category: string;
  score: number;
  title: string;
  caption: string;
}

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

// ─── Arc Gauge ────────────────────────────────────────────────────────────
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

  const categoryCounts: Record<string, number> = {};
  const streamerTypeCounts: Record<string, number> = {};
  const coachScores: number[] = [];

  for (const vod of vods || []) {
    const peaks = (vod.peak_data as Peak[]) || [];
    for (const peak of peaks) {
      const cat = peak.category?.toLowerCase();
      if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
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

  // Score trend: compare oldest 3 vs newest 3 (scores desc by stream_date → reverse for oldest first)
  const reversed = [...coachScores].reverse();
  let scoreTrend: "up" | "down" | "flat" | null = null;
  let avgScore: number | null = null;
  let trendDelta: number | null = null;
  if (reversed.length >= 1) {
    avgScore = Math.round(reversed.reduce((a, b) => a + b, 0) / reversed.length);
  }
  if (reversed.length >= 4) {
    const early = reversed.slice(0, 3);
    const recent = reversed.slice(-3);
    const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const delta = recentAvg - earlyAvg;
    trendDelta = Math.round(delta);
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

  // Pulse color keyed to trend/avg
  const pulseHex = scoreTrend === "up" ? "#4ade80"
    : scoreTrend === "down" ? "#f87171"
    : avgScore !== null ? scoreHex(avgScore)
    : "#8b5cf6";

  const pulseHeadline = scoreTrend === "up"
    ? "You're trending up."
    : scoreTrend === "down"
    ? "You're slipping — time to reset."
    : scoreTrend === "flat"
    ? "You've got a consistent baseline."
    : avgScore !== null
    ? "Your formula is starting to show."
    : "Let's build your playbook.";

  const pulseSub = scoreTrend === "up" && trendDelta !== null
    ? `Your recent streams average ${trendDelta} points higher than your early ones. Keep the pattern going.`
    : scoreTrend === "down" && trendDelta !== null
    ? `Recent streams are ${Math.abs(trendDelta)} points below your early pace. Below are the levers to pull.`
    : scoreTrend === "flat"
    ? `You're holding steady. Time to break through by sharpening your highest-performing content.`
    : avgScore !== null
    ? `Across ${reversed.length} stream${reversed.length !== 1 ? "s" : ""}, your avg coach score is ${avgScore}.`
    : "Analyze more streams to unlock trend insights.";

  const consistencyBadge =
    recentStreamCount >= 20 ? { label: "Excellent pace", color: "#4ade80" }
    : recentStreamCount >= 12 ? { label: "Good pace", color: "#4ade80" }
    : recentStreamCount >= 6 ? { label: "Needs work", color: "#facc15" }
    : { label: "Stream more", color: "#f87171" };

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

          {/* ── GROWTH PULSE HERO ─────────────────────────────────────── */}
          <div
            className="rounded-2xl relative overflow-hidden"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${pulseHex}15 0%, rgba(10,9,20,0) 70%), rgba(10,9,20,0.98)`,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px" style={{ background: `linear-gradient(90deg, transparent, ${pulseHex}60, transparent)` }} />

            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-center px-6 py-7">
              {avgScore !== null ? (
                <div className="flex justify-center sm:justify-start">
                  <ArcGauge score={avgScore} size={190} />
                </div>
              ) : null}

              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-2">Growth Pulse</p>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {scoreTrend === "up" && <TrendingUp size={22} className="text-green-400 flex-shrink-0" />}
                  {scoreTrend === "down" && <TrendingDown size={22} className="text-red-400 flex-shrink-0" />}
                  {scoreTrend === "flat" && <Minus size={22} className="text-yellow-400 flex-shrink-0" />}
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{pulseHeadline}</h2>
                </div>
                <p className="text-sm text-white/55 leading-relaxed mb-4">{pulseSub}</p>

                <div className="flex flex-wrap gap-2">
                  {trendDelta !== null && trendDelta !== 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                      style={{
                        background: trendDelta > 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                        borderColor: trendDelta > 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
                        color: trendDelta > 0 ? "#4ade80" : "#f87171",
                      }}
                    >
                      {trendDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {trendDelta > 0 ? `+${trendDelta}` : trendDelta} pts
                    </span>
                  )}
                  {dominantCatLabel && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                      style={{
                        background: `${dominantCatColor}12`,
                        borderColor: `${dominantCatColor}30`,
                        color: dominantCatColor,
                      }}
                    >
                      {dominantCatLabel} ({dominantCatPct}%)
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                    style={{
                      background: `${consistencyBadge.color}10`,
                      borderColor: `${consistencyBadge.color}25`,
                      color: consistencyBadge.color,
                    }}
                  >
                    {recentStreamCount} streams · {consistencyBadge.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                    {totalPeaks} clip moments
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ARCHETYPE CARD (existing component) ──────────────────── */}
          <ArchetypeCard
            dominantCategory={dominantCategory}
            dominantStreamerType={dominantStreamerType}
            categoryCounts={categoryCounts}
            totalPeaks={totalPeaks}
          />

          {/* ── CONSISTENCY + TACTICS (side by side on desktop) ──────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ConsistencyGrid streamDates={streamDates} />
            <TacticsCarousel />
          </div>

          {/* ── TOP CLIPS — #1 hero, others rows ───────────────────── */}
          {topClips && topClips.length > 0 && (() => {
            const hero = topClips[0];
            const rest = topClips.slice(1);
            const heroColor = CATEGORY_COLORS[hero.peak_category] || "#8b5cf6";
            const heroLabel = CATEGORY_LABELS[hero.peak_category] || hero.peak_category;
            const heroPct = Math.round(hero.peak_score * 100);

            return (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Your Best Clips</p>
                    <h2 className="text-sm font-bold text-white">Post these first — they convert strangers.</h2>
                  </div>
                  <Link href="/dashboard/clips" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                    See all <ChevronRight size={12} />
                  </Link>
                </div>

                {/* #1 Hero */}
                <Link
                  href="/dashboard/clips"
                  className="block px-6 py-6 relative overflow-hidden group transition-colors hover:bg-white/[0.02]"
                  style={{
                    background: `linear-gradient(135deg, ${heroColor}10 0%, ${heroColor}04 60%, rgba(10,9,20,0) 100%)`,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="absolute top-0 left-0 w-32 h-px" style={{ background: `linear-gradient(90deg, ${heroColor}80, transparent)` }} />
                  <div className="flex items-center gap-5">
                    {/* Video thumb */}
                    <div className="relative w-32 sm:w-44 aspect-video flex-shrink-0 rounded-xl overflow-hidden bg-black" style={{ border: `1px solid ${heroColor}30` }}>
                      <video
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      >
                        <source src={hero.video_url} type="video/mp4" />
                      </video>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${heroColor}`, boxShadow: `0 0 16px ${heroColor}80` }}>
                          <Play size={16} className="text-white ml-0.5" fill="white" />
                        </div>
                      </div>
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white px-1.5 py-0.5 rounded" style={{ background: `${heroColor}`, boxShadow: `0 0 8px ${heroColor}90` }}>
                        #1
                      </span>
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ color: heroColor, background: `${heroColor}15`, border: `1px solid ${heroColor}30` }}>
                          {heroLabel}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Virality {heroPct}/100</span>
                      </div>
                      <p className="text-base sm:text-lg font-black text-white leading-tight mb-1 line-clamp-2">{hero.title}</p>
                      {hero.caption_text && (
                        <p className="text-xs text-white/40 line-clamp-2">{hero.caption_text}</p>
                      )}
                      <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden max-w-xs">
                        <div className="h-full rounded-full" style={{ width: `${heroPct}%`, background: `linear-gradient(90deg, ${heroColor}aa, ${heroColor})`, boxShadow: `0 0 8px ${heroColor}55` }} />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Other clip rows */}
                <div className="divide-y divide-white/[0.04]">
                  {rest.map((clip, i) => {
                    const color = CATEGORY_COLORS[clip.peak_category] || "#8b5cf6";
                    const label = CATEGORY_LABELS[clip.peak_category] || clip.peak_category;
                    const pct = Math.round(clip.peak_score * 100);
                    return (
                      <div
                        key={clip.id}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-sm font-black w-5 text-center flex-shrink-0 text-white/30 tabular-nums">
                          {i + 2}
                        </span>

                        <video
                          preload="metadata"
                          muted
                          playsInline
                          className="w-20 aspect-video rounded-lg bg-black flex-shrink-0 object-cover"
                          style={{ border: `1px solid ${color}25` }}
                        >
                          <source src={clip.video_url} type="video/mp4" />
                        </video>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white/85 truncate mb-1">{clip.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}15` }}>
                              {label}
                            </span>
                            {clip.caption_text && (
                              <span className="text-xs text-white/35 truncate line-clamp-1">{clip.caption_text}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="w-16 h-1 rounded-full bg-white/[0.05] overflow-hidden hidden sm:block">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{pct}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.015]">
                  <p className="text-xs text-white/35 leading-relaxed">
                    When a stranger lands on your Twitch from a clip, they expect this version of you. Stream like your top clips every time.
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
