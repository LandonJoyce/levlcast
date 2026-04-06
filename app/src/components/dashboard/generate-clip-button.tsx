"use client";

import { useState } from "react";
import { Scissors, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "./upgrade-modal";

export function GenerateClipButton({
  vodId,
  peakIndex,
}: {
  vodId: string;
  peakIndex: number;
}) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const router = useRouter();

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId, peakIndex }),
      });

      const json = await res.json();

      if (res.status === 403 && json.upgrade) {
        setUpgradeReason(json.message ?? "Upgrade to Pro to continue.");
        setUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }

      // Clip is now queued as a background job — refresh to show "processing" state
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent-light font-medium">
        <Loader2 size={13} className="animate-spin" />
        Processing — check back in a minute
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 bg-accent hover:opacity-85 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
        >
          {generating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Scissors size={13} />
          )}
          {generating ? "Generating..." : "Generate Clip"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </>
  );
}
