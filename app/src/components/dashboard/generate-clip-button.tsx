"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "./upgrade-modal";

export function GenerateClipButton({
  vodId,
  peakIndex,
  hasProcessing,
}: {
  vodId: string;
  peakIndex: number;
  hasProcessing?: boolean;
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
      if (!res.ok) { setError(json.error || "Failed"); return; }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  if (done) {
    return <span className="chip" style={{ width: "100%", justifyContent: "center", color: "var(--blue)" }}>Queued — generating…</span>;
  }

  if (hasProcessing && !generating) {
    return <span className="chip" style={{ width: "100%", justifyContent: "center", opacity: 0.5 }}>Wait for current clip</span>;
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn btn-blue"
        style={{ width: "100%", padding: "7px 0", fontSize: 12, justifyContent: "center", opacity: generating ? 0.6 : 1 }}
      >
        {generating ? "Queuing…" : "Generate Clip"}
      </button>
      {error && <span className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, display: "block" }}>{error}</span>}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
