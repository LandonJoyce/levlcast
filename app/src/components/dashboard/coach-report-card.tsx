"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle, Lightbulb, Target, ShieldAlert, Gamepad2, MessageCircle, Map, Shuffle, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
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
  const color = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  const borderColor = score >= 75 ? "border-green-400/50" : score >= 50 ? "border-yellow-400/50" : "border-red-400/50";
  return (
    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 ${borderColor} bg-bg flex-shrink-0`}>
      <span className={`text-xl font-extrabold ${color}`}>{score}</span>
      <span className="text-[10px] text-muted">/100</span>
    </div>
  );
}

const STREAMER_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  gaming: { label: "Gaming", icon: <Gamepad2 size={13} />, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  just_chatting: { label: "Just Chatting", icon: <MessageCircle size={13} />, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  irl: { label: "IRL", icon: <Map size={13} />, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  variety: { label: "Variety", icon: <Shuffle size={13} />, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  educational: { label: "Educational", icon: <BookOpen size={13} />, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
};

export function CoachReportCard({ report }: { report: CoachReport }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = report.streamer_type ? STREAMER_TYPE_CONFIG[report.streamer_type] : null;

  const retentionColor = report.viewer_retention_risk === "low" ? "text-green-400" :
    report.viewer_retention_risk === "medium" ? "text-yellow-400" : "text-red-400";

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">

      {/* ── Always visible: header ── */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-extrabold text-sm tracking-tight">Stream Coach Report</h2>
        <div className="flex items-center gap-3">
          {typeConfig && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${typeConfig.bg} ${typeConfig.color} border ${typeConfig.border}`}>
              {typeConfig.icon}
              {typeConfig.label}
            </span>
          )}
          <div className="flex items-center gap-1 text-xs text-muted">
            <EnergyIcon trend={report.energy_trend} />
            <span className="capitalize">{report.energy_trend}</span>
          </div>
        </div>
      </div>

      {/* ── Always visible: score + summary + coach's take ── */}
      <div className="p-5 space-y-4">
        <div className="flex gap-4 items-center">
          <ScoreRing score={report.overall_score} />
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed text-muted">{report.stream_summary}</p>
            {report.viewer_retention_risk && (
              <div className="flex items-center gap-1.5 mt-2">
                <ShieldAlert size={11} className={retentionColor} />
                <span className={`text-xs font-medium capitalize ${retentionColor}`}>
                  {report.viewer_retention_risk} retention risk
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Coach's take — always visible, it's the most actionable */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={13} className="text-accent-light" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-light">Coach's Take</span>
          </div>
          <p className="text-sm leading-relaxed">{report.recommendation}</p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted hover:text-white transition-colors py-1"
        >
          {expanded ? (
            <><ChevronUp size={13} /> Hide full report</>
          ) : (
            <><ChevronDown size={13} /> Show full report</>
          )}
        </button>

        {/* ── Expanded detail ── */}
        {expanded && (
          <div className="space-y-4 pt-1 border-t border-border">

            {/* Best Moment */}
            {report.best_moment && (
              <div className="bg-accent/5 border border-accent/15 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Star size={13} className="text-accent-light" />
                  <span className="text-xs font-semibold text-accent-light uppercase tracking-wider">Best Moment</span>
                  <span className="text-xs text-muted ml-auto">{report.best_moment.time}</span>
                </div>
                <p className="text-sm">{report.best_moment.description}</p>
              </div>
            )}

            {/* Strengths + Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Star size={13} className="text-green-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-green-400">What Worked</span>
                </div>
                <ul className="space-y-2">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted flex gap-2">
                      <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400/60" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <AlertCircle size={13} className="text-yellow-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400">Improve</span>
                </div>
                <ul className="space-y-2">
                  {report.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-muted flex gap-2">
                      <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Content Mix */}
            {report.content_mix && report.content_mix.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">Content Mix</span>
                <div className="flex gap-2 flex-wrap">
                  {report.content_mix.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1">
                      <span className="text-xs capitalize">{c.category}</span>
                      <span className="text-xs font-bold text-accent-light">{c.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Stream Goals */}
            {report.next_stream_goals && report.next_stream_goals.length > 0 && (
              <div className="bg-accent/5 border border-accent/15 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Target size={13} className="text-accent-light" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent-light">Next Stream Goals</span>
                </div>
                <ul className="space-y-2">
                  {report.next_stream_goals.map((goal, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full border border-accent/40 flex items-center justify-center mt-0.5">
                        <span className="text-[10px] font-bold text-accent-light">{i + 1}</span>
                      </span>
                      <span className="text-muted">{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
