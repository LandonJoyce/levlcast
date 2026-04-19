import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Flame, Star } from "lucide-react";
import { WrappedShareButton } from "@/components/dashboard/wrapped-share-button";

function scoreHex(n: number) { return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171"; }
function scoreCls(n: number) { return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400"; }

function ArcGauge({ score }: { score: number }) {
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
  const largeArc = 1;
  const progLarge = (score / 100) * sweep > 180 ? 1 : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 144 }}>
      <svg width="200" height="144" viewBox="0 0 160 120" className="absolute inset-0">
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
      <div className="flex flex-col items-center" style={{ marginTop: 12 }}>
        <div className="flex items-baseline gap-1">
          <span className={`font-black tabular-nums leading-none ${cls}`} style={{ fontSize: 52 }}>{score}</span>
          <span className="text-xl font-bold text-white/20">/100</span>
        </div>
      </div>
    </div>
  );
}

export default async function WrappedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();

  // Show last full month (if data exists), else current month
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = lastMonthDate.toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: lastMonthVods }, { data: currentMonthVods }, { data: profile }] = await Promise.all([
    supabase.from("vods").select("coach_report, analyzed_at, duration_seconds, title, peak_data").eq("user_id", user!.id).eq("status", "ready").gte("analyzed_at", lastMonthStart).lt("analyzed_at", lastMonthEnd).order("analyzed_at", { ascending: true }),
    supabase.from("vods").select("coach_report, analyzed_at, duration_seconds, title, peak_data").eq("user_id", user!.id).eq("status", "ready").gte("analyzed_at", currentMonthStart).order("analyzed_at", { ascending: true }),
    supabase.from("profiles").select("twitch_display_name").eq("id", user!.id).single(),
  ]);

  const useLastMonth = (lastMonthVods?.length ?? 0) >= 2;
  const vods = useLastMonth ? lastMonthVods! : (currentMonthVods ?? []);
  const monthDate = useLastMonth ? lastMonthDate : now;
  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (vods.length === 0) {
    return (
      <div>
        <Link href="/dashboard/vods" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6">
          <ArrowLeft size={14} />Back to VODs
        </Link>
        <div className="rounded-2xl p-16 text-center" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Star size={28} className="text-violet-400/60 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-2">No data yet</h2>
          <p className="text-sm text-white/45 max-w-sm mx-auto">Analyze at least 2 streams to unlock your monthly Wrapped.</p>
        </div>
      </div>
    );
  }

  // Compute stats
  const scores = vods.map((v) => (v.coach_report as any)?.overall_score as number).filter((s) => typeof s === "number");
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);
  const bestVod = vods[scores.indexOf(bestScore)];

  const totalDuration = vods.reduce((a, v) => a + (v.duration_seconds ?? 0), 0);

  // Score trend: first half vs second half
  const half = Math.floor(scores.length / 2);
  const firstHalfAvg = half > 0 ? scores.slice(0, half).reduce((a, b) => a + b, 0) / half : null;
  const secondHalfAvg = half > 0 ? scores.slice(half).reduce((a, b) => a + b, 0) / (scores.length - half) : null;
  const trend = firstHalfAvg !== null && secondHalfAvg !== null
    ? secondHalfAvg - firstHalfAvg > 3 ? "improving" : secondHalfAvg - firstHalfAvg < -3 ? "declining" : "consistent"
    : "consistent";

  // Best clip moment
  const allPeaks = vods.flatMap((v) => ((v.peak_data as any[]) || []).map((p: any) => ({ ...p, vodTitle: v.title })));
  const bestPeak = allPeaks.reduce<any>((best, p) => (!best || p.score > best.score ? p : best), null);

  // Streamer type distribution
  const types = vods.map((v) => (v.coach_report as any)?.streamer_type as string).filter(Boolean);
  const typeCounts: Record<string, number> = {};
  for (const t of types) typeCounts[t] = (typeCounts[t] || 0) + 1;
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const typeLabel: Record<string, string> = { gaming: "Gaming", just_chatting: "Just Chatting", irl: "IRL", variety: "Variety", educational: "Educational" };

  const hex = scoreHex(avgScore);
  const name = profile?.twitch_display_name ?? "Streamer";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link href="/dashboard/vods" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={14} />Back to VODs
        </Link>
        <WrappedShareButton />
      </div>

      {/* The wrapped card */}
      <div id="wrapped-card" className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center relative overflow-hidden" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: `radial-gradient(ellipse 80% 80% at 50% 0%, ${hex}18 0%, rgba(10,9,20,0) 70%)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px" style={{ background: `linear-gradient(90deg, transparent, ${hex}70, transparent)` }} />
          <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1" style={{ color: hex }}>{name}</p>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">{monthLabel} Wrapped</h1>
          <p className="text-xs text-white/30">{vods.length} stream{vods.length !== 1 ? "s" : ""} analyzed</p>
        </div>

        <div className="px-6 py-8 space-y-6">

          {/* Average score hero */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/30 mb-3">Average Score</p>
            <ArcGauge score={avgScore} />
            <div className="flex items-center gap-2 mt-2">
              {trend === "improving" && <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400"><TrendingUp size={12} />Improving this month</span>}
              {trend === "declining" && <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400"><TrendingDown size={12} />Room to grow</span>}
              {trend === "consistent" && <span className="flex items-center gap-1.5 text-xs font-semibold text-white/30"><Minus size={12} />Consistent</span>}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBlock label="Streams" value={vods.length.toString()} color="#8b5cf6" />
            <StatBlock label="Best Score" value={`${bestScore}`} color={scoreHex(bestScore)} />
            <StatBlock label="Worst Score" value={`${worstScore}`} color={scoreHex(worstScore)} />
            <StatBlock label="Total Time" value={formatDuration(totalDuration)} color="#facc15" />
          </div>

          {/* Best stream */}
          {bestVod && (
            <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: `radial-gradient(ellipse 80% 80% at 0% 50%, ${scoreHex(bestScore)}12 0%, rgba(10,9,20,0) 70%), rgba(255,255,255,0.02)`, border: `1px solid ${scoreHex(bestScore)}30` }}>
              <div className="absolute top-0 left-0 w-20 h-px" style={{ background: `linear-gradient(90deg, ${scoreHex(bestScore)}70, transparent)` }} />
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={11} style={{ color: scoreHex(bestScore) }} />
                <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: scoreHex(bestScore) }}>Best Stream</span>
                <span className="ml-auto text-lg font-black tabular-nums" style={{ color: scoreHex(bestScore) }}>{bestScore}</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{(bestVod as any).title}</p>
            </div>
          )}

          {/* Best clip moment */}
          {bestPeak && (
            <div className="rounded-xl px-5 py-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(10,9,20,0) 100%)", border: "1px solid rgba(139,92,246,0.22)" }}>
              <div className="absolute top-0 left-0 w-20 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.6), transparent)" }} />
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-2">Best Clip Moment</p>
              <p className="text-sm font-bold text-white mb-1">{bestPeak.title}</p>
              <p className="text-xs text-white/45 leading-relaxed">{bestPeak.reason}</p>
              {bestPeak.vodTitle && <p className="text-[10px] text-white/25 mt-2 font-medium">from "{bestPeak.vodTitle}"</p>}
            </div>
          )}

          {/* Score arc over time */}
          {scores.length >= 3 && (
            <div className="rounded-xl px-5 py-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/25 mb-4">Score Arc</p>
              <div className="flex items-end gap-1.5 h-12">
                {scores.map((s, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, (s / 100) * 100)}%`, background: scoreHex(s), opacity: 0.7 + (i / scores.length) * 0.3, boxShadow: `0 0 4px ${scoreHex(s)}55` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-white/20">Stream 1</span>
                <span className="text-[9px] text-white/20">Stream {scores.length}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            {dominantType && (
              <div className="flex items-center gap-2">
                <Flame size={11} className="text-orange-400" />
                <span className="text-xs text-white/40">Mostly streaming <span className="text-white/70 font-semibold">{typeLabel[dominantType] ?? dominantType}</span></span>
              </div>
            )}
            <span className="text-xs text-white/20 ml-auto font-bold tracking-wide">LevlCast</span>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl px-4 py-4 relative overflow-hidden text-center" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}80, transparent)` }} />
      <p className="text-xl sm:text-2xl font-black tabular-nums leading-none mb-1.5" style={{ color }}>{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
    </div>
  );
}
