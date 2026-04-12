"use client";

import { useState } from "react";
import { Check, Copy, Loader2, CalendarDays, Sparkles } from "lucide-react";

interface DayPerformance {
  avgScore: number;
  count: number;
}

interface StreamerIdentity {
  streamerType: string | null;
  dominantCategory: string | null;
  totalStreams: number;
}

interface PlanResult {
  schedule: Array<{ day: string; time: string; reason: string }>;
  titles: Array<{ content: string; suggestions: string[] }>;
}

interface Props {
  contentOptions: string[];
  dayPerformance: Record<string, DayPerformance>;
  streamerIdentity: StreamerIdentity;
}

export function PlannerForm({
  contentOptions,
  dayPerformance,
  streamerIdentity,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((s) => s !== option) : [...prev, option]
    );
    // Reset plan when selection changes
    if (plan) setPlan(null);
  }

  async function generate() {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    setPlan(null);

    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedContent: selected,
          dayPerformance,
          streamerIdentity,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error === "pro_required" ? "pro_required" : "Failed to generate plan. Try again.");
        return;
      }

      const data = await res.json();
      setPlan(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTitle(title: string) {
    await navigator.clipboard.writeText(title);
    setCopied(title);
    setTimeout(() => setCopied(null), 1500);
  }

  const hasDayData = Object.keys(dayPerformance).length > 0;

  return (
    <div className="space-y-6">
      {/* Content options */}
      <div>
        <p className="text-sm font-semibold text-white mb-1">
          What are you planning to stream this week?
        </p>
        <p className="text-xs text-muted mb-4">
          Based on your stream history — select everything you plan to do.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {contentOptions.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                onClick={() => toggle(option)}
                className={`relative flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                  isSelected
                    ? "bg-accent/15 border-accent/40 text-white"
                    : "bg-white/[0.02] border-border text-muted hover:text-white hover:border-white/15"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-accent border-accent"
                      : "border-white/20"
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
                <span className="truncate">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Historical day performance (compact) */}
      {hasDayData && (
        <div className="bg-white/[0.02] border border-border rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2.5">
            Your performance by day
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dayPerformance)
              .sort(([, a], [, b]) => b.avgScore - a.avgScore)
              .map(([day, data]) => {
                const score = Math.round(data.avgScore);
                const color =
                  score >= 70
                    ? "text-green-400"
                    : score >= 50
                    ? "text-yellow-400"
                    : "text-muted";
                return (
                  <div key={day} className="flex items-center gap-1.5">
                    <span className="text-xs text-white/50">{day.slice(0, 3)}</span>
                    <span className={`text-xs font-bold ${color}`}>{score}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={selected.length === 0 || loading}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-accent hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-opacity text-sm"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generating your plan...
          </>
        ) : (
          <>
            <Sparkles size={15} />
            Generate Plan
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Plan output */}
      {plan && (
        <div className="space-y-5 pt-2">
          {/* Schedule */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={15} className="text-accent-light" />
              <h3 className="text-sm font-bold text-white">Your Best Days to Stream</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plan.schedule.map((slot, i) => (
                <div
                  key={i}
                  className="bg-white/[0.03] border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-bold text-white">{slot.day}</p>
                    <span className="text-xs font-semibold text-accent-light flex-shrink-0">
                      {slot.time}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{slot.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Titles */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} className="text-accent-light" />
              <h3 className="text-sm font-bold text-white">Title Ideas</h3>
            </div>
            <div className="space-y-4">
              {plan.titles.map((item, i) => (
                <div
                  key={i}
                  className="bg-white/[0.03] border border-border rounded-xl p-4"
                >
                  <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                    {item.content}
                  </p>
                  <div className="space-y-2">
                    {item.suggestions.map((title, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between gap-3 group"
                      >
                        <p className="text-sm text-white leading-snug flex-1">{title}</p>
                        <button
                          onClick={() => copyTitle(title)}
                          className="flex-shrink-0 text-muted hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                          title="Copy title"
                        >
                          {copied === title ? (
                            <Check size={13} className="text-green-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
