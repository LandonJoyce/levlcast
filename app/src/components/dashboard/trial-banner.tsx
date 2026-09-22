"use client";

import { useState } from "react";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

/**
 * Persistent banner shown to free users, tracking the weekly allowance.
 *
 * Surfaces remaining analyses/clips so the user can pace their use, and
 * shifts to a "trial used up" state with a direct upgrade CTA when both
 * counters are exhausted. Lives in the dashboard layout so every page
 * shows a consistent state.
 *
 * The `personalizedReason` prop carries the upgrade-pitch text built
 * server-side from the user's actual reports (lib/upgrade-pitch.ts).
 * Surfaced in the UpgradeModal when the user clicks the CTA so they
 * see their real numbers, not a generic feature list.
 */
export function TrialBanner({
  analysesUsed,
  analysesLimit,
  clipsUsed,
  clipsLimit,
  personalizedReason,
}: {
  analysesUsed: number;
  analysesLimit: number;
  clipsUsed: number;
  clipsLimit: number;
  personalizedReason: string;
}) {
  const [open, setOpen] = useState(false);
  const analysesLeft = Math.max(0, analysesLimit - analysesUsed);
  const clipsLeft = Math.max(0, clipsLimit - clipsUsed);
  const exhausted = analysesLeft === 0 && clipsLeft === 0;
  const analysesExhausted = analysesLeft === 0;
  const lastAnalysis = analysesLeft === 1;

  // Tone shifts as the trial drains.
  const tone = exhausted ? "danger" : analysesExhausted || clipsLeft === 0 ? "warn" : "neutral";

  const accent =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warn"
        ? "var(--orange, #d97706)"
        : "var(--blue)";

  // This used to run on loss aversion: "Trial used up. You can't track
  // what's changing." That was written when the trial was two analyses
  // ever and cross-stream tracking was locked. Neither is true now — the
  // allowance refills Monday and nothing in the report is withheld — so
  // the old copy would simply be lying to the reader.
  //
  // What replaces it says when you get more and what Pro is actually for.
  // Running out on Wednesday is not a loss, it is a wait, and pretending
  // otherwise to squeeze a conversion is how you lose the next one.
  const headline = analysesExhausted
    ? "That's both analyses this week."
    : lastAnalysis
      ? "One analysis left this week."
      : "Free";

  const subline = analysesExhausted
    ? "Two more unlock Monday. Streaming more often than that? Pro is 15 a month and 20 clips."
    : `${analysesLeft} ${analysesLeft === 1 ? "analysis" : "analyses"} and ${clipsLeft} ${clipsLeft === 1 ? "clip" : "clips"} left this week. Resets Monday.`;

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
        reason={personalizedReason}
      />
    </>
  );
}
