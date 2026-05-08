"use client";

import { useState } from "react";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

/**
 * Persistent banner shown to users on the lifetime free trial.
 *
 * Surfaces remaining analyses/clips so the user can pace their use, and
 * shifts to a "trial used up" state with a direct upgrade CTA when both
 * counters are exhausted. Lives in the dashboard layout so every page
 * shows a consistent state.
 */
export function TrialBanner({
  analysesUsed,
  analysesLimit,
  clipsUsed,
  clipsLimit,
}: {
  analysesUsed: number;
  analysesLimit: number;
  clipsUsed: number;
  clipsLimit: number;
}) {
  const [open, setOpen] = useState(false);
  const analysesLeft = Math.max(0, analysesLimit - analysesUsed);
  const clipsLeft = Math.max(0, clipsLimit - clipsUsed);
  const exhausted = analysesLeft === 0 && clipsLeft === 0;
  const lastAnalysis = analysesLeft === 1;

  // Tone shifts as the trial drains.
  const tone = exhausted ? "danger" : analysesLeft === 0 || clipsLeft === 0 ? "warn" : "neutral";

  const accent =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warn"
        ? "var(--orange, #d97706)"
        : "var(--blue)";

  const headline = exhausted
    ? "Your free trial is used up. Subscribe to keep going."
    : lastAnalysis
      ? "Your last free analysis. Make it count."
      : "Free trial";

  const subline = exhausted
    ? "Pro is $9.99/month and resets monthly with 15 analyses and 20 clips."
    : `${analysesLeft} ${analysesLeft === 1 ? "analysis" : "analyses"} and ${clipsLeft} ${clipsLeft === 1 ? "clip" : "clips"} remaining.`;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          marginBottom: 16,
          borderRadius: 12,
          background: `color-mix(in oklab, ${accent} 8%, var(--surface))`,
          border: `1px solid color-mix(in oklab, ${accent} 28%, var(--line))`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.35 }}>
            {headline}
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "2px 0 0", lineHeight: 1.4 }}>
            {subline}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: accent,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            padding: "7px 14px",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {exhausted ? "Subscribe now" : "Upgrade"}
        </button>
      </div>

      <UpgradeModal
        isOpen={open}
        onClose={() => setOpen(false)}
        reason="Your trial gives you a taste. Pro unlocks 15 analyses and 20 clips every month plus highlight reels and the full coach report."
      />
    </>
  );
}
