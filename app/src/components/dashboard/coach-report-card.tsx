"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle,
  Lightbulb, Target, ShieldAlert, Gamepad2, MessageCircle, Map,
  Shuffle, BookOpen, ChevronDown, ChevronUp, Zap, Volume2, VolumeX,
  Pause, Play, Loader2, Flame,
} from "lucide-react";
import { CoachReport } from "@/lib/analyze";

// ─── Sub-components ──────────────────────────────────────────────────────────

function EnergyIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "building":  return <TrendingUp size={12} className="text-green-400" />;
    case "declining": return <TrendingDown size={12} className="text-red-400" />;
    case "volatile":  return <Activity size={12} className="text-yellow-400" />;
    default:          return <Minus size={12} className="text-muted" />;
  }
}

function ScoreRing({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const color  = score >= 75 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171";
  const label  = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  // "lg": r=36, cx/cy=48, viewBox=96 → 12px padding each side (glow-safe)
  // "sm": r=28, cx/cy=32, viewBox=64 → matches original dimensions
  const r      = size === "lg" ? 36 : 28;
  const cx     = size === "lg" ? 48 : 32;
  const vb     = size === "lg" ? "0 0 96 96" : "0 0 64 64";
  const dim    = size === "lg" ? "w-28 h-28" : "w-20 h-20";
  const numCls = size === "lg" ? "text-4xl" : "text-xl";
  const circ   = 2 * Math.PI * r;
  const prog   = (score / 100) * circ;

  return (
    <div className={`relative flex-shrink-0 ${dim} flex items-center justify-center`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox={vb}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${prog} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={`${numCls} font-extrabold leading-none ${label}`}>{score}</span>
        <span className="text-[9px] text-white/30 font-medium">/100</span>
      </div>
    </div>
  );
}

function ScoreDeltaBadge({ score, previousScore }: { score: number; previousScore?: number }) {
  if (previousScore === undefined) return null;
  const delta = score - previousScore;
  if (delta > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/25 text-green-400">
      <TrendingUp size={11} />+{delta} from last stream
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-400/10 border border-red-400/25 text-red-400">
      <TrendingDown size={11} />{delta} from last stream
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40">
      <Minus size={11} />Same as last stream
    </span>
  );
}

/** Renders "**Bold Label** — rest of text" with the bold part highlighted. Falls back to plain text. */
function BoldLeadText({ text, className }: { text: string; className?: string }) {
  const match = text.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);
  if (!match) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      <span className="font-bold text-white/90">{match[1]}</span>
      <span className="text-white/40"> — </span>
      {match[2]}
    </span>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STREAMER_TYPE_CONFIG: Record<string, {
  label: string; icon: React.ReactNode;
  color: string; bg: string; border: string; glow: string;
}> = {
  gaming:        { label: "Gaming",        icon: <Gamepad2 size={11} />,     color: "text-purple-300", bg: "bg-purple-500/15", border: "border-purple-400/30", glow: "#a855f7" },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={11} />, color: "text-blue-300",   bg: "bg-blue-500/15",   border: "border-blue-400/30",   glow: "#60a5fa" },
  irl:           { label: "IRL",           icon: <Map size={11} />,           color: "text-green-300",  bg: "bg-green-500/15",  border: "border-green-400/30",  glow: "#4ade80" },
  variety:       { label: "Variety",       icon: <Shuffle size={11} />,       color: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-400/30", glow: "#fb923c" },
  educational:   { label: "Educational",   icon: <BookOpen size={11} />,      color: "text-cyan-300",   bg: "bg-cyan-500/15",   border: "border-cyan-400/30",   glow: "#22d3ee" },
};

// ─── Audio ───────────────────────────────────────────────────────────────────

function buildQuickListenScript(report: CoachReport, previousScore?: number): string {
  const lines: string[] = [];
  lines.push(`Stream score: ${report.overall_score} out of 100.`);
  if (previousScore !== undefined) {
    const delta = report.overall_score - previousScore;
    if (delta > 0) lines.push(`That's up ${delta} points from last stream.`);
    else if (delta < 0) lines.push(`That's down ${Math.abs(delta)} points from last stream.`);
    else lines.push(`Same score as last stream.`);
  }
  lines.push(`Number one priority. ${report.recommendation}`);
  if (report.next_stream_goals?.length) {
    lines.push("Your missions for next stream.");
    report.next_stream_goals.forEach((g, i) => lines.push(`Mission ${i + 1}. ${g}`));
  }
  return lines.join(" ");
}

type PlayState = "idle" | "loading" | "playing" | "paused";

function useReportAudio(report: CoachReport, previousScore?: number) {
  const [playState, setPlayState] = useState<PlayState>("idle");
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef    = useRef<string | null>(null);
  const usingSpeechRef = useRef(false); // true when browser speech fallback is active

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const play = useCallback(async () => {
    // Resume from pause — speech synthesis path
    if (playState === "paused" && usingSpeechRef.current) {
      window.speechSynthesis?.resume();
      setPlayState("playing");
      return;
    }
    // Resume from pause — HTML audio path
    if (playState === "paused" && audioRef.current) {
      audioRef.current.play();
      setPlayState("playing");
      return;
    }
    // Replay cached audio
    if (blobUrlRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlayState("playing");
      return;
    }

    setPlayState("loading");
    const script = buildQuickListenScript(report, previousScore);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script }),
      });
      if (!res.ok) throw new Error("TTS unavailable");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      usingSpeechRef.current = false;

      const audio = new Audio(url);
      audio.onended = () => setPlayState("idle");
      audio.onerror = () => setPlayState("idle");
      audioRef.current = audio;
      await audio.play();
      setPlayState("playing");
    } catch {
      // Fallback: browser Web Speech API
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(script);
        utterance.rate  = 0.95;
        utterance.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        const male   = voices.find((v) =>
          /david|mark|daniel|google uk english male|microsoft david|alex/i.test(v.name)
        );
        if (male) utterance.voice = male;
        utterance.onend   = () => { usingSpeechRef.current = false; setPlayState("idle"); };
        utterance.onerror = () => { usingSpeechRef.current = false; setPlayState("idle"); };
        usingSpeechRef.current = true;
        window.speechSynthesis.speak(utterance);
        setPlayState("playing");
      } else {
        setPlayState("idle");
      }
    }
  }, [playState, report, previousScore]);

  const pause = useCallback(() => {
    if (usingSpeechRef.current) window.speechSynthesis?.pause();
    else audioRef.current?.pause();
    setPlayState("paused");
  }, []);

  const stop = useCallback(() => {
    if (usingSpeechRef.current) { window.speechSynthesis?.cancel(); usingSpeechRef.current = false; }
    else if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlayState("idle");
  }, []);

  return { playState, play, pause, stop };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CoachReportCard({
  report,
  previousScore,
  streak = 0,
}: {
  report: CoachReport;
  previousScore?: number;
  streak?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { playState, play, pause, stop } = useReportAudio(report, previousScore);

  const typeConfig = report.streamer_type ? STREAMER_TYPE_CONFIG[report.streamer_type] : null;
  const glowColor  = typeConfig?.glow ?? "#8b5cf6";

  return (
    <div className="relative rounded-2xl overflow-hidden">

      {/* Static holographic border */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          padding: "1px",
          background: `linear-gradient(135deg, ${glowColor}80, #ff008040, #facc1540, #4ade8040, #60a5fa40, ${glowColor}80)`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Subtle scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-10 rounded-2xl"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)",
        }}
      />

      {/* Card body */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(20,18,38,0.99) 0%, rgba(14,13,26,0.99) 50%, rgba(18,14,32,0.99) 100%)`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.07), 0 4px 32px ${glowColor}18`,
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between border-b border-white/8"
          style={{ background: `linear-gradient(90deg, ${glowColor}18 0%, transparent 60%)` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${glowColor}25`, boxShadow: `0 0 12px ${glowColor}40` }}
            >
              <Zap size={14} style={{ color: glowColor }} />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white">Stream Debrief</span>
          </div>
          <div className="flex items-center gap-2">
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-400/30 text-orange-300">
                <Flame size={11} />
                {streak} stream streak
              </span>
            )}
            {typeConfig && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${typeConfig.bg} ${typeConfig.color} border ${typeConfig.border}`}
                style={{ boxShadow: `0 0 8px ${glowColor}30` }}
              >
                {typeConfig.icon}
                {typeConfig.label}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-white/35">
              <EnergyIcon trend={report.energy_trend} />
              <span className="capitalize">{report.energy_trend}</span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Stream story — narrative arc before the numbers */}
          {report.stream_story && (
            <div className="flex gap-3">
              <div className="w-0.5 rounded-full bg-gradient-to-b from-white/20 to-white/0 flex-shrink-0" />
              <p className="text-sm text-white/55 leading-relaxed italic">{report.stream_story}</p>
            </div>
          )}

          {/* Score hero row */}
          <div className="flex gap-5 items-center">
            <ScoreRing score={report.overall_score} size="lg" />
            <div className="flex flex-col gap-2 min-w-0">
              <ScoreDeltaBadge score={report.overall_score} previousScore={previousScore} />
              {/* Stat pills */}
              <div className="flex flex-wrap gap-1.5">
                {/* Energy */}
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
                  <EnergyIcon trend={report.energy_trend} />
                  <span className="capitalize">{report.energy_trend} energy</span>
                </span>
                {/* Retention */}
                {report.viewer_retention_risk && (() => {
                  const color = report.viewer_retention_risk === "low" ? "text-green-400 bg-green-400/10 border-green-400/20"
                    : report.viewer_retention_risk === "medium" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                    : "text-red-400 bg-red-400/10 border-red-400/20";
                  return (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${color}`}>
                      <ShieldAlert size={10} />
                      {report.viewer_retention_risk} retention risk
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Cold Open */}
          {report.cold_open && (() => {
            const s = report.cold_open.score;
            const color = s === "strong" ? "text-green-400 bg-green-400/10 border-green-400/20"
              : s === "average" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
              : "text-red-400 bg-red-400/10 border-red-400/20";
            const label = s === "strong" ? "Strong Open" : s === "average" ? "Slow Start" : "Cold Open";
            return (
              <div className={`rounded-xl px-4 py-3 border flex items-start gap-3 ${color}`}>
                <span className="text-xs font-extrabold uppercase tracking-widest flex-shrink-0 mt-0.5">{label}</span>
                <p className="text-xs leading-relaxed opacity-80">{report.cold_open.note}</p>
              </div>
            );
          })()}

          {/* #1 Priority */}
          <div
            className="rounded-xl p-4 border border-white/8"
            style={{ background: `linear-gradient(135deg, ${glowColor}15 0%, rgba(255,255,255,0.02) 100%)` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={13} style={{ color: glowColor }} />
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: glowColor }}>
                #1 Priority
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/85 font-medium">{report.recommendation}</p>
          </div>

          {/* Your Missions — always visible */}
          {report.next_stream_goals && report.next_stream_goals.length > 0 && (
            <div
              className="rounded-xl p-4 border"
              style={{
                background: `linear-gradient(135deg, ${glowColor}10 0%, rgba(255,255,255,0.02) 100%)`,
                borderColor: `${glowColor}25`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Target size={13} style={{ color: glowColor }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: glowColor }}>Your Missions</span>
              </div>
              <ul className="space-y-2.5">
                {report.next_stream_goals.map((goal, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 border text-[10px] font-extrabold"
                      style={{ borderColor: `${glowColor}50`, color: glowColor, background: `${glowColor}15` }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-white/65 leading-relaxed">{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom bar: Quick Listen + Expand */}
          <div className="flex items-center gap-2">
            {/* Quick Listen controls */}
            {playState === "idle" && (
              <button
                onClick={play}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/25 text-white/40 hover:text-white/80 transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <Volume2 size={12} />
                Quick Listen
              </button>
            )}
            {playState === "loading" && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-white/30">
                <Loader2 size={12} className="animate-spin" />
                Loading...
              </span>
            )}
            {(playState === "playing" || playState === "paused") && (
              <div className="flex items-center gap-1">
                <button
                  onClick={playState === "playing" ? pause : play}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-white/10 hover:border-white/25 text-white/60 hover:text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  {playState === "playing" ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button
                  onClick={stop}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-xl text-white/25 hover:text-red-400 transition-colors"
                >
                  <VolumeX size={12} />
                </button>
              </div>
            )}

            {/* Expand toggle — fills remaining space */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-xl border border-white/8 hover:border-white/20 text-white/35 hover:text-white/75 transition-all"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              {expanded
                ? <><ChevronUp size={12} /> Hide Breakdown</>
                : <><ChevronDown size={12} /> See Full Breakdown</>}
            </button>
          </div>

          {/* Expanded section */}
          {expanded && (
            <div className="space-y-4 pt-2 border-t border-white/8">

              {/* Best Moment */}
              {report.best_moment && (
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    background: `linear-gradient(135deg, ${glowColor}15 0%, rgba(255,255,255,0.02) 100%)`,
                    borderColor: `${glowColor}35`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={13} style={{ color: glowColor }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: glowColor }}>Best Moment</span>
                    <span className="text-xs text-white/30 ml-auto font-mono">{report.best_moment.time}</span>
                  </div>
                  <p className="text-sm text-white/75">{report.best_moment.description}</p>
                </div>
              )}

              {/* Retention Alert — shown when medium/high risk */}
              {report.viewer_retention_risk && report.viewer_retention_risk !== "low" && (() => {
                const isHigh = report.viewer_retention_risk === "high";
                const color = isHigh
                  ? "border-red-500/25 bg-red-500/5 text-red-400"
                  : "border-yellow-500/25 bg-yellow-500/5 text-yellow-400";
                const msg = isHigh
                  ? "High viewer drop-off risk. Check the fixes below — they likely caused viewers to leave."
                  : "Medium viewer drop-off risk. Review the fixes below to keep viewers watching longer.";
                return (
                  <div className={`rounded-xl px-4 py-3 border flex items-start gap-3 ${color}`}>
                    <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed opacity-90">{msg}</p>
                  </div>
                );
              })()}

              {/* What Worked / Fix for Next Stream */}
              <div className="flex flex-col gap-3">
                <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Star size={12} className="text-green-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-green-400">What Worked</span>
                  </div>
                  <ul className="space-y-2.5">
                    {(report.strengths ?? []).map((s, i) => (
                      <li key={i} className="text-sm text-white/65 flex gap-2">
                        <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400/70" />
                        <BoldLeadText text={s} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <AlertCircle size={12} className="text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Fix for Next Stream</span>
                  </div>
                  <ul className="space-y-2.5">
                    {(report.improvements ?? []).map((s, i) => (
                      <li key={i} className="text-sm text-white/65 flex gap-2">
                        <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400/70" />
                        <BoldLeadText text={s} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
