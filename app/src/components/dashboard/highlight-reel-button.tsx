"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

/**
 * Trigger a multi-cut highlight reel generation.
 *
 * Disabled when:
 *   - the VOD doesn't have at least 2 detected peaks (server enforces too)
 *   - a reel for this VOD is already processing
 *   - the user is over their clip quota (server enforces, we just fail nicely)
 */
export function HighlightReelButton({
  vodId,
  peakCount,
  reelExisting,
  reelProcessing,
}: {
  vodId: string;
  peakCount: number;
  /** Existing ready reel id, if any. */
  reelExisting?: string | null;
  /** True if a reel for this VOD is currently being generated. */
  reelProcessing?: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const router = useRouter();

  const disabled = peakCount < 2;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/clips/highlight-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId }),
      });
      const json = await res.json();
      if (res.status === 403 && json.upgrade) {
        setUpgradeReason(json.message ?? "Upgrade to Pro to keep clipping.");
        setUpgradeOpen(true);
        return;
      }
      if (!res.ok) {
        setError(json.message || json.error || "Failed to start reel");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  if (reelExisting && !reelProcessing) {
    return (
      <a
        href="/dashboard/clips"
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "8px 14px", whiteSpace: "nowrap" }}
      >
        View highlight reel
      </a>
    );
  }

  if (reelProcessing) {
    return (
      <span
        className="chip"
        style={{ fontSize: 12, padding: "7px 12px", whiteSpace: "nowrap", opacity: 0.85 }}
      >
        Building reel…
      </span>
    );
  }

  if (disabled) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn btn-blue"
        style={{
          fontSize: 12,
          padding: "8px 14px",
          whiteSpace: "nowrap",
          opacity: generating ? 0.6 : 1,
        }}
      >
        {generating ? "Queuing…" : "Generate highlight reel"}
      </button>
      {error && (
        <span className="mono" style={{ fontSize: 11, color: "var(--danger)", display: "block", marginTop: 4 }}>
          {error}
        </span>
      )}
      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </>
  );
}
