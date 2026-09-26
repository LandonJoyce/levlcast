"use client";

import { Loader2, Check } from "lucide-react";

/**
 * What an analysis is doing while it runs, on the stream page. Two steps:
 * the audio becomes a transcript, then the transcript becomes the report
 * and the clip picks. The page polls and swaps to the report when it's in.
 */

const STEPS = [
  {
    status: "transcribing",
    label: "Transcribing the audio",
    description: "Turning the whole stream into text.",
    // About a minute per three minutes of stream.
    estimateMins: (secs: number) => Math.max(5, Math.ceil(secs / 180)),
  },
  {
    status: "analyzing",
    label: "Writing your report",
    description: "Finding your best moments, scoring the stream and picking the one thing to fix.",
    estimateMins: (_secs: number) => 8,
  },
];

function formatEstimate(mins: number): string {
  if (mins < 60) return `about ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `about ${h}h ${m}m` : `about ${h}h`;
}

export function VodProgress({ status, durationSeconds }: { status: string; durationSeconds: number }) {
  const current = Math.max(0, STEPS.findIndex((s) => s.status === status));
  const remaining = STEPS.slice(current).reduce((sum, s) => sum + s.estimateMins(durationSeconds), 0);

  return (
    <section className="vp" aria-live="polite">
      <p className="hm-k">Analyzing</p>
      <p className="vp-title">Your report is on the way.</p>
      <p className="vp-sub">
        {formatEstimate(remaining)} left. You can leave this page, it&apos;ll be here when you come back.
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
                <p className="vp-step-label">
                  {step.label}
                  {state === "active" && <span>{formatEstimate(step.estimateMins(durationSeconds))}</span>}
                </p>
                {state === "active" && <p className="vp-step-desc">{step.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
