"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/utils";

interface AnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  vodId: string;
  vodTitle: string;
  durationSeconds: number;
  onUpgrade: (reason: string) => void;
}

type Preset = "full" | "first_hour" | "last_hour" | "custom";

/** Parse a time string like "1:30:00", "45:00", or "90:00" into seconds */
function parseTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60; // treat bare number as minutes
  return null;
}

/** Format seconds to HH:MM:SS or MM:SS */
function toTimeString(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function estimateMinutes(durationSecs: number, rangeSecs: number): number {
  // Transcription is always full VOD: ~1 min per 3 min of content
  const transcribeMin = Math.max(5, Math.ceil(durationSecs / 180));
  // Analysis scales with selected range
  const analyzeMin = Math.max(3, Math.ceil(rangeSecs / 180));
  return transcribeMin + analyzeMin;
}

export function AnalyzeModal({
  isOpen,
  onClose,
  vodId,
  vodTitle,
  durationSeconds,
  onUpgrade,
}: AnalyzeModalProps) {
  const [preset, setPreset] = useState<Preset>("full");
  const [customStart, setCustomStart] = useState("0:00");
  const [customEnd, setCustomEnd] = useState(toTimeString(durationSeconds));
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!isOpen) return null;

  const hasHour = durationSeconds >= 3600;

  // Resolve the actual start/end based on preset
  let startSeconds = 0;
  let endSeconds = durationSeconds;

  if (preset === "first_hour") {
    endSeconds = Math.min(3600, durationSeconds);
  } else if (preset === "last_hour") {
    startSeconds = Math.max(0, durationSeconds - 3600);
  } else if (preset === "custom") {
    const s = parseTime(customStart);
    const e = parseTime(customEnd);
    if (s !== null) startSeconds = Math.max(0, s);
    if (e !== null) endSeconds = Math.min(e, durationSeconds);
  }

  const rangeSeconds = Math.max(0, endSeconds - startSeconds);
  const isFull = preset === "full";
  const estimatedMin = estimateMinutes(durationSeconds, isFull ? durationSeconds : rangeSeconds);

  // Validation
  let validationError: string | null = null;
  if (preset === "custom") {
    const s = parseTime(customStart);
    const e = parseTime(customEnd);
    if (s === null) validationError = "Invalid start time format. Use MM:SS or H:MM:SS.";
    else if (e === null) validationError = "Invalid end time format. Use MM:SS or H:MM:SS.";
    else if (e <= s) validationError = "End time must be after start time.";
    else if (e - s < 60) validationError = "Range must be at least 1 minute.";
  }

  async function handleAnalyze() {
    if (validationError) return;
    setAnalyzing(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { vodId };
      if (!isFull) {
        body.startSeconds = startSeconds;
        body.endSeconds = endSeconds;
      }

      const res = await fetch("/api/vods/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.status === 403 && json.upgrade) {
        onClose();
        onUpgrade(json.message ?? "Upgrade to Pro to continue.");
        return;
      }

      if (!res.ok) {
        setError(json.error || "Analysis failed");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight">Analyze VOD</h2>
            <p className="text-xs text-muted truncate mt-0.5">{vodTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/5 flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Duration info */}
          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock size={12} />
            <span>Stream length: {formatDuration(durationSeconds)}</span>
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs font-medium text-muted mb-2">
              What to analyze
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PresetButton
                label="Full Stream"
                sublabel={formatDuration(durationSeconds)}
                active={preset === "full"}
                onClick={() => setPreset("full")}
              />
              {hasHour && (
                <>
                  <PresetButton
                    label="First Hour"
                    sublabel={formatDuration(Math.min(3600, durationSeconds))}
                    active={preset === "first_hour"}
                    onClick={() => setPreset("first_hour")}
                  />
                  <PresetButton
                    label="Last Hour"
                    sublabel={formatDuration(Math.min(3600, durationSeconds))}
                    active={preset === "last_hour"}
                    onClick={() => setPreset("last_hour")}
                  />
                </>
              )}
              <PresetButton
                label="Custom Range"
                sublabel="Pick a section"
                active={preset === "custom"}
                onClick={() => setPreset("custom")}
              />
            </div>
          </div>

          {/* Custom range inputs */}
          {preset === "custom" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Start</label>
                <input
                  type="text"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  placeholder="0:00"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent/50"
                />
              </div>
              <span className="text-muted mt-5">to</span>
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">End</label>
                <input
                  type="text"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  placeholder={toTimeString(durationSeconds)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>
          )}

          {/* Estimate */}
          <div className="bg-bg/50 border border-border rounded-xl p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {isFull ? "Full stream" : `${toTimeString(startSeconds)} — ${toTimeString(endSeconds)}`}
                {!isFull && (
                  <span className="text-muted/60 ml-1">({formatDuration(rangeSeconds)})</span>
                )}
              </span>
              <span className="font-medium">
                ~{estimatedMin < 60 ? `${estimatedMin} min` : `${Math.floor(estimatedMin / 60)}h ${estimatedMin % 60}m`}
              </span>
            </div>
            {!isFull && durationSeconds > 3600 && (
              <p className="text-xs text-muted/60 mt-1">
                Full stream audio is transcribed first, then your selected section is analyzed.
              </p>
            )}
          </div>

          {/* Error */}
          {(validationError || error) && (
            <p className="text-xs text-red-400">{validationError || error}</p>
          )}

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !!validationError}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-opacity text-sm"
          >
            {analyzing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {analyzing ? "Starting analysis..." : "Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PresetButton({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-colors ${
        active
          ? "border-accent/50 bg-accent/10"
          : "border-border hover:border-white/10 bg-bg/30"
      }`}
    >
      <span className={`text-sm font-medium block ${active ? "text-accent-light" : ""}`}>
        {label}
      </span>
      <span className="text-xs text-muted">{sublabel}</span>
    </button>
  );
}
