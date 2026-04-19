import { createClient } from "@/lib/supabase/server";
import WelcomeModal from "@/components/dashboard/welcome-modal";
import Link from "next/link";
import { Film, CheckCircle2, Circle, ArrowRight, ChevronRight, TrendingUp, TrendingDown, Trophy, Scissors } from "lucide-react";

function scoreHex(n: number) { return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171"; }
function scoreCls(n: number) { return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400"; }

function ArcGauge({ score, size = 170 }: { score: number; size?: number }) {
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [vodsResult, clipsResult, peaksResult, profileResult, recentVodsResult, analyzedResult] = await Promise.all([
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "ready"),
    supabase.from("vods").select("peak_data").eq("user_id", user!.id).eq("status", "ready").not("peak_data", "is", null),
    supabase.from("profiles").select("twitch_display_name").eq("id", user!.id).single(),
    supabase.from("vods").select("id, title, coach_report, stream_date, peak_data, status").eq("user_id", user!.id).order("stream_date", { ascending: false }).limit(6),
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "ready"),
  ]);

  const totalVods = vodsResult.count || 0;
  const totalClips = clipsResult.count || 0;
  const totalAnalyzed = analyzedResult.count || 0;
  const totalPeaks = (peaksResult.data || []).reduce((sum, v) => sum + ((v.peak_data as any[])?.length || 0), 0);
  const displayName = profileResult.data?.twitch_display_name || "Streamer";
  const recentVods = recentVodsResult.data || [];
  const readyVods = recentVods.filter((v) => v.status === "ready");
  const latestReady = readyVods[0] || null;
  const latestScore = latestReady ? (latestReady.coach_report as any)?.overall_score as number | null : null;
  const prevScore = readyVods[1] ? (readyVods[1].coach_report as any)?.overall_score as number | undefined : undefined;
  const delta = latestScore !== null && prevScore !== undefined ? latestScore - prevScore : null;
  const unclipped = Math.max(0, totalPeaks - totalClips);

  const last5Scores = readyVods.slice(0, 5).map((v) => Number((v.coach_report as any)?.overall_score)).filter((s) => Number.isFinite(s));
  const avg5 = last5Scores.length > 0 ? last5Scores.reduce((a, b) => a + b, 0) / last5Scores.length : 0;
  const RANK_TIERS = [
    { title: "Fresh Streamer",     min: 0,  next: 40  },
    { title: "Rising Talent",      min: 40, next: 55  },
    { title: "Consistent Creator", min: 55, next: 70  },
    { title: "Crowd Favorite",     min: 70, next: 80  },
    { title: "Elite Entertainer",  min: 80, next: 90  },
    { title: "LevlCast Legend",    min: 90, next: null },
  ];
  const currentTier = last5Scores.length === 0 ? null : RANK_TIERS.slice().reverse().find((t) => avg5 >= t.min) ?? RANK_TIERS[0];
  const streamerTitle = currentTier?.title ?? null;
  const nextTier = currentTier?.next !== null ? RANK_TIERS.find((t) => t.min === currentTier?.next) ?? null : null;
  const rankProgress = currentTier && nextTier ? Math.min(1, (avg5 - currentTier.min) / (nextTier.min - currentTier.min)) : 1;

  const isEmpty = totalVods === 0 && totalClips === 0;
  const needsOnboarding = !isEmpty && (totalAnalyzed === 0 || totalClips === 0);
  const latestHex = latestScore !== null ? scoreHex(latestScore) : "#8b5cf6";

  const headline = latestScore === null
    ? "Ready when you are."
    : latestScore >= 75 ? "That last stream hit."
    : latestScore >= 60 ? "Solid run. Let's build on it."
    : latestScore >= 45 ? "You've got a foundation."
    : "Reset time — here's what to fix.";

  return (
    <div className="max-w-3xl">
      {isEmpty && <WelcomeModal name={displayName} />}

      {/* Greeting */}
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Welcome back</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Hey, {displayName}</h1>
        <p className="text-sm text-muted">
          {isEmpty ? "Let's get your stream set up." : needsOnboarding ? "Complete your setup below to get started." : "Here's where you're at."}
        </p>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl p-16 text-center relative overflow-hidden" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(139,92,246,0.12) 0%, rgba(10,9,20,0) 70%), rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)" }} />
          <Film size={28} className="text-violet-400/60 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-2 tracking-tight">No VODs yet</h2>
          <p className="text-sm text-white/55 max-w-md mx-auto mb-8 leading-relaxed">Sync your Twitch VODs to get started. LevlCast will analyze your streams and find your best moments.</p>
          <Link href="/dashboard/vods" className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] active:scale-[0.97]">
            <Film size={16} /> Sync VODs
          </Link>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Onboarding checklist */}
          {needsOnboarding && (
            <div className="rounded-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.05) 60%, rgba(10,9,20,0) 100%)", border: "1px solid rgba(139,92,246,0.28)", boxShadow: "0 0 30px rgba(139,92,246,0.08) inset" }}>
              <div className="absolute top-0 left-0 w-32 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.7), transparent)" }} />
              <div className="px-6 py-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-1">Getting Started</p>
                <h2 className="text-lg font-black text-white mb-5 tracking-tight">Your first moves</h2>
                <div className="space-y-4">
                  <OnboardingStep done={totalVods > 0} label="Sync your Twitch VODs" detail={totalVods > 0 ? `${totalVods} VOD${totalVods !== 1 ? "s" : ""} synced` : "Import your recent streams from Twitch"} href="/dashboard/vods" cta="Go to VODs" />
                  <OnboardingStep done={totalAnalyzed > 0} label="Analyze your first stream" detail={totalAnalyzed > 0 ? `${totalAnalyzed} stream${totalAnalyzed !== 1 ? "s" : ""} analyzed` : "Get a coach score and find your best moments"} href="/dashboard/vods" cta="Pick a VOD" />
                  <OnboardingStep done={totalClips > 0} label="Generate your first clip" detail={totalClips > 0 ? `${totalClips} clip${totalClips !== 1 ? "s" : ""} ready` : "Turn your best moments into shareable clips"} href={latestReady ? `/dashboard/vods/${latestReady.id}` : "/dashboard/vods"} cta="Make a clip" />
                </div>
              </div>
            </div>
          )}

          {/* Latest stream hero */}
          {latestScore !== null && latestReady && (
            <Link href={`/dashboard/vods/${latestReady.id}`} className="block rounded-2xl relative overflow-hidden group transition-all hover:-translate-y-px" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${latestHex}15 0%, rgba(10,9,20,0) 70%), rgba(10,9,20,0.98)`, border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px" style={{ background: `linear-gradient(90deg, transparent, ${latestHex}60, transparent)` }} />
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-8 items-center px-6 py-6">
                <div className="flex justify-center sm:justify-start">
                  <ArcGauge score={latestScore} size={170} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">Latest Stream</p>
                    <ChevronRight size={14} className="text-violet-400/40 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mb-1 tracking-tight leading-tight truncate">{headline}</h2>

                  {streamerTitle && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15" }}>
                          <Trophy size={9} />{streamerTitle}
                        </span>
                        {nextTier && (
                          <span className="text-[10px] text-white/30 font-semibold">
                            {Math.round(avg5 * 10) / 10} / {nextTier.min} avg → <span className="text-white/50">{nextTier.title}</span>
                          </span>
                        )}
                      </div>
                      {nextTier && (
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden w-full">
                          <div className="h-full rounded-full" style={{ width: `${rankProgress * 100}%`, background: "linear-gradient(90deg, #facc15, #fb923c)", boxShadow: "0 0 6px rgba(250,204,21,0.4)" }} />
                        </div>
                      )}
                      {!nextTier && <p className="text-[10px] text-yellow-400/60 font-semibold">You&apos;ve hit the top rank.</p>}
                    </div>
                  )}

                  <p className="text-sm font-semibold text-white/80 truncate mb-1">{latestReady.title}</p>
                  <p className="text-xs text-white/40 mb-4">{new Date(latestReady.stream_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

                  <div className="flex flex-wrap gap-2">
                    {delta !== null && delta !== 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border" style={{ background: delta > 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", borderColor: delta > 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)", color: delta > 0 ? "#4ade80" : "#f87171" }}>
                        {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {delta > 0 ? `+${delta}` : delta} vs previous
                      </span>
                    )}
                    {unclipped > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-violet-400/25 bg-violet-500/10 text-violet-300">
                        {unclipped} moment{unclipped !== 1 ? "s" : ""} to clip
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                      View full report
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Recent streams */}
          {readyVods.length > 1 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-sm font-bold text-white">Recent Streams</p>
                <Link href="/dashboard/vods" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                  See all <ChevronRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {readyVods.slice(1, 5).map((vod) => {
                  const score = (vod.coach_report as any)?.overall_score as number | undefined;
                  const peaks = (vod.peak_data as any[])?.length || 0;
                  const rowHex = score === undefined ? "#4b5563" : scoreHex(score);
                  return (
                    <Link key={vod.id} href={`/dashboard/vods/${vod.id}`} className="flex items-stretch group hover:bg-white/[0.02] transition-colors">
                      <div className="w-[3px] flex-shrink-0" style={{ background: rowHex, opacity: 0.8 }} />
                      <div className="flex items-center gap-4 px-5 py-3.5 flex-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white/90 truncate group-hover:text-white transition-colors">{vod.title}</p>
                          <p className="text-xs text-white/40 mt-0.5">{new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {peaks} moment{peaks !== 1 ? "s" : ""}</p>
                        </div>
                        {score !== undefined && (
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-16 h-1 rounded-full bg-white/[0.05] overflow-hidden hidden sm:block">
                              <div className="h-full rounded-full" style={{ width: `${score}%`, background: rowHex, boxShadow: `0 0 6px ${rowHex}55` }} />
                            </div>
                            <span className={`text-xl font-black tabular-nums leading-none ${scoreCls(score)}`}>{score}</span>
                            <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 transition-all" />
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/vods" className="rounded-2xl p-5 flex items-center gap-3 group hover:-translate-y-px transition-all" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Film size={18} className="text-violet-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">VODs</p>
                <p className="text-xs text-white/40">{totalAnalyzed} analyzed</p>
              </div>
              <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 ml-auto transition-all" />
            </Link>
            <Link href="/dashboard/clips" className="rounded-2xl p-5 flex items-center gap-3 group hover:-translate-y-px transition-all" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Scissors size={18} className="text-violet-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Clips</p>
                <p className="text-xs text-white/40">{totalClips} ready{unclipped > 0 ? ` · ${unclipped} to make` : ""}</p>
              </div>
              <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 ml-auto transition-all" />
            </Link>
          </div>

        </div>
      )}
    </div>
  );
}

function OnboardingStep({ done, label, detail, href, cta }: { done: boolean; label: string; detail: string; href: string; cta: string }) {
  return (
    <div className="flex items-center gap-3">
      {done
        ? <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(74,222,128,0.4))" }} />
        : <Circle size={18} className="text-violet-400/50 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${done ? "text-white/40 line-through" : "text-white"}`}>{label}</p>
        <p className="text-xs text-white/45 mt-0.5">{detail}</p>
      </div>
      {!done && (
        <Link href={href} className="flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0">
          {cta} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}
