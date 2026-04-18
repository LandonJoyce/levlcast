"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle,
  Lightbulb, Target, Gamepad2, MessageCircle, Map,
  Shuffle, BookOpen, Volume2, VolumeX,
  Pause, Play, Loader2, Flame, Zap, Clock, ShieldAlert,
} from "lucide-react";
import { CoachReport } from "@/lib/analyze";

// ─── Config ──────────────────────────────────────────────────────────────────

const STREAMER_TYPE_CONFIG: Record<string, {
  label: string; icon: React.ReactNode; color: string; bg: string; border: string;
}> = {
  gaming:        { label: "Gaming",        icon: <Gamepad2 size={10} />,      color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-400/20" },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={10} />, color: "text-blue-300",   bg: "bg-blue-500/10",   border: "border-blue-400/20"   },
  irl:           { label: "IRL",           icon: <Map size={10} />,           color: "text-green-300",  bg: "bg-green-500/10",  border: "border-green-400/20"  },
  variety:       { label: "Variety",       icon: <Shuffle size={10} />,       color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-400/20" },
  educational:   { label: "Educational",   icon: <BookOpen size={10} />,      color: "text-cyan-300",   bg: "bg-cyan-500/10",   border: "border-cyan-400/20"   },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${className}`}>
      {children}
    </span>
  );
}

function CoachItem({ text, accent }: { text: string; accent: "green" | "yellow" }) {
  const recurring = /^RECURRING:\s*/i.test(text);
  const cleaned   = text.replace(/^RECURRING:\s*/i, "");
  const labelMatch = cleaned.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);

  if (!labelMatch) return <p className="text-xs text-white/55 leading-relaxed">{cleaned}</p>;

  const label = labelMatch[1];
  let   body  = labelMatch[2].trim();
  const tsMatch = body.match(/\s+at\s+(\d{1,2}:\d{2})\.?\s*$/i);
  const ts      = tsMatch ? tsMatch[1] : null;
  if (tsMatch) body = body.slice(0, tsMatch.index!).trim().replace(/\.$/, "");

  const labelColor = accent === "green" ? "text-green-400" : "text-yellow-400";

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5 flex-wrap">
        {recurring && (
          <span className="text-[8px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full">
            Recurring
          </span>
        )}
        <span className={`text-[11px] font-bold ${labelColor} leading-tight`}>{label}</span>
        {ts && <span className="text-[9px] font-mono text-white/20 ml-auto">{ts}</span>}
      </div>
      <p className="text-[11px] text-white/45 leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Audio ───────────────────────────────────────────────────────────────────

function buildScript(report: CoachReport, previousScore?: number): string {
  const lines: string[] = [];
  lines.push(`Stream score: ${report.overall_score} out of 100.`);
  if (previousScore !== undefined) {
    const d = report.overall_score - previousScore;
    if (d > 0) lines.push(`Up ${d} points from last stream.`);
    else if (d < 0) lines.push(`Down ${Math.abs(d)} points from last stream.`);
  }
  lines.push(`Number one priority. ${report.recommendation}`);
  if (report.next_stream_goals?.length) {
    lines.push("Missions for next stream.");
    report.next_stream_goals.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
  }
  return lines.join(" ");
}

type PlayState = "idle" | "loading" | "playing" | "paused";

function useReportAudio(report: CoachReport, previousScore?: number) {
  const [playState, setPlayState] = useState<PlayState>("idle");
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef     = useRef<string | null>(null);
  const usingSpeechRef = useRef(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const play = useCallback(async () => {
    if (playState === "paused" && usingSpeechRef.current) { window.speechSynthesis?.resume(); setPlayState("playing"); return; }
    if (playState === "paused" && audioRef.current)       { audioRef.current.play(); setPlayState("playing"); return; }
    if (blobUrlRef.current && audioRef.current)           { audioRef.current.currentTime = 0; audioRef.current.play(); setPlayState("playing"); return; }

    setPlayState("loading");
    const script = buildScript(report, previousScore);
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: script }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
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
        const utt = new SpeechSynthesisUtterance(script);
        utt.rate  = 0.95;
        const male = window.speechSynthesis.getVoices().find((v) => /david|mark|daniel|google uk english male|alex/i.test(v.name));
        if (male) utt.voice = male;
        utt.onend = utt.onerror = () => { usingSpeechRef.current = false; setPlayState("idle"); };
        usingSpeechRef.current = true;
        window.speechSynthesis.speak(utt);
        setPlayState("playing");
      } else setPlayState("idle");
    }
  }, [playState, report, previousScore]);

  const pause = useCallback(() => {
    if (usingSpeechRef.current) window.speechSynthesis?.pause(); else audioRef.current?.pause();
    setPlayState("paused");
  }, []);

  const stop = useCallback(() => {
    if (usingSpeechRef.current) { window.speechSynthesis?.cancel(); usingSpeechRef.current = false; }
    else if (audioRef.current)  { audioRef.current.pause(); audioRef.current.currentTime = 0; }
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
  const { playState, play, pause, stop } = useReportAudio(report, previousScore);

  const typeConfig = report.streamer_type ? STREAMER_TYPE_CONFIG[report.streamer_type] : null;
  const delta      = previousScore !== undefined ? report.overall_score - previousScore : null;

  const scoreColor = report.overall_score >= 75 ? "text-green-400"
    : report.overall_score >= 50 ? "text-yellow-400" : "text-red-400";

  const coldOpenLabel = report.cold_open?.score === "strong" ? "Strong Open"
    : report.cold_open?.score === "average" ? "Slow Start" : "Cold Open";
  const coldOpenColor = report.cold_open?.score === "strong"
    ? "text-green-400 bg-green-400/[0.07] border-green-400/15"
    : report.cold_open?.score === "average"
    ? "text-yellow-400 bg-yellow-400/[0.07] border-yellow-400/15"
    : "text-red-400 bg-red-400/[0.07] border-red-400/15";

  const energyColor = report.energy_trend === "building" ? "text-green-400 bg-green-400/[0.07] border-green-400/15"
    : report.energy_trend === "declining" ? "text-red-400 bg-red-400/[0.07] border-red-400/15"
    : report.energy_trend === "volatile"  ? "text-yellow-400 bg-yellow-400/[0.07] border-yellow-400/15"
    : "text-white/40 bg-white/[0.04] border-white/[0.07]";

  const retentionColor = report.viewer_retention_risk === "low"
    ? "text-green-400 bg-green-400/[0.07] border-green-400/15"
    : report.viewer_retention_risk === "medium"
    ? "text-yellow-400 bg-yellow-400/[0.07] border-yellow-400/15"
    : "text-red-400 bg-red-400/[0.07] border-red-400/15";

  const hasSilenceLog = (report.dead_zones ?? []).length > 0;
  const hasScoreBreakdown = !!report.score_breakdown;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-accent-light" />
          <span className="text-sm font-extrabold text-white tracking-tight">Stream Debrief</span>
        </div>
        <div className="flex items-center gap-1.5">
          {streak >= 2 && (
            <Pill className="text-orange-300 bg-orange-500/10 border-orange-400/20">
              <Flame size={9} />{streak} streak
            </Pill>
          )}
          {typeConfig && (
            <Pill className={`${typeConfig.color} ${typeConfig.bg} ${typeConfig.border}`}>
              {typeConfig.icon}{typeConfig.label}
            </Pill>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Score hero ── */}
        <div className="flex items-start gap-4">
          {/* Big number */}
          <div className="flex-shrink-0">
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-black leading-none tabular-nums ${scoreColor}`}>{report.overall_score}</span>
              <span className="text-base text-white/20 font-semibold">/100</span>
            </div>
            {delta !== null && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/30"}`}>
                {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                {delta > 0 ? `+${delta}` : delta} from last
              </div>
            )}
          </div>

          {/* Pills column */}
          <div className="flex flex-col gap-1.5 pt-1 flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <Pill className={energyColor}>
                {report.energy_trend === "building" ? <TrendingUp size={9} />
                  : report.energy_trend === "declining" ? <TrendingDown size={9} />
                  : report.energy_trend === "volatile" ? <Activity size={9} />
                  : <Minus size={9} />}
                <span className="capitalize">{report.energy_trend} energy</span>
              </Pill>
              <Pill className={retentionColor}>
                <ShieldAlert size={9} />
                <span className="capitalize">{report.viewer_retention_risk} retention risk</span>
              </Pill>
              {report.cold_open && (
                <Pill className={coldOpenColor}>{coldOpenLabel}</Pill>
              )}
            </div>

            {/* Audio controls */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {playState === "idle" && (
                <button onClick={play} className="flex items-center gap-1 text-[10px] font-semibold text-white/30 hover:text-white/70 transition-colors">
                  <Volume2 size={10} />Quick Listen
                </button>
              )}
              {playState === "loading" && (
                <span className="flex items-center gap-1 text-[10px] text-white/20">
                  <Loader2 size={10} className="animate-spin" />Loading...
                </span>
              )}
              {(playState === "playing" || playState === "paused") && (
                <div className="flex items-center gap-1">
                  <button onClick={playState === "playing" ? pause : play} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition-colors">
                    {playState === "playing" ? <Pause size={10} /> : <Play size={10} />}
                  </button>
                  <button onClick={stop} className="text-[10px] text-white/20 hover:text-red-400 transition-colors">
                    <VolumeX size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stream story ── */}
        {report.stream_story && (
          <p className="text-xs text-white/50 leading-relaxed italic border-l-2 border-white/[0.08] pl-3">{report.stream_story}</p>
        )}

        {/* ── Cold open note ── */}
        {report.cold_open?.note && (
          <p className="text-xs text-white/40 leading-relaxed pl-3 border-l-2 border-white/[0.06]">{report.cold_open.note}</p>
        )}

        {/* ── #1 Priority ── */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={11} className="text-accent-light" />
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-accent-light">#1 Priority</span>
          </div>
          <p className="text-sm leading-relaxed text-white/85 font-medium">{report.recommendation}</p>
        </div>

        {/* ── Score breakdown ── */}
        {hasScoreBreakdown && (
          <div className="grid grid-cols-4 gap-2">
            {(["energy", "engagement", "consistency", "content"] as const).map((key) => {
              const val = report.score_breakdown![key];
              const c   = val >= 70 ? "text-green-400" : val >= 50 ? "text-yellow-400" : "text-red-400";
              return (
                <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2.5 text-center">
                  <div className={`text-lg font-extrabold leading-none ${c}`}>{val}</div>
                  <div className="text-[9px] text-muted capitalize mt-0.5">{key}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Best Moment ── */}
        {report.best_moment && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Star size={11} className="text-accent-light" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-accent-light">Best Moment</span>
              <span className="text-[10px] text-white/25 ml-auto font-mono">{report.best_moment.time}</span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">{report.best_moment.description}</p>
          </div>
        )}

        {/* ── What Worked / Fix for Next — two columns ── */}
        {((report.strengths ?? []).length > 0 || (report.improvements ?? []).length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {/* What Worked */}
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.05] bg-green-500/[0.04]">
                <Star size={9} className="text-green-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">What Worked</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {(report.strengths ?? []).map((s, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <CoachItem text={s} accent="green" />
                  </div>
                ))}
              </div>
            </div>

            {/* Fix for Next */}
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.05] bg-yellow-500/[0.04]">
                <AlertCircle size={9} className="text-yellow-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400">Fix for Next</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {(report.improvements ?? []).map((s, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <CoachItem text={s} accent="yellow" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Your Missions ── */}
        {(report.next_stream_goals ?? []).length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Target size={11} className="text-accent-light" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-accent-light">Your Missions</span>
            </div>
            <div className="space-y-2">
              {(report.next_stream_goals ?? []).map((goal, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/[0.04] border border-white/[0.09] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-white/35">{i + 1}</span>
                  </div>
                  <span className="text-xs text-white/65 leading-snug flex-1">{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Silence Log ── */}
        {hasSilenceLog && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Clock size={11} className="text-muted/50" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted/50">Silence Log</span>
              <span className="text-[9px] text-muted/30 ml-auto">{report.dead_zones!.length} gaps detected</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {report.dead_zones!.map((gap, i) => {
                const secs = gap.duration;
                const mins = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
                const severity = secs >= 300 ? "text-red-400" : secs >= 120 ? "text-yellow-400" : "text-white/35";
                return (
                  <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="text-[10px] font-mono text-white/30 w-10 flex-shrink-0">{gap.time}</span>
                    <span className={`text-[10px] font-semibold tabular-nums ${severity} ml-auto`}>{mins}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
