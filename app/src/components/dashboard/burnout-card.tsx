"use client";

import { useEffect, useState } from "react";
import { HeartPulse, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface BurnoutSnapshot {
  score: number;
  score_decline: number;
  energy_decline: number;
  session_shortening: number;
  frequency_drop: number;
  retention_risk: number;
  growth_stall: number;
  insight: string | null;
  recommendation: string | null;
  computed_at: string;
}

function scoreColor(score: number) {
  if (score <= 25) return { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", fill: "#4ade80" };
  if (score <= 45) return { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", fill: "#facc15" };
  if (score <= 65) return { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", fill: "#fb923c" };
  return { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", fill: "#f87171" };
}

function scoreLabel(score: number) {
  if (score <= 25) return "Healthy";
  if (score <= 45) return "Watch";
  if (score <= 65) return "Warning";
  return "Alert";
}

function TrendIcon({ history }: { history: BurnoutSnapshot[] }) {
  if (history.length < 2) return <Minus size={14} className="text-muted" />;
  const prev = history[history.length - 2].score;
  const curr = history[history.length - 1].score;
  if (curr > prev + 5) return <TrendingUp size={14} className="text-red-400" />;
  if (curr < prev - 5) return <TrendingDown size={14} className="text-green-400" />;
  return <Minus size={14} className="text-muted" />;
}

export function BurnoutCard() {
  const [latest, setLatest] = useState<BurnoutSnapshot | null>(null);
  const [history, setHistory] = useState<BurnoutSnapshot[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/burnout")
      .then((r) => r.json())
      .then((data) => {
        setLatest(data.latest);
        setHistory(data.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !latest) return null; // don't render if no data yet

  const colors = scoreColor(latest.score);
  const label = scoreLabel(latest.score);

  // Invert: 100 = healthy, 0 = burnout (for the visual bar)
  const healthPercent = 100 - latest.score;

  return (
    <div
      className={`rounded-2xl border p-5 ${colors.bg} ${colors.border} cursor-pointer transition-all`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HeartPulse size={16} className={colors.text} />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            Streamer Health
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon history={history} />
          <span className={`text-sm font-bold ${colors.text}`}>{label}</span>
        </div>
      </div>

      {/* Health bar */}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${healthPercent}%`, backgroundColor: colors.fill }}
        />
      </div>

      {/* Insight */}
      {latest.insight && (
        <p className="text-sm text-white/80 leading-relaxed">
          {latest.insight}
        </p>
      )}

      {/* Expanded: recommendation + signal breakdown */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          {latest.recommendation && (
            <p className="text-sm text-muted leading-relaxed">
              <span className="font-semibold text-white/90">This week:</span>{" "}
              {latest.recommendation}
            </p>
          )}

          {/* Mini sparkline of last 8 scores */}
          {history.length > 1 && (
            <div className="flex items-end gap-1 h-8">
              {history.map((snap, i) => {
                const height = Math.max(4, (100 - snap.score) * 0.3);
                const isLast = i === history.length - 1;
                return (
                  <div
                    key={snap.computed_at}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${height}px`,
                      backgroundColor: isLast ? colors.fill : "rgba(255,255,255,0.1)",
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Signal breakdown */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <SignalDot label="Score" value={latest.score_decline} />
            <SignalDot label="Energy" value={latest.energy_decline} />
            <SignalDot label="Sessions" value={latest.session_shortening} />
            <SignalDot label="Frequency" value={latest.frequency_drop} />
            <SignalDot label="Retention" value={latest.retention_risk} />
            <SignalDot label="Growth" value={latest.growth_stall} />
          </div>
        </div>
      )}
    </div>
  );
}

function SignalDot({ label, value }: { label: string; value: number }) {
  const color = value <= 25 ? "bg-green-400" : value <= 50 ? "bg-yellow-400" : value <= 75 ? "bg-orange-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-muted">{label}</span>
    </div>
  );
}
