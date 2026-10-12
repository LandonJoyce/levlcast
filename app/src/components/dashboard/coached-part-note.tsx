"use client";

import { useState } from "react";
import { UpgradeModal } from "./upgrade-modal";
import { streamLength } from "@/lib/analysis-progress";

/**
 * On a free report that covers only the first part of a longer stream
 * (the first hour; reports made before 2026-10-12 covered 2): one line
 * saying so, with the way to get the whole stream coached. The report
 * itself never mentions the plan (the coach is told not to), so this is
 * the only place it shows.
 */
export function CoachedPartNote({ coachedSeconds, totalSeconds }: { coachedSeconds: number; totalSeconds: number }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const hours = coachedSeconds / 3600;
  const coached = hours === 1 ? "hour" : Number.isInteger(hours) ? `${hours} hours` : streamLength(coachedSeconds);
  return (
    <div className="sp-part">
      <p>
        This report coaches the first {coached} of your {streamLength(totalSeconds)} stream.{" "}
        <button type="button" className="am-link" onClick={() => setUpgradeOpen(true)}>
          Pro coaches the whole stream.
        </button>
      </p>
      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={`Pro coaches the whole stream, all ${streamLength(totalSeconds)} of it, with 20 reports a month.`}
      />
    </div>
  );
}
