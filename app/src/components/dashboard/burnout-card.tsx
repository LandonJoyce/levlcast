"use client";

import { useEffect, useState } from "react";
import { HeartPulse, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { UpgradeModal } from "./upgrade-modal";

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

/** Generate a plain-English summary from raw signal values when Claude insight is missing */
function fallbackInsight(snap: BurnoutSnapshot): string {
  const issues: string[] = [];
  if (snap.score_decline > 50) issues.push("your stream scores are trending down");
  if (snap.energy_decline > 50) issues.push("your energy has been inconsistent");
  if (snap.session_shortening > 50) issues.push("your sessions are getting shorter");
  if (snap.frequency_drop > 50) issues.push("you're streaming less frequently");
  if (snap.retention_risk > 50) issues.push("viewer retention risk is elevated");
  if (snap.growth_stall > 50) issues.push("follower growth has slowed");

  if (issues.length === 0) {
    if (snap.score <= 25) return "Everything looks good. You're in a solid rhythm.";
    return "A few minor signals this week, but nothing to worry about yet.";
  }
  const joined = issues.length === 1 ? issues[0] : issues.slice(0, -1).join(", ") + " and " + issues[issues.length - 1];
  return `Heads up: ${joined}. This isn't a big deal yet, but worth keeping an eye on.`;
}

function fallbackRecommendation(snap: BurnoutSnapshot): string {
  if (snap.frequency_drop > 60) return "Try to get back to your normal schedule this week, even if the streams are shorter.";
  if (snap.session_shortening > 60) return "If your streams feel like a grind, take a day off and come back fresh. Short breaks help.";
  if (snap.energy_decline > 60) return "Switch up your content or try a collab this week. A change of pace can reset your energy.";
  if (snap.score_decline > 60) return "Review your last few coach reports and focus on the top improvement from each one.";
  if (snap.score <= 25) return "Keep doing what you're doing. Consistency is your best growth tool right now.";
  return "Focus on one small improvement from your latest coach report this week.";
}

/** Human-readable signal label */
function signalExplain(label: string, value: number): string {
  const status = value <= 25 ? "Good" : value <= 50 ? "Okay" : value <= 75 ? "Flagged" : "Concern";
  const descriptions: Record<string, string> = {
    "Stream Scores": "Are your coach scores going up or down?",
    "Energy Level": "Is your on-stream energy staying consistent?",
    "Session Length": "Are your streams getting shorter over time?",
    "Stream Frequency": "Are you streaming as often as before?",
    "Viewer Retention": "Are viewers at risk of dropping off?",
    "Follower Growth": "Is your follower count still growing?",
  };
  return `${status} ${descriptions[label] || ""}`;
}

export function BurnoutCard() {
  const [latest, setLatest] = useState<BurnoutSnapshot | null>(null);
  const [history, setHistory] = useState<BurnoutSnapshot[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    fetch("/api/burnout")
      .then((r) => r.json())
      .then((data) => {
        if (data.locked) { setLocked(true); return; }
        setLatest(data.latest);
        setHistory(data.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (locked) {
    return (
      <>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse size={16} className="text-muted" />
            <span className="text-xs font-medium text-muted">Streamer Health</span>
          </div>
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Lock size={18} className="text-accent-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Burnout Monitoring is Pro</p>
              <p className="text-xs text-muted leading-relaxed">Your manager tracks energy, frequency, and health signals weekly upgrade to see your report.</p>
            </div>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="mt-1 px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
        <UpgradeModal
          isOpen={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          reason="Upgrade to Pro to unlock Burnout Monitoring your manager will track your energy, stream frequency, and health signals every week."
        />
      </>
    );
  }

  if (!latest) return null;

  const colors = scoreColor(latest.score);
  const label = scoreLabel(latest.score);
  const healthPercent = 100 - latest.score;
  const insight = latest.insight || fallbackInsight(latest);
  const recommendation = latest.recommendation || fallbackRecommendation(latest);

  return (
    <div
      className={`rounded-2xl border p-5 ${colors.bg} ${colors.border} cursor-pointer transition-all`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HeartPulse size={16} className={colors.text} />
          <span className="text-xs font-medium text-muted">
            Streamer Health
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${colors.text}`}>{label}</span>
          {expanded
            ? <ChevronUp size={14} className="text-muted" />
            : <ChevronDown size={14} className="text-muted" />
          }
        </div>
      </div>

      {/* Health bar */}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${healthPercent}%`, backgroundColor: colors.fill }}
        />
      </div>

      {/* Insight always visible */}
      <p className="text-sm text-white/80 leading-relaxed">{insight}</p>

      {/* Expanded */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
          {/* Recommendation */}
          <div className="bg-white/[0.03] rounded-xl p-4">
            <p className="text-xs font-medium text-muted mb-2">This Week's Focus</p>
            <p className="text-sm text-white/90 leading-relaxed">{recommendation}</p>
          </div>

          {/* Signal breakdown human readable */}
          <div>
            <p className="text-xs font-medium text-muted mb-3">What We're Watching</p>
            <div className="space-y-2">
              <SignalRow label="Stream Scores" value={latest.score_decline} />
              <SignalRow label="Energy Level" value={latest.energy_decline} />
              <SignalRow label="Session Length" value={latest.session_shortening} />
              <SignalRow label="Stream Frequency" value={latest.frequency_drop} />
              <SignalRow label="Viewer Retention" value={latest.retention_risk} />
              <SignalRow label="Follower Growth" value={latest.growth_stall} />
            </div>
          </div>

          {/* Mini sparkline of last 8 weeks */}
          {history.length > 1 && (
            <div>
              <p className="text-xs font-medium text-muted mb-2">Health Trend</p>
              <div className="flex items-end gap-1 h-10">
                {history.map((snap, i) => {
                  const height = Math.max(6, (100 - snap.score) * 0.38);
                  const isLast = i === history.length - 1;
                  return (
                    <div
                      key={snap.computed_at}
                      className="flex-1 rounded-sm transition-all"
                      style={{
                        height: `${height}px`,
                        backgroundColor: isLast ? colors.fill : "rgba(255,255,255,0.08)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: number }) {
  const color = value <= 25 ? "bg-green-400" : value <= 50 ? "bg-yellow-400" : value <= 75 ? "bg-orange-400" : "bg-red-400";
  const textColor = value <= 25 ? "text-green-400" : value <= 50 ? "text-yellow-400" : value <= 75 ? "text-orange-400" : "text-red-400";
  const statusText = value <= 25 ? "Good" : value <= 50 ? "Okay" : value <= 75 ? "Watch" : "Concern";
  const pct = Math.min(value, 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-14 text-right ${textColor}`}>{statusText}</span>
    </div>
  );
}
