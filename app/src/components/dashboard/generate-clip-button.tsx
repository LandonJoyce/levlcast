"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "./upgrade-modal";
import type { CaptionStyle } from "@/lib/captions";

const STYLES: {
  value: CaptionStyle;
  label: string;
  tag?: string;
  bg: string;
  render: () => React.ReactNode;
}[] = [
  {
    value: "bold",
    label: "Bold",
    tag: "Popular",
    bg: "#0e0e0e",
    render: () => (
      <span style={{
        fontWeight: 900, fontSize: 17, color: "#fff", textTransform: "uppercase",
        textShadow: "-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000",
        letterSpacing: ".03em", lineHeight: 1.1,
      }}>CAPTION</span>
    ),
  },
  {
    value: "classic",
    label: "Classic",
    bg: "#0e0e0e",
    render: () => (
      <span style={{
        fontWeight: 900, fontSize: 17, color: "#FFE600", textTransform: "uppercase",
        textShadow: "-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000",
        letterSpacing: ".03em",
      }}>CAPTION</span>
    ),
  },
  {
    value: "fire",
    label: "Fire",
    bg: "#0e0e0e",
    render: () => (
      <span style={{
        fontWeight: 900, fontSize: 17, color: "#FF6B00", textTransform: "uppercase",
        textShadow: "-3px -3px 0 #1A0000,3px -3px 0 #1A0000,-3px 3px 0 #1A0000,3px 3px 0 #1A0000,0 0 12px rgba(255,107,0,0.4)",
        letterSpacing: ".03em",
      }}>CAPTION</span>
    ),
  },
  {
    value: "neon",
    label: "Neon",
    bg: "#050f11",
    render: () => (
      <span style={{
        fontWeight: 900, fontSize: 17, color: "#00EEFF", textTransform: "uppercase",
        textShadow: "-2px -2px 0 #003344,2px -2px 0 #003344,-2px 2px 0 #003344,2px 2px 0 #003344,0 0 14px rgba(0,238,255,0.45)",
        letterSpacing: ".03em",
      }}>CAPTION</span>
    ),
  },
  {
    value: "impact",
    label: "Impact",
    bg: "#0e0e0e",
    render: () => (
      <span style={{
        fontWeight: 900, fontSize: 21, color: "#fff", textTransform: "uppercase",
        textShadow: "-4px -4px 0 #000,4px -4px 0 #000,-4px 4px 0 #000,4px 4px 0 #000",
        letterSpacing: "-.01em", lineHeight: 1,
      }}>CAPTION</span>
    ),
  },
  {
    value: "boxed",
    label: "Boxed",
    bg: "#0e0e0e",
    render: () => (
      <span style={{
        fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase",
        background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 5,
        letterSpacing: ".02em",
      }}>CAPTION</span>
    ),
  },
  {
    value: "minimal",
    label: "Minimal",
    bg: "#0e0e0e",
    render: () => (
      <span style={{
        fontWeight: 500, fontSize: 13, color: "rgba(255,255,255,0.92)",
        textShadow: "-1px -1px 0 rgba(0,0,0,0.8),1px 1px 0 rgba(0,0,0,0.8)",
      }}>Caption text</span>
    ),
  },
];

export function GenerateClipButton({
  vodId,
  peakIndex,
  hasProcessing,
  clipTitle,
}: {
  vodId: string;
  peakIndex: number;
  hasProcessing?: boolean;
  clipTitle?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [style, setStyle] = useState<CaptionStyle>("bold");
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setModalOpen(false);
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

  const selectedStyle = STYLES.find((s) => s.value === style) ?? STYLES[0];

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        disabled={generating}
        className="btn btn-blue"
        style={{ width: "100%", justifyContent: "center", fontSize: 12, opacity: generating ? 0.6 : 1 }}
      >
        {generating ? "Queuing…" : "Generate Clip"}
      </button>

      {error && <span className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, display: "block" }}>{error}</span>}

      {/* Style picker modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div style={{
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 16, width: "100%", maxWidth: 480,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase", fontFamily: "var(--font-geist-mono), monospace" }}>Caption Style</p>
                {clipTitle && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-2)", fontWeight: 500 }}>{clipTitle}</p>}
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {/* Style grid */}
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {STYLES.map((s) => {
                const selected = style === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    style={{
                      background: selected ? "color-mix(in oklab, var(--blue) 10%, var(--surface-2))" : "var(--surface-2)",
                      border: selected ? "2px solid var(--blue)" : "2px solid var(--line)",
                      borderRadius: 10,
                      padding: 0,
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      transition: "border-color 0.12s",
                    }}
                  >
                    {s.tag && (
                      <span style={{
                        position: "absolute", top: 5, right: 5, zIndex: 1,
                        fontSize: 8, fontWeight: 700, letterSpacing: ".06em",
                        color: "#fff", background: "var(--blue)",
                        padding: "2px 5px", borderRadius: 4,
                        textTransform: "uppercase",
                      }}>{s.tag}</span>
                    )}
                    {/* Preview */}
                    <div style={{
                      background: s.bg,
                      height: 60,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 8px", textAlign: "center",
                    }}>
                      {s.render()}
                    </div>
                    {/* Label */}
                    <div style={{
                      padding: "6px 4px",
                      fontSize: 10, fontWeight: selected ? 700 : 500,
                      color: selected ? "var(--blue)" : "var(--ink-3)",
                      letterSpacing: ".04em", textAlign: "center",
                      background: "var(--surface-2)",
                    }}>
                      {s.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected preview + Generate */}
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                background: "#111", borderRadius: 10, height: 56,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid var(--line)",
              }}>
                {selectedStyle.render()}
              </div>
              <button
                onClick={handleGenerate}
                className="btn btn-blue"
                style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "11px 0" }}
              >
                Generate with {selectedStyle.label}
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
