"use client";

import { useState } from "react";
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
      <span className="gen-wait">Analyzed</span>
    );
  }

  if (isProcessing) {
    return null; // VodProgress handles the display
  }

  // Another VOD is already being analyzed — block this one
  if (hasProcessing) {
    return (
      <span className="gen-wait">One at a time</span>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        type="button"
        className="btn btn-blue gen-clip"
      >
        {status === "failed" ? "Try again" : "Analyze"}
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
