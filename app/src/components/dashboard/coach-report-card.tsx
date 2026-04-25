"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Minus, Activity, AlertCircle,
  Target, Gamepad2, MessageCircle, Map, Shuffle, BookOpen,
  Volume2, VolumeX, Pause, Play, Loader2, Flame, ShieldAlert, Clock,
  CheckCircle2, Trophy,
} from "lucide-react";
import { CoachReport } from "@/lib/analyze";

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  gaming:        { label: "Gaming",        icon: <Gamepad2 size={11} />      },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={11} /> },
  irl:           { label: "IRL",           icon: <Map size={11} />           },
  variety:       { label: "Variety",       icon: <Shuffle size={11} />       },
  educational:   { label: "Educational",   icon: <BookOpen size={11} />      },
};

function scoreHex(n: number) { return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171"; }
function scoreCls(n: number) { return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400"; }

function parseItem(raw: string) {
  const recurring = /^RECURRING:\s*/i.test(raw);
  const cleaned   = raw.replace(/^RECURRING:\s*/i, "");
  const m = cleaned.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);
  if (!m) return { label: "", body: cleaned, ts: null, recurring };
  let body = m[2].trim();
  const tsM = body.match(/\s+at\s+(\d{1,2}:\d{2})\.?\s*$/i);
  const ts   = tsM ? tsM[1] : null;
  if (tsM) body = body.slice(0, tsM.index!).trim().replace(/\.$/, "");
  return { label: m[1], body, ts, recurring };
}

// ─── Arc Gauge ────────────────────────────────────────────────────────────────

function ArcGauge({ score, displayScore }: { score: number; displayScore: number }) {
  const hex = scoreHex(displayScore);
  const cls = scoreCls(displayScore);

  // Arc: 220° sweep centered at bottom, r=70, viewBox 160×120
  const R  = 70;
  const cx = 80;
  const cy = 90;
  const startAngle = -200; // degrees from 3 o'clock (right)
  const sweep      = 220;

  function polar(angle: number, r: number = R) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const start = polar(startAngle);
  const end   = polar(startAngle + sweep);
  const progEnd = polar(startAngle + (displayScore / 100) * sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  const progLarge = (displayScore / 100) * sweep > 180 ? 1 : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 140 }}>
      <svg width="200" height="140" viewBox="0 0 160 120" className="absolute inset-0">
        {/* Track */}
        <path
          d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Progress */}
        {displayScore > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${progLarge} 1 ${progEnd.x} ${progEnd.y}`}
            fill="none"
            stroke={hex}
            strokeWidth="6"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${hex})` }}
          />
        )}
        {/* Tick marks at 25/50/75 */}
        {[25, 50, 75].map((v) => {
          const a = startAngle + (v / 100) * sweep;
          const inner = polar(a, R - 10);
          const outer = polar(a, R - 4);
          return (
            <line key={v} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
          );
        })}
      </svg>

      {/* Center number */}
      <div className="flex flex-col items-center" style={{ marginTop: 12 }}>
        <div className="flex items-baseline gap-1">
          <span className={`font-black tabular-nums leading-none ${cls}`} style={{ fontSize: 52 }}>{displayScore}</span>
          <span className="text-xl font-bold text-white/20">/100</span>
        </div>
      </div>
    </div>
  );
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function buildScript(r: CoachReport, prev?: number) {
  const p = [`Stream score: ${r.overall_score} out of 100.`];
  if (prev !== undefined) {
    const d = r.overall_score - prev;
    if (d > 0) p.push(`Up ${d} from last stream.`); else if (d < 0) p.push(`Down ${Math.abs(d)} from last stream.`);
  }
  p.push(`Number one priority. ${r.recommendation}`);
  (r.next_stream_goals ?? []).forEach((g, i) => p.push(`Mission ${i + 1}. ${g}`));
  return p.join(" ");
}

type PS = "idle" | "loading" | "playing" | "paused";

