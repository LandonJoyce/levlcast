"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Sparkles, Clock, Scissors, Zap, ArrowUpRight } from "lucide-react";

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

  function load(autoRefreshIfStale = false) {
    setLoading(true);
    fetch("/api/digest")
      .then((r) => r.json())
      .then((data) => {
        if (data.locked) { setLocked(true); return; }
        setDigest(data.latest ?? null);
        if (autoRefreshIfStale && data.needs_refresh) {
          generate();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(true); }, []);

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
  const avgScore = digest?.avg_score ?? null;
  const scoreColor = avgScore == null ? "text-white" : avgScore >= 70 ? "text-green-400" : avgScore >= 50 ? "text-yellow-400" : "text-red-400";
  const scoreBg = avgScore == null ? "from-white/5 to-white/[0.02]" : avgScore >= 70 ? "from-green-500/10 to-green-500/[0.03]" : avgScore >= 50 ? "from-yellow-500/10 to-yellow-500/[0.03]" : "from-red-500/10 to-red-500/[0.03]";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400">
            Weekly Digest
          </span>
          {weekLabel && <span className="text-xs text-muted">Week of {weekLabel}</span>}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-white transition-colors duration-300 disabled:opacity-40"
        >
          <RefreshCw size={11} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : digest ? "Refresh" : "Generate"}
        </button>
      </div>

      {!digest ? (
        <div className="px-5 pb-8 text-center">
          <p className="text-sm font-semibold text-white mb-1">No digest yet</p>
          <p className="text-xs text-muted max-w-xs mx-auto mb-5">
            Generates every Monday from your recent streams. Build one now to see how your week looked.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all duration-300 hover:-translate-y-px"
          >
            <Zap size={12} />
            {generating ? "Generating..." : "Generate now"}
          </button>
        </div>
      ) : (
        <div className="px-5 pb-5 space-y-4">
          {/* Headline — accent left bar */}
          <div className="flex gap-3">
            <div className="w-0.5 rounded-full bg-gradient-to-b from-accent to-accent/20 flex-shrink-0" />
            <p className="text-sm font-semibold text-white/90 leading-relaxed">{digest.headline}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatTile
              icon={<Sparkles size={12} className={scoreColor} />}
              value={avgScore != null ? String(avgScore) : "—"}
              label="Avg Score"
              valueClass={scoreColor}
              bgClass={`bg-gradient-to-b ${scoreBg}`}
            />
            <StatTile
              icon={<Clock size={12} className="text-blue-400" />}
              value={`${digest.total_duration_min}m`}
              label="Streamed"
              bgClass="bg-gradient-to-b from-blue-500/8 to-blue-500/[0.02]"
            />
            <StatTile
              icon={<Scissors size={12} className="text-purple-400" />}
              value={String(digest.clips_generated)}
              label="Clips"
              bgClass="bg-gradient-to-b from-purple-500/8 to-purple-500/[0.02]"
            />
            <StatTile
              icon={followerDelta >= 0
                ? <TrendingUp size={12} className="text-emerald-400" />
                : <TrendingDown size={12} className="text-red-400" />}
              value={`${followerDelta >= 0 ? "+" : ""}${followerDelta}`}
              label="Followers"
              valueClass={followerDelta >= 0 ? "text-emerald-400" : "text-red-400"}
              bgClass={followerDelta >= 0 ? "bg-gradient-to-b from-emerald-500/8 to-emerald-500/[0.02]" : "bg-gradient-to-b from-red-500/8 to-red-500/[0.02]"}
            />
          </div>

          {/* Summaries */}
          {(digest.health_summary || digest.content_summary || digest.collab_summary) && (
            <div className="rounded-xl border border-white/[0.05] divide-y divide-white/[0.04] overflow-hidden">
              {digest.health_summary && <SummaryRow label="Health" text={digest.health_summary} />}
              {digest.content_summary && <SummaryRow label="Content" text={digest.content_summary} />}
              {digest.collab_summary && <SummaryRow label="Collabs" text={digest.collab_summary} />}
            </div>
          )}

          {/* Action items */}
          {(digest.action_items || []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest mb-3">This week's focus</p>
              <div className="space-y-2.5">
                {digest.action_items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-accent-light">{i + 1}</span>
                    </div>
                    <span className="text-sm text-white/80 leading-snug flex-1">{item}</span>
                    <ArrowUpRight size={13} className="text-white/10 group-hover:text-white/30 transition-colors flex-shrink-0 mt-0.5" />
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

function StatTile({ icon, value, label, valueClass, bgClass }: {
  icon: ReactNode; value: string; label: string; valueClass?: string; bgClass?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.05] px-3 py-3 ${bgClass || "bg-white/[0.02]"}`}>
      <div className={`flex items-center gap-1.5 text-lg font-extrabold leading-none mb-1 ${valueClass || "text-white"}`}>
        {icon}{value}
      </div>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

function SummaryRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <span className="text-[9px] font-bold text-muted/40 uppercase tracking-widest w-12 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-white/65 leading-relaxed">{text}</span>
    </div>
  );
}
