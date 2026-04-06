"use client";

import { useState, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle, Lightbulb, Target, ShieldAlert, Gamepad2, MessageCircle, Map, Shuffle, BookOpen, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { CoachReport } from "@/lib/analyze";

function EnergyIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "building": return <TrendingUp size={13} className="text-green-400" />;
    case "declining": return <TrendingDown size={13} className="text-red-400" />;
    case "volatile": return <Activity size={13} className="text-yellow-400" />;
    default: return <Minus size={13} className="text-muted" />;
  }
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171";
  const label = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  const circumference = 2 * Math.PI * 28;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative flex-shrink-0 w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r="28"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={`text-xl font-extrabold leading-none ${label}`}>{score}</span>
        <span className="text-[9px] text-white/30 font-medium">/100</span>
      </div>
    </div>
  );
}

const STREAMER_TYPE_CONFIG: Record<string, {
  label: string; icon: React.ReactNode;
  color: string; bg: string; border: string; glow: string;
}> = {
  gaming:       { label: "Gaming",       icon: <Gamepad2 size={12} />,    color: "text-purple-300", bg: "bg-purple-500/15",  border: "border-purple-400/30", glow: "#a855f7" },
  just_chatting:{ label: "Just Chatting",icon: <MessageCircle size={12} />,color: "text-blue-300",   bg: "bg-blue-500/15",    border: "border-blue-400/30",   glow: "#60a5fa" },
  irl:          { label: "IRL",          icon: <Map size={12} />,          color: "text-green-300",  bg: "bg-green-500/15",   border: "border-green-400/30",  glow: "#4ade80" },
  variety:      { label: "Variety",      icon: <Shuffle size={12} />,      color: "text-orange-300", bg: "bg-orange-500/15",  border: "border-orange-400/30", glow: "#fb923c" },
  educational:  { label: "Educational",  icon: <BookOpen size={12} />,     color: "text-cyan-300",   bg: "bg-cyan-500/15",    border: "border-cyan-400/30",   glow: "#22d3ee" },
};

export function CoachReportCard({ report }: { report: CoachReport }) {
  const [expanded, setExpanded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const typeConfig = report.streamer_type ? STREAMER_TYPE_CONFIG[report.streamer_type] : null;
  const glowColor = typeConfig?.glow ?? "#8b5cf6";

  const retentionColor = report.viewer_retention_risk === "low" ? "text-green-400" :
    report.viewer_retention_risk === "medium" ? "text-yellow-400" : "text-red-400";
  const retentionBg = report.viewer_retention_risk === "low" ? "bg-green-400/10 border-green-400/20" :
    report.viewer_retention_risk === "medium" ? "bg-yellow-400/10 border-yellow-400/20" : "bg-red-400/10 border-red-400/20";

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  // Holographic tilt values
  const rotateX = hovered ? (mousePos.y - 0.5) * -12 : 0;
  const rotateY = hovered ? (mousePos.x - 0.5) * 12 : 0;
  const shineX = mousePos.x * 100;
  const shineY = mousePos.y * 100;

  return (
    <div
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMousePos({ x: 0.5, y: 0.5 }); }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: hovered ? "transform 0.1s ease-out" : "transform 0.4s ease-out",
          transformStyle: "preserve-3d",
        }}
        className="relative rounded-2xl overflow-hidden"
      >
        {/* Holographic rainbow shimmer layer */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-2xl opacity-0 transition-opacity duration-300"
          style={{
            opacity: hovered ? 0.18 : 0,
            background: `radial-gradient(circle at ${shineX}% ${shineY}%,
              #ff0080, #ff8c00, #ffd700, #00ff88, #00cfff, #a855f7, #ff0080)`,
            mixBlendMode: "screen",
          }}
        />

        {/* Edge glow on hover */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-2xl transition-opacity duration-300"
          style={{
            opacity: hovered ? 1 : 0,
            boxShadow: `0 0 0 1px ${glowColor}55, 0 0 30px ${glowColor}22, inset 0 0 30px ${glowColor}08`,
          }}
        />

        {/* Scanline texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-2xl opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
          }}
        />

        {/* Card body */}
        <div
          className="relative bg-surface border border-white/10 rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg,
              rgba(20,20,35,0.98) 0%,
              rgba(15,15,28,0.98) 50%,
              rgba(20,15,35,0.98) 100%)`,
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between border-b border-white/8"
            style={{
              background: `linear-gradient(90deg, ${glowColor}18 0%, transparent 60%)`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${glowColor}25`, boxShadow: `0 0 12px ${glowColor}40` }}
              >
                <Zap size={14} style={{ color: glowColor }} />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white">Stream Coach Report</span>
            </div>
            <div className="flex items-center gap-2.5">
              {typeConfig && (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${typeConfig.bg} ${typeConfig.color} border ${typeConfig.border}`}
                  style={{ boxShadow: `0 0 8px ${glowColor}30` }}
                >
                  {typeConfig.icon}
                  {typeConfig.label}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs text-white/40">
                <EnergyIcon trend={report.energy_trend} />
                <span className="capitalize">{report.energy_trend}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">

            {/* Score + summary */}
            <div className="flex gap-4 items-center">
              <ScoreRing score={report.overall_score} />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed text-white/70">{report.stream_summary}</p>
                {report.viewer_retention_risk && (
                  <div className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full border text-xs font-semibold capitalize ${retentionColor} ${retentionBg}`}>
                    <ShieldAlert size={11} />
                    {report.viewer_retention_risk} retention risk
                  </div>
                )}
              </div>
            </div>

            {/* Coach's take */}
            <div
              className="rounded-xl p-4 border border-white/8"
              style={{
                background: `linear-gradient(135deg, ${glowColor}12 0%, rgba(255,255,255,0.02) 100%)`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={13} style={{ color: glowColor }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: glowColor }}>
                  Coach's Take
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/80">{report.recommendation}</p>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-xl border border-white/8 hover:border-white/20 text-white/40 hover:text-white/80 transition-all"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              {expanded ? <><ChevronUp size={13} /> Hide full report</> : <><ChevronDown size={13} /> Show full report</>}
            </button>

            {/* Expanded */}
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

                {/* Strengths + Improvements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Star size={12} className="text-green-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-green-400">What Worked</span>
                    </div>
                    <ul className="space-y-2.5">
                      {report.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-white/65 flex gap-2">
                          <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400/70" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <AlertCircle size={12} className="text-yellow-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Improve</span>
                    </div>
                    <ul className="space-y-2.5">
                      {report.improvements.map((s, i) => (
                        <li key={i} className="text-sm text-white/65 flex gap-2">
                          <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400/70" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Content Mix */}
                {report.content_mix && report.content_mix.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/30 block mb-2.5">Content Mix</span>
                    <div className="flex gap-2 flex-wrap">
                      {report.content_mix.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-3 py-1">
                          <span className="text-xs capitalize text-white/60">{c.category}</span>
                          <span className="text-xs font-bold" style={{ color: glowColor }}>{c.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Stream Goals */}
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
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: glowColor }}>Next Stream Goals</span>
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

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