function useAudio(r: CoachReport, prev?: number) {
  const [ps, setPs]  = useState<PS>("idle");
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const blobRef      = useRef<string | null>(null);
  const speechRef    = useRef(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const play = useCallback(async () => {
    if (ps === "paused" && speechRef.current) { window.speechSynthesis?.resume(); setPs("playing"); return; }
    if (ps === "paused" && audioRef.current)  { audioRef.current.play(); setPs("playing"); return; }
    if (blobRef.current && audioRef.current)  { audioRef.current.currentTime = 0; audioRef.current.play(); setPs("playing"); return; }
    setPs("loading");
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: buildScript(r, prev) }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      blobRef.current = url; speechRef.current = false;
      const a = new Audio(url);
      a.onended = a.onerror = () => setPs("idle");
      audioRef.current = a; await a.play(); setPs("playing");
    } catch {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(buildScript(r, prev));
        utt.rate = 0.95;
        const male = window.speechSynthesis.getVoices().find((v) => /david|mark|daniel|google uk english male|alex/i.test(v.name));
        if (male) utt.voice = male;
        utt.onend = utt.onerror = () => { speechRef.current = false; setPs("idle"); };
        speechRef.current = true; window.speechSynthesis.speak(utt); setPs("playing");
      } else setPs("idle");
    }
  }, [ps, r, prev]);

  const pause = useCallback(() => {
    if (speechRef.current) window.speechSynthesis?.pause(); else audioRef.current?.pause();
    setPs("paused");
  }, []);
  const stop = useCallback(() => {
    if (speechRef.current) { window.speechSynthesis?.cancel(); speechRef.current = false; }
    else if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPs("idle");
  }, []);

  return { ps, play, pause, stop };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CoachReportCard({ report, previousScore, streak = 0, isPersonalBest = false, streamerTitle }: {
  report: CoachReport; previousScore?: number; streak?: number; isPersonalBest?: boolean; streamerTitle?: string;
}) {
  const { ps, play, pause, stop } = useAudio(report, previousScore);
  const tc    = report.streamer_type ? TYPE_CONFIG[report.streamer_type] : null;
  const delta = previousScore !== undefined ? report.overall_score - previousScore : null;

  const [displayScore, setDisplayScore] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const target = report.overall_score;
    const duration = 1600;
    let startTime: number | null = null;
    let raf: number;

    function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

    const timeout = setTimeout(() => {
      function tick(now: number) {
        if (startTime === null) startTime = now;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setDisplayScore(Math.round(easeOutCubic(progress) * target));
        if (progress < 1) { raf = requestAnimationFrame(tick); }
        else { setRevealed(true); }
      }
      raf = requestAnimationFrame(tick);
    }, 350);

    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [report.overall_score]);

  const hex = scoreHex(displayScore);

  const energyInfo = {
    label: report.energy_trend === "building" ? "Building Energy" : report.energy_trend === "declining" ? "Declining Energy" : report.energy_trend === "volatile" ? "Volatile Energy" : "Consistent Energy",
    cls:   report.energy_trend === "building" ? "bg-green-500/10 border-green-500/20 text-green-300" : report.energy_trend === "declining" ? "bg-red-500/10 border-red-500/20 text-red-300" : report.energy_trend === "volatile" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300" : "bg-white/[0.05] border-white/10 text-white/40",
    icon:  report.energy_trend === "building" ? <TrendingUp size={11} /> : report.energy_trend === "declining" ? <TrendingDown size={11} /> : report.energy_trend === "volatile" ? <Activity size={11} /> : <Minus size={11} />,
  };

  const retInfo = {
    label: `${report.viewer_retention_risk === "low" ? "Low" : report.viewer_retention_risk === "medium" ? "Medium" : "High"} Retention Risk`,
    cls:   report.viewer_retention_risk === "low" ? "bg-green-500/10 border-green-500/20 text-green-300" : report.viewer_retention_risk === "medium" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300" : "bg-red-500/10 border-red-500/20 text-red-300",
  };

  const coldInfo = report.cold_open ? {
    label: report.cold_open.score === "strong" ? "Strong Open" : report.cold_open.score === "average" ? "Slow Start" : "Cold Open",
    cls:   report.cold_open.score === "strong" ? "bg-green-500/10 border-green-500/20 text-green-300" : report.cold_open.score === "average" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300" : "bg-red-500/10 border-red-500/20 text-red-300",
  } : null;

  const closingInfo = report.closing ? {
    label: report.closing.score === "strong" ? "Strong Close" : report.closing.score === "average" ? "Mixed Close" : "Weak Close",
    cls:   report.closing.score === "strong" ? "bg-green-500/10 border-green-500/20 text-green-300" : report.closing.score === "average" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300" : "bg-red-500/10 border-red-500/20 text-red-300",
  } : null;

  const antiPatternLabels: Record<string, string> = {
    viewer_count_apology: "Apologized for viewer count",
    follow_begging: "Asked for follows off-hype",
    lurker_shaming: "Called chat dead",
    pre_stream_drain: "Low-energy opening",
    self_defeat: "Self-deprecation",
  };

  const gaps = report.dead_zones ?? [];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div className="flex items-center gap-2.5">
          <span className="font-extrabold text-sm text-white tracking-wide">Stream Debrief</span>
        </div>
        <div className="flex items-center gap-2">
          {streamerTitle && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-violet-300">
              <Trophy size={10} />{streamerTitle}
            </span>
          )}
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-300">
              <Flame size={10} />{streak} streak
            </span>
          )}
          {tc && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border text-white/45" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.09)" }}>
              {tc.icon}{tc.label}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">

        {/* ── Score hero card ── */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${hex}18 0%, rgba(10,9,20,0) 70%), rgba(255,255,255,0.025)`,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Subtle top glow line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px" style={{ background: `linear-gradient(90deg, transparent, ${hex}60, transparent)` }} />

          <div className="px-6 pt-6 pb-5">
            {/* Arc gauge centered */}
            <div className="flex justify-center mb-2">
              <ArcGauge score={report.overall_score} displayScore={displayScore} />
            </div>

            {/* Personal best badge */}
            {revealed && isPersonalBest && (
              <div className="flex justify-center mb-3 animate-fade-in">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold px-4 py-2 rounded-full"
                  style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", boxShadow: "0 0 20px rgba(251,191,36,0.15)" }}>
                  <Trophy size={12} />NEW PERSONAL BEST
                </span>
              </div>
            )}

            {/* Delta */}
            <div className="flex items-center justify-center mb-5">
              {delta !== null ? (
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/30"}`}>
                  {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                  {delta > 0 ? `+${delta}` : delta} from last stream
                </span>
              ) : <span className="text-sm text-white/20">First report</span>}
            </div>

            {/* Pills centered */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${energyInfo.cls}`}>
                {energyInfo.icon}{energyInfo.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${retInfo.cls}`}>
                <ShieldAlert size={11} />{retInfo.label}
              </span>
              {coldInfo && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${coldInfo.cls}`}>
                  {coldInfo.label}
                </span>
              )}
              {closingInfo && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${closingInfo.cls}`}>
                  {closingInfo.label}
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.05] pt-4 flex items-center justify-between">
              <p className="text-xs text-white/25 font-medium">Performance Score</p>
              {/* Quick Listen */}
              <div>
                {ps === "idle" && (
                  <button onClick={play} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-white/35 hover:text-white/75 transition-colors" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                    <Volume2 size={12} />Quick Listen
                  </button>
                )}
                {ps === "loading" && <span className="flex items-center gap-1.5 text-xs text-white/25"><Loader2 size={12} className="animate-spin" />Loading...</span>}
                {(ps === "playing" || ps === "paused") && (
                  <div className="flex items-center gap-1">
                    <button onClick={ps === "playing" ? pause : play} className="p-1.5 rounded-xl text-white/50 hover:text-white transition-colors" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                      {ps === "playing" ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button onClick={stop} className="p-1.5 text-white/20 hover:text-red-400 transition-colors"><VolumeX size={12} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stream story */}
        {report.stream_story && (
          <div className="px-1">
            <p className="text-sm text-white/50 leading-relaxed italic">{report.stream_story}</p>
          </div>
        )}

        {/* Shareable win */}
        {report.shareable_win && (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(250,204,21,0.08) 0%, rgba(234,179,8,0.03) 60%, rgba(10,9,20,0) 100%)",
              border: "1px solid rgba(250,204,21,0.22)",
            }}
          >
            <Trophy size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-yellow-400 mb-1.5">Worth Sharing</p>
              <p className="text-sm font-bold text-yellow-200 mb-1 leading-tight">{report.shareable_win.stat}</p>
              <p className="text-xs text-white/50 leading-relaxed">{report.shareable_win.context}</p>
            </div>
          </div>
        )}

        {/* Cold open note */}
        {report.cold_open?.note && (
          <div className="pl-4 border-l-2 border-white/[0.08]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Opening</p>
            <p className="text-sm text-white/38 leading-relaxed">{report.cold_open.note}</p>
          </div>
        )}

        {/* Closing note */}
        {report.closing?.note && (
          <div className="pl-4 border-l-2 border-white/[0.08]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Closing</p>
            <p className="text-sm text-white/38 leading-relaxed">{report.closing.note}</p>
          </div>
        )}

        {/* ── #1 Priority ── */}
        <div
          className="rounded-xl p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.06) 60%, rgba(10,9,20,0) 100%)",
            border: "1px solid rgba(139,92,246,0.28)",
            boxShadow: "0 0 30px rgba(139,92,246,0.08) inset",
          }}
        >
          <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.5), transparent)" }} />
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">#1 Priority</span>
          </div>
          <p className="text-[15px] leading-relaxed text-white/90 font-medium">{report.recommendation}</p>
        </div>

        {/* ── Score breakdown ── */}
        {report.score_breakdown && (
          <div className="grid grid-cols-4 gap-2.5">
            {(["energy", "engagement", "consistency", "content"] as const).map((k) => {
              const v   = report.score_breakdown![k];
              const c   = scoreHex(v);
              const cls = scoreCls(v);
              const pct = v;
              return (
                <div key={k} className="rounded-xl px-3 py-3 text-center" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className={`text-2xl font-extrabold leading-none mb-2 ${cls}`}>{v}</div>
                  <div className="h-1 rounded-full mb-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
                  </div>
                  <div className="text-[9px] text-white/25 capitalize tracking-wide">{k}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Best Moment ── */}
        {report.best_moment && (
          <div
            className="rounded-xl px-4 py-4 flex items-start gap-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: `2px solid rgba(139,92,246,0.5)` }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-1.5">Best Moment</p>
              <p className="text-sm text-white/70 leading-relaxed">{report.best_moment.description}</p>
            </div>
            <span className="text-sm font-mono font-bold flex-shrink-0 pt-0.5" style={{ color: "rgba(139,92,246,0.6)" }}>{report.best_moment.time}</span>
          </div>
        )}

        {/* ── What Worked / Fix for Next ── */}
        {((report.strengths ?? []).length > 0 || (report.improvements ?? []).length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {/* What Worked */}
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(74,222,128,0.12)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(74,222,128,0.08)", background: "rgba(74,222,128,0.05)" }}>
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-green-400">What Worked</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {(report.strengths ?? []).map((s, i) => {
                  const { label, body, ts, recurring } = parseItem(s);
                  return (
                    <div key={i} className="px-4 py-3 space-y-1">
                      {recurring && <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full">Recurring</span>}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-green-400 leading-tight">{label || body}</p>
                        {ts && <span className="text-xs font-mono text-white/20 flex-shrink-0">{ts}</span>}
                      </div>
                      {label && <p className="text-xs text-white/45 leading-relaxed">{body}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fix for Next */}
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(250,204,21,0.12)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(250,204,21,0.08)", background: "rgba(250,204,21,0.04)" }}>
                <AlertCircle size={12} className="text-yellow-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-yellow-400">Fix for Next</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {(report.improvements ?? []).map((s, i) => {
                  const { label, body, ts, recurring } = parseItem(s);
                  return (
                    <div key={i} className="px-4 py-3 space-y-1">
                      {recurring && <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full">Recurring</span>}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-yellow-400 leading-tight">{label || body}</p>
                        {ts && <span className="text-xs font-mono text-white/20 flex-shrink-0">{ts}</span>}
                      </div>
                      {label && <p className="text-xs text-white/45 leading-relaxed">{body}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Anti-patterns ── */}
        {(report.anti_patterns ?? []).length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: "rgba(248,113,113,0.03)", border: "1px solid rgba(248,113,113,0.18)" }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(248,113,113,0.1)", background: "rgba(248,113,113,0.05)" }}>
              <ShieldAlert size={12} className="text-red-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400">Watch For This</span>
              <span className="ml-auto text-[10px] text-red-400/50">{(report.anti_patterns ?? []).length} flagged</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(report.anti_patterns ?? []).map((ap, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-red-300 leading-tight">{antiPatternLabels[ap.type] ?? ap.type}</p>
                    <span className="text-xs font-mono text-white/20 flex-shrink-0">{ap.time}</span>
                  </div>
                  <p className="text-xs text-white/55 italic leading-relaxed">&ldquo;{ap.quote}&rdquo;</p>
                  <p className="text-xs text-white/40 leading-relaxed">{ap.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Your Missions ── */}
        {(report.next_stream_goals ?? []).length > 0 && (
          <div className="rounded-xl px-5 py-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Target size={13} className="text-accent-light" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent-light">Your Missions</span>
            </div>
            <div className="space-y-3">
              {(report.next_stream_goals ?? []).map((goal, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold mt-0.5"
                    style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.22)", color: "rgba(167,139,250,0.8)" }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-sm text-white/68 leading-relaxed flex-1">{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Silence Gaps ── */}
        {gaps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={11} className="text-white/20" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/20">Silence Gaps</span>
              <span className="ml-auto text-[10px] text-white/15">{gaps.length} detected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gaps.map((g, i) => {
                const s   = g.duration;
                const dur = s >= 60 ? `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ""}` : `${s}s`;
                const bad = s >= 300;
                const mid = s >= 120;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                    style={{
                      background: bad ? "rgba(248,113,113,0.07)" : mid ? "rgba(250,204,21,0.07)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${bad ? "rgba(248,113,113,0.2)" : mid ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.08)"}`,
                      color: bad ? "#fca5a5" : mid ? "#fde68a" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    <span className="font-mono text-[10px] opacity-70">{g.time}</span>
                    <span className="w-px h-3 opacity-20" style={{ background: "currentColor" }} />
                    <span className="font-bold">{dur} gap</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
