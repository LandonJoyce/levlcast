"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle,
  Lightbulb, Target, Gamepad2, MessageCircle, Map, Shuffle, BookOpen,
  Volume2, VolumeX, Pause, Play, Loader2, Flame, Zap, ShieldAlert, Clock,
  CheckCircle2,
} from "lucide-react";
import { CoachReport } from "@/lib/analyze";

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  gaming:        { label: "Gaming",        icon: <Gamepad2 size={11} />      },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={11} /> },
  irl:           { label: "IRL",           icon: <Map size={11} />           },
  variety:       { label: "Variety",       icon: <Shuffle size={11} />       },
  educational:   { label: "Educational",   icon: <BookOpen size={11} />      },
};

function scoreHex(n: number) {
  return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171";
}
function scoreCls(n: number) {
  return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400";
}

function stripText(raw: string): { label: string; body: string; ts: string | null; recurring: boolean } {
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

function buildScript(r: CoachReport, prev?: number) {
  const p = [`Stream score: ${r.overall_score} out of 100.`];
  if (prev !== undefined) {
    const d = r.overall_score - prev;
    if (d > 0) p.push(`Up ${d} from last stream.`);
    else if (d < 0) p.push(`Down ${Math.abs(d)} from last stream.`);
  }
  p.push(`Number one priority. ${r.recommendation}`);
  (r.next_stream_goals ?? []).forEach((g, i) => p.push(`Mission ${i + 1}. ${g}`));
  return p.join(" ");
}

type PS = "idle" | "loading" | "playing" | "paused";

function useAudio(r: CoachReport, prev?: number) {
  const [ps, setPs]    = useState<PS>("idle");
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const blobRef        = useRef<string | null>(null);
  const speechRef      = useRef(false);

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

export function CoachReportCard({ report, previousScore, streak = 0 }: {
  report: CoachReport; previousScore?: number; streak?: number;
}) {
  const { ps, play, pause, stop } = useAudio(report, previousScore);
  const tc    = report.streamer_type ? TYPE_CONFIG[report.streamer_type] : null;
  const delta = previousScore !== undefined ? report.overall_score - previousScore : null;
  const hex   = scoreHex(report.overall_score);
  const cls   = scoreCls(report.overall_score);

  // pill helpers
  const energyPill = {
    cls: report.energy_trend === "building"  ? "bg-green-500/10 border-green-500/25 text-green-300"
       : report.energy_trend === "declining" ? "bg-red-500/10 border-red-500/25 text-red-300"
       : report.energy_trend === "volatile"  ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300"
       : "bg-white/[0.05] border-white/10 text-white/45",
    label: report.energy_trend === "building"  ? "Building Energy"
         : report.energy_trend === "declining" ? "Declining Energy"
         : report.energy_trend === "volatile"  ? "Volatile Energy"
         : "Consistent Energy",
    icon: report.energy_trend === "building"  ? <TrendingUp size={11} />
        : report.energy_trend === "declining" ? <TrendingDown size={11} />
        : report.energy_trend === "volatile"  ? <Activity size={11} />
        : <Minus size={11} />,
  };

  const retPill = {
    cls: report.viewer_retention_risk === "low"    ? "bg-green-500/10 border-green-500/25 text-green-300"
       : report.viewer_retention_risk === "medium" ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300"
       : "bg-red-500/10 border-red-500/25 text-red-300",
    label: report.viewer_retention_risk === "low" ? "Low Retention Risk"
         : report.viewer_retention_risk === "medium" ? "High Retention Risk"
         : "High Retention Risk",
  };

  const coldPill = report.cold_open ? {
    cls: report.cold_open.score === "strong" ? "bg-green-500/10 border-green-500/25 text-green-300"
       : report.cold_open.score === "average" ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300"
       : "bg-red-500/10 border-red-500/25 text-red-300",
    label: report.cold_open.score === "strong" ? "Strong Open"
         : report.cold_open.score === "average" ? "Slow Start"
         : "Cold Open",
  } : null;

  const gaps = report.dead_zones ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <Zap size={14} className="text-accent-light" />
          <span className="font-extrabold text-base text-white tracking-tight">Stream Debrief</span>
        </div>
        <div className="flex items-center gap-2">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-300">
              <Flame size={10} />{streak} streak
            </span>
          )}
          {tc && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-white/50">
              {tc.icon}{tc.label}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">

        {/* ── Score card ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-6 py-6">
          {/* Centered score number */}
          <div className="flex items-baseline justify-center gap-2 mb-5">
            <span className={`text-8xl font-black tabular-nums leading-none ${cls}`}>{report.overall_score}</span>
            <span className="text-3xl font-bold text-white/20">/100</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden mb-4">
            <div
              className="h-full rounded-full"
              style={{ width: `${report.overall_score}%`, backgroundColor: hex, boxShadow: `0 0 12px ${hex}60`, transition: "width 0.7s ease" }}
            />
          </div>

          {/* Delta row */}
          <div className="flex items-center justify-between mb-4">
            {delta !== null ? (
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/30"}`}>
                {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                {delta > 0 ? `+${delta}` : delta} from last
              </span>
            ) : <span />}

            {/* Quick Listen */}
            {ps === "idle" && (
              <button onClick={play} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/40 hover:text-white/75 transition-colors">
                <Volume2 size={12} />Quick Listen
              </button>
            )}
            {ps === "loading" && (
              <span className="flex items-center gap-1.5 text-xs text-white/25"><Loader2 size={12} className="animate-spin" />Loading...</span>
            )}
            {(ps === "playing" || ps === "paused") && (
              <div className="flex items-center gap-1">
                <button onClick={ps === "playing" ? pause : play} className="p-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/50 hover:text-white transition-colors">
                  {ps === "playing" ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button onClick={stop} className="p-1.5 text-white/20 hover:text-red-400 transition-colors"><VolumeX size={12} /></button>
              </div>
            )}
          </div>

          {/* Pills */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${energyPill.cls}`}>
              {energyPill.icon}{energyPill.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${retPill.cls}`}>
              <ShieldAlert size={11} />{retPill.label}
            </span>
            {coldPill && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${coldPill.cls}`}>
                {coldPill.label}
              </span>
            )}
          </div>
        </div>

        {/* Stream story */}
        {report.stream_story && (
          <p className="text-sm text-white/55 leading-relaxed italic">{report.stream_story}</p>
        )}

        {/* Cold open note */}
        {report.cold_open?.note && (
          <p className="text-sm text-white/40 leading-relaxed border-l-2 border-white/[0.08] pl-4">{report.cold_open.note}</p>
        )}

        {/* #1 Priority */}
        <div className="rounded-xl p-5 border" style={{ borderColor: "rgba(139,92,246,0.3)", background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.05) 100%)" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.25)" }}>
              <Lightbulb size={14} className="text-violet-300" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-violet-400">#1 Priority</span>
          </div>
          <p className="text-base leading-relaxed text-white/90 font-medium">{report.recommendation}</p>
        </div>

        {/* Score breakdown */}
        {report.score_breakdown && (
          <div className="grid grid-cols-4 gap-3">
            {(["energy", "engagement", "consistency", "content"] as const).map((k) => {
              const v = report.score_breakdown![k];
              return (
                <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-center">
                  <div className={`text-2xl font-extrabold leading-none mb-1 ${scoreCls(v)}`}>{v}</div>
                  <div className="text-[10px] text-white/30 capitalize">{k}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Best Moment */}
        {report.best_moment && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent/10 border border-accent/20">
              <Star size={14} className="text-accent-light" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent-light mb-1.5">Best Moment</p>
              <p className="text-sm text-white/70 leading-relaxed">{report.best_moment.description}</p>
            </div>
            <span className="text-sm font-mono text-white/25 flex-shrink-0 pt-0.5">{report.best_moment.time}</span>
          </div>
        )}

        {/* What Worked / Fix for Next — two columns */}
        {((report.strengths ?? []).length > 0 || (report.improvements ?? []).length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {/* What Worked */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/10 bg-green-500/[0.05]">
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-400">What Worked</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {(report.strengths ?? []).map((s, i) => {
                  const { label, body, ts, recurring } = stripText(s);
                  return (
                    <div key={i} className="px-4 py-3 space-y-1">
                      {recurring && <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full">Recurring</span>}
                      <p className="text-sm font-bold text-green-400 leading-tight">
                        {label || body}
                        {ts && <span className="font-mono text-white/20 text-xs ml-1.5">{ts}</span>}
                      </p>
                      {label && <p className="text-sm text-white/50 leading-relaxed">{body}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fix for Next */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-yellow-500/10 bg-yellow-500/[0.05]">
                <AlertCircle size={12} className="text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Fix for Next</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {(report.improvements ?? []).map((s, i) => {
                  const { label, body, ts, recurring } = stripText(s);
                  return (
                    <div key={i} className="px-4 py-3 space-y-1">
                      {recurring && <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full">Recurring</span>}
                      <p className="text-sm font-bold text-yellow-400 leading-tight">
                        {label || body}
                        {ts && <span className="font-mono text-white/20 text-xs ml-1.5">{ts}</span>}
                      </p>
                      {label && <p className="text-sm text-white/50 leading-relaxed">{body}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Your Missions */}
        {(report.next_stream_goals ?? []).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target size={13} className="text-accent-light" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent-light">Your Missions</span>
            </div>
            <div className="space-y-3">
              {(report.next_stream_goals ?? []).map((goal, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full border border-white/[0.1] bg-white/[0.04] flex items-center justify-center text-xs font-bold text-white/35 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white/70 leading-relaxed flex-1">{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Silence Gaps */}
        {gaps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={12} className="text-white/25" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/25">Silence Gaps</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gaps.map((g, i) => {
                const s   = g.duration;
                const dur = s >= 60 ? `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ""}` : `${s}s`;
                const c   = s >= 300 ? "border-red-500/25 bg-red-500/[0.07] text-red-300"
                  : s >= 120 ? "border-yellow-500/25 bg-yellow-500/[0.07] text-yellow-300"
                  : "border-white/[0.09] bg-white/[0.03] text-white/40";
                return (
                  <span key={i} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${c}`}>
                    <span className="font-mono">{g.time}</span>
                    <span className="text-[10px] opacity-70">·</span>
                    <span>{dur} gap</span>
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
