"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";

interface StreamerIdentity {
  streamerType: string | null;
  dominantCategory: string | null;
  totalStreams: number;
}

interface TitleSuggestion {
  title: string;
  why: string;
}

interface TitleResult {
  titles: Array<{ content: string; suggestions: TitleSuggestion[] }>;
}

interface Props {
  contentOptions: string[];
  streamerIdentity: StreamerIdentity;
}

export function PlannerForm({ contentOptions, streamerIdentity }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TitleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option)
        ? prev.filter((s) => s !== option)
        : [...prev, option]
    );
    if (result) setResult(null);
  }

  async function generate() {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedContent: selected,
          streamerIdentity,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "pro_required"
            ? "pro_required"
            : "Failed to generate titles. Try again."
        );
        return;
      }

      const data = await res.json();
      setResult(data);
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

  return (
    <div className="space-y-6">
      {/* Content options */}
      <div>
        <p className="text-sm font-semibold text-white mb-1">
          What are you streaming?
        </p>
        <p className="text-xs text-muted mb-4">
          Based on your stream history — select what you plan to do.
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
                    isSelected ? "bg-accent border-accent" : "border-white/20"
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

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={selected.length === 0 || loading}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-accent hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-opacity text-sm"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generating titles...
          </>
        ) : (
          <>
            <Sparkles size={15} />
            Generate Titles
          </>
        )}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Title output */}
      {result && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-accent-light" />
            <h3 className="text-sm font-bold text-white">Title Ideas</h3>
          </div>
          <div className="space-y-4">
            {result.titles.map((item, i) => (
              <div
                key={i}
                className="bg-white/[0.03] border border-border rounded-xl p-4"
              >
                <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                  {item.content}
                </p>
                <div className="space-y-3">
                  {item.suggestions.map((s, j) => {
                    const titleStr = typeof s === "string" ? s : s.title;
                    const whyStr = typeof s === "string" ? null : s.why;
                    return (
                      <div key={j} className="flex items-start justify-between gap-3 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white leading-snug">{titleStr}</p>
                          {whyStr && (
                            <p className="text-[11px] text-muted mt-0.5">{whyStr}</p>
                          )}
                        </div>
                        <button
                          onClick={() => copyTitle(titleStr)}
                          className="flex-shrink-0 text-muted hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 mt-0.5"
                          title="Copy title"
                        >
                          {copied === titleStr ? (
                            <Check size={13} className="text-green-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
