"use client";

import { useState } from "react";
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

function estimateMinutes(durationSecs: number, rangeSecs: number): number {
  const transcribeMin = Math.max(5, Math.ceil(durationSecs / 180));
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

  const estimateLabel =
    estimatedMin < 60
      ? `~${estimatedMin} min`
      : `~${Math.floor(estimatedMin / 60)}h ${estimatedMin % 60}m`;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0C111C",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ minWidth: 0, paddingRight: 16 }}>
            <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 8 }}>
              Analyze Stream
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#ECF1FA", margin: 0, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {vodTitle}
            </h2>
            <div style={{ fontSize: 12, color: "#6F7C95", marginTop: 6, fontFamily: "monospace" }}>
              {formatDuration(durationSeconds)} stream
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#6F7C95", fontSize: 20, cursor: "pointer", padding: "0 0 0 16px", lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0 22px" }} />

        {/* Preset section */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#ECF1FA", marginBottom: 10 }}>
          What to analyze
        </div>
        <div style={{ display: "grid", gridTemplateColumns: hasHour ? "1fr 1fr" : "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <PresetCard
            label="Full Stream"
            sub={formatDuration(durationSeconds)}
            active={preset === "full"}
            onClick={() => setPreset("full")}
          />
          {hasHour && (
            <PresetCard
              label="First Hour"
              sub={formatDuration(Math.min(3600, durationSeconds))}
              active={preset === "first_hour"}
              onClick={() => setPreset("first_hour")}
            />
          )}
          {hasHour && (
            <PresetCard
              label="Last Hour"
              sub={formatDuration(Math.min(3600, durationSeconds))}
              active={preset === "last_hour"}
              onClick={() => setPreset("last_hour")}
            />
          )}
          <PresetCard
            label="Custom Range"
            sub="Pick a section"
            active={preset === "custom"}
            onClick={() => setPreset("custom")}
          />
        </div>

        {preset === "custom" && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 18 }}>
            <TimeField label="Start" value={customStart} onChange={setCustomStart} placeholder="0:00" />
            <span style={{ fontSize: 12, color: "#6F7C95", paddingBottom: 11 }}>to</span>
            <TimeField label="End" value={customEnd} onChange={setCustomEnd} placeholder={toTimeString(durationSeconds)} />
          </div>
        )}

        {/* Summary card */}
        <div style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "rgba(34,211,238,0.04)",
          border: "1px solid rgba(34,211,238,0.18)",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 4 }}>
                Range
              </div>
              <div style={{ fontSize: 13, color: "#ECF1FA", fontFamily: "monospace" }}>
                {isFull
                  ? "Full stream"
                  : `${toTimeString(startSeconds)} → ${toTimeString(endSeconds)}`}
                {!isFull && (
                  <span style={{ color: "#6F7C95", marginLeft: 8 }}>
                    ({formatDuration(rangeSeconds)})
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 4 }}>
                Time
              </div>
              <div style={{ fontSize: 13, color: "#22D3EE", fontFamily: "monospace", fontWeight: 700 }}>
                {estimateLabel}
              </div>
            </div>
          </div>
          {!isFull && durationSeconds > 3600 && (
            <div style={{ fontSize: 11, color: "#6F7C95", marginTop: 8, lineHeight: 1.5 }}>
              We transcribe the full stream first, then run coaching analysis on your selected section only.
            </div>
          )}
        </div>

        {/* What you'll get — anchors the Analyze CTA */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {["Coach Report", "Score / 100", "Clip Moments", "Word-Synced Captions"].map((tag) => (
            <span key={tag} style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)", color: "#A6B3C9",
            }}>
              {tag}
            </span>
          ))}
        </div>

        {(validationError || error) && (
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
            marginBottom: 14, fontSize: 12, color: "#F87171",
          }}>
            {validationError || error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
              color: "#A6B3C9", fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !!validationError}
            style={{
              padding: "10px 22px", borderRadius: 8, border: "none",
              background: "#22D3EE", color: "#001318", fontSize: 13, fontWeight: 700,
              cursor: analyzing || validationError ? "not-allowed" : "pointer",
              opacity: analyzing || validationError ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            {analyzing ? "Starting…" : "Analyze Stream"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PresetCard({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 10,
        border: active ? "1px solid rgba(34,211,238,0.55)" : "1px solid rgba(255,255,255,0.1)",
        background: active ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        transition: "border-color 150ms, background 150ms",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: active ? "#22D3EE" : "#ECF1FA", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#6F7C95", fontFamily: "monospace" }}>
        {sub}
      </div>
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
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 6, display: "block" }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "9px 12px",
          fontSize: 13,
          fontFamily: "monospace",
          color: "#ECF1FA",
          outline: "none",
        }}
      />
    </div>
  );
}
