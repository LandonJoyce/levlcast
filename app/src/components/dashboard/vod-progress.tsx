"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

/**
 * What an analysis is doing while it runs, on the stream page. Two steps:
 * the audio becomes a transcript, then the transcript becomes the report
 * and the clip picks. The page polls and swaps to the report when it's in.
 *
 * The time left follows how analyzeVod (lib/inngest/functions.ts) actually
 * runs: the audio is read in 12-minute parts, four at a time, and a round
 * of four takes about a minute and a half; the report is about four
 * minutes after that. A 3-hour stream is around ten minutes all in, which
 * is what production shows. This used to budget a minute of transcribing
 * per three minutes of stream plus eight for the report, so a new streamer
 * with a 3-hour stream was told to come back in over an hour.
 *
 * It counts down from when the current step started (the row's updated_at,
 * which the pipeline bumps as it moves along) and never climbs back up
 * between refreshes.
 */

/** CHUNK_SECONDS and BATCH_CONCURRENCY in analyzeVod. */
const PART_SECONDS = 720;
const PARTS_AT_ONCE = 4;
const MINUTES_PER_ROUND = 1.5;
const WRITING_MINUTES = 4;

function transcribingMinutes(seconds: number): number {
  const parts = Math.max(1, Math.ceil(seconds / PART_SECONDS));
  return Math.max(2, Math.ceil(parts / PARTS_AT_ONCE) * MINUTES_PER_ROUND);
}

const STEPS = [
  {
    status: "transcribing",
    label: "Transcribing the audio",
    description: "Turning the whole stream into text.",
  },
  {
    status: "analyzing",
    label: "Writing your report",
    description: "Finding your best moments, scoring the stream and picking the one thing to fix.",
  },
];

export function VodProgress({
  status,
  durationSeconds,
  stepStartedAt = null,
  now,
  first = false,
  emailed = false,
}: {
  status: string;
  durationSeconds: number | null;
  /** When the current step started: the vods row's updated_at. */
  stepStartedAt?: string | null;
  /** The server's clock when the page was rendered. */
  now: number;
  /** Their first report ever, which places them on the ladder. */
  first?: boolean;
  /** The pipeline emails them when it's done, if we have an address. */
  emailed?: boolean;
}) {
  const current = Math.max(0, STEPS.findIndex((s) => s.status === status));
  const writing = current === 1;
  const started = stepStartedAt ? Date.parse(stepStartedAt) : NaN;
  const elapsed = Number.isFinite(started) ? Math.max(0, (now - started) / 60000) : 0;
  const stepMinutes = writing ? WRITING_MINUTES : transcribingMinutes(durationSeconds ?? 0);
  const left = writing
    ? Math.max(0, WRITING_MINUTES - elapsed)
    : // Never "done transcribing" while it's still transcribing.
      Math.max(0.5, stepMinutes - elapsed) + WRITING_MINUTES;
  // Well past what the step should take: say so rather than count down to
  // a number that isn't going to happen.
  const slow = elapsed > stepMinutes * 2 + 3;

  // The page refreshes every few seconds, and the row's updated_at also
  // moves when the transcript is saved, just before the report starts.
  // Hold the lowest figure shown so that can't make the countdown jump up.
  const [lowest, setLowest] = useState(left);
  useEffect(() => setLowest((l) => Math.min(l, left)), [left]);
  const mins = Math.min(lowest, left);

  const time = slow
    ? "Taking longer than usual, but it's still going."
    : mins >= 1.5
      ? `About ${Math.round(mins)} min left.`
      : "Almost done.";

  return (
    <section className="vp" aria-live="polite">
      <p className="hm-k">{first ? "Your first full report" : "Analyzing"}</p>
      <p className="vp-title">{first ? "Being made right now." : "Your report is on the way."}</p>
      <p className="vp-sub">
        {time}{" "}
        {emailed
          ? "We'll email you when it's in, so you can close this."
          : "You can leave this page, it'll be here when you come back."}
      </p>
      <ol className="vp-steps">
        {STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "next";
          return (
            <li key={step.status} className="vp-step" data-state={state}>
              <span className="vp-icon" aria-hidden="true">
                {state === "done" ? <Check size={14} /> : state === "active" ? <Loader2 size={14} className="animate-spin" /> : null}
              </span>
              <div>
                <p className="vp-step-label">{step.label}</p>
                {state === "active" && <p className="vp-step-desc">{step.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
