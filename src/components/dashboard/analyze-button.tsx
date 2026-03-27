"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AnalyzeButton({ vodId, status }: { vodId: string; status: string }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isProcessing = status === "transcribing" || status === "analyzing";
  const isDone = status === "ready";

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/vods/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Analysis failed");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setAnalyzing(false);
    }
  }

  if (isDone) {
    return (
      <span className="text-xs text-green-400 font-medium">Analyzed</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleAnalyze}
        disabled={analyzing || isProcessing}
        className="inline-flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 disabled:opacity-50 text-accent-light text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        {analyzing || isProcessing ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} />
        )}
        {analyzing ? "Analyzing..." : isProcessing ? "Processing..." : "Analyze"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
