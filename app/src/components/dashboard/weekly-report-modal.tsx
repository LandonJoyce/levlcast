"use client";

import { useEffect, useState } from "react";
import {
  X, Newspaper, TrendingUp, TrendingDown, CheckCircle2,
} from "lucide-react";

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

const STORAGE_KEY = "digest_seen_week";

export function WeeklyReportModal() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((data) => {
        if (data.locked || !data.latest) return;
        const latest: WeeklyDigest = data.latest;
        const seen = localStorage.getItem(STORAGE_KEY);
        if (seen !== latest.week_start) {
          setDigest(latest);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    if (digest) localStorage.setItem(STORAGE_KEY, digest.week_start);
    setOpen(false);
  }

  if (!open || !digest) return null;

  const followerDelta = digest.follower_delta ?? 0;
  const deltaColor = followerDelta >= 0 ? "text-green-400" : "text-red-400";
  const DeltaIcon = followerDelta >= 0 ? TrendingUp : TrendingDown;

  const weekLabel = new Date(digest.week_start + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#111018] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-blue-500/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Newspaper size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Weekly Report</p>
              <p className="text-xs text-muted">Week of {weekLabel}</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-white hover:bg-white/8 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Headline */}
          <p className="text-base font-semibold text-white leading-snug">{digest.headline}</p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatBox label="Streams" value={String(digest.streams_count || 0)} />
            <StatBox label="Avg Score" value={digest.avg_score != null ? String(digest.avg_score) : "—"} />
            <StatBox
              label="Followers"
              value={`${followerDelta >= 0 ? "+" : ""}${followerDelta}`}
              valueClass={deltaColor}
              icon={<DeltaIcon size={12} />}
            />
          </div>

          {/* Summaries */}
          {(digest.health_summary || digest.content_summary || digest.collab_summary) && (
            <div className="space-y-2 bg-white/[0.02] rounded-xl p-3">
              {digest.health_summary && <SummaryRow label="Health" text={digest.health_summary} />}
              {digest.content_summary && <SummaryRow label="Content" text={digest.content_summary} />}
              {digest.collab_summary && <SummaryRow label="Collabs" text={digest.collab_summary} />}
            </div>
          )}

          {/* Action items */}
          {(digest.action_items || []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">This Week's Focus</p>
              <div className="space-y-2">
                {(digest.action_items || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-accent-light mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/85 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-accent hover:opacity-85 text-white text-sm font-semibold transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, valueClass, icon }: {
  label: string; value: string; valueClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
      <div className={`text-xl font-extrabold flex items-center justify-center gap-1 ${valueClass || "text-white"}`}>
        {icon}{value}
      </div>
      <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function SummaryRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-bold text-muted uppercase w-14 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-white/70 leading-relaxed">{text}</span>
    </div>
  );
}
