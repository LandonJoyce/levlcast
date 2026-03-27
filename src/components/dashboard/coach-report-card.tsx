"use client";

import { TrendingUp, TrendingDown, Minus, Activity, Star, AlertCircle, Lightbulb } from "lucide-react";
import { CoachReport } from "@/lib/analyze";

function EnergyIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "building": return <TrendingUp size={14} className="text-green-400" />;
    case "declining": return <TrendingDown size={14} className="text-red-400" />;
    case "volatile": return <Activity size={14} className="text-yellow-400" />;
    default: return <Minus size={14} className="text-muted" />;
  }
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-border bg-bg">
      <span className={`text-2xl font-extrabold ${color}`}>{score}</span>
      <span className="text-xs text-muted">/100</span>
    </div>
  );
}

export function CoachReportCard({ report }: { report: CoachReport }) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-extrabold text-base tracking-tight">Stream Coach Report</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <EnergyIcon trend={report.energy_trend} />
          <span className="capitalize">{report.energy_trend} energy</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Score + Summary */}
        <div className="flex gap-5 items-start">
          <ScoreRing score={report.overall_score} />
          <div className="flex-1">
            <p className="text-sm text-muted leading-relaxed">{report.stream_summary}</p>
          </div>
        </div>

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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Star size={13} className="text-green-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-green-400">What Worked</span>
            </div>
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-sm text-muted flex gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-green-400/60" />
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
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Content Mix */}
        {report.content_mix && report.content_mix.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2.5">Content Mix</span>
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

        {/* Recommendation */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={13} className="text-accent-light" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-light">Coach's Take</span>
          </div>
          <p className="text-sm">{report.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
