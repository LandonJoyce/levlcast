"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle,
  Lightbulb, Target, ShieldAlert, Gamepad2, MessageCircle, Map,
  Shuffle, BookOpen, ChevronDown, ChevronUp, Volume2, VolumeX,
  Pause, Play, Loader2, Flame, Zap,
} from "lucide-react";
import { CoachReport } from "@/lib/analyze";

// ─── Sub-components ──────────────────────────────────────────────────────────

function EnergyIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "building":  return <TrendingUp size={11} className="text-green-400" />;
    case "declining": return <TrendingDown size={11} className="text-red-400" />;
    case "volatile":  return <Activity size={11} className="text-yellow-400" />;
    default:          return <Minus size={11} className="text-muted" />;
  }
}

function ScoreRing({ score }: { score: number }) {
  const color  = score >= 75 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171";
  const label  = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  const r = 28; const cx = 32; const circ = 2 * Math.PI * r;
  const prog = (score / 100) * circ;

  return (
    <div className="relative flex-shrink-0 w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${prog} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={`text-2xl font-extrabold leading-none ${label}`}>{score}</span>
        <span className="text-[9px] text-white/25 font-medium">/100</span>
      </div>
    </div>
  );
}

function CoachItem({ text, accent }: { text: string; accent: "green" | "yellow" }) {
  const recurring = /^RECURRING:\s*/i.test(text);
  const cleaned   = text.replace(/^RECURRING:\s*/i, "");

  const labelMatch = cleaned.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);
  if (!labelMatch) return <p className="text-xs text-white/55 leading-relaxed">{text}</p>;

  const label = labelMatch[1];
  let   body  = labelMatch[2].trim();

  const tsMatch = body.match(/\s+at\s+(\d{1,2}:\d{2})\.?\s*$/i);
  const ts      = tsMatch ? tsMatch[1] : null;
  if (tsMatch) body = body.slice(0, tsMatch.index).trim().replace(/\.$/, "");

  const labelColor = accent === "green" ? "text-green-400" : "text-yellow-400";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        {recurring && (
          <span className="text-[8px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
            Recurring
          </span>
        )}
        <span className={`text-xs font-bold ${labelColor} leading-none`}>{label}</span>
        {ts && <span className="ml-auto text-[10px] font-mono text-white/20 flex-shrink-0">{ts}</span>}
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STREAMER_TYPE_CONFIG: Record<string, {
  label: string; icon: React.ReactNode;
  color: string; bg: string; border: string;
}> = {
  gaming:        { label: "Gaming",        icon: <Gamepad2 size={11} />,      color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-400/20" },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={11} />, color: "text-blue-300",   bg: "bg-blue-500/10",   border: "border-blue-400/20"   },
  irl:           { label: "IRL",           icon: <Map size={11} />,           color: "text-green-300",  bg: "bg-green-500/10",  border: "border-green-400/20"  },
  variety:       { label: "Variety",       icon: <Shuffle size={11} />,       color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-400/20" },
  educational:   { label: "Educational",   icon: <BookOpen size={11} />,      color: "text-cyan-300",   bg: "bg-cyan-500/10",   border: "border-cyan-400/20"   },
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
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef     = useRef<string | null>(null);
  const usingSpeechRef = useRef(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const play = useCallback(async () => {
    if (playState === "paused" && usingSpeechRef.current) {
      window.speechSynthesis?.resume();
      setPlayState("playing");
      return;
    }
    if (playState === "paused" && audioRef.current) {
      audioRef.current.play();
      setPlayState("playing");
      return;
    }
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

  // Score delta
  const delta = previousScore !== undefined ? report.overall_score - previousScore : null;
  const deltaLabel = delta === null ? null
    : delta > 0 ? { text: `+${delta} from last`, color: "text-green-400", icon: <TrendingUp size={10} /> }
    : delta < 0 ? { text: `${delta} from last`, color: "text-red-400", icon: <TrendingDown size={10} /> }
    : { text: "Same as last", color: "text-white/30", icon: <Minus size={10} /> };

  // Cold open
  const coldOpen = report.cold_open ?? null;
  const coldOpenColor = coldOpen?.score === "strong" ? "text-green-400"
    : coldOpen?.score === "average" ? "text-yellow-400"
    : "text-red-400";
  const coldOpenLabel = coldOpen?.score === "strong" ? "Strong open"
    : coldOpen?.score === "average" ? "Slow start"
    : "Cold open";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-accent-light" />
          <span className="text-sm font-extrabold text-white tracking-tight">Stream Debrief</span>
        </div>
        <div className="flex items-center gap-1.5">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-300">
              <Flame size={10} />{streak} streak
            </span>
          )}
          {typeConfig && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${typeConfig.bg} ${typeConfig.color} border ${typeConfig.border}`}>
              {typeConfig.icon}{typeConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">

        {/* Score row */}
        <div className="flex items-center gap-4">
          <ScoreRing score={report.overall_score} />
          <div className="flex flex-col gap-2 min-w-0">
            {/* Delta */}
            {deltaLabel && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold ${deltaLabel.color}`}>
                {deltaLabel.icon}{deltaLabel.text}
              </span>
            )}
            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-white/40">
                <EnergyIcon trend={report.energy_trend} />
                <span className="capitalize">{report.energy_trend} energy</span>
              </span>
              {report.viewer_retention_risk && (() => {
                const c = report.viewer_retention_risk === "low"
                  ? "text-green-400 bg-green-400/[0.07] border-green-400/15"
                  : report.viewer_retention_risk === "medium"
                  ? "text-yellow-400 bg-yellow-400/[0.07] border-yellow-400/15"
                  : "text-red-400 bg-red-400/[0.07] border-red-400/15";
                return (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${c}`}>
                    <ShieldAlert size={9} />{report.viewer_retention_risk} retention risk
                  </span>
                );
              })()}
              {coldOpen && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] ${coldOpenColor}`}>
                  {coldOpenLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cold open note — one line below the pills if there's a note */}
        {coldOpen?.note && (
          <p className="text-xs text-white/40 leading-relaxed pl-1 border-l-2 border-white/[0.08]">{coldOpen.note}</p>
        )}

        {/* #1 Priority */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={12} className="text-accent-light" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent-light">#1 Priority</span>
          </div>
          <p className="text-sm leading-relaxed text-white/80 font-medium">{report.recommendation}</p>
        </div>

        {/* Bottom bar: Quick Listen + Expand */}
        <div className="flex items-center gap-2">
          {playState === "idle" && (
            <button
              onClick={play}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/[0.08] hover:border-white/20 text-white/35 hover:text-white/70 transition-all bg-white/[0.02]"
            >
              <Volume2 size={11} />Quick Listen
            </button>
          )}
          {playState === "loading" && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-white/25">
              <Loader2 size={11} className="animate-spin" />Loading...
            </span>
          )}
          {(playState === "playing" || playState === "paused") && (
            <div className="flex items-center gap-1">
              <button
                onClick={playState === "playing" ? pause : play}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-white/[0.08] hover:border-white/20 text-white/55 hover:text-white transition-all bg-white/[0.02]"
              >
                {playState === "playing" ? <Pause size={11} /> : <Play size={11} />}
              </button>
              <button onClick={stop} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-xl text-white/20 hover:text-red-400 transition-colors">
                <VolumeX size={11} />
              </button>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-xl border border-white/[0.07] hover:border-white/15 text-white/30 hover:text-white/65 transition-all bg-white/[0.02]"
          >
            {expanded
              ? <><ChevronUp size={11} />Hide Breakdown</>
              : <><ChevronDown size={11} />Full Breakdown</>}
          </button>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t border-white/[0.06]">

            {/* Stream story */}
            {report.stream_story && (
              <div className="flex gap-3">
                <div className="w-0.5 rounded-full bg-white/10 flex-shrink-0" />
                <p className="text-xs text-white/45 leading-relaxed italic">{report.stream_story}</p>
              </div>
            )}

            {/* Best Moment */}
            {report.best_moment && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Star size={11} className="text-accent-light" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-light">Best Moment</span>
                  <span className="text-[10px] text-white/25 ml-auto font-mono">{report.best_moment.time}</span>
                </div>
                <p className="text-xs text-white/65 leading-relaxed">{report.best_moment.description}</p>
              </div>
            )}

            {/* Retention Alert */}
            {report.viewer_retention_risk && report.viewer_retention_risk !== "low" && (() => {
              const isHigh = report.viewer_retention_risk === "high";
              const c = isHigh
                ? "border-red-500/20 bg-red-500/[0.04] text-red-400"
                : "border-yellow-500/20 bg-yellow-500/[0.04] text-yellow-400";
              const msg = isHigh
                ? "High viewer drop-off risk. The fixes below likely caused viewers to leave."
                : "Medium viewer drop-off risk. Review the fixes below to keep viewers watching longer.";
              return (
                <div className={`rounded-xl px-4 py-3 border flex items-start gap-2.5 ${c}`}>
                  <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed opacity-85">{msg}</p>
                </div>
              );
            })()}

            {/* What Worked */}
            {(report.strengths ?? []).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.05]">
                  <Star size={10} className="text-green-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">What Worked</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {(report.strengths ?? []).map((s, i) => (
                    <div key={i} className="px-4 py-3">
                      <CoachItem text={s} accent="green" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fix for Next Stream */}
            {(report.improvements ?? []).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.05]">
                  <AlertCircle size={10} className="text-yellow-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Fix for Next Stream</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {(report.improvements ?? []).map((s, i) => (
                    <div key={i} className="px-4 py-3">
                      <CoachItem text={s} accent="yellow" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Your Missions */}
            {(report.next_stream_goals ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest mb-3">Your Missions</p>
                <div className="space-y-2.5">
                  {(report.next_stream_goals ?? []).map((goal, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-white/40">{i + 1}</span>
                      </div>
                      <span className="text-sm text-white/65 leading-snug flex-1">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
