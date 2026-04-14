"use client";

import { useEffect, useState } from "react";
import { Newspaper, ChevronDown, ChevronUp, CheckCircle2, TrendingUp, TrendingDown, Lock } from "lucide-react";
import { UpgradeModal } from "./upgrade-modal";

interface WeeklyDigest {
  headline: string;
  streams_count: number;
  total_duration_min: number;
  avg_score: number | null;
  best_score: number | null;
  peaks_found: number;
  clips_generated: number;
  follower_delta: number;
  health_summary: string | null;
  content_summary: string | null;
  collab_summary: string | null;
  action_items: string[];
  week_start: string;
}

export function DigestCard() {
  const [latest, setLatest] = useState<WeeklyDigest | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((data) => {
        if (data.locked) { setLocked(true); return; }
        setLatest(data.latest);
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
            <Newspaper size={16} className="text-muted" />
            <span className="text-xs font-medium text-muted">Weekly Digest</span>
          </div>
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Lock size={18} className="text-accent-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Weekly Digest is Pro</p>
              <p className="text-xs text-muted leading-relaxed">Every Monday your manager sends a full week recap — streams, clips, follower growth, and your action plan.</p>
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
          reason="Upgrade to Pro to unlock the Weekly Digest — every Monday your manager sends a full recap with your action plan for the week."
        />
      </>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper size={16} className="text-blue-400" />
          <span className="text-xs font-medium text-muted">Weekly Digest</span>
        </div>
        <p className="text-sm font-semibold text-white mb-1">Your first report is on the way</p>
        <p className="text-xs text-muted leading-relaxed">
          Every Monday we send a full recap — streams, score changes, follower growth, and your action plan for the week.
        </p>
      </div>
    );
  }

  const followerDelta = latest.follower_delta ?? 0;
  const deltaColor = followerDelta >= 0 ? "text-green-400" : "text-red-400";
  const DeltaIcon = followerDelta >= 0 ? TrendingUp : TrendingDown;

  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 cursor-pointer transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-blue-400" />
          <span className="text-xs font-medium text-muted">
            Weekly Digest
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            {formatWeekDate(latest.week_start)}
          </span>
          {expanded
            ? <ChevronUp size={14} className="text-muted" />
            : <ChevronDown size={14} className="text-muted" />
          }
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm font-semibold text-white leading-relaxed mb-3">{latest.headline}</p>

      {/* Quick stats row */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span>{latest.streams_count || 0} stream{(latest.streams_count || 0) !== 1 ? "s" : ""}</span>
        {latest.avg_score != null && <span>avg {latest.avg_score}</span>}
        <span className={`flex items-center gap-1 ${deltaColor}`}>
          <DeltaIcon size={12} />
          {followerDelta >= 0 ? "+" : ""}{followerDelta}
        </span>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Duration" value={`${latest.total_duration_min}m`} />
            <MiniStat label="Peaks" value={latest.peaks_found.toString()} />
            <MiniStat label="Clips" value={latest.clips_generated.toString()} />
          </div>

          {/* Summaries */}
          <div className="space-y-2">
            {latest.health_summary && (
              <SummaryRow icon="health" text={latest.health_summary} />
            )}
            {latest.content_summary && (
              <SummaryRow icon="content" text={latest.content_summary} />
            )}
            {latest.collab_summary && (
              <SummaryRow icon="collab" text={latest.collab_summary} />
            )}
          </div>

          {/* Action items */}
          {(latest.action_items || []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-2">This Week's Actions</p>
              <div className="space-y-2">
                {(latest.action_items || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-accent-light mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function SummaryRow({ icon, text }: { icon: string; text: string }) {
  const labels: Record<string, string> = {
    health: "Health",
    content: "Content",
    collab: "Collabs",
  };
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-bold text-muted uppercase w-14 flex-shrink-0 pt-0.5">
        {labels[icon] || icon}
      </span>
      <span className="text-sm text-white/70">{text}</span>
    </div>
  );
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
