"use client";

import { useEffect, useState } from "react";
import { Newspaper, ChevronDown, ChevronUp, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((data) => setLatest(data.latest))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !latest) return null;

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
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
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
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">This Week's Actions</p>
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
      <div className="text-[10px] text-muted uppercase tracking-wide">{label}</div>
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
