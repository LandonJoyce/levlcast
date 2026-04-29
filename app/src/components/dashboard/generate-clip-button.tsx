"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "./upgrade-modal";

type CaptionStyle = "bold" | "boxed" | "minimal";

const STYLES: {
  value: CaptionStyle;
  label: string;
  preview: React.CSSProperties;
  wrapStyle?: React.CSSProperties;
}[] = [
  {
    value: "bold",
    label: "Bold",
    preview: {
      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 900,
      color: "#ffffff",
      textTransform: "uppercase",
      letterSpacing: ".04em",
      textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
      lineHeight: 1.2,
    },
  },
  {
    value: "boxed",
    label: "Boxed",
    preview: {
      fontFamily: "inherit",
      fontSize: 12,
      fontWeight: 700,
      color: "#ffffff",
      background: "rgba(0,0,0,0.6)",
      padding: "3px 8px",
      borderRadius: 4,
      lineHeight: 1.3,
    },
  },
  {
    value: "minimal",
    label: "Minimal",
    preview: {
      fontFamily: "inherit",
      fontSize: 11,
      fontWeight: 500,
      color: "rgba(255,255,255,0.9)",
      textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
      lineHeight: 1.3,
    },
  },
];

export function GenerateClipButton({
  vodId,
  peakIndex,
  hasProcessing,
}: {
  vodId: string;
  peakIndex: number;
  hasProcessing?: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [style, setStyle] = useState<CaptionStyle>("bold");
  const router = useRouter();

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId, peakIndex, captionStyle: style }),
      });
      const json = await res.json();
      if (res.status === 403 && json.upgrade) {
        setUpgradeReason(json.message ?? "Upgrade to Pro to continue.");
        setUpgradeOpen(true);
        return;
      }
      if (!res.ok) { setError(json.error || "Failed"); return; }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  if (done) {
    return <span className="chip" style={{ width: "100%", justifyContent: "center", color: "var(--blue)" }}>Queued — generating…</span>;
  }

  if (hasProcessing && !generating) {
    return <span className="chip" style={{ width: "100%", justifyContent: "center", opacity: 0.5 }}>Wait for current clip</span>;
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Caption style visual picker */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {STYLES.map((s) => {
            const selected = style === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                style={{
                  background: selected ? "color-mix(in oklab, var(--blue) 10%, var(--surface))" : "var(--surface-2)",
                  border: selected ? "1.5px solid color-mix(in oklab, var(--blue) 50%, transparent)" : "1.5px solid var(--line)",
                  borderRadius: 8,
                  padding: 0,
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s",
                }}
              >
                {/* Preview area */}
                <div style={{
                  background: "#111",
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                }}>
                  <span style={s.preview}>Caption</span>
                </div>
                {/* Label */}
                <div style={{
                  padding: "5px 0",
                  fontSize: 10,
                  fontWeight: selected ? 700 : 500,
                  color: selected ? "var(--blue)" : "var(--ink-3)",
                  letterSpacing: ".04em",
                  textAlign: "center",
                }}>
                  {s.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-blue"
          style={{ width: "100%", justifyContent: "center", fontSize: 12, opacity: generating ? 0.6 : 1 }}
        >
          {generating ? "Queuing…" : "Generate Clip"}
        </button>
      </div>

      {error && <span className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, display: "block" }}>{error}</span>}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
