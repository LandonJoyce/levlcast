"use client";

import { useAnalysisEstimate, timeLeftLine } from "./analysis-bar";
import { streamLength, type AnalysisProgress } from "@/lib/analysis-progress";

/**
 * A running analysis on the stream page: a bar for how close it is to done,
 * what it's doing right now, and about how long is left. The numbers come
 * from lib/analysis-progress.ts: real transcription progress when the
 * pipeline has recorded it, the clock for the rest. The page polls and
 * swaps to the report when it's in.
 */
export function VodProgress({
  status,
  durationSeconds,
  firstPartOnly = false,
  updatedAt = null,
  progress = null,
  now,
  first = false,
  emailed = false,
}: {
  status: string;
  /** How much of the stream is being coached (a free report: the first 2 hours). */
  durationSeconds: number | null;
  /** Only the first part of a longer stream is being coached. */
  firstPartOnly?: boolean;
  /** The vods row's updated_at. */
  updatedAt?: string | null;
  /** Transcription parts done, when the pipeline has recorded them. */
  progress?: AnalysisProgress | null;
  /** The server's clock when the page was rendered. */
  now: number;
  /** Their first report ever, which places them on the ladder. */
  first?: boolean;
  /** The pipeline emails them when it's done, if we have an address. */
  emailed?: boolean;
}) {
  const estimate = useAnalysisEstimate({ status, durationSeconds, updatedAt, progress }, now);
  const pct = Math.round(estimate.fraction * 100);
  const doing =
    estimate.phase === "writing"
      ? "Writing your report. Finding your best moments, scoring the stream and picking the one thing to fix."
      : estimate.streamSecondsDone && durationSeconds
        ? `Transcribing the audio: ${streamLength(estimate.streamSecondsDone)} of ${firstPartOnly ? "the first " : ""}${streamLength(durationSeconds)} done.`
        : firstPartOnly
          ? "Transcribing the audio. Turning the first 2 hours into text."
          : "Transcribing the audio. Turning the whole stream into text.";

  return (
    <section className="vp">
      <p className="hm-k">{first ? "Your first full report" : "Analyzing"}</p>
      <div className="vp-head">
        <p className="vp-title">{first ? "Being made right now." : "Your report is on the way."}</p>
        <p className="vp-pct">{pct}%</p>
      </div>
      <div
        className="vp-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="How far along the report is"
      >
        <span style={{ width: `${(estimate.fraction * 100).toFixed(1)}%` }} />
      </div>
      <p className="vp-doing">{doing}</p>
      <p className="vp-sub">
        {timeLeftLine(estimate.minutesLeft, estimate.slow)}{" "}
        {emailed
          ? "We'll email you when it's in, so you can close this."
          : "You can leave this page, it'll be here when you come back."}
      </p>
    </section>
  );
}
