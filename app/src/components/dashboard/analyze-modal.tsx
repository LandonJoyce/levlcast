"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";
import { formatDuration } from "@/lib/utils";

/**
 * The window between pressing Analyze and the analysis starting: what to
 * analyze (the whole stream, an hour, or a range) and roughly how long it
 * takes.
 *
 * A free streamer who has used both weekly reports gets one more option
 * here instead of a dead end: analyze it anyway, and it comes back sealed
 * until Monday. Pro opens it straight away.
 */

interface AnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  vodId: string;
  vodTitle: string;
  durationSeconds: number;
  userPlan?: string;
  onUpgrade: (reason: string) => void;
}

const FREE_MAX_SECONDS = 14400; // 4 hours

type Preset = "full" | "first_hour" | "last_hour" | "custom";

function parseTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return null;
}

function toTimeString(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Transcription takes about a minute per 15 minutes of audio, then the report. */
function estimateMinutes(durationSecs: number, rangeSecs: number): number {
  const transcribeMin = Math.max(3, Math.ceil(durationSecs / 900));
  const analyzeMin = Math.max(2, Math.ceil(rangeSecs / 1800));
  return transcribeMin + analyzeMin;
}

export function AnalyzeModal({ isOpen, onClose, vodId, vodTitle, durationSeconds, userPlan, onUpgrade }: AnalyzeModalProps) {
  const [preset, setPreset] = useState<Preset>("full");
  const [customStart, setCustomStart] = useState("0:00");
  const [customEnd, setCustomEnd] = useState(toTimeString(durationSeconds));
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the free allowance is used up but the sealed extra isn't.
  const [sealedOffer, setSealedOffer] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasHour = durationSeconds >= 3600;
  let startSeconds = 0;
  let endSeconds = durationSeconds;
  if (preset === "first_hour") endSeconds = Math.min(3600, durationSeconds);
  else if (preset === "last_hour") startSeconds = Math.max(0, durationSeconds - 3600);
  else if (preset === "custom") {
    const s = parseTime(customStart);
    const e = parseTime(customEnd);
    if (s !== null) startSeconds = Math.max(0, s);
    if (e !== null) endSeconds = Math.min(e, durationSeconds);
  }

  const rangeSeconds = Math.max(0, endSeconds - startSeconds);
  const isFull = preset === "full";
  const estimatedMin = estimateMinutes(durationSeconds, isFull ? durationSeconds : rangeSeconds);
  const isFree = userPlan !== "pro";
  const tooLongForFree = isFree && durationSeconds > FREE_MAX_SECONDS;

  let validationError: string | null = null;
  if (preset === "custom") {
    const s = parseTime(customStart);
    const e = parseTime(customEnd);
    if (s === null) validationError = "Start time should look like 12:30 or 1:05:00.";
    else if (e === null) validationError = "End time should look like 12:30 or 1:05:00.";
    else if (e <= s) validationError = "End has to be after the start.";
    else if (e - s < 60) validationError = "Pick at least a minute.";
  }

  async function start(sealedExtra = false) {
    if (validationError) return;
    setAnalyzing(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { vodId };
      if (!isFull) {
        body.startSeconds = startSeconds;
        body.endSeconds = endSeconds;
      }
      if (sealedExtra) body.sealedExtra = true;
      const res = await fetch("/api/vods/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json.sealed_extra_available && !sealedExtra) {
        setSealedOffer(json.message ?? "You've used both free reports this week.");
        return;
      }
      if (res.status === 403 && json.upgrade) {
        onClose();
        onUpgrade(json.message ?? "Go Pro to keep going.");
        return;
      }
      if (!res.ok) {
        setError(json.message || json.error || "That didn't start. Try again.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't reach LevlCast. Check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const estimateLabel =
    estimatedMin < 60 ? `about ${estimatedMin} min` : `about ${Math.floor(estimatedMin / 60)}h ${estimatedMin % 60}m`;

  return (
    <div className="am" role="dialog" aria-modal="true" aria-labelledby="am-title">
      <div className="fs-scrim" onClick={onClose} />
      <div className="am-card">
        <div className="am-head">
          <div className="am-head-main">
            <p className="hm-k">Analyze</p>
            <h2 id="am-title" className="am-title">
              {vodTitle}
            </h2>
            <p className="am-meta">{formatDuration(durationSeconds)}</p>
          </div>
          <button type="button" className="fs-close am-close" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {sealedOffer ? (
          <div className="am-sealed">
            <p className="am-sealed-k">
              <Lock size={12} strokeWidth={2.2} aria-hidden="true" /> Sealed until Monday
            </p>
            <p className="am-sealed-title">You&apos;ve used both free reports this week.</p>
            <p className="am-sealed-sub">
              We can still analyze this one. It comes back sealed and unlocks Monday when your free reports reset.
              Pro opens it the moment it&apos;s done.
            </p>
            {error && <p className="am-error">{error}</p>}
            <div className="am-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  onClose();
                  onUpgrade("Pro opens every report the moment it's done, with 15 reports a month.");
                }}
              >
                Go Pro
              </button>
              <button type="button" className="btn btn-blue" disabled={analyzing} onClick={() => start(true)}>
                {analyzing ? "Starting..." : "Analyze it sealed"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="am-label">What to analyze</p>
            <div className="am-presets" data-disabled={tooLongForFree ? "yes" : undefined}>
              <Preset label="Full stream" sub={formatDuration(durationSeconds)} active={preset === "full"} onClick={() => setPreset("full")} />
              {hasHour && (
                <Preset label="First hour" sub={formatDuration(Math.min(3600, durationSeconds))} active={preset === "first_hour"} onClick={() => setPreset("first_hour")} />
              )}
              {hasHour && (
                <Preset label="Last hour" sub={formatDuration(Math.min(3600, durationSeconds))} active={preset === "last_hour"} onClick={() => setPreset("last_hour")} />
              )}
              <Preset label="Custom range" sub="Pick a section" active={preset === "custom"} onClick={() => setPreset("custom")} />
            </div>

            {preset === "custom" && (
              <div className="am-range">
                <TimeField label="Start" value={customStart} onChange={setCustomStart} placeholder="0:00" />
                <span>to</span>
                <TimeField label="End" value={customEnd} onChange={setCustomEnd} placeholder={toTimeString(durationSeconds)} />
              </div>
            )}

            <div className="am-summary">
              <div>
                <p className="hm-k">Range</p>
                <p className="am-summary-v">
                  {isFull ? "Full stream" : `${toTimeString(startSeconds)} to ${toTimeString(endSeconds)}`}
                  {!isFull && <span> ({formatDuration(rangeSeconds)})</span>}
                </p>
              </div>
              <div className="am-summary-r">
                <p className="hm-k">Takes</p>
                <p className="am-summary-v">{estimateLabel}</p>
              </div>
            </div>
            {!isFull && durationSeconds > 3600 && (
              <p className="am-note">We transcribe the whole stream, then coach only the part you picked.</p>
            )}
            {isFull && durationSeconds >= 14400 && !tooLongForFree && (
              <p className="am-note">Long stream, so it runs in the background. You can close this page.</p>
            )}
            {tooLongForFree && <p className="am-note am-note-bad">Free analyzes streams up to 4 hours. Pro goes up to 8.</p>}

            {(validationError || error) && <p className="am-error">{validationError || error}</p>}

            <div className="am-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              {tooLongForFree ? (
                <button
                  type="button"
                  className="btn btn-blue"
                  onClick={() => {
                    onClose();
                    onUpgrade("Pro analyzes streams up to 8 hours long.");
                  }}
                >
                  Go Pro
                </button>
              ) : (
                <button type="button" className="btn btn-blue" onClick={() => start()} disabled={analyzing || !!validationError}>
                  {analyzing ? "Starting..." : "Analyze"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Preset({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="am-preset" data-active={active ? "yes" : undefined} onClick={onClick}>
      <b>{label}</b>
      <span>{sub}</span>
    </button>
  );
}

function TimeField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="am-time">
      <span>{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
