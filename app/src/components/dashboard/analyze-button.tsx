"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { AnalyzeModal } from "./analyze-modal";
import { UpgradeModal } from "./upgrade-modal";

export function AnalyzeButton({
  vodId,
  status,
  vodTitle,
  durationSeconds,
  hasProcessing,
  userPlan,
}: {
  vodId: string;
  status: string;
  vodTitle: string;
  durationSeconds: number;
  hasProcessing?: boolean;
  userPlan?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");

  const isProcessing = status === "transcribing" || status === "analyzing";
  const isDone = status === "ready";

  if (isDone) {
    return (
      <span className="text-xs text-green-400 font-medium">Analyzed</span>
    );
  }

  if (isProcessing) {
    return null; // VodProgress handles the display
  }

  // Another VOD is already being analyzed — block this one
  if (hasProcessing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted cursor-not-allowed opacity-60">
        <Loader2 size={13} className="animate-spin" />
        Wait for current analysis to finish
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent-light text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        <Sparkles size={13} />
        {status === "failed" ? "Retry Analysis" : "Analyze"}
      </button>

      <AnalyzeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        vodId={vodId}
        vodTitle={vodTitle}
        durationSeconds={durationSeconds}
        userPlan={userPlan}
        onUpgrade={(reason) => {
          setUpgradeReason(reason);
          setUpgradeOpen(true);
        }}
      />

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </>
  );
}
