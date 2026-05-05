"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ChevronDown, ChevronUp, Zap } from "lucide-react";

interface CategoryBreakdown {
  category: string;
  vod_count: number;
  avg_score: number;
  total_peaks: number;
  avg_peak_score: number;
  avg_duration_min: number;
  follower_delta: number;
  growth_rating: "high" | "medium" | "low";
}

interface ContentReport {
  category_breakdown: CategoryBreakdown[];
  top_category: string | null;
  insight: string | null;
  recommendation: string | null;
  period_start: string;
  period_end: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Comedy",
  educational: "Educational",
  emotional: "Emotional",
  clutch_play: "Clutch Plays",
  rage: "Rage",
  wholesome: "Wholesome",
};

const RATING_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  high: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  medium: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  low: { text: "text-white/40", bg: "bg-white/[0.03]", border: "border-white/5" },
};

function fallbackInsight(report: ContentReport): string {
  const cats = report.category_breakdown || [];
  if (cats.length === 0) return "We're analyzing your content mix. Check back after a few more streams.";
  const top = cats[0];
  const label = CATEGORY_LABELS[top.category] || top.category;
  if (top.growth_rating === "high") {
    return `Your ${label.toLowerCase()} content is your strongest performer with an avg score of ${top.avg_score} across ${top.vod_count} streams.`;
  }
  return `You've streamed ${cats.length} content styles recently. ${label} content leads with a ${top.avg_score} avg score.`;
}

function fallbackRecommendation(report: ContentReport): string {
  const cats = report.category_breakdown || [];
  if (cats.length === 0) return "Keep streaming and we'll start tracking which content types work best for your growth.";
  const top = cats[0];
  const label = CATEGORY_LABELS[top.category] || top.category;
  if (cats.length === 1) return `You've been consistent with ${label.toLowerCase()} content. Try mixing in a different style to see how your audience responds.`;
  return `Double down on ${label.toLowerCase()} content this week. It's driving the most growth for your channel.`;
}

export function MonetizationCard() {
  const [latest, setLatest] = useState<ContentReport | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monetization")
      .then((r) => r.json())
      .then((data) => setLatest(data.latest))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !latest) return null;

  const categories = latest.category_breakdown || [];
  if (categories.length === 0) return null;

  const insight = latest.insight || fallbackInsight(latest);
  const recommendation = latest.recommendation || fallbackRecommendation(latest);
  const topLabel = latest.top_category ? (CATEGORY_LABELS[latest.top_category] || latest.top_category) : null;

  return (
    <div
      className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5 cursor-pointer transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-accent-light" />
          <span className="text-xs font-medium text-muted">
            Content Performance
          </span>
        </div>
        <div className="flex items-center gap-2">
          {topLabel && (
            <span className="text-sm font-bold text-accent-light">{topLabel}</span>
          )}
          {expanded
            ? <ChevronUp size={14} className="text-muted" />
            : <ChevronDown size={14} className="text-muted" />
          }
        </div>
      </div>

      {/* Insight — always visible */}
      <p className="text-sm text-white/80 leading-relaxed">{insight}</p>

      {/* Expanded */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
          {/* Recommendation */}
          <div className="bg-white/[0.03] rounded-xl p-4">
            <p className="text-xs font-medium text-muted mb-2">This Week's Strategy</p>
            <p className="text-sm text-white/90 leading-relaxed">{recommendation}</p>
          </div>

          {/* Category breakdown */}
          <div>
            <p className="text-xs font-medium text-muted mb-3">Category Breakdown</p>
            <div className="space-y-2">
              {categories.map((cat) => (
                <CategoryRow key={cat.category} data={cat} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ data }: { data: CategoryBreakdown }) {
  const label = CATEGORY_LABELS[data.category] || data.category;
  const colors = RATING_COLORS[data.growth_rating] || RATING_COLORS.low;
  const deltaStr = data.follower_delta >= 0 ? `+${data.follower_delta}` : `${data.follower_delta}`;

  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${colors.bg} ${colors.border}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-white">{label}</span>
          {data.growth_rating === "high" && <Zap size={12} className="text-green-400" />}
        </div>
        <span className="text-xs text-muted">
          {data.vod_count} stream{data.vod_count !== 1 ? "s" : ""} · avg {data.avg_score} score · {data.total_peaks} peak{data.total_peaks !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-bold ${data.follower_delta >= 0 ? "text-green-400" : "text-red-400"}`}>
          {deltaStr}
        </div>
        <div className="text-[10px] text-muted">followers</div>
      </div>
    </div>
  );
}
