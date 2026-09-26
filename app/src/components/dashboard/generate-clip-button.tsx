"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UpgradeModal } from "./upgrade-modal";

/**
 * One-click clip generation. Generates with the default 'bold' caption
 * style — caption style, trim, and hook frame are all customisable in
 * the editor afterward, so showing a style picker at gen time was just
 * decision paralysis.
 */
export function GenerateClipButton({
  vodId,
  peakIndex,
  hasProcessing,
}: {
  vodId: string;
  peakIndex: number;
  hasProcessing?: boolean;
  clipTitle?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [doneClipId, setDoneClipId] = useState<string | null>(null);
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
        body: JSON.stringify({ vodId, peakIndex, captionStyle: "bold" }),
      });
      const json = await res.json();
      if (res.status === 403 && json.upgrade) {
        setUpgradeReason(json.message ?? "Upgrade to Pro to continue.");
        setUpgradeOpen(true);
        return;
      }
      if (!res.ok) { setError(json.error || "Failed"); return; }
      if (json.clipId) setDoneClipId(json.clipId as string);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  if (doneClipId) {
    return (
      <Link
        href={`/dashboard/clips/${doneClipId}/edit`}
        className="btn btn-ghost gen-clip"
      >
        Open in editor
      </Link>
    );
  }

  if (hasProcessing && !generating) {
    return (
      <button type="button" className="btn btn-ghost gen-clip" disabled title="One clip at a time. This comes back when the current one is done.">
        Make clip
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn btn-ghost gen-clip"
        style={{ opacity: generating ? 0.6 : 1 }}
      >
        {generating ? "Starting..." : "Make clip"}
      </button>

      {error && <span className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, display: "block" }}>{error}</span>}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
