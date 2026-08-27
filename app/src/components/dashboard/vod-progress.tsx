"use client";

import { Loader2, CheckCircle2, Circle } from "lucide-react";

const STEPS = [
  {
    status: "transcribing",
    label: "Transcribing audio",
    description: "Converting your stream audio to text via Deepgram",
    // ~1 min per 3 min of content
    estimateMins: (secs: number) => Math.max(5, Math.ceil(secs / 180)),
  },
  {
    status: "analyzing",
    label: "Analyzing peaks & generating coaching",
    description: "Claude is finding your best moments and writing your coaching report",
    estimateMins: (_secs: number) => 8,
  },
];

function formatEstimate(mins: number): string {
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

interface VodProgressProps {
  status: string;
  durationSeconds: number;
  compact?: boolean;
}

export function VodProgress({ status, durationSeconds, compact = false }: VodProgressProps) {
  const currentStepIdx = STEPS.findIndex((s) => s.status === status);
  const isLongVod = durationSeconds > 3600; // over 1 hour

  if (compact) {
    const current = STEPS[currentStepIdx];
    if (!current) return null;
    const estimate = current.estimateMins(durationSeconds);

    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-400 font-medium">
            Step {currentStepIdx + 1} of {STEPS.length}: {current.label}
          </span>
        </div>
        <span className="text-xs text-muted pl-4">
          {isLongVod
            ? `Long VOD: ${formatEstimate(estimate)} for this step`
            : `Est. ${formatEstimate(estimate)} for this step`}
        </span>
      </div>
    );
  }

  // Full expanded view for detail page
  const totalEstimate = STEPS.slice(currentStepIdx).reduce(
    (sum, s) => sum + s.estimateMins(durationSeconds),
    0
  );

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-sm mb-0.5">Analyzing your stream</h3>
          <p className="text-xs text-muted">
            {isLongVod
              ? `This is a long VOD. Total estimated time is ${formatEstimate(totalEstimate)}. You can leave this page and come back.`
              : `Estimated ${formatEstimate(totalEstimate)} remaining. You can leave this page and come back.`}
          </p>
        </div>
        <Loader2 size={18} className="animate-spin text-yellow-400 flex-shrink-0" />
      </div>

      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const isDone = i < currentStepIdx;
          const isActive = i === currentStepIdx;
          const isPending = i > currentStepIdx;

          return (
            <div key={step.status} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 size={16} className="text-green-400" />
                ) : isActive ? (
                  <Loader2 size={16} className="animate-spin text-yellow-400" />
                ) : (
                  <Circle size={16} className="text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${isDone ? "text-green-400" : isActive ? "text-white" : "text-muted"}`}>
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="text-xs text-muted flex-shrink-0">
                      {formatEstimate(step.estimateMins(durationSeconds))}
                    </span>
                  )}
                </div>
                {isActive && (
                  <p className="text-xs text-muted mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isLongVod && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs text-muted">
            Streams over 1 hour take longer to process. Deepgram transcribes the full audio before Claude analyzes it. This is normal and the results will be worth the wait.
          </p>
        </div>
      )}
    </div>
  );
}
