"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "./upgrade-modal";

type CaptionStyle = "bold" | "boxed" | "minimal";

const STYLES: { value: CaptionStyle; label: string; desc: string }[] = [
  { value: "bold", label: "Bold", desc: "Big white text, black stroke" },
  { value: "boxed", label: "Boxed", desc: "White text on dark pill" },
  { value: "minimal", label: "Minimal", desc: "Small, clean, lower-case" },
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
  const [showStyles, setShowStyles] = useState(false);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-blue"
            style={{ flex: 1, padding: "7px 0", fontSize: 12, justifyContent: "center", opacity: generating ? 0.6 : 1 }}
          >
            {generating ? "Queuing…" : "Generate Clip"}
          </button>
          <button
            onClick={() => setShowStyles((v) => !v)}
            title="Caption style"
            style={{
              background: showStyles ? "color-mix(in oklab, var(--blue) 15%, var(--surface-2))" : "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "7px 9px",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), monospace",
              color: "var(--ink-2)",
              cursor: "pointer",
              letterSpacing: ".04em",
              flexShrink: 0,
            }}
          >
            {style === "bold" ? "Aa" : style === "boxed" ? "[A]" : "a"}
          </button>
        </div>

        {showStyles && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
            <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: ".05em", marginBottom: 2 }}>CAPTION STYLE</span>
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => { setStyle(s.value); setShowStyles(false); }}
                style={{
                  background: style === s.value ? "color-mix(in oklab, var(--blue) 12%, var(--surface))" : "none",
                  border: style === s.value ? "1px solid color-mix(in oklab, var(--blue) 35%, var(--line))" : "1px solid transparent",
                  borderRadius: 6,
                  padding: "6px 8px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: style === s.value ? "var(--blue)" : "var(--ink)" }}>{s.label}</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <span className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, display: "block" }}>{error}</span>}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
