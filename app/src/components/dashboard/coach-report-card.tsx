"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle,
  Lightbulb, Target, Gamepad2, MessageCircle, Map, Shuffle, BookOpen,
  Volume2, VolumeX, Pause, Play, Loader2, Flame, Zap, ShieldAlert, Clock,
  CheckCircle2, XCircle,
} from "lucide-react";
import { CoachReport } from "@/lib/analyze";

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  gaming:        { label: "Gaming",        icon: <Gamepad2 size={10} />      },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={10} /> },
  irl:           { label: "IRL",           icon: <Map size={10} />           },
  variety:       { label: "Variety",       icon: <Shuffle size={10} />       },
  educational:   { label: "Educational",   icon: <BookOpen size={10} />      },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(n: number) {
  return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171";
}
function scoreTailwind(n: number) {
  return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400";
}

/** Strip **Label** — body format down to just the body sentence */
function parseCoachText(raw: string): { label: string; body: string; ts: string | null; recurring: boolean } {
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

// ─── Audio ───────────────────────────────────────────────────────────────────

function buildScript(report: CoachReport, previousScore?: number): string {
  const parts = [`Stream score: ${report.overall_score} out of 100.`];
  if (previousScore !== undefined) {
    const d = report.overall_score - previousScore;
    if (d > 0) parts.push(`Up ${d} from last stream.`);
    else if (d < 0) parts.push(`Down ${Math.abs(d)} from last stream.`);
  }
  parts.push(`Number one priority. ${report.recommendation}`);
  (report.next_stream_goals ?? []).forEach((g, i) => parts.push(`Mission ${i + 1}. ${g}`));
  return parts.join(" ");
}

type PlayState = "idle" | "loading" | "playing" | "paused";

function useReportAudio(report: CoachReport, previousScore?: number) {
  const [state, setState]  = useState<PlayState>("idle");
  const audioRef           = useRef<HTMLAudioElement | null>(null);
  const blobRef            = useRef<string | null>(null);
  const speechRef          = useRef(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const play = useCallback(async () => {
    if (state === "paused" && speechRef.current) { window.speechSynthesis?.resume(); setState("playing"); return; }
    if (state === "paused" && audioRef.current)  { audioRef.current.play(); setState("playing"); return; }
    if (blobRef.current && audioRef.current)     { audioRef.current.currentTime = 0; audioRef.current.play(); setState("playing"); return; }
    setState("loading");
    const script = buildScript(report, previousScore);
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: script }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      blobRef.current = url;
      speechRef.current = false;
      const audio = new Audio(url);
      audio.onended = audio.onerror = () => setState("idle");
      audioRef.current = audio;
      await audio.play();
      setState("playing");
    } catch {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(script);
        utt.rate = 0.95;
        const male = window.speechSynthesis.getVoices().find((v) => /david|mark|daniel|google uk english male|alex/i.test(v.name));
        if (male) utt.voice = male;
        utt.onend = utt.onerror = () => { speechRef.current = false; setState("idle"); };
        speechRef.current = true;
        window.speechSynthesis.speak(utt);
        setState("playing");
      } else setState("idle");
    }
  }, [state, report, previousScore]);

  const pause = useCallback(() => {
    if (speechRef.current) window.speechSynthesis?.pause(); else audioRef.current?.pause();
    setState("paused");
  }, []);

  const stop = useCallback(() => {
    if (speechRef.current) { window.speechSynthesis?.cancel(); speechRef.current = false; }
    else if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setState("idle");
  }, []);

  return { state, play, pause, stop };
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
  const { state: playState, play, pause, stop } = useReportAudio(report, previousScore);
  const typeConfig = report.streamer_type ? TYPE_CONFIG[report.streamer_type] : null;
  const delta      = previousScore !== undefined ? report.overall_score - previousScore : null;
  const color      = scoreColor(report.overall_score);
  const colorCls   = scoreTailwind(report.overall_score);

  const energyLabel = report.energy_trend === "building"  ? "Building Energy"
    : report.energy_trend === "declining" ? "Declining Energy"
    : report.energy_trend === "volatile"  ? "Volatile Energy"
    : "Consistent Energy";
  const energyCls = report.energy_trend === "building"  ? "bg-green-400/10 border-green-400/20 text-green-300"
    : report.energy_trend === "declining" ? "bg-red-400/10 border-red-400/20 text-red-300"
    : report.energy_trend === "volatile"  ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-300"
    : "bg-white/[0.05] border-white/10 text-white/40";

  const retentionCls = report.viewer_retention_risk === "low"
    ? "bg-green-400/10 border-green-400/20 text-green-300"
    : report.viewer_retention_risk === "medium"
    ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-300"
    : "bg-red-400/10 border-red-400/20 text-red-300";
  const retentionLabel = `${report.viewer_retention_risk === "low" ? "Low" : report.viewer_retention_risk === "medium" ? "Medium" : "High"} Retention Risk`;

  const coldOpenCls   = report.cold_open?.score === "strong"
    ? "bg-green-400/10 border-green-400/20 text-green-300"
    : report.cold_open?.score === "average"
    ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-300"
    : "bg-red-400/10 border-red-400/20 text-red-300";
  const coldOpenLabel = report.cold_open?.score === "strong" ? "Strong Open"
    : report.cold_open?.score === "average" ? "Slow Start" : "Cold Open";

  const silenceGaps = report.dead_zones ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-accent-light" />
          <span className="text-sm font-extrabold text-white tracking-tight">Stream Debrief</span>
        </div>
        <div className="flex items-center gap-1.5">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-300">
              <Flame size={9} />{streak} streak
            </span>
          )}
          {typeConfig && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-white/50">
              {typeConfig.icon}{typeConfig.label}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Score card ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-start justify-between mb-3">
            {/* Number */}
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-5xl font-black tabular-nums leading-none ${colorCls}`}>{report.overall_score}</span>
                <span className="text-lg text-white/20 font-semibold">/100</span>
              </div>
              {delta !== null && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/30"}`}>
                  {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                  {delta > 0 ? `+${delta}` : delta} from last
                </div>
              )}
            </div>

            {/* Quick Listen */}
            <div>
              {playState === "idle" && (
                <button onClick={play} className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/35 hover:text-white/70 transition-colors">
                  <Volume2 size={10} />Listen
                </button>
              )}
              {playState === "loading" && (
                <span className="flex items-center gap-1 text-[10px] text-white/20 px-2.5 py-1.5">
                  <Loader2 size={10} className="animate-spin" />Loading
                </span>
              )}
              {(playState === "playing" || playState === "paused") && (
                <div className="flex items-center gap-1">
                  <button onClick={playState === "playing" ? pause : play} className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white transition-colors">
                    {playState === "playing" ? <Pause size={10} /> : <Play size={10} />}
                  </button>
                  <button onClick={stop} className="p-1.5 text-white/20 hover:text-red-400 transition-colors">
                    <VolumeX size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-white/[0.06] mb-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${report.overall_score}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
            />
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${energyCls}`}>
              {report.energy_trend === "building" ? <TrendingUp size={9} />
                : report.energy_trend === "declining" ? <TrendingDown size={9} />
                : report.energy_trend === "volatile" ? <Activity size={9} />
                : <Minus size={9} />}
              {energyLabel}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${retentionCls}`}>
              <ShieldAlert size={9} />{retentionLabel}
            </span>
            {report.cold_open && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${coldOpenCls}`}>
                {coldOpenLabel}
              </span>
            )}
          </div>
        </div>

        {/* ── Stream story ── */}
        {report.stream_story && (
          <p className="text-xs text-white/45 leading-relaxed italic px-1">{report.stream_story}</p>
        )}

        {/* ── Cold open note ── */}
        {report.cold_open?.note && (
          <p className="text-xs text-white/35 leading-relaxed border-l-2 border-white/[0.07] pl-3">{report.cold_open.note}</p>
        )}

        {/* ── #1 Priority ── */}
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "rgba(139,92,246,0.25)",
            background: "linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.04) 100%)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.2)" }}>
              <Lightbulb size={12} className="text-violet-300" />
            </div>
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-violet-400">#1 Priority</span>
          </div>
          <p className="text-sm leading-relaxed text-white/85 font-medium">{report.recommendation}</p>
        </div>

        {/* ── Score breakdown ── */}
        {report.score_breakdown && (
          <div className="grid grid-cols-4 gap-2">
            {(["energy", "engagement", "consistency", "content"] as const).map((k) => {
              const v = report.score_breakdown![k];
              return (
                <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5 text-center">
                  <div className={`text-lg font-extrabold leading-none ${scoreTailwind(v)}`}>{v}</div>
                  <div className="text-[9px] text-white/30 capitalize mt-0.5">{k}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Best Moment ── */}
        {report.best_moment && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent/10">
              <Star size={12} className="text-accent-light" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-accent-light mb-0.5">Best Moment</p>
              <p className="text-xs text-white/60 leading-snug">{report.best_moment.description}</p>
            </div>
            <span className="text-[10px] font-mono text-white/25 flex-shrink-0">{report.best_moment.time}</span>
          </div>
        )}

        {/* ── What Worked / Fix for Next — two columns ── */}
        {((report.strengths ?? []).length > 0 || (report.improvements ?? []).length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {/* What Worked */}
            <div className="rounded-xl border border-green-500/15 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-green-500/10 bg-green-500/[0.05]">
                <CheckCircle2 size={10} className="text-green-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">What Worked</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {(report.strengths ?? []).map((s, i) => {
                  const { label, body, ts, recurring } = parseCoachText(s);
                  return (
                    <div key={i} className="px-3 py-2.5 space-y-0.5">
                      {recurring && (
                        <span className="text-[8px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1 py-0.5 rounded-full">
                          Recurring
                        </span>
                      )}
                      {label && <p className="text-[10px] font-bold text-green-400 leading-tight">{label}{ts && <span className="font-mono text-white/20 ml-1">{ts}</span>}</p>}
                      <p className="text-[10px] text-white/45 leading-relaxed">{body}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fix for Next */}
            <div className="rounded-xl border border-yellow-500/15 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-yellow-500/10 bg-yellow-500/[0.05]">
                <XCircle size={10} className="text-yellow-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400">Fix for Next</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {(report.improvements ?? []).map((s, i) => {
                  const { label, body, ts, recurring } = parseCoachText(s);
                  return (
                    <div key={i} className="px-3 py-2.5 space-y-0.5">
                      {recurring && (
                        <span className="text-[8px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1 py-0.5 rounded-full">
                          Recurring
                        </span>
                      )}
                      {label && <p className="text-[10px] font-bold text-yellow-400 leading-tight">{label}{ts && <span className="font-mono text-white/20 ml-1">{ts}</span>}</p>}
                      <p className="text-[10px] text-white/45 leading-relaxed">{body}</p>
                    </div>
                  );
                })}
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
                  <span className="flex-shrink-0 w-5 h-5 rounded-full border border-white/[0.1] bg-white/[0.04] flex items-center justify-center text-[9px] font-bold text-white/35 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs text-white/65 leading-snug flex-1">{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Silence Gaps ── */}
        {silenceGaps.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Clock size={10} className="text-white/25" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Silence Gaps</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {silenceGaps.map((gap, i) => {
                const secs    = gap.duration;
                const durStr  = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60 > 0 ? `${secs % 60}s` : ""}`.trim() : `${secs}s`;
                const chipCls = secs >= 300 ? "border-red-500/20 bg-red-500/[0.06] text-red-300"
                  : secs >= 120 ? "border-yellow-500/20 bg-yellow-500/[0.06] text-yellow-300"
                  : "border-white/[0.08] bg-white/[0.03] text-white/35";
                return (
                  <div key={i} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${chipCls}`}>
                    <span className="text-[10px] font-mono">{gap.time}</span>
                    <span className="text-[10px] font-bold">{durStr} gap</span>
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
