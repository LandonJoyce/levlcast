"use client";

import { useEffect, useState } from "react";
import { estimateAnalysis, type AnalysisInput } from "@/lib/analysis-progress";

/**
 * The analysis estimate (lib/analysis-progress.ts) on a clock that ticks in
 * the browser, so a bar keeps moving between the page's refreshes. The
 * clock starts from the server's, so the first render matches what the
 * server sent. The bar never slides back on small timing noise; a big drop
 * means the stream started over (a retry), and that is shown.
 */
export function useAnalysisEstimate(input: AnalysisInput, serverNow: number) {
  const [clock, setClock] = useState(serverNow);
  useEffect(() => {
    const offset = serverNow - Date.now();
    const timer = setInterval(() => setClock(Date.now() + offset), 1000);
    return () => clearInterval(timer);
    // The offset is taken once, when the bar appears; the page's refreshes
    // pass a newer server time, but the clock is already running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estimate = estimateAnalysis(input, clock);
  const [held, setHeld] = useState(estimate.fraction);
  const holds = (h: number) => h > estimate.fraction && h - estimate.fraction < 0.15;
  const fraction = holds(held) ? held : estimate.fraction;
  useEffect(() => {
    setHeld((h) => (h > estimate.fraction && h - estimate.fraction < 0.15 ? h : estimate.fraction));
  }, [estimate.fraction]);

  return { ...estimate, fraction, minutesLeft: estimate.totalMinutes * (1 - fraction) };
}

/** "About 6 min left." and the like. */
export function timeLeftLine(minutesLeft: number, slow: boolean): string {
  if (slow) return "Taking longer than usual, but it's still going.";
  return minutesLeft >= 1.5 ? `About ${Math.round(minutesLeft)} min left.` : "Almost done.";
}

/**
 * A small bar with the percent, for places that list a running analysis:
 * the dashboard's first-report card and the Streams list.
 */
export function AnalysisBar({
  input,
  now,
  showTime = false,
}: {
  input: AnalysisInput;
  /** The server's clock when the page was rendered. */
  now: number;
  /** Also say about how long is left. */
  showTime?: boolean;
}) {
  const estimate = useAnalysisEstimate(input, now);
  const pct = Math.round(estimate.fraction * 100);
  return (
    <div className="pbar">
      <div className="pbar-row">
        <span
          className="pbar-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="How far along the report is"
        >
          <span style={{ width: `${(estimate.fraction * 100).toFixed(1)}%` }} />
        </span>
        <span className="pbar-pct">{pct}%</span>
      </div>
      {showTime && <p className="pbar-time">{timeLeftLine(estimate.minutesLeft, estimate.slow)}</p>}
    </div>
  );
}
