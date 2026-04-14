"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Newspaper, RefreshCw, CheckCircle2, TrendingUp, TrendingDown, Sparkles, Clock, Scissors } from "lucide-react";

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

export function WeeklyDigestSection() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/digest")
      .then((r) => r.json())
      .then((data) => {
        if (data.locked) { setLocked(true); return; }
        setDigest(data.latest ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function generate() {
    setGenerating(true);
    try {
      await fetch("/api/digest", { method: "POST" });
      await load();
    } catch {
    } finally {
      setGenerating(false);
    }
  }

  if (loading || locked) return null;

  const weekLabel = digest
    ? new Date(digest.week_start + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  const followerDelta = digest?.follower_delta ?? 0;
  const scoreColor = digest?.avg_score == null ? "text-white" : digest.avg_score >= 70 ? "text-green-400" : digest.avg_score >= 50 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="bg-surface border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Newspaper size={14} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Weekly Digest</h2>
            {weekLabel && <p className="text-xs text-muted">Week of {weekLabel}</p>}
          </div>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : digest ? "Refresh" : "Generate now"}
        </button>
      </div>

      {!digest ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white mb-1">No digest yet</p>
          <p className="text-xs text-muted max-w-xs mx-auto mb-4">
            Generates every Monday from your recent streams. Hit Generate now to build one immediately.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all duration-300 hover:-translate-y-px"
          >
            <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
            {generating ? "Generating..." : "Generate now"}
          </button>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {/* Headline */}
          <p className="text-sm font-semibold text-white leading-snug">{digest.headline}</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              icon={<Sparkles size={13} className={scoreColor} />}
              value={digest.avg_score != null ? String(digest.avg_score) : "—"}
              label="Avg Score"
              valueClass={scoreColor}
            />
            <StatTile
              icon={<Clock size={13} className="text-muted" />}
              value={`${digest.total_duration_min}m`}
              label="Streamed"
            />
            <StatTile
              icon={<Scissors size={13} className="text-muted" />}
              value={String(digest.clips_generated)}
              label="Clips"
            />
            <StatTile
              icon={followerDelta >= 0 ? <TrendingUp size={13} className="text-green-400" /> : <TrendingDown size={13} className="text-red-400" />}
              value={`${followerDelta >= 0 ? "+" : ""}${followerDelta}`}
              label="Followers"
              valueClass={followerDelta >= 0 ? "text-green-400" : "text-red-400"}
            />
          </div>

          {/* Summaries */}
          {(digest.health_summary || digest.content_summary || digest.collab_summary) && (
            <div className="bg-white/[0.02] rounded-xl p-3.5 space-y-2">
              {digest.health_summary && <SummaryRow label="Health" text={digest.health_summary} />}
              {digest.content_summary && <SummaryRow label="Content" text={digest.content_summary} />}
              {digest.collab_summary && <SummaryRow label="Collabs" text={digest.collab_summary} />}
            </div>
          )}

          {/* Action items */}
          {(digest.action_items || []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-2.5">This week's focus</p>
              <div className="space-y-2">
                {digest.action_items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-accent-light mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/85 leading-snug">{item}</span>
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

function StatTile({ icon, value, label, valueClass }: {
  icon: ReactNode; value: string; label: string; valueClass?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
      <div className={`flex items-center justify-center gap-1 text-lg font-extrabold mb-0.5 ${valueClass || "text-white"}`}>
        {icon}{value}
      </div>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

function SummaryRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[10px] font-semibold text-muted/60 w-14 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-white/70 leading-relaxed">{text}</span>
    </div>
  );
}
